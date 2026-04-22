// agents/test_generator.js
// Stage 2 of the AI-SDET pipeline.
// Takes structured test cases (JSON, produced by test_designer) plus an
// optional DOM snapshot, and emits a Page Object + Cypress spec.

import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { llm } from "../llm.js";
import fs from "fs";

const prompt = fs.readFileSync("prompts/generate_test_script.txt", "utf8");

export const testGeneratorAgent = createReactAgent({
  llm,
  tools: [],
  prompt,
});
