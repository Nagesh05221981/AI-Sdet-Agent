// tools/validator.js
// Validates LLM-generated files before Cypress execution.
// All checks are deterministic (no LLM calls).

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
  const pos = files.filter(f => f.path.startsWith("cypress/support/pages/") && f.path.endsWith(".js"));

  for (const spec of specs) {
    // Find PO method calls: page.someMethod() or page.someGetter.
    const methodCallRe = /(?:page|authPage|shopPage|filterPage|signupPage)\.([\w]+)\s*\(/g;
    const getterRe = /(?:page|authPage|shopPage|filterPage|signupPage)\.([\w]+)\./g;

    const usedMembers = new Set();
    let m;
    while ((m = methodCallRe.exec(spec.content)) !== null) usedMembers.add(m[1]);
    while ((m = getterRe.exec(spec.content)) !== null) usedMembers.add(m[1]);

    // Also catch page.someGetter.should(...)
    const getterShouldRe = /(?:page|authPage|shopPage|filterPage|signupPage)\.([\w]+)\.should/g;
    while ((m = getterShouldRe.exec(spec.content)) !== null) usedMembers.add(m[1]);

    // Collect all members defined in POs
    const definedMembers = new Set();
    for (const po of pos) {
      // Getters: get foo() {
      const getterDefRe = /get\s+([\w]+)\s*\(\)/g;
      while ((m = getterDefRe.exec(po.content)) !== null) definedMembers.add(m[1]);
      // Methods: foo(...) {
      const methodDefRe = /^\s*([\w]+)\s*\([^)]*\)\s*\{/gm;
      while ((m = methodDefRe.exec(po.content)) !== null) {
        if (!["get", "set", "constructor", "if", "for", "while"].includes(m[1])) {
          definedMembers.add(m[1]);
        }
      }
    }

    // Check for missing members
    for (const member of usedMembers) {
      if (!definedMembers.has(member) && member !== "should" && member !== "then"
          && member !== "each" && member !== "first" && member !== "find"
          && member !== "contains" && member !== "invoke" && member !== "its") {
        errors.push(`${spec.path} — calls page.${member}() but no Page Object defines "${member}"`);
      }
    }
  }
}
