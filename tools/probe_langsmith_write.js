// tools/probe_langsmith_write.js
// Bypasses LangChain entirely. Talks directly to the LangSmith Client to:
//   1. Create a run with createRun()  → write test
//   2. End it with updateRun()         → write test
//   3. List runs with listRuns()       → read-back verification
//   4. As a second path, wrap a function with traceable() and confirm
//      it auto-creates a run via the langsmith SDK (not LangChain).
//
// If step 1/2 fails → API key lacks write permission, or the workspace
// doesn't allow ingest. If they succeed but the LangChain auto-tracer
// in check_langsmith.js still produces zero runs, the bug is somewhere
// in @langchain/core's tracer wiring (we'd switch to traceable()).

import "dotenv/config";
import { Client } from "langsmith";
import { traceable } from "langsmith/traceable";
import { randomUUID } from "crypto";

const apiKey = process.env.LANGSMITH_API_KEY || process.env.LANGCHAIN_API_KEY;
const endpoint =
  process.env.LANGSMITH_ENDPOINT ||
  process.env.LANGCHAIN_ENDPOINT ||
  "https://api.smith.langchain.com";
const project =
  process.env.LANGSMITH_PROJECT || process.env.LANGCHAIN_PROJECT || "ai-sdet";

console.log("Endpoint:", endpoint);
console.log("Project :", project);
console.log("Key tail:", apiKey ? apiKey.slice(-8) : "(missing)");

const client = new Client({ apiUrl: endpoint, apiKey });

// --- Path A: raw createRun + updateRun ---------------------------------
console.log("\n=== Path A: client.createRun() + updateRun() ===");
const runId = randomUUID();
const startTime = new Date();
try {
  await client.createRun({
    id: runId,
    name: "manual-probe",
    run_type: "llm",
    inputs: { question: "ping" },
    project_name: project,
    start_time: startTime.getTime(),
  });
  console.log("  ✅ createRun returned without error. id =", runId);
} catch (e) {
  console.error("  ❌ createRun threw:", e.message);
  console.error("     full error:", e);
}

try {
  await client.updateRun(runId, {
    outputs: { answer: "pong" },
    end_time: Date.now(),
  });
  console.log("  ✅ updateRun returned without error.");
} catch (e) {
  console.error("  ❌ updateRun threw:", e.message);
}

// Force flush of this client's queue.
try {
  if (typeof client.awaitPendingTraceBatches === "function") {
    await client.awaitPendingTraceBatches();
    console.log("  ✅ awaitPendingTraceBatches resolved");
  }
} catch (e) {
  console.error("  ❌ flush threw:", e.message);
}

// --- Path B: traceable() wrapper from langsmith SDK --------------------
console.log("\n=== Path B: traceable() wrapper ===");
const tracedFn = traceable(
  async (msg) => {
    return `echo: ${msg}`;
  },
  { name: "traceable-probe", project_name: project, run_type: "chain" }
);
try {
  const out = await tracedFn("hello");
  console.log("  ✅ traceable function returned:", out);
} catch (e) {
  console.error("  ❌ traceable threw:", e.message);
}

try {
  if (typeof client.awaitPendingTraceBatches === "function") {
    await client.awaitPendingTraceBatches();
  }
} catch (e) {}

// --- Read-back ----------------------------------------------------------
console.log("\n=== Read-back: listRuns since probe started ===");
console.log("  (waiting 4s for ingest...)");
await new Promise((r) => setTimeout(r, 4000));

try {
  const runs = [];
  for await (const r of client.listRuns({
    projectName: project,
    startTime: new Date(startTime.getTime() - 10_000),
    limit: 25,
  })) {
    runs.push(r);
    if (runs.length >= 25) break;
  }
  console.log(`  Found ${runs.length} run(s) in '${project}' since probe start.`);
  for (const r of runs.slice(0, 10)) {
    console.log(`    - ${r.run_type.padEnd(8)} ${r.name.padEnd(20)} id=${r.id}`);
  }

  const sawManual = runs.some((r) => r.id === runId);
  const sawTraceable = runs.some((r) => r.name === "traceable-probe");
  console.log("\n  Path A run visible :", sawManual ? "YES" : "NO");
  console.log("  Path B run visible :", sawTraceable ? "YES" : "NO");

  if (!sawManual && !sawTraceable) {
    console.log("\n  ❌ Neither path produced a visible run.");
    console.log("     Most likely: API key lacks write/ingest permission for this workspace,");
    console.log("     or the calls 200'd but the server discarded them silently.");
    console.log("     Check the key's scope at https://smith.langchain.com/settings");
  } else if (sawManual && !sawTraceable) {
    console.log("\n  ⚠️  Raw client writes work but traceable() doesn't — odd, but switch to raw client.");
  } else if (sawManual && sawTraceable) {
    console.log("\n  ✅ Writes work. The bug is in LangChain's auto-tracer wiring.");
    console.log("     Workaround: wrap LLM calls with traceable() instead of relying on env-var auto-tracing.");
  }
} catch (e) {
  console.error("  ❌ listRuns failed:", e.message);
}

console.log("\nDone.");
