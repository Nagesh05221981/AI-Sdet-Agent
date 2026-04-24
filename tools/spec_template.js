// tools/spec_template.js
// Deterministic code generator: converts spec JSON definition → Cypress spec file.

import fs from "fs";
import path from "path";

/**
 * Convert a step's call + args into JavaScript code.
 */
function buildStepCode(step) {
  // Strip trailing () if LLM included them — we add our own
  const call = step.call.replace(/\(\)$/, "");
  if (step.args && step.args.length > 0) {
    return `    ${call}(${step.args.join(", ")})`;
  }
  return `    ${call}()`;
}

/**
 * Generate a Cypress spec .js file from a spec definition.
 */
export function compileSpecDefinition(definition, slugOverride) {
  const { feature, tests } = definition;
  const spec = slugOverride || definition.spec;
  const lines = [];

  lines.push(`import { BaseTest } from "../base/baseTest"`);
  lines.push(`const test = new BaseTest()`);
  lines.push("");
  lines.push(`describe("${feature}", () => {`);

  for (const test_ of tests) {
    lines.push(`  it("${test_.id} ${test_.title}", () => {`);
    for (const step of test_.steps) {
      lines.push(buildStepCode(step));
    }
    lines.push(`  })`);
    lines.push("");
  }

  lines.push(`})`);
  lines.push("");

  const code = lines.join("\n");
  const filePath = `cypress/e2e/${spec}.cy.js`;
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, code, "utf-8");

  return { filePath, code };
}

/**
 * Validate spec definition against PO catalog.
 * Returns { valid: boolean, errors: string[] }
 */
export function validateSpecAgainstCatalog(specDef, pages) {
  const errors = [];

  // Build a map of valid calls from array-based definitions
  const validCalls = new Set();
  for (const page of pages) {
    for (const action of page.actions) {
      validCalls.add(`test.${page.property}.${action.name}`);
    }
    for (const verify of page.verifications) {
      validCalls.add(`test.${page.property}.${verify.name}`);
    }
  }

  for (const test of specDef.tests) {
    for (const step of test.steps) {
      // Strip trailing () if LLM included them
      const call = step.call.replace(/\(\)$/, "");
      if (!validCalls.has(call)) {
        errors.push(`${test.id}: calls ${step.call} but no Page Object defines this method. Available: ${[...validCalls].join(", ")}`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}
