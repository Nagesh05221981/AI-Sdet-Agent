// tools/po_template.js
// Deterministic code generator: converts PO JSON definition → JavaScript files.
// The LLM decides WHAT (selectors, methods). This template decides HOW (code pattern).

import fs from "fs";
import path from "path";

/**
 * Generate a single element getter expression from a selector definition.
 */
function buildElementGetter(def) {
  if (def.param) {
    if (def.contains) {
      return `(param) => cy.get('${def.get}').contains('${def.contains}', param)`;
    }
    return `(param) => cy.contains('${def.get}', param)`;
  }
  let expr = `() => cy.get('${def.get}')`;
  if (def.find && def.find !== null) {
    expr = `() => cy.get('${def.get}').find('${def.find}')`;
  } else if (def.contains && def.contains !== null) {
    expr = `() => cy.get('${def.get}').contains('${def.contains}')`;
  }
  return expr;
}

/**
 * Generate action method code from an action definition.
 */
function buildElementCall(elementName, params) {
  // If this element takes a parameter, try to pass the matching method param
  // Elements like filterChip(param) need filterChip(category) when called from clickFilterButton(category)
  return `this.elements.${elementName}`;
}

function buildActionMethod(name, action, pageElements) {
  const params = action.params ? action.params.join(", ") : "";
  const methodParams = action.params || [];

  // Build set of parameterized element names
  const paramElements = new Set();
  if (pageElements) {
    for (const el of pageElements) {
      if (el.param) paramElements.add(el.name);
    }
  }

  const lines = [];
  lines.push(`    ${name}(${params}) {`);
  for (const step of action.steps) {
    const elBase = `this.elements.${step.element}`;
    const isParamElement = paramElements.has(step.element);

    if (step.do === "click") {
      // Only pass value to parameterized elements
      const elCall = isParamElement && step.value && methodParams.includes(step.value)
        ? `${elBase}(${step.value})` : `${elBase}()`;
      lines.push(`        ${elCall}.should('be.visible').click()`);
    } else if (step.do === "clear-type") {
      const val = step.value || "value";
      lines.push(`        ${elBase}().should('be.visible').clear().type(${val})`);
    } else if (step.do === "type") {
      const val = step.value || "value";
      lines.push(`        ${elBase}().should('be.visible').type(${val})`);
    }
  }
  lines.push(`    }`);
  return lines.join("\n");
}

/**
 * Generate verification method code from a verification definition.
 */
// Normalize Cypress assertion strings — LLM may use non-standard forms
function normalizeAssert(assert) {
  const MAP = {
    "visible": "be.visible",
    "hidden": "be.hidden",
    "disabled": "be.disabled",
    "enabled": "be.enabled",
    "empty": "be.empty",
    "checked": "be.checked",
    "selected": "be.selected",
    "focused": "be.focused",
    "not.visible": "not.be.visible",
    "not.hidden": "not.be.hidden",
    "not.disabled": "not.be.disabled",
    "not.empty": "not.be.empty",
    "contains": "not.be.empty",  // "contains" without value = not empty
    "contains.text": "contain.text",
    "contain": "contain.text",
    "has.class": "have.class",
    "has.text": "have.text",
    "has.value": "have.value",
    "have.length.greaterThan.0": "have.length.greaterThan",
  };
  return MAP[assert] || assert;
}

