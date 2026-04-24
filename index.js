import "dotenv/config";
import fs from "fs";
import path from "path";
import { awaitAllCallbacks } from "@langchain/core/callbacks/promises";
import { ChatOpenAI } from "@langchain/openai";
import { testDesignerAgent } from "./agents/test_designer.js";
import { runCypress } from "./tools/cypress_runner.js";
import { extractRelevantDom } from "./tools/dom_context_builder.js";
import { PO_DEFINITION_SCHEMA, SPEC_DEFINITION_SCHEMA } from "./tools/schemas.js";
import { compilePODefinition, buildPOCatalog } from "./tools/po_template.js";
import { compileSpecDefinition, validateSpecAgainstCatalog } from "./tools/spec_template.js";

// --- LangSmith flush --------------------------------------------------------
async function flushLangSmith() {
  try {
    await awaitAllCallbacks();
    console.log("LangSmith callbacks drained");
  } catch (e) { /* non-fatal */ }
}

// --- Log trail --------------------------------------------------------------
const LOG_FILE = "pipeline.log";
const _logLines = [];

function log(stage, action, detail = "") {
  const ts = new Date().toISOString().replace("T", " ").slice(0, 19);
  const line = `[${ts}] [${stage}] ${action}${detail ? " — " + detail : ""}`;
  _logLines.push(line);
  console.log(line);
}

function flushLogTrail() {
  fs.writeFileSync(LOG_FILE, _logLines.join("\n") + "\n", "utf-8");
}

// --- Config -----------------------------------------------------------------
const STORIES_DIR = "stories";
const DOM_SNAPSHOT_PATH = "cypress/dom-snapshots/homepage.html";
const TEST_CASES_DIR = "cypress/test-cases";
const COMPILED_DIR = "cypress/compiled";
const SPEC_GLOB = "cypress/e2e/**/*.cy.js";
const DOM_TRUNCATE_CHARS = 20000;

// --- LLM with structured output support ------------------------------------
const structuredLLM = new ChatOpenAI({
  model: "gpt-4o",
  temperature: 0,
  configuration: {
    baseURL: process.env.OPENAI_API_BASE,
    apiKey: process.env.OPENAI_API_KEY,
  },
});

// --- Helpers ----------------------------------------------------------------
function readDomSnapshotIfExists() {
  try {
    const raw = fs.readFileSync(DOM_SNAPSHOT_PATH, "utf-8");
    const dom = extractRelevantDom(raw);
    log("INIT", "DOM snapshot loaded", `raw=${raw.length}, cleaned=${dom.length} chars`);
    return dom;
  } catch (e) {
    if (e.code === "ENOENT") {
      log("INIT", "No DOM snapshot found", "first run will create it");
      return null;
    }
    throw e;
  }
}

