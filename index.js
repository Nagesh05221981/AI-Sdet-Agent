import "dotenv/config";
import fs from "fs";
import path from "path";
import { awaitAllCallbacks } from "@langchain/core/callbacks/promises";
import { testDesignerAgent } from "./agents/test_designer.js";
import { testGeneratorAgent } from "./agents/test_generator.js";
import { testFixerAgent } from "./agents/test_fixer.js";
import { runCypress } from "./tools/cypress_runner.js";
import { buildPageObjectIndexBlock } from "./tools/page_object_index.js";
import { extractRelevantDom } from "./tools/dom_context_builder.js";

// LangSmith / LangChain JS batches traces in the background. If the Node
// process exits before the LangChainTracer's internal client posts its
// queue, traces never reach the LangSmith UI. awaitAllCallbacks() drains
// every in-flight async callback (including the tracer) before we exit.
async function flushLangSmith() {
  try {
    await awaitAllCallbacks();
    console.log("📡 LangSmith callbacks drained");
  } catch (e) {
    console.warn("⚠️  awaitAllCallbacks failed:", e.message);
  }
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
const PAGES_DIR = "cypress/support/pages";
const SPEC_GLOB = "cypress/e2e/**/*.cy.js";
const DOM_TRUNCATE_CHARS = 20000;

// --- Helpers ----------------------------------------------------------------
function readDomSnapshotIfExists() {
  try {
    const raw = fs.readFileSync(DOM_SNAPSHOT_PATH, "utf-8");
    const dom = extractRelevantDom(raw);
    log("INIT", "DOM snapshot loaded", `${DOM_SNAPSHOT_PATH} (raw=${raw.length}, cleaned=${dom.length} chars)`);
    return dom;
  } catch (e) {
    if (e.code === "ENOENT") {
      log("INIT", "No DOM snapshot found", "first run will create it");
      return null;
    }
    throw e;
  }
}

function writeGeneratedFiles(files) {
  const written = [];
  for (const file of files) {
    if (!file?.path || typeof file.content !== "string") {
      console.warn("⚠️  Skipping malformed file entry:", file);
      continue;
    }
    const fullPath = path.resolve(file.path);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, file.content, "utf-8");
    log("WRITE", "File written", `${file.path} (${file.content.length} chars)`);
    written.push(file.path);
  }
  return written;
}

function extractJson(raw) {
  // LLMs occasionally wrap JSON in ```json fences despite instructions.
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  let candidate = (fence ? fence[1] : raw).trim();
  // LLMs sometimes emit \' (backslash-escaped single quotes) which is invalid JSON.
  candidate = candidate.replace(/\\'/g, "'");
  // Strip trailing commas before } or ] (common LLM mistake).
  candidate = candidate.replace(/,\s*([}\]])/g, "$1");
  return JSON.parse(candidate);
}

function slugify(s) {
  return String(s || "feature")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "feature";
}

function withDomBlock(body, dom) {
  if (!dom) return body;
  return `${body}\n\nCurrent DOM snapshot of /eclat-shop.html (truncated to ${DOM_TRUNCATE_CHARS} chars):\n${dom.slice(0, DOM_TRUNCATE_CHARS)}`;
}

function classifyFailure(log) {
  if (!log) return "unknown";
  if (/could not verify that this server is running/i.test(log) ||
      /ECONNREFUSED/i.test(log))
    return "server_unreachable";
  if (/Timed out retrying/i.test(log)) return "timeout_issue";
  if (/Expected to find element/i.test(log)) return "selector_issue";
  if (/cy\.visit.*failed/i.test(log)) return "baseurl_issue";
  if (/AssertionError/i.test(log)) return "assertion_issue";
  if (/SyntaxError|ReferenceError|TypeError/i.test(log)) return "spec_error";
  return "unknown";
}

// --- Fixer helpers ----------------------------------------------------------
const INFRA_FAILURES = new Set(["server_unreachable", "baseurl_issue"]);
const MAX_FIX_RETRIES = 3;

