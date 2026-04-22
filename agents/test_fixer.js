// agents/test_fixer.js
// Stage 4 of the AI-SDET pipeline.
// Takes a failing Cypress spec, error log, failure classification, original
// test cases, DOM snapshot, and PO index, then returns patched files.

import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { llm } from "../llm.js";
import fs from "fs";

const prompt = fs.readFileSync("prompts/fix_test.txt", "utf8");

export const testFixerAgent = createReactAgent({
  llm,
  tools: [],
  prompt,
});
