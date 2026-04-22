// agents/test_designer.js
// Stage 1 of the AI-SDET pipeline.
// Takes a user story (+ optional DOM snapshot, injected by index.js) and
// returns a JSON object of structured test cases. The downstream codegen
// agent (test_generator) consumes that JSON to produce the Cypress spec.

import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { llm } from "../llm.js";
import fs from "fs";

const prompt = fs.readFileSync("prompts/generate_test_cases.txt", "utf8");

export const testDesignerAgent = createReactAgent({
  llm,
  tools: [],
  prompt,
});