function buildVerifyMethod(name, verify, pageElements) {
  const params = verify.params ? verify.params.join(", ") : "";
  const methodParams = verify.params || [];
  const lines = [];
  lines.push(`    ${name}(${params}) {`);

  // Build set of parameterized element names
  const paramElements = new Set();
  if (pageElements) {
    for (const el of pageElements) {
      if (el.param) paramElements.add(el.name);
    }
  }

  for (const step of verify.steps) {
    const elBase = `this.elements.${step.element}`;
    const isParamElement = paramElements.has(step.element);

    // Handle LLM bug: action steps ("click") misplaced in verification
    if (step.assert === "click") {
      let elCall;
      if (isParamElement && methodParams.length > 0) {
        elCall = `${elBase}(${methodParams[0]})`;
      } else {
        elCall = `${elBase}()`;
      }
      lines.push(`        ${elCall}.should('be.visible').click()`);
      continue;
    }

    let assertion = normalizeAssert(step.assert);

    // If assertion needs a value but none provided, use a safe default
    if (!step.value && (assertion === "contain.text" || assertion === "contain" || assertion === "have.class" || assertion === "have.text")) {
      assertion = "not.be.empty";
    }

    // Build element call — pass first method param if element is parameterized
    let elCall;
    if (isParamElement && methodParams.length > 0) {
      // Parameterized element: pass the first method param as the element arg
      elCall = `${elBase}(${methodParams[0]})`;
    } else {
      elCall = `${elBase}()`;
    }

    if (step.value && assertion !== "not.be.empty") {
      const isParam = methodParams.includes(step.value);
      const val = isParam ? step.value : `'${step.value}'`;
      lines.push(`        ${elCall}.should('${assertion}', ${val})`);
    } else {
      lines.push(`        ${elCall}.should('${assertion}')`);
    }
  }
  lines.push(`    }`);
  return lines.join("\n");
}

/**
 * Generate a method using raw code (escape hatch for complex DOM traversal).
 */
function buildCodeMethod(name, method) {
  const params = method.params ? method.params.join(", ") : "";
  const lines = [];
  lines.push(`    ${name}(${params}) {`);
  // Split code into lines and indent
  const codeLines = method.code.split("\n").map(l => l.trim()).filter(l => l);
  for (const cl of codeLines) {
    lines.push(`        ${cl}`);
  }
  lines.push(`    }`);
  return lines.join("\n");
}

/**
 * Generate a complete Page Object .js file from a page definition.
 */
function generatePageObjectCode(page) {
  const lines = [];
  lines.push(`class ${page.className} {`);

  // Elements object (from array)
  lines.push(`    elements = {`);
  for (let i = 0; i < page.elements.length; i++) {
    const el = page.elements[i];
    const comma = i < page.elements.length - 1 ? "," : "";
    lines.push(`        ${el.name}: ${buildElementGetter(el)}${comma}`);
  }
  lines.push(`    }\n`);

  // Action methods (from array)
  for (const action of page.actions) {
    if (action.code) {
      lines.push(buildCodeMethod(action.name, action));
    } else {
      lines.push(buildActionMethod(action.name, action, page.elements));
    }
    lines.push("");
  }

  // Verification methods (from array)
  for (const verify of page.verifications) {
    if (verify.code) {
      lines.push(buildCodeMethod(verify.name, verify));
    } else {
      lines.push(buildVerifyMethod(verify.name, verify, page.elements));
    }
    lines.push("");
  }

  lines.push(`}`);
  lines.push("");
  lines.push(`export default ${page.className}`);
  lines.push("");

  return lines.join("\n");
}

/**
 * Generate BaseTest.js from the page definitions.
 */
function generateBaseTest(pages) {
  const lines = [];

  // Imports
  for (const page of pages) {
    const importPath = `../${page.file.replace("cypress/", "")}`;
    lines.push(`import ${page.className} from "${importPath}"`);
  }
  lines.push("");

  // Class
  lines.push(`export class BaseTest {`);
  for (const page of pages) {
    lines.push(`    ${page.property} = new ${page.className}()`);
  }
  lines.push(`    users = {}`);
  lines.push("");
  lines.push(`    constructor() {`);
  lines.push(`        before(() => {`);
  lines.push(`            cy.fixture('users').then((data) => {`);
  lines.push(`                this.users = data`);
  lines.push(`            })`);
  lines.push(`        })`);
  lines.push(`        beforeEach(() => {`);
  lines.push(`            cy.seedUser(this.users.validUser)`);
  lines.push(`            cy.visit('/eclat-shop.html')`);
  lines.push(`        })`);
  lines.push(`    }`);
  lines.push(`}`);
  lines.push("");

  return lines.join("\n");
}

