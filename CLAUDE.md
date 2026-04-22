# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

An autonomous AI-SDET pipeline that converts plain-language user stories into Cypress test suites. It uses LLM agents (via LangChain/LangGraph + OpenAI) to: design test cases from stories, generate Cypress specs with Page Object Model, run them against a static HTML SPA (`eclat-shop.html`), and (WIP) self-heal failing tests using DOM snapshots and error logs. All traces go to LangSmith.

## Commands

```bash
# Serve the target app (required in a separate terminal)
python3 -m http.server 8080

# Run the full pipeline (processes all stories/*.md files)
node index.js

# Run a specific story file
node index.js browse-products

# Run with an ad-hoc inline story
USER_STORY="Filter products by Tech category" node index.js

# Run Cypress directly (for debugging generated specs)
npx cypress run --spec "cypress/e2e/browse-products.cy.js"
npx cypress open   # interactive mode
```

## Architecture

The pipeline has 3 stages orchestrated by `index.js`:

1. **Designer** (`agents/test_designer.js` + `prompts/generate_test_cases.txt`) — LLM reads a user story + DOM snapshot, outputs structured test cases as JSON to `cypress/test-cases/<slug>.json`.
2. **Generator** (`agents/test_generator.js` + `prompts/generate_test_script.txt`) — LLM reads test cases JSON + DOM snapshot + existing Page Object index, outputs `{ files: [{path, content}] }` JSON containing a Cypress spec and Page Object(s).
3. **Cypress Runner** (`tools/cypress_runner.js`) — spawns `npx cypress run`, streams output live, writes `cypress-failure.log` on failure. `index.js` classifies failures (server_unreachable, selector_issue, timeout_issue, etc.) and writes `cypress-failure-context.json`.

**Stage 4 (test_fixer)** is scaffolded in `agents/test_fixer.js` but not yet implemented — intended to self-heal specs using the failure log + DOM snapshot (needs `prompts/fix_test.txt` and a retry loop in `index.js`, max 3 retries).

Both agents use `createReactAgent` from LangGraph with zero tools — they are prompt-only LLM calls that return raw JSON text. `index.js` parses the output via `extractJson()` which strips markdown fences LLMs sometimes add.

Stories are processed sequentially so that each story's Page Objects are visible to the next via the PO index (`tools/page_object_index.js`). After all stories are generated, Cypress runs the full spec glob (`cypress/e2e/**/*.cy.js`) in a single pass to catch cross-story regressions.

## Key Conventions

- **ESM throughout** (`"type": "module"` in package.json), except `cypress.config.js` which **must be CommonJS** (Cypress requirement — uses `require()` and `module.exports`).
- **LLM output contract**: agents return `{ files: [{path, content}] }` (generator) or `{ feature, story, cases: [...] }` (designer). Both are raw JSON text parsed by `extractJson()`.
- **No `cy.intercept`** — the target app has no backend; all data is in-memory JS or localStorage.
- **Always `cy.visit('/eclat-shop.html')`** — no hardcoded protocol/host; `baseUrl` comes from `cypress.config.js`.
- **No invented selectors** — only use selectors visible in the DOM snapshot or listed in the prompt's selector catalogue. Never add `data-cy`/`data-test` attributes that don't exist in the HTML.
- **POM pattern** — specs import Page Objects from `cypress/support/pages/`. Page Objects must NOT call `cy.visit()` (navigation is the spec's concern). The `page_object_index.js` tool scans existing POs and injects a summary into the generator prompt so it reuses rather than overwrites them.
- **DOM snapshot is source of truth** — `cypress/support/e2e.js` runs `cy.captureDom('homepage')` after every test via `afterEach`, writing to `cypress/dom-snapshots/homepage.html`. Every agent prompt receives this when available.
- Stories are stored as markdown files in `stories/` with acceptance criteria.

## Environment Variables (.env)

`OPENAI_API_KEY`, `OPENAI_API_BASE`, `BASE_URL` (defaults to `http://localhost:8080`), plus `LANGCHAIN_TRACING_V2`, `LANGCHAIN_API_KEY`, `LANGCHAIN_PROJECT` for LangSmith tracing.

## LLM Configuration

`llm.js` exports a single `ChatOpenAI` instance (gpt-4o-mini, temperature 0.2). All agents share it. The base URL and API key come from `.env` via `OPENAI_API_BASE` and `OPENAI_API_KEY`.
