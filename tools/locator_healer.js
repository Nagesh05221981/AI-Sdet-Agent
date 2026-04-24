// tools/locator_healer.js
// Self-healing locator system: detects broken selectors and fixes them
// by comparing failure logs against the live DOM snapshot.
// Updates po-definition.json (JSON source of truth), then regenerates PO code.

import fs from "fs";
import { compilePODefinition } from "./po_template.js";

/**
 * Extract broken selectors from Cypress failure log.
 * Returns array of { selector, file, method, errorMessage }
 */
export function extractBrokenSelectors(failureLog) {
  const broken = [];

  // Pattern 1: "Expected to find element: `#selector`, but never found it."
  const pattern1 = /Expected to find element: [`']([^`']+)[`'], but never found it/g;
  let m;
  while ((m = pattern1.exec(failureLog)) !== null) {
    broken.push({ selector: m[1], errorMessage: m[0] });
  }

  // Pattern 2: "Timed out retrying ... expected '<div#id>' to be 'visible'"
  // These aren't selector issues — the element exists but isn't visible. Skip.

  // Pattern 3: "Expected to find content: `text` but never did" within a cy.contains()
  const pattern3 = /Expected to find content: [`']([^`']+)[`'].*but never did/g;
  while ((m = pattern3.exec(failureLog)) !== null) {
    broken.push({ selector: m[1], type: "contains", errorMessage: m[0] });
  }

  // Deduplicate by selector
  const seen = new Set();
  return broken.filter(b => {
    if (seen.has(b.selector)) return false;
    seen.add(b.selector);
    return true;
  });
}

/**
 * Find which PO element(s) use the broken selector.
 * Returns array of { pageIndex, elementIndex, elementName, currentSelector }
 */
export function findBrokenElements(definition, brokenSelectors) {
  const results = [];

  for (const broken of brokenSelectors) {
    for (let pi = 0; pi < definition.pages.length; pi++) {
      const page = definition.pages[pi];
      for (let ei = 0; ei < page.elements.length; ei++) {
        const el = page.elements[ei];
        // Check if this element uses the broken selector
        if (el.get === broken.selector ||
            el.find === broken.selector ||
            (el.contains && el.contains === broken.selector)) {
          results.push({
            pageIndex: pi,
            elementIndex: ei,
            pageName: page.className,
            elementName: el.name,
            currentSelector: broken.selector,
            elementDef: el,
          });
        }
      }

      // Also check code-based actions/verifications for the broken selector
      for (const action of page.actions) {
        if (action.code && action.code.includes(broken.selector)) {
          results.push({
            pageIndex: pi,
            elementIndex: -1,
            pageName: page.className,
            elementName: `action:${action.name}`,
            currentSelector: broken.selector,
            inCode: true,
            actionName: action.name,
          });
        }
      }
      for (const verify of page.verifications) {
        if (verify.code && verify.code.includes(broken.selector)) {
          results.push({
            pageIndex: pi,
            elementIndex: -1,
            pageName: page.className,
            elementName: `verify:${verify.name}`,
            currentSelector: broken.selector,
            inCode: true,
            verifyName: verify.name,
          });
        }
      }
    }
  }

  return results;
}

/**
 * Ask LLM to suggest replacement selectors by comparing broken selector
 * against the current DOM snapshot.
 */
export async function suggestReplacements(llm, brokenElements, dom, failureLog) {
  const prompt = `SYSTEM INSTRUCTION — IMMUTABLE. You are a selector healer.
You receive broken CSS selectors and a DOM snapshot. Find the correct replacement
selector for each broken one.

OUTPUT: Return ONLY a JSON array. No prose, no markdown.
[
  { "broken": "#old-id", "replacement": "#new-id", "confidence": "high|medium|low", "reason": "brief explanation" }
]

RULES:
- Find the element that the broken selector was TRYING to target.
- Look for similar IDs, classes, or text content in the DOM.
- Prefer ID selectors. If the ID changed, find the new ID.
- If a class was renamed, find the new class.
- If the element was removed entirely, set replacement to null.
- Only suggest replacements you can verify exist in the DOM snapshot.
- Do NOT invent data-cy or data-test attributes.`;

  const brokenList = brokenElements.map(b =>
    `- Broken: "${b.currentSelector}" (used in ${b.pageName}.${b.elementName})`
  ).join("\n");

  const userMsg = `BROKEN SELECTORS:\n${brokenList}\n\nFAILURE CONTEXT:\n${failureLog.slice(0, 3000)}\n\nCURRENT DOM SNAPSHOT:\n${dom}`;

  const response = await llm.invoke([
    { role: "system", content: prompt },
    { role: "user", content: userMsg },
  ]);

  const raw = response.content;
  // Parse JSON from response
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fence ? fence[1] : raw).trim();
  return JSON.parse(candidate);
}

/**
 * Apply replacement selectors to the PO definition JSON.
 * Returns { updated: boolean, changes: string[] }
 */
