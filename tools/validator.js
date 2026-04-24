// tools/validator.js
// Validates LLM-generated files before Cypress execution.
// All checks are deterministic (no LLM calls).

import fs from "fs";

/**
 * Validate generated files against rules and DOM snapshot.
 * Returns { valid: boolean, errors: string[] }
 */
export function validateGeneratedFiles(files, dom) {
  const errors = [];

  // --- Structure checks ---
  if (!files || !Array.isArray(files) || files.length === 0) {
    errors.push("No files generated");
    return { valid: false, errors };
  }

  for (const file of files) {
    if (!file.path || typeof file.content !== "string") {
      errors.push(`Malformed file entry: missing path or content`);
      continue;
    }

    // Path safety: only allow cypress/ and nothing outside
    if (!file.path.startsWith("cypress/")) {
      errors.push(`Unsafe path: ${file.path} — must be under cypress/`);
    }

    // Generator should NOT output Page Object, BaseTest, commands, or fixture files
    if (file.path.startsWith("cypress/pages/") || file.path.includes("baseTest")
        || file.path.includes("commands.js") || file.path === "cypress/fixtures/users.json") {
      errors.push(`${file.path} — generator must NOT create Page Objects, BaseTest, commands, or users.json (they are pre-built)`);
    }

    // Spec file checks
    if (file.path.endsWith(".cy.js")) {
      validateSpec(file, errors);
    }

    // Page Object checks
    if (file.path.startsWith("cypress/support/pages/") && file.path.endsWith(".js")) {
      validatePageObject(file, dom, errors);
    }
  }

  // Cross-file checks: spec references PO methods that exist
  validateSpecPOAlignment(files, errors);

  return { valid: errors.length === 0, errors };
}

