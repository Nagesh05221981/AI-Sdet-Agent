import { ChatOpenAI } from "@langchain/openai";

export const llm = new ChatOpenAI({
  model: "gpt-4o",
  temperature: 0.2,

  configuration: {
    baseURL: process.env.OPENAI_API_BASE,
    apiKey: process.env.OPENAI_API_KEY
  }
});