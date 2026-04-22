# AI-SDET — Project Roadmap & Design Doc

A living document. Captures what's built, what's next, and the design decisions
behind each piece so a fresh chat session can pick up without losing context.

---

## 1. Goal

Build an autonomous SDET pipeline that:

1. Takes a plain-language **user story** as input.
2. Uses an LLM to derive **test cases** (Given/When/Then) from the story.
3. Uses an LLM to translate those cases into **Cypress test scripts** (Page
   Object Model).
4. Runs the scripts against a real app served at `http://localhost:8080`
   (`eclat-shop.html`).
5. On failure, an LLM **self-heals** the spec using the live DOM snapshot and
   the Cypress error log, then re-runs.
6. Everything traced in **LangSmith**.

Target app: a single static HTML SPA (NOVA / Eclat shop). No backend, no
routing, all flows happen in modals on one page.

---

## 2. Architecture (target)

```
                ┌─────────────────────────────────────────────────┐
                │                   USER STORY                    │
                └─────────────────────────────────────────────────┘
                                     │
                                     ▼
        ┌──────────────────────────────────────────────────┐
        │ STAGE 1 — test_designer agent                    │
        │ Prompt: prompts/generate_test_cases.txt          │
        │ Inputs : story + DOM snapshot                    │
        │ Output : cypress/test-cases/<feature>.json       │
        │           [{ id, title, given, when, then }]     │
        └──────────────────────────────────────────────────┘
                                     │
                                     ▼
        ┌──────────────────────────────────────────────────┐
        │ STAGE 2 — test_generator agent                   │
        │ Prompt: prompts/generate_test_script.txt         │
        │ Inputs : test cases JSON + DOM snapshot          │
        │ Output : Page Object + spec under cypress/       │
        └──────────────────────────────────────────────────┘
                                     │
                                     ▼
        ┌──────────────────────────────────────────────────┐
        │ STAGE 3 — Cypress run                            │
        │ tools/cypress_runner.js (spawn, stream + capture)│
        │ Writes cypress-failure.log on non-zero exit      │
        └──────────────────────────────────────────────────┘
                                     │
                          pass ◀─────┼─────▶ fail
                                                │
                                                ▼
        ┌──────────────────────────────────────────────────┐
        │ STAGE 4 — test_fixer agent  (NEXT)               │
        │ Prompt: prompts/fix_test.txt                     │
        │ Inputs : failing spec + failure log + DOM        │
        │ Output : patched spec → loop back to Stage 3     │
        └──────────────────────────────────────────────────┘

  Side channel (already wired):
    cypress/support/e2e.js → afterEach → cy.captureDom('homepage')
    writes cypress/dom-snapshots/homepage.html, consumed by every stage.
```

---

## 3. What's built so far

| # | Step                              | Status | File(s)                                        |
|---|-----------------------------------|--------|------------------------------------------------|
| 1 | Project scaffold (package, env)   | done   | `package.json`, `.env`                         |
| 2 | LangChain LLM wrapper             | done   | `llm.js`                                       |
| 3 | Cypress baseline + custom command | done   | `cypress.config.js`, `cypress/support/*`       |
| 4 | DOM snapshot pipeline             | done   | `cypress/support/commands.js` (`captureDom`)   |
| 5 | Test generator agent (single)     | done   | `agents/test_generator.js`                     |
| 6 | Generator prompt (DOM-aware)      | done   | `prompts/generate_test.txt`                    |
| 7 | Cypress runner (stream + capture) | done   | `tools/cypress_runner.js`                      |
| 8 | DOM helpers                       | done   | `tools/dom_parser.js`, `tools/dom_context_builder.js` |
| 9 | Failure classifier + log writer   | done   | `index.js`                                     |
|10 | Workflow diagram (one-slide PPT)  | done   | `AI_SDET_Workflow.pptx`                        |
|11 | Test fixer agent (skeleton)       | partial| `agents/test_fixer.js` (no prompt yet)         |

---

## 4. Two-stage design (next scaffolding pass)

**Decision:** split today's single generator into a **designer** stage that
emits plain-language test cases, and a **generator** stage that turns those
cases into Cypress code. Why:

- *Reviewable artifact* — `cypress/test-cases/<feature>.json` is human-readable;
  a PM/QA lead can sanity check before code lands.
- *Better LLM accuracy* — each prompt is smaller and more focused; the design
  model isn't distracted by Cypress syntax, the codegen model isn't guessing
  intent.
- *Self-healer alignment* — when a test fails, the fixer can compare the
  failing assertion back to the case's `then` clause to decide
  "selector wrong" vs "requirement changed".
- *Reusable* — same cases could later drive Playwright, manual QA exports, or
  coverage reports.
