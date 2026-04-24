// tools/page_object_index.js
// Scans cypress/support/pages/ for existing Page Objects and produces a
// short, prompt-ready summary so the codegen agent reuses them instead of
// regenerating (and overwriting) them every time a new story runs.
//
// Heuristic extraction — good enough for the simple POM style our prompt
// enforces (ES6 class, default export, methods on the class body).
//
// Output shape (string):
//
//   Existing Page Objects (REUSE — do NOT redefine these files):
//   - ShopPage   (cypress/support/pages/ShopPage.js)
//       methods: search, filterBy, addProductByName
//   - AuthModal  (cypress/support/pages/AuthModal.js)
//       methods: switchToSignup, signup, login

import fs from "fs";
import path from "path";

const PAGES_DIR = "cypress/support/pages";

// Lines we don't want to surface as "methods".
const SKIP_NAMES = new Set([
  "constructor",
  "if",
  "for",
  "while",
  "switch",
  "return",
  "function",
  "get",
  "set",
]);

function extractMethods(source) {
  const methods = [];
  const seen = new Set();
  const push = (name) => {
    if (!name || SKIP_NAMES.has(name) || seen.has(name)) return;
    seen.add(name);
    methods.push(name);
  };

  // 1. Plain methods:  foo() { ... }   async bar(arg) { ... }
  const reMethod = /^\s*(?:async\s+)?([a-zA-Z_][\w$]*)\s*\([^)]*\)\s*\{/gm;
  let m;
  while ((m = reMethod.exec(source)) !== null) push(m[1]);

  // 2. Getter / setter accessors:  get foo() { ... }   set bar(v) { ... }
  const reAccessor = /^\s*(?:get|set)\s+([a-zA-Z_][\w$]*)\s*\(/gm;
  while ((m = reAccessor.exec(source)) !== null) push(m[1]);

  // 3. Elements object keys:  elementName: () => cy.get(...)
  const reElement = /^\s*([a-zA-Z_][\w$]*)\s*:\s*(?:\([^)]*\)\s*=>|\(\)\s*=>)/gm;
  while ((m = reElement.exec(source)) !== null) push(m[1]);

  return methods;
}

function extractClassName(source, fallback) {
  const m = source.match(/export\s+default\s+class\s+([A-Za-z_][\w$]*)/);
  return m ? m[1] : fallback;
}

export function listPageObjects(pagesDir = PAGES_DIR) {
  if (!fs.existsSync(pagesDir)) return [];
  return fs
    .readdirSync(pagesDir)
    .filter((f) => f.endsWith(".js"))
    .map((file) => {
      const rel = path.join(pagesDir, file);
      const source = fs.readFileSync(rel, "utf-8");
      const fallback = path.basename(file, ".js");
      return {
        file: rel,
        className: extractClassName(source, fallback),
        methods: extractMethods(source),
      };
    });
}

export function buildPageObjectIndexBlock(pagesDir = PAGES_DIR) {
  const pos = listPageObjects(pagesDir);
  if (pos.length === 0) {
    return "Existing Page Objects: (none yet — you may create new ones.)";
  }
  const lines = ["Existing Page Objects (REUSE — do NOT redefine these files):"];
  for (const po of pos) {
    lines.push(`- ${po.className}  (${po.file})`);
    if (po.methods.length) {
      lines.push(`    methods: ${po.methods.join(", ")}`);
    } else {
      lines.push(`    methods: (none detected — extend as needed)`);
    }
  }
  return lines.join("\n");
}