function extractJson(raw) {
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  let candidate = (fence ? fence[1] : raw).trim();
  candidate = candidate.replace(/,\s*([}\]])/g, "$1");
  candidate = candidate.replace(/\\(?!["\\/bfnrtu])/g, "\\\\");
  try {
    return JSON.parse(candidate);
  } catch (firstErr) {
    const relaxed = candidate.replace(/\\(?!["\\/bfnrtu])/g, "");
    return JSON.parse(relaxed);
  }
}

function slugify(s) {
  return String(s || "feature")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "feature";
}

function classifyFailure(log) {
  if (!log) return "unknown";
  if (/could not verify that this server is running/i.test(log) || /ECONNREFUSED/i.test(log)) return "server_unreachable";
  if (/Timed out retrying/i.test(log)) return "timeout_issue";
  if (/Expected to find element/i.test(log)) return "selector_issue";
  if (/cy\.visit.*failed/i.test(log)) return "baseurl_issue";
  if (/AssertionError/i.test(log)) return "assertion_issue";
  if (/SyntaxError|ReferenceError|TypeError/i.test(log)) return "spec_error";
  return "unknown";
}

// --- Sanitize DOM for prompt injection protection ---------------------------
function sanitizeDom(dom) {
  // Strip any content that could act as prompt injection
  return dom
    .replace(/<!--[\s\S]*?-->/g, "")           // Remove HTML comments
    .replace(/data-prompt[^=]*="[^"]*"/gi, "")  // Remove suspicious data attributes
    .replace(/\{%[\s\S]*?%\}/g, "")             // Remove template tags
    .replace(/\{\{[\s\S]*?\}\}/g, "");           // Remove handlebars
}

// --- CLI flags --------------------------------------------------------------
const FORCE = process.argv.includes("--force");

// --- Story discovery --------------------------------------------------------
function listStoryFiles() {
  if (!fs.existsSync(STORIES_DIR)) return [];
  return fs.readdirSync(STORIES_DIR)
    .filter((f) => f.endsWith(".md"))
    .map((f) => ({ slug: f.replace(/\.md$/, ""), path: path.join(STORIES_DIR, f) }))
    .sort((a, b) => a.slug.localeCompare(b.slug));
}

function specExistsForSlug(slug) {
  return fs.existsSync(`cypress/e2e/${slug}.cy.js`);
}

function resolveStoriesToRun() {
  if (process.env.USER_STORY) {
    return [{ slug: slugify(process.env.USER_STORY).slice(0, 40) || "ad-hoc", text: process.env.USER_STORY, source: "USER_STORY env" }];
  }
  const slugArg = process.argv.slice(2).find((a) => !a.startsWith("-"));
  const all = listStoryFiles();
  if (slugArg) {
    const hit = all.find((s) => s.slug === slugArg);
    if (!hit) throw new Error(`No story file '${slugArg}.md' under ${STORIES_DIR}/`);
    return [{ slug: hit.slug, text: fs.readFileSync(hit.path, "utf-8").trim(), source: hit.path }];
  }
  if (all.length === 0) return [{ slug: "default", text: "User opens the Eclat shop and can see the product listing", source: "(built-in default)" }];
  return all.map((s) => ({ slug: s.slug, text: fs.readFileSync(s.path, "utf-8").trim(), source: s.path }));
}

// =============================================================================
// STAGE 0: Compile Page Objects from DOM (Compiled AI pattern)
// =============================================================================
async function compilePOs(dom) {
  const defPath = path.join(COMPILED_DIR, "po-definition.json");

  // If already compiled, skip
  if (fs.existsSync(defPath)) {
    const existing = JSON.parse(fs.readFileSync(defPath, "utf-8"));
    log("STAGE-0", "PO definition already compiled", `${existing.pages.length} pages, skipping LLM call`);
    // Still regenerate code from JSON (idempotent, ensures code matches JSON)
    const { pages, written } = compilePODefinition(existing);
    log("STAGE-0", "Code regenerated from compiled JSON", `${written.length} files`);
    return pages;
  }

  if (!dom) {
    log("STAGE-0", "No DOM snapshot — cannot compile POs");
    throw new Error("DOM snapshot required for Stage 0 compilation");
  }

  log("STAGE-0", "Compiling Page Objects from DOM snapshot");

  const prompt = fs.readFileSync("prompts/generate_page_objects.txt", "utf8");
  const safeDom = sanitizeDom(dom);

  log("STAGE-0", "Invoking LLM with structured output...");
  const response = await structuredLLM.invoke(
    [
      { role: "system", content: prompt },
      { role: "user", content: `DOM snapshot:\n\n${safeDom.slice(0, DOM_TRUNCATE_CHARS)}` },
    ],
    { response_format: { type: "json_schema", json_schema: PO_DEFINITION_SCHEMA } }
  );

  const raw = response.content;
  log("STAGE-0", "LLM responded", `${raw.length} chars`);

  let definition;
  try {
    definition = JSON.parse(raw);
  } catch (e) {
    definition = extractJson(raw);
  }

  if (!definition.pages || !Array.isArray(definition.pages)) {
    throw new Error("PO definition missing pages array");
  }

  log("STAGE-0", "PO definition parsed", `${definition.pages.length} pages: ${definition.pages.map(p => p.className).join(", ")}`);

  // Compile JSON → JavaScript files
  const { pages, written } = compilePODefinition(definition);
  log("STAGE-0", "Compiled to files", `${written.length} files: ${written.join(", ")}`);

  return pages;
}

// =============================================================================
// STAGE 1: Design test cases from story
// =============================================================================
async function designTestCases(slug, story, dom) {
  log("STAGE-1", "Designing test cases", `slug=${slug}`);

  const domBlock = dom ? `\n\nDOM snapshot (for reference):\n${dom.slice(0, 8000)}` : "";
  const userMsg = `User story:\n${story}${domBlock}`;

  log("STAGE-1", "Invoking designer agent...");
  const result = await testDesignerAgent.invoke({
    messages: [{ role: "user", content: userMsg }],
  });

  const raw = result.messages.at(-1).content;
  log("STAGE-1", "Designer responded", `${raw.length} chars`);

  const cases = extractJson(raw);
  if (!cases || !Array.isArray(cases.cases) || cases.cases.length === 0) {
    throw new Error("Designer output missing non-empty 'cases' array");
  }

  fs.mkdirSync(TEST_CASES_DIR, { recursive: true });
  const casesPath = path.join(TEST_CASES_DIR, `${slug}.json`);
  fs.writeFileSync(casesPath, JSON.stringify(cases, null, 2), "utf-8");

  for (const tc of cases.cases) {
    log("STAGE-1", `  ${tc.id}: ${tc.title}`, `priority=${tc.priority}`);
  }

  return cases;
}

// =============================================================================
// STAGE 2: Generate spec definition (Compiled AI — JSON, not code)
// =============================================================================
async function generateSpec(slug, cases, pages) {
  log("STAGE-2", "Generating spec definition", `slug=${slug}`);

  const catalog = buildPOCatalog(pages);
  const prompt = fs.readFileSync("prompts/generate_test_script.txt", "utf8");

  const userMsg = `Story slug: ${slug}\n\nTest cases:\n${JSON.stringify(cases, null, 2)}\n\n${catalog}`;

  log("STAGE-2", "Invoking LLM...");
  const response = await structuredLLM.invoke([
    { role: "system", content: prompt },
    { role: "user", content: userMsg },
  ]);

  const raw = response.content;
  log("STAGE-2", "LLM responded", `${raw.length} chars`);

  let specDef = extractJson(raw);

  // Ensure specDef has the expected shape
  if (!specDef.tests || !Array.isArray(specDef.tests)) {
    // Try to find tests in a nested structure
    if (specDef.spec && specDef.spec.tests) specDef = specDef.spec;
    else throw new Error(`Spec definition missing 'tests' array. Got keys: ${Object.keys(specDef).join(", ")}`);
  }
  if (!specDef.feature) specDef.feature = cases.feature || slug;

  // Validate test count — must match test cases
  const expectedCount = cases.cases.length;
  if (specDef.tests.length < expectedCount) {
    log("VALIDATE", "Test count mismatch", `spec has ${specDef.tests.length} tests but ${expectedCount} test cases exist. Retrying...`);
    const retryMsg2 = `${userMsg}\n\nERROR: You generated only ${specDef.tests.length} tests but there are ${expectedCount} test cases. Generate ALL ${expectedCount} tests.`;
    const retryResp2 = await structuredLLM.invoke(
      [{ role: "system", content: prompt }, { role: "user", content: retryMsg2 }],
    );
    const retryDef2 = extractJson(retryResp2.content);
    if (retryDef2.tests.length >= expectedCount) {
      specDef = retryDef2;
      log("VALIDATE", "Test count retry PASSED", `${retryDef2.tests.length} tests`);
    } else {
      log("VALIDATE", "Test count retry still short", `${retryDef2.tests.length}/${expectedCount}`);
    }
  }

  // Validate spec against PO catalog
  const validation = validateSpecAgainstCatalog(specDef, pages);
  if (!validation.valid) {
    log("VALIDATE", "Spec validation FAILED", `${validation.errors.length} error(s)`);
    for (const err of validation.errors) {
      log("VALIDATE", "  " + err);
    }

    // Retry with errors
    log("VALIDATE", "Retrying with validation errors...");
    const retryMsg = `${userMsg}\n\nVALIDATION ERRORS FROM PREVIOUS ATTEMPT (fix these):\n${validation.errors.map(e => "- " + e).join("\n")}`;
    const retryResponse = await structuredLLM.invoke(
      [{ role: "system", content: prompt }, { role: "user", content: retryMsg }],
    );
    const retryDef = extractJson(retryResponse.content);
    const retryValidation = validateSpecAgainstCatalog(retryDef, pages);
    if (retryValidation.valid) {
      log("VALIDATE", "Retry PASSED");
      specDef = retryDef;
    } else {
      log("VALIDATE", "Retry still has errors — proceeding", `${retryValidation.errors.length} error(s)`);
    }
  } else {
    log("VALIDATE", "Spec validation PASSED");
  }

  // Compile JSON → JavaScript spec file (force slug from pipeline, not LLM)
  const { filePath } = compileSpecDefinition(specDef, slug);
  log("STAGE-2", "Spec compiled", filePath);

  return filePath;
}

// =============================================================================
// STAGE 3+4: Run Cypress + Self-heal
// =============================================================================
const INFRA_FAILURES = new Set(["server_unreachable", "baseurl_issue"]);
const MAX_FIX_RETRIES = 3;

function extractFailingSpecs(output) {
  const specs = [];
  const re = /[✖✗×]\s+([\w.\-]+\.cy\.js)/g;
  let m;
  while ((m = re.exec(output)) !== null) specs.push(m[1]);
  if (specs.length === 0) {
    const specRan = /Spec\s+Ran:\s+([\w.\-]+\.cy\.js)/g;
    while ((m = specRan.exec(output)) !== null) specs.push(m[1]);
  }
  return [...new Set(specs)].map((name) => `cypress/e2e/${name}`);
}

async function fixAndRetry(pages, dom) {
  const fixerPrompt = fs.readFileSync("prompts/fix_test.txt", "utf8");

  for (let attempt = 1; attempt <= MAX_FIX_RETRIES; attempt++) {
    log("STAGE-4", `Fix attempt ${attempt}/${MAX_FIX_RETRIES}`);

    const failureLog = fs.readFileSync("cypress-failure.log", "utf-8");
    const failureType = classifyFailure(failureLog);
    log("STAGE-4", "Failure classified", `type=${failureType}`);

    if (INFRA_FAILURES.has(failureType)) {
      log("STAGE-4", "BAIL — infrastructure failure", failureType);
      return false;
    }

    let failingSpecPaths = extractFailingSpecs(failureLog);
    if (failingSpecPaths.length === 0) {
      log("STAGE-4", "Could not identify failing specs. Aborting.");
      return false;
    }

    // Build fixer context with all failing specs
    const specBlocks = [];
    for (const specPath of failingSpecPaths) {
      if (!fs.existsSync(specPath)) continue;
      const specSource = fs.readFileSync(specPath, "utf-8");
      specBlocks.push(`FAILING SPEC (${specPath}):\n${specSource}`);
    }

    const catalog = buildPOCatalog(pages);
    const userMsg = [
      `FAILURE TYPE: ${failureType}`,
      `FAILURE LOG:\n${failureLog.slice(0, 5000)}`,
      ...specBlocks,
      catalog,
      dom ? `DOM snapshot:\n${dom.slice(0, 8000)}` : "",
    ].join("\n\n");

    log("STAGE-4", "Invoking fixer LLM...", `${specBlocks.length} spec(s)`);

    // Fixer outputs spec definitions, which we compile to code
    const response = await structuredLLM.invoke(
      [
        { role: "system", content: fixerPrompt },
        { role: "user", content: userMsg },
      ],
    );

    const raw = response.content;
    log("STAGE-4", "Fixer responded", `${raw.length} chars`);

    let parsed;
    try {
      parsed = extractJson(raw);
    } catch (e) {
      log("STAGE-4", "JSON parse FAILED", e.message);
      continue;
    }

    // Fixer returns { files: [{ path, content }] } for spec files only
    if (parsed.files && Array.isArray(parsed.files) && parsed.files.length > 0) {
      // Block fixer from modifying anything except spec files
      const safeFixes = parsed.files.filter(f => {
        if (!f.path.startsWith("cypress/e2e/") || !f.path.endsWith(".cy.js")) {
          log("STAGE-4", "BLOCKED fixer from modifying", f.path);
          return false;
        }
        return true;
      });
      if (safeFixes.length > 0) {
        for (const file of safeFixes) {
          fs.writeFileSync(file.path, file.content, "utf-8");
          log("WRITE", "Fixer wrote", file.path);
        }
      } else {
        log("STAGE-4", "Fixer produced no valid spec changes. Aborting.");
        return false;
      }
    } else {
      log("STAGE-4", "Fixer produced no files. Aborting.");
      return false;
    }

    log("STAGE-4", "Re-running Cypress", `attempt ${attempt}`);
    const { ok } = await runCypress([SPEC_GLOB]);

    if (ok) {
      log("STAGE-4", "Cypress PASSED", `fixed on attempt ${attempt}`);
      return true;
    }
    log("STAGE-4", "Cypress still FAILING", `attempt ${attempt}`);
  }

  log("STAGE-4", "EXHAUSTED", `all ${MAX_FIX_RETRIES} fix attempts failed`);
  return false;
}

// =============================================================================
// MAIN PIPELINE
// =============================================================================
async function runAISDET() {
  log("INIT", "Pipeline starting");

  const stories = resolveStoriesToRun();
  log("INIT", "Stories resolved", `${stories.length}: ${stories.map(s => s.slug).join(", ")}`);

  const dom = readDomSnapshotIfExists();

  // Stage 0 — Compile Page Objects (one-time)
  const pages = await compilePOs(dom);

  // Stage 1+2 for each story (skip existing specs unless --force)
  const specFiles = [];
  let skipped = 0;
  for (const story of stories) {
    if (!FORCE && specExistsForSlug(story.slug)) {
      const specPath = `cypress/e2e/${story.slug}.cy.js`;
      log("STORY", "Skipped (spec exists)", `slug=${story.slug}, spec=${specPath} — use --force to regenerate`);
      specFiles.push(specPath);
      skipped++;
      continue;
    }
    // Reject empty stories
    if (!story.text || story.text.trim().length < 10) {
      log("STORY", "SKIPPED — empty or too short", `slug=${story.slug}, length=${(story.text || "").length} chars`);
      continue;
    }
    log("STORY", "Processing", `slug=${story.slug}, source=${story.source}`);
    try {
      const cases = await designTestCases(story.slug, story.text, dom);
      const specFile = await generateSpec(story.slug, cases, pages);
      specFiles.push(specFile);
      log("STORY", "Complete", `slug=${story.slug}, spec=${specFile}`);
    } catch (e) {
      log("STORY", "FAILED", `slug=${story.slug}: ${e.message}`);
      throw e;
    }
  }
  if (skipped > 0) {
    log("INIT", "Skipped stories", `${skipped} already have specs (${stories.length - skipped} new)`);
  }

  // Stage 3 — Run Cypress
  log("STAGE-3", "Running Cypress", `spec glob: ${SPEC_GLOB}`);
  const { ok, status, output } = await runCypress([SPEC_GLOB]);

  if (ok) {
    log("STAGE-3", "Cypress PASSED", `all ${specFiles.length} specs`);
    log("DONE", "Pipeline complete", "all tests passing — NO FIXER NEEDED");
    flushLogTrail();
    return;
  }

  log("STAGE-3", "Cypress FAILED", `exit code ${status}`);

  // Write failure context
  const failureType = classifyFailure(output);
  fs.writeFileSync("cypress-failure-context.json", JSON.stringify({
    timestamp: new Date().toISOString(),
    exitCode: status,
    type: failureType,
    specs: specFiles,
  }, null, 2));

  // Stage 4 — Self-heal
  log("STAGE-4", "Entering self-healing fix loop", `max retries: ${MAX_FIX_RETRIES}`);
  const fixed = await fixAndRetry(pages, dom);

  if (!fixed) {
    log("ERROR", "Pipeline failed", `self-healing exhausted after ${MAX_FIX_RETRIES} attempts`);
    flushLogTrail();
    throw new Error(`Self-healing failed after ${MAX_FIX_RETRIES} attempts. Type: ${failureType}`);
  }

  log("DONE", "Pipeline complete", "all tests passing after self-heal");
  flushLogTrail();
}

// --- Entry point ------------------------------------------------------------
runAISDET()
  .catch((err) => {
    log("ERROR", "Pipeline aborted", err.message);
    process.exitCode = 1;
  })
  .finally(() => {
    flushLogTrail();
    return flushLangSmith();
  });
