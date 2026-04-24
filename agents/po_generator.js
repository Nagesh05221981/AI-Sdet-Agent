// agents/po_generator.js
// Stage 0 of the AI-SDET pipeline.
// Takes the DOM snapshot and generates Page Objects + BaseTest.
// Run once before any stories — specs import these, never recreate them.

import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { llm } from "../llm.js";
import fs from "fs";

const prompt = fs.readFileSync("prompts/generate_page_objects.txt", "utf8");

export const poGeneratorAgent = createReactAgent({
  llm,
  tools: [],
  prompt,
});