function extractFailingSpecs(output) {
  // Cypress marks failing specs with ✖ in the summary table.
  const specs = [];
  const re = /[✖✗×]\s+([\w.\-]+\.cy\.js)/g;
  let m;
  while ((m = re.exec(output)) !== null) specs.push(m[1]);

  // Fallback: "Spec Ran:" line that shows after a single-spec failure
  if (specs.length === 0) {
    const specRan = /Spec\s+Ran:\s+([\w.\-]+\.cy\.js)/g;
    while ((m = specRan.exec(output)) !== null) specs.push(m[1]);
  }

  return [...new Set(specs)].map((name) => `cypress/e2e/${name}`);
}

function findTestCasesForSpec(specPath, generated) {
  for (const g of generated) {
    if (g.specFiles.includes(specPath)) return g.cases;
  }
  return null;
}

async function fixAndRetry(generated, dom) {
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
      // Conservative fallback: send all specs from this run
      failingSpecPaths = generated.flatMap((g) => g.specFiles);
      console.warn("⚠️  Could not identify failing spec(s); sending all specs to fixer.");
    }

    const poIndex = buildPageObjectIndexBlock(PAGES_DIR);

    // Build a single fixer prompt with ALL failing specs so the LLM sees
    // the full picture and doesn't clobber shared Page Objects.
    const specBlocks = [];
    for (const specPath of failingSpecPaths) {
      if (!fs.existsSync(specPath)) {
        log("STAGE-4", "Spec not found, skipping", specPath);
        continue;
      }
      const specSource = fs.readFileSync(specPath, "utf-8");
      const testCases = findTestCasesForSpec(specPath, generated);
      specBlocks.push(
        `FAILING SPEC SOURCE (${specPath}):\n${specSource}\n\n` +
        `ORIGINAL TEST CASES FOR ${specPath}:\n${JSON.stringify(testCases, null, 2)}`
      );
    }

    if (specBlocks.length === 0) {
      log("STAGE-4", "No failing specs found on disk. Aborting.");
      return false;
    }

    const userMsg = [
      `FAILURE TYPE: ${failureType}`,
      ``,
      `FAILURE LOG:\n${failureLog}`,
      ``,
      `NUMBER OF FAILING SPECS: ${specBlocks.length}`,
      `Fix ALL of them in a single response. Include the FULL content of every`,
      `file you change — especially shared Page Objects that multiple specs use.`,
      ``,
      ...specBlocks,
      ``,
      poIndex,
    ].join("\n");

    const fullMsg = withDomBlock(userMsg, dom);

    log("STAGE-4", "Invoking fixer agent", `${specBlocks.length} failing spec(s), type=${failureType}`);
    const result = await testFixerAgent.invoke({
      messages: [{ role: "user", content: fullMsg }],
    });

    const raw = result.messages.at(-1).content;
    log("STAGE-4", "Fixer agent responded", `${raw.length} chars`);

    let parsed;
    let anyFileWritten = false;
    try {
      parsed = extractJson(raw);
    } catch (e) {
      log("STAGE-4", "JSON parse FAILED", e.message);
      continue;
    }

    if (parsed.files && Array.isArray(parsed.files) && parsed.files.length > 0) {
      log("STAGE-4", "Fixer output", `${parsed.files.length} file(s): ${parsed.files.map(f => f.path).join(", ")}`);
      writeGeneratedFiles(parsed.files);
      anyFileWritten = true;
    } else if (parsed.reason) {
      log("STAGE-4", "Fixer declined", parsed.reason);
    }

    if (!anyFileWritten) {
      console.warn("⚠️  Fixer produced no file changes. Aborting retry loop.");
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

// --- Story discovery --------------------------------------------------------
function listStoryFiles() {
  if (!fs.existsSync(STORIES_DIR)) return [];
  return fs
    .readdirSync(STORIES_DIR)
    .filter((f) => f.endsWith(".md"))
    .map((f) => ({
      slug: f.replace(/\.md$/, ""),
      path: path.join(STORIES_DIR, f),
    }))
    .sort((a, b) => a.slug.localeCompare(b.slug));
}

function readStoryFile(p) {
  return fs.readFileSync(p, "utf-8").trim();
}

/**
 * Resolve the list of stories to run from CLI/env:
 *   USER_STORY="..." node index.js     → ad-hoc inline story
 *   node index.js                      → every stories/*.md
 *   node index.js <slug>               → just that story file
 */
function resolveStoriesToRun() {
  if (process.env.USER_STORY) {
    return [
      {
        slug: slugify(process.env.USER_STORY).slice(0, 40) || "ad-hoc",
        text: process.env.USER_STORY,
        source: "USER_STORY env",
      },
    ];
  }

  const slugArg = process.argv.slice(2).find((a) => !a.startsWith("-"));
  const all = listStoryFiles();

  if (slugArg) {
    const hit = all.find((s) => s.slug === slugArg);
    if (!hit) {
      const known = all.map((s) => s.slug).join(", ") || "(none yet)";
      throw new Error(
        `No story file '${slugArg}.md' under ${STORIES_DIR}/. Known stories: ${known}`
      );
    }
    return [{ slug: hit.slug, text: readStoryFile(hit.path), source: hit.path }];
  }

  if (all.length === 0) {
    // Default seed story if no files exist yet.
    return [
      {
        slug: "default",
        text: "User opens the Eclat shop and can see the product listing",
        source: "(built-in default)",
      },
    ];
  }

  return all.map((s) => ({
    slug: s.slug,
    text: readStoryFile(s.path),
    source: s.path,
  }));
}

// --- Stage 1: design test cases --------------------------------------------
async function designTestCases(slug, story, dom) {
  log("STAGE-1", "Designing test cases", `slug=${slug}`);
  log("STAGE-1", "LLM input prepared", `story (${story.length} chars) + DOM ${dom ? "yes" : "no"}`);

  const userMsg = withDomBlock(`User story:\n${story}`, dom);

  log("STAGE-1", "Invoking designer agent...");
  const result = await testDesignerAgent.invoke({
    messages: [{ role: "user", content: userMsg }],
  });

  const raw = result.messages.at(-1).content;
  log("STAGE-1", "Designer agent responded", `${raw.length} chars`);

  let cases;
  try {
    cases = extractJson(raw);
  } catch (e) {
    log("STAGE-1", "JSON parse FAILED", e.message);
    throw new Error("Designer output is not valid JSON: " + e.message);
  }

  if (!cases || !Array.isArray(cases.cases) || cases.cases.length === 0) {
    throw new Error("Designer output missing non-empty 'cases' array");
  }

  fs.mkdirSync(TEST_CASES_DIR, { recursive: true });
  const casesPath = path.join(TEST_CASES_DIR, `${slug}.json`);
  fs.writeFileSync(casesPath, JSON.stringify(cases, null, 2), "utf-8");
  log("STAGE-1", "Test cases written", `${cases.cases.length} case(s) → ${casesPath}`);

  for (const tc of cases.cases) {
    log("STAGE-1", `  ${tc.id}: ${tc.title}`, `priority=${tc.priority}`);
  }

  return { cases, casesPath };
}

// --- Stage 2: generate Cypress files ---------------------------------------
async function generateCypressFiles(slug, cases, dom) {
  log("STAGE-2", "Generating Cypress spec + Page Object", `slug=${slug}`);

  const poIndex = buildPageObjectIndexBlock(PAGES_DIR);
  log("STAGE-2", "PO index built", poIndex.split("\n")[0]);

  const userMsg = withDomBlock(
    `Story slug (use as the spec filename): ${slug}\n\n` +
      `Test cases:\n${JSON.stringify(cases, null, 2)}\n\n` +
      `${poIndex}`,
    dom
  );
  log("STAGE-2", "LLM input prepared", `${userMsg.length} chars`);

  log("STAGE-2", "Invoking generator agent...");
  const result = await testGeneratorAgent.invoke({
    messages: [{ role: "user", content: userMsg }],
  });

  const raw = result.messages.at(-1).content;
  log("STAGE-2", "Generator agent responded", `${raw.length} chars`);

  let parsed;
  try {
    parsed = extractJson(raw);
  } catch (e) {
    log("STAGE-2", "JSON parse FAILED", e.message);
    throw new Error("Generator output is not valid JSON: " + e.message);
  }

  if (parsed === "MULTI_FILE_GENERATION_REQUIRED") {
    throw new Error("Generator refused — multi-file output required.");
  }
  if (!parsed.files || !Array.isArray(parsed.files)) {
    throw new Error("Generator output missing files array");
  }

  log("STAGE-2", "Files to write", `${parsed.files.length} file(s): ${parsed.files.map(f => f.path).join(", ")}`);
  const written = writeGeneratedFiles(parsed.files);
  const specFiles = written.filter(
    (p) => p.startsWith("cypress/e2e/") && p.endsWith(".cy.js")
  );

  if (specFiles.length === 0) {
    throw new Error("No Cypress spec files were generated under cypress/e2e/");
  }
  return specFiles;
}

// --- Per-story pipeline (Stages 1 + 2 only) --------------------------------
async function generateForStory(story, dom) {
  log("STORY", "Reading story", `slug=${story.slug}, source=${story.source}`);
  log("STORY", "Story content", `${story.text.length} chars`);

  const { cases } = await designTestCases(story.slug, story.text, dom);
  const specFiles = await generateCypressFiles(story.slug, cases, dom);

  log("STORY", "Story complete", `slug=${story.slug}, feature="${cases.feature}", specs=[${specFiles.join(", ")}]`);
  return { slug: story.slug, feature: cases.feature, cases, specFiles };
}

// --- Main -------------------------------------------------------------------
async function runAISDET() {
  log("INIT", "Pipeline starting");

  const stories = resolveStoriesToRun();
  log("INIT", "Stories resolved", `${stories.length} story/stories: ${stories.map((s) => s.slug).join(", ")}`);

  const dom = readDomSnapshotIfExists();

  // Stage 1+2 for each story, sequentially so the PO index seen by story N+1
  // already reflects POs created by story N.
  const generated = [];
  for (const story of stories) {
    try {
      generated.push(await generateForStory(story, dom));
    } catch (e) {
      console.error(`\n💥 Failed during generation for '${story.slug}':`, e.message);
      throw e;
    }
  }

  // Stage 3 — run the entire spec suite
  log("STAGE-3", "Running Cypress", `spec glob: ${SPEC_GLOB}`);
  const { ok, status, output } = await runCypress([SPEC_GLOB]);

  if (ok) {
    log("STAGE-3", "Cypress PASSED", `all ${generated.length} story/stories`);
    log("DONE", "Pipeline complete", "all tests passing");
    flushLogTrail();
    return;
  }

  log("STAGE-3", "Cypress FAILED", `exit code ${status}`);

  const context = {
    timestamp: new Date().toISOString(),
    exitCode: status,
    type: classifyFailure(output),
    spec_glob: SPEC_GLOB,
    stories: generated.map((g) => ({
      slug: g.slug,
      feature: g.feature,
      case_count: g.cases.cases.length,
      specs: g.specFiles,
    })),
    log_path: "cypress-failure.log",
    dom_snapshot: fs.existsSync(DOM_SNAPSHOT_PATH) ? DOM_SNAPSHOT_PATH : null,
  };

  fs.writeFileSync(
    "cypress-failure-context.json",
    JSON.stringify(context, null, 2)
  );

  log("STAGE-3", "Failure context written", `type=${context.type}, log=cypress-failure.log`);

  // Stage 4 — self-healing retry loop
  log("STAGE-4", "Entering self-healing fix loop", `max retries: ${MAX_FIX_RETRIES}`);
  const fixed = await fixAndRetry(generated, dom);

  if (!fixed) {
    const finalLog = fs.existsSync("cypress-failure.log")
      ? fs.readFileSync("cypress-failure.log", "utf-8")
      : output;
    const finalContext = {
      ...context,
      timestamp: new Date().toISOString(),
      type: classifyFailure(finalLog),
      fix_attempts: MAX_FIX_RETRIES,
      fix_result: "exhausted",
    };
    fs.writeFileSync(
      "cypress-failure-context.json",
      JSON.stringify(finalContext, null, 2)
    );
    throw new Error(
      `Self-healing failed after ${MAX_FIX_RETRIES} attempts. Type: ${finalContext.type}`
    );
  }

  log("DONE", "Pipeline complete", "all tests passing after self-heal");
  flushLogTrail();
}

runAISDET()
  .catch((err) => {
    log("ERROR", "Pipeline aborted", err.message);
    process.exitCode = 1;
  })
  .finally(() => {
    flushLogTrail();
    return flushLangSmith();
  });