- *Mirrors real SDET work* — Jira story → test cases (TestRail/Zephyr) →
  automation.

### Files to create / change

| Action | Path                                           | Purpose                                |
|--------|------------------------------------------------|----------------------------------------|
| NEW    | `prompts/generate_test_cases.txt`              | Designer prompt (story + DOM → cases)  |
| NEW    | `agents/test_designer.js`                      | Wraps designer prompt with createReactAgent |
| RENAME | `prompts/generate_test.txt` → `prompts/generate_test_script.txt` | Codegen prompt; input contract becomes test cases JSON |
| EDIT   | `agents/test_generator.js`                     | Point at new prompt file               |
| EDIT   | `index.js`                                     | Run designer → write JSON → run generator → run Cypress |
| NEW    | `cypress/test-cases/`                          | Output dir for case JSON files         |

### Test case JSON shape (designer output)

```json
{
  "feature": "Browse products",
  "story": "User opens the Eclat shop and can see the product listing",
  "cases": [
    {
      "id": "TC-01",
      "title": "Grid renders on load",
      "given": "User opens /eclat-shop.html",
      "when":  "page finishes rendering",
      "then":  "at least one .pcard is visible and #results-info shows a count",
      "selectors_hint": ["#grid", ".pcard", "#results-info"]
    }
  ]
}
```

`selectors_hint` is optional — gives the codegen stage a head start without
locking it in.

---

## 5. After the split — remaining steps

| Step | Description |
|------|-------------|
| 12   | Flesh out `agents/test_fixer.js` + write `prompts/fix_test.txt`. Inputs: failing spec source, `cypress-failure.log`, DOM snapshot. Output: patched spec (same JSON shape as generator). |
| 13   | Autonomous fix loop in `index.js`. Max 3 retries. After each retry: re-write spec, re-run Cypress, re-classify. Bail on `server_unreachable`. |
| 14   | Optional: surface diff between original and fixed spec to the user. |
| 15   | CI integration — `.github/workflows/cypress.yml` runs `node index.js` against a story matrix, uploads `cypress-failure.log` and DOM snapshots as artifacts. |
| 16   | Optional: case-level result reporting (per-TC pass/fail), feeds back into LangSmith. |

---

## 6. File map (current)

```
AI-Sdet-Agent/
├─ .env                          # OPENAI_API_KEY, LANGCHAIN_*, BASE_URL
├─ package.json                  # ESM, "type": "module"
├─ cypress.config.js             # baseUrl from BASE_URL, supportFile wired
├─ eclat-shop.html               # target SPA (served via python3 -m http.server 8080)
├─ index.js                      # orchestrator
├─ llm.js                        # ChatOpenAI factory
├─ AI_SDET_Workflow.pptx         # one-slide architecture diagram
├─ agents/
│  ├─ test_generator.js          # createReactAgent + generator prompt
│  └─ test_fixer.js              # skeleton (TBD)
├─ prompts/
│  └─ generate_test.txt          # current single-stage prompt (will be split)
├─ tools/
│  ├─ cypress_runner.js          # spawn npx cypress run, stream + capture log
│  ├─ dom_parser.js
│  └─ dom_context_builder.js
└─ cypress/
   ├─ support/
   │  ├─ commands.js             # cy.captureDom(name)
   │  └─ e2e.js                  # afterEach → cy.captureDom('homepage')
   ├─ dom-snapshots/             # generated, gitignored candidate
   ├─ e2e/                       # generated specs
   └─ fixtures/
```

---

## 7. How to run

```bash
# 1. Serve the target app (separate terminal, from the folder containing eclat-shop.html)
cd /Users/nageshallur/AI-Sdet-Agent
python3 -m http.server 8080

# 2. Run the AI-SDET pipeline
node index.js                       # uses default story in index.js
USER_STORY="Filter products by Tech category" node index.js
```

Outputs:
- `cypress/e2e/<spec>.cy.js`           generated spec
- `cypress/support/pages/<Page>.js`    generated Page Object
- `cypress/dom-snapshots/homepage.html` post-render DOM (auto-captured)
- `cypress-failure.log` + `cypress-failure-context.json` on failure

---

## 8. Conventions worth keeping

- **No `cy.intercept`** — app has no backend.
- **No hardcoded protocol** in `cy.visit` — always `cy.visit('/eclat-shop.html')`.
- **No invented selectors** — only those visible in the DOM snapshot or in
  `prompts/generate_test_script.txt`'s catalog.
- **POM only** — specs import Page Objects from `cypress/support/pages/`.
- **JSON-only LLM output** — agents return `{ files: [{path, content}] }`,
  parsed in `index.js`.
- **DOM snapshot is the source of truth** — every prompt receives it when
  available; classifier + fixer use it for selector recovery.