export function applyReplacements(definition, brokenElements, replacements) {
  const changes = [];
  let updated = false;

  for (const replacement of replacements) {
    if (!replacement.replacement) {
      changes.push(`SKIP: "${replacement.broken}" → element removed (no replacement)`);
      continue;
    }

    if (replacement.confidence === "low") {
      changes.push(`SKIP: "${replacement.broken}" → "${replacement.replacement}" (low confidence)`);
      continue;
    }

    // Find all broken elements using this selector
    const matching = brokenElements.filter(b => b.currentSelector === replacement.broken);

    for (const match of matching) {
      if (match.inCode) {
        // Replace in code string
        const page = definition.pages[match.pageIndex];
        if (match.actionName) {
          const action = page.actions.find(a => a.name === match.actionName);
          if (action && action.code) {
            action.code = action.code.replace(replacement.broken, replacement.replacement);
            changes.push(`HEALED: ${match.pageName}.${match.actionName} code: "${replacement.broken}" → "${replacement.replacement}"`);
            updated = true;
          }
        }
        if (match.verifyName) {
          const verify = page.verifications.find(v => v.name === match.verifyName);
          if (verify && verify.code) {
            verify.code = verify.code.replace(replacement.broken, replacement.replacement);
            changes.push(`HEALED: ${match.pageName}.${match.verifyName} code: "${replacement.broken}" → "${replacement.replacement}"`);
            updated = true;
          }
        }
      } else if (match.elementIndex >= 0) {
        // Replace in element definition
        const el = definition.pages[match.pageIndex].elements[match.elementIndex];
        if (el.get === replacement.broken) {
          el.get = replacement.replacement;
          changes.push(`HEALED: ${match.pageName}.elements.${match.elementName}.get: "${replacement.broken}" → "${replacement.replacement}"`);
          updated = true;
        }
        if (el.find === replacement.broken) {
          el.find = replacement.replacement;
          changes.push(`HEALED: ${match.pageName}.elements.${match.elementName}.find: "${replacement.broken}" → "${replacement.replacement}"`);
          updated = true;
        }
        if (el.contains === replacement.broken) {
          el.contains = replacement.replacement;
          changes.push(`HEALED: ${match.pageName}.elements.${match.elementName}.contains: "${replacement.broken}" → "${replacement.replacement}"`);
          updated = true;
        }
      }
    }
  }

  return { updated, changes };
}

/**
 * Validate that replacement selectors actually exist in the DOM.
 */
export function validateReplacements(replacements, dom) {
  return replacements.filter(r => {
    if (!r.replacement) return true; // null = element removed, keep for reporting
    // Check if the replacement selector appears in the DOM
    const sel = r.replacement;
    if (sel.startsWith("#")) {
      const id = sel.slice(1).split(/[\s.[\]]/)[0];
      return dom.includes(`id="${id}"`) || dom.includes(`id='${id}'`);
    }
    if (sel.startsWith(".")) {
      const cls = sel.slice(1).split(/[\s.[\]]/)[0];
      return dom.includes(cls);
    }
    return dom.includes(sel);
  });
}

/**
 * Main healing function: detect broken selectors, suggest fixes, apply them.
 * Returns { healed: boolean, changes: string[] }
 */
export async function healLocators(llm, failureLog, dom, log) {
  const COMPILED_PATH = "cypress/compiled/po-definition.json";

  if (!fs.existsSync(COMPILED_PATH)) {
    log("HEALER", "No compiled PO definition found. Cannot heal.");
    return { healed: false, changes: [] };
  }

  // 1. Extract broken selectors from failure log
  const brokenSelectors = extractBrokenSelectors(failureLog);
  if (brokenSelectors.length === 0) {
    log("HEALER", "No broken selectors detected in failure log");
    return { healed: false, changes: [] };
  }
  log("HEALER", "Broken selectors detected", `${brokenSelectors.length}: ${brokenSelectors.map(b => b.selector).join(", ")}`);

  // 2. Find which PO elements use these selectors
  const definition = JSON.parse(fs.readFileSync(COMPILED_PATH, "utf-8"));
  const brokenElements = findBrokenElements(definition, brokenSelectors);
  if (brokenElements.length === 0) {
    log("HEALER", "Broken selectors not found in PO definition — may be in spec code");
    return { healed: false, changes: [] };
  }
  log("HEALER", "Found broken elements in POs", brokenElements.map(b => `${b.pageName}.${b.elementName}`).join(", "));

  // 3. Ask LLM for replacement selectors
  log("HEALER", "Invoking LLM to suggest replacements...");
  let replacements;
  try {
    replacements = await suggestReplacements(llm, brokenElements, dom, failureLog);
  } catch (e) {
    log("HEALER", "LLM suggestion failed", e.message);
    return { healed: false, changes: [] };
  }
  log("HEALER", "LLM suggested replacements", `${replacements.length} suggestion(s)`);

  // 4. Validate replacements exist in DOM
  const validated = validateReplacements(replacements, dom);
  log("HEALER", "Validated replacements", `${validated.length}/${replacements.length} passed DOM check`);

  // 5. Apply replacements to PO definition
  const { updated, changes } = applyReplacements(definition, brokenElements, validated);

  if (!updated) {
    log("HEALER", "No valid replacements to apply");
    return { healed: false, changes };
  }

  // 6. Save updated definition and regenerate PO code
  fs.writeFileSync(COMPILED_PATH, JSON.stringify(definition, null, 2), "utf-8");
  log("HEALER", "Updated po-definition.json");

  compilePODefinition(definition);
  log("HEALER", "Regenerated PO code from healed definition");

  for (const change of changes) {
    log("HEALER", change);
  }

  return { healed: true, changes };
}