/**
 * Build a PO catalog string for the spec generator prompt.
 * Lists test.<property> → methods available.
 */
export function buildPOCatalog(pages) {
  const lines = [
    "AVAILABLE PAGE OBJECTS — use EXACTLY these test.<property>.<method> calls:",
    "",
  ];
  for (const page of pages) {
    lines.push(`test.${page.property} → ${page.className}`);
    for (const a of page.actions) {
      const params = a.params.length ? `(${a.params.join(", ")})` : "()";
      lines.push(`  action: test.${page.property}.${a.name}${params}`);
    }
    for (const v of page.verifications) {
      const params = v.params.length ? `(${v.params.join(", ")})` : "()";
      lines.push(`  verify: test.${page.property}.${v.name}${params}`);
    }
    lines.push("");
  }
  lines.push("Test data: test.users.validUser (email, password, name), test.users.newUser (email, password, name)");
  lines.push("");
  lines.push("DO NOT use any method not listed above.");
  return lines.join("\n");
}

/**
 * Write all PO files, BaseTest, infrastructure from the PO definition JSON.
 * Returns the pages array for use by spec generator.
 */
export function compilePODefinition(definition) {
  const { pages } = definition;
  const written = [];

  // Write each Page Object
  for (const page of pages) {
    const code = generatePageObjectCode(page);
    const dir = path.dirname(page.file);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(page.file, code, "utf-8");
    written.push(page.file);
  }

  // Write BaseTest
  const baseTestCode = generateBaseTest(pages);
  fs.mkdirSync("cypress/base", { recursive: true });
  fs.writeFileSync("cypress/base/baseTest.js", baseTestCode, "utf-8");
  written.push("cypress/base/baseTest.js");

  // Write users.json fixture
  const usersFixture = JSON.stringify({
    validUser: { email: "test@example.com", password: "password123", name: "Test" },
    newUser: { email: "newuser@example.com", password: "password123", name: "New User" },
  }, null, 4);
  fs.mkdirSync("cypress/fixtures", { recursive: true });
  fs.writeFileSync("cypress/fixtures/users.json", usersFixture, "utf-8");
  written.push("cypress/fixtures/users.json");

  // Write commands.js (append seedUser if not present)
  const commandsPath = "cypress/support/commands.js";
  const seedCmd = `Cypress.Commands.add('seedUser', (user) => {\n    if (!user) return\n    const users = JSON.parse(localStorage.getItem('nova_users')) || {}\n    users[user.email] = { name: user.name, password: user.password }\n    localStorage.setItem('nova_users', JSON.stringify(users))\n})\n\nCypress.Commands.add('captureDom', (name = 'homepage') => {\n    cy.document({ log: false }).then((doc) => {\n        cy.writeFile(\n            \`cypress/dom-snapshots/\${name}.html\`,\n            doc.documentElement.outerHTML,\n            { log: false }\n        )\n    })\n})\n`;
  fs.writeFileSync(commandsPath, seedCmd, "utf-8");
  written.push(commandsPath);

  // Write e2e.js
  const e2eCode = `import './commands'\n\nafterEach(() => {\n    cy.window({ log: false }).then((win) => {\n        if (win && win.document) {\n            cy.captureDom('homepage')\n        }\n    })\n})\n`;
  fs.writeFileSync("cypress/support/e2e.js", e2eCode, "utf-8");
  written.push("cypress/support/e2e.js");

  // Save the definition JSON for future reference
  fs.mkdirSync("cypress/compiled", { recursive: true });
  fs.writeFileSync("cypress/compiled/po-definition.json", JSON.stringify(definition, null, 2), "utf-8");
  written.push("cypress/compiled/po-definition.json");

  return { pages, written };
}