function validateSpec(file, errors) {
  const content = file.content;
  const lines = content.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const lineNum = i + 1;

    // Skip imports, comments, and describe/it/before/beforeEach declarations
    if (line.startsWith("import ") || line.startsWith("//") || line === ""
        || line.startsWith("describe(") || line.startsWith("it(")
        || line.startsWith("before(") || line.startsWith("beforeEach(")
        || line.startsWith("let ") || line.startsWith("const ")
        || line.startsWith("})") || line.startsWith("});")
        || line.startsWith("{") || line.startsWith("}")
        || line.startsWith("cy.fixture(") || line.startsWith("cy.visit(")
        || line.startsWith("cy.window(") || line.startsWith("cy.wrap(")
        || line.startsWith("w.localStorage")) {
      continue;
    }

    // Check for direct cy.get() in spec (should be in PO)
    if (/cy\.get\s*\(/.test(line)) {
      errors.push(`${file.path}:${lineNum} — cy.get() in spec file (should be in Page Object)`);
    }

    // Check for .click() chained in spec (should be PO action method)
    if (/\.click\s*\(/.test(line) && !line.includes("// ")) {
      errors.push(`${file.path}:${lineNum} — .click() in spec file (should be PO action method)`);
    }

    // Check for .type() chained in spec
    if (/\.type\s*\(/.test(line) && !line.includes("// ")) {
      errors.push(`${file.path}:${lineNum} — .type() in spec file (should be PO action method)`);
    }

    // Check for .submit() in spec
    if (/\.submit\s*\(/.test(line)) {
      errors.push(`${file.path}:${lineNum} — .submit() in spec (use PO action method with .msubmit button click)`);
    }
  }
}

function validatePageObject(file, dom, errors) {
  const content = file.content;

  // Check for cy.visit in PO (navigation belongs in spec)
  if (/cy\.visit\s*\(/.test(content)) {
    errors.push(`${file.path} — cy.visit() in Page Object (navigation belongs in spec)`);
  }

  // Check for cy.intercept in PO (no backend)
  if (/cy\.intercept\s*\(/.test(content)) {
    errors.push(`${file.path} — cy.intercept() used (app has no backend)`);
  }

  // Validate selectors against DOM if available
  if (dom) {
    validateSelectors(file, dom, errors);
  }
}

function validateSelectors(file, dom, errors) {
  const content = file.content;

  // Extract selectors from cy.get('...') and .find('...')
  const selectorRe = /(?:cy\.get|\.find)\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  let match;
  while ((match = selectorRe.exec(content)) !== null) {
    const selector = match[1];

    // Skip compound/pseudo selectors that are hard to validate statically
    if (selector.includes(":") || selector.includes(">") || selector.includes("+")) {
      continue;
    }

    // Check ID selectors
    if (selector.startsWith("#")) {
      const id = selector.slice(1).split(/[\s.[\]]/)[0]; // handle #id.class
      if (!dom.includes(`id="${id}"`) && !dom.includes(`id='${id}'`)) {
        errors.push(`${file.path} — selector "${selector}" not found in DOM (no element with id="${id}")`);
      }
    }
    // Check class selectors
    else if (selector.startsWith(".")) {
      const cls = selector.slice(1).split(/[\s.[\]]/)[0]; // first class name
      if (!dom.includes(`class="`) || !dom.includes(cls)) {
        // Looser check — class might appear in a compound class attribute
        if (!dom.includes(cls)) {
          errors.push(`${file.path} — selector "${selector}" not found in DOM (class "${cls}" absent)`);
        }
      }
    }
  }
}

function validateSpecPOAlignment(files, errors) {
  const specs = files.filter(f => f.path.endsWith(".cy.js"));

  // Valid BaseTest property names
  const VALID_PROPERTIES = new Set([
    "homePage", "loginPage", "signUpPage", "filterBars", "catalogue", "cart", "users",
  ]);

  // Read POs from disk and build a map: propertyName → Set of methods
  const poDir = "cypress/pages";
  const propertyToMethods = {};
  const classToProperty = {
    HomePage: "homePage", LoginPage: "loginPage", SignUpPage: "signUpPage",
    FilterBars: "filterBars", Catalogue: "catalogue", Cart: "cart", CartDrawer: "cart",
  };

  if (fs.existsSync(poDir)) {
    for (const f of fs.readdirSync(poDir).filter(f => f.endsWith(".js"))) {
      const content = fs.readFileSync(`${poDir}/${f}`, "utf-8");
      // Detect class name
      const classMatch = content.match(/class\s+(\w+)/);
      const className = classMatch ? classMatch[1] : f.replace(".js", "");
      const prop = classToProperty[className] || className.charAt(0).toLowerCase() + className.slice(1);

      const methods = new Set();
      let m;
      // Getters
      const getterRe = /get\s+([\w]+)\s*\(\)/g;
      while ((m = getterRe.exec(content)) !== null) methods.add(m[1]);
      // Methods
      const methodRe = /^\s*([\w]+)\s*\([^)]*\)\s*\{/gm;
      while ((m = methodRe.exec(content)) !== null) {
        if (!["get", "set", "constructor", "if", "for", "while", "class"].includes(m[1])) {
          methods.add(m[1]);
        }
      }
      // Elements
      const elemRe = /^\s*([\w]+)\s*:\s*(?:\([^)]*\)\s*=>|\(\)\s*=>)/gm;
      while ((m = elemRe.exec(content)) !== null) methods.add(m[1]);

      propertyToMethods[prop] = methods;
    }
  }

  for (const spec of specs) {
    // Check test.<property> usage — validate property names
    const propRe = /test\.([\w]+)\./g;
    let m;
    const usedProperties = new Set();
    while ((m = propRe.exec(spec.content)) !== null) usedProperties.add(m[1]);

    for (const prop of usedProperties) {
      if (!VALID_PROPERTIES.has(prop)) {
        errors.push(`${spec.path} — uses test.${prop} but BaseTest has no property "${prop}" (valid: ${[...VALID_PROPERTIES].join(", ")})`);
      }
    }

    // Check test.<property>.<method>() — validate method names
    const callRe = /test\.([\w]+)\.([\w]+)/g;
    while ((m = callRe.exec(spec.content)) !== null) {
      const [, prop, method] = m;
      if (prop === "users") continue; // test.users.validUser is data, not PO
      const methods = propertyToMethods[prop];
      if (methods && !methods.has(method)) {
        errors.push(`${spec.path} — calls test.${prop}.${method}() but ${prop} has no method "${method}" (available: ${[...methods].join(", ")})`);
      }
    }
  }
}
