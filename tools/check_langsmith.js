// tools/check_langsmith.js
// Diagnose why LangSmith traces are not appearing.
// Run: node tools/check_langsmith.js
//
// What this version does differently:
//   - Flushes via @langchain/core's awaitAllCallbacks() (the *real* flush
//     that drains the LangChainTracer's internal client queue, not just
//     our standalone Client).
//   - After the LLM call, queries LangSmith directly for runs created in
//     the last 5 minutes in this project. If zero runs come back, the
//     trace was never sent. If runs come back, the issue is UI-side
//     (wrong project, propagation delay, browser cache).

import "dotenv/config";
import { ChatOpenAI } from "@langchain/openai";
import { Client } from "langsmith";
import { awaitAllCallbacks } from "@langchain/core/callbacks/promises";

const mask = (s) => {
  if (!s) return "(missing)";
  if (s.length < 12) return s;
  return s.slice(0, 8) + "..." + s.slice(-4);
};

console.log("\n=== 1. Env vars ===");
const env = process.env;
const tracing = env.LANGCHAIN_TRACING_V2 || env.LANGSMITH_TRACING;
const apiKey = env.LANGCHAIN_API_KEY || env.LANGSMITH_API_KEY;
const project =
  env.LANGCHAIN_PROJECT || env.LANGSMITH_PROJECT || "default";
const endpoint =
  env.LANGCHAIN_ENDPOINT ||
  env.LANGSMITH_ENDPOINT ||
  "https://api.smith.langchain.com";

console.log("  LANGCHAIN_TRACING_V2 :", tracing || "(missing)");
console.log("  LANGCHAIN_API_KEY    :", mask(apiKey));
console.log("  LANGCHAIN_PROJECT    :", project);
console.log("  LANGCHAIN_ENDPOINT   :", endpoint);
console.log("  OPENAI_API_KEY       :", mask(env.OPENAI_API_KEY));
console.log("  OPENAI_API_BASE      :", env.OPENAI_API_BASE || "(default)");

if (!tracing || tracing.toLowerCase() !== "true") {
  console.error("\n❌ Tracing flag is not 'true'. Tracing is OFF.");
  process.exit(1);
}
if (!apiKey) {
  console.error("\n❌ No LangSmith API key found.");
  process.exit(1);
}

console.log("\n=== 2. LangSmith client auth ===");
const client = new Client({ apiUrl: endpoint, apiKey });
try {
  const projects = [];
  for await (const p of client.listProjects()) {
    projects.push(p.name);
    if (projects.length >= 10) break;
  }
  console.log("  ✅ Auth OK. First few projects:", projects);
  if (!projects.includes(project)) {
    console.log(
      `  ℹ️  Project '${project}' not in the first 10 — it will be auto-created on first trace.`
    );
  }
} catch (e) {
  console.error("  ❌ LangSmith auth failed:", e.message);
  process.exit(1);
}

console.log("\n=== 3. Live LLM call (auto-traced) ===");
const llm = new ChatOpenAI({
  model: "gpt-4o-mini",
  temperature: 0,
  configuration: {
    baseURL: env.OPENAI_API_BASE,
    apiKey: env.OPENAI_API_KEY,
  },
});

const callStart = new Date();
const ping = `langsmith-check-${Date.now()}`;
try {
  const res = await llm.invoke([
    {
      role: "user",
      content: `Reply with exactly the word: ${ping}`,
    },
  ]);
  console.log(`  ✅ LLM reply (${Date.now() - callStart.getTime()}ms):`, res.content);
  console.log(`  ⛓  Sent unique marker: ${ping}`);
} catch (e) {
  console.error("  ❌ LLM call failed:", e.message);
  process.exit(1);
}

console.log("\n=== 4. Flush via awaitAllCallbacks() ===");
try {
  await awaitAllCallbacks();
  console.log("  ✅ awaitAllCallbacks() resolved");
} catch (e) {
  console.error("  ❌ awaitAllCallbacks failed:", e.message);
}

// Belt-and-braces: also flush our standalone client (harmless if empty).
try {
  if (typeof client.awaitPendingTraceBatches === "function") {
    await client.awaitPendingTraceBatches();
  }
} catch (e) {}

console.log(
  "\n=== 5. Query LangSmith for the run we just created ==="
);
console.log("  (waiting 3s for server-side ingest...)");
await new Promise((r) => setTimeout(r, 3000));

try {
  const runs = [];
  for await (const r of client.listRuns({
    projectName: project,
    startTime: new Date(callStart.getTime() - 60_000),
    limit: 25,
  })) {
    runs.push(r);
    if (runs.length >= 25) break;
  }
  console.log(`  Found ${runs.length} run(s) in project '${project}' since ~1 min ago.`);
  if (runs.length === 0) {
    console.log("\n  ❌ Trace was NEVER sent. Likely causes:");
    console.log("     - LANGSMITH_API_KEY does not match the workspace where you're looking.");
    console.log("     - You are looking at a different region (US vs EU).");
    console.log("     - A network proxy is blocking POSTs to api.smith.langchain.com.");
  } else {
    const recent = runs.slice(0, 5);
    console.log("\n  Most recent runs:");
    for (const r of recent) {
      console.log(`    - ${r.run_type.padEnd(8)} ${r.name.padEnd(20)} id=${r.id}`);
    }
    console.log(
      `\n  ✅ Open https://smith.langchain.com/o/-/projects/p/${encodeURIComponent(project)}`
    );
  }
} catch (e) {
  console.error("  ❌ listRuns failed:", e.message);
}

console.log("\nDone.");
