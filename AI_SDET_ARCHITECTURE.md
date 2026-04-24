# AI-SDET Agent — Architecture & Roadmap

An autonomous test generation pipeline that converts plain-language user stories
into Cypress test suites using LLM agents, deterministic code templates, and
self-healing capabilities.

---

## 1. System Overview

```
 User Story (.md)
       │
       ▼
 ┌─────────────────────────────────────────────────────────────┐
 │                    AI-SDET PIPELINE                         │
 │                                                             │
 │  Stage 0 ──► Stage 1 ──► Stage 2 ──► Stage 3 ──► Stage 4   │
 │  Compile     Design      Generate    Execute     Self-Heal  │
 │  POs         Test Cases  Spec Files  Cypress     Fix Specs  │
 │  (one-time)  (per story) (per story) (all specs) (if fail)  │
 │                                                             │
 │  LLM: gpt-4o via LangChain/LangGraph                       │
 │  Tracing: LangSmith                                         │
 │  Runner: Cypress 15                                         │
 └─────────────────────────────────────────────────────────────┘
       │
       ▼
 Passing Cypress Tests + pipeline.log + LangSmith Traces
```

**Target App**: NOVA / Eclat Shop — single-page static HTML SPA, no backend,
all flows in modals, auth via localStorage.

---

## 2. Core Architecture: Compiled AI

Based on the [Compiled AI](https://arxiv.org/html/2604.05150v1) pattern:
LLM runs once during a **compilation phase**, then code executes
**deterministically** without further model invocation for the same input.

### Separation of Concerns

| Concern | Who Handles It | How |
|---------|---------------|-----|
| **WHAT** to test (selectors, actions, assertions) | LLM (gpt-4o) | Structured JSON output |
| **HOW** to write code (JS patterns, syntax, formatting) | Code templates | Deterministic generation |
| **WHEN** to run (orchestration, retries, validation) | index.js | Pipeline logic |

The LLM never writes JavaScript directly. It outputs structured JSON definitions
that code templates convert to JavaScript files. This eliminates:
- Non-deterministic code patterns (getters vs methods vs arrow functions)
- Selector scoping bugs (`.msubmit` matching 2 elements)
- Property name mismatches (`test.cartDrawer` vs `test.cart`)
- Formatting/linter interference

---

## 3. Pipeline Stages

### Stage 0: Compile Page Objects (one-time)

```
DOM Snapshot ──► LLM (Structured Output) ──► PO Definition JSON ──► Code Template ──► .js files
```

- **Input**: Cleaned DOM snapshot (scripts/styles stripped, 20K chars max)
- **LLM**: OpenAI Structured Outputs (`strict: true`) with `PO_DEFINITION_SCHEMA`
- **Output**: JSON defining 6 Page Objects with elements, actions, verifications
- **Template**: Converts JSON → JavaScript files with consistent `elements = {}` pattern
- **Infrastructure**: Also writes BaseTest, commands.js, e2e.js, users.json deterministically
- **Cached**: Writes to `cypress/compiled/po-definition.json` — skips LLM on subsequent runs

**Prompt injection protection**: DOM sanitized (comments, template tags, data-prompt attrs stripped).

### Stage 1: Design Test Cases (per story)

```
User Story + DOM ──► Designer Agent ──► Test Cases JSON
```

- **Agent**: `testDesignerAgent` (LangGraph ReAct, no tools)
- **Output**: `{ feature, story, cases: [{ id, title, given, when, then, selectors_hint, priority }] }`
- **Artifact**: Written to `cypress/test-cases/<slug>.json` — human-reviewable

### Stage 2: Generate Spec Definition (per story)

```
Test Cases + PO Catalog ──► Generator LLM ──► Spec Definition JSON ──► Code Template ──► .cy.js
```

- **Input**: Test cases JSON + PO method catalog (auto-generated from Stage 0 output)
- **Output**: `{ spec, feature, tests: [{ id, title, steps: [{ call, args }] }] }`
- **Validation**: Test count check + PO method cross-validation (retry on failure)
- **Template**: Converts JSON → Cypress spec file with BaseTest import pattern

### Stage 3: Execute Cypress

```
Spec Files ──► npx cypress run ──► pass/fail + failure.log
```

- **Runner**: `tools/cypress_runner.js` — spawns Cypress, streams output, captures log
- **Classification**: Regex-based failure classifier (server_unreachable, timeout, selector, assertion, spec_error)

### Stage 4: Self-Healing Fix Loop (max 3 retries)

```
Failure Log + Spec Source + PO Catalog ──► Fixer LLM ──► Patched Spec ──► Re-run Cypress
```

- **Constraint**: Fixer can ONLY modify `cypress/e2e/*.cy.js` — all other files are protected
- **Bail conditions**: Infrastructure failures (server_unreachable, baseurl_issue)
- **Input**: All failing specs batched into single fixer call (prevents PO clobbering)

---

## 4. File Structure

```
AI-Sdet-Agent/
├── index.js                          # Pipeline orchestrator
├── llm.js                            # ChatOpenAI wrapper (gpt-4o, temp 0.2)
├── .env                              # API keys, BASE_URL
├── cypress.config.js                 # Cypress config (CommonJS)
├── eclat-shop.html                   # Target SPA
│
├── agents/                           # LangGraph ReAct agents (no tools)
│   ├── po_generator.js              # Stage 0
│   ├── test_designer.js             # Stage 1
│   ├── test_generator.js            # Stage 2
│   └── test_fixer.js                # Stage 4
│
├── prompts/                          # System prompts (prompt-injection hardened)
│   ├── generate_page_objects.txt    # Stage 0
│   ├── generate_test_cases.txt      # Stage 1
│   ├── generate_test_script.txt     # Stage 2
│   └── fix_test.txt                 # Stage 4
│
├── tools/                            # Code generators & utilities
│   ├── schemas.js                   # OpenAI JSON schemas
│   ├── po_template.js               # PO JSON → JavaScript
│   ├── spec_template.js             # Spec JSON → JavaScript
│   ├── cypress_runner.js            # Spawn + capture Cypress
│   ├── dom_context_builder.js       # Strip scripts/styles from DOM
│   ├── page_object_index.js         # PO scanner + BaseTest property mapper
│   └── validator.js                 # Guardrail validation
│
├── stories/                          # Input: user stories (markdown)
│   ├── browse-products.md
│   ├── filter-by-category.md
│   ├── user-login.md
│   └── user-signup.md
│
├── cypress/
│   ├── compiled/po-definition.json  # Master PO definition (cached)
│   ├── base/baseTest.js             # BaseTest class (deterministic)
│   ├── pages/                       # 6 Page Objects (deterministic)
│   │   ├── homePage.js
│   │   ├── loginPage.js
│   │   ├── signUpPage.js
│   │   ├── filterBars.js
│   │   ├── catalogue.js
│   │   └── cartDrawer.js
│   ├── e2e/                         # Generated spec files
│   ├── test-cases/                  # Generated test case JSONs
│   ├── fixtures/users.json          # Test data (deterministic)
│   ├── support/commands.js          # seedUser + captureDom
│   ├── support/e2e.js               # Root setup
│   └── dom-snapshots/               # Post-test DOM captures
│
├── pipeline.log                      # Execution trace
├── cypress-failure.log              # Failure output
└── cypress-failure-context.json     # Failure metadata
```

---

## 5. Page Object Pattern

All 6 Page Objects follow the `cypress-ecommerce` reference pattern:

```javascript
class PageName {
    elements = {
        buttonName: () => cy.get('#selector'),
        inputField: () => cy.get('#parent').find('.child'),
        textButton: () => cy.get('#container').contains('Button Text'),
        dynamic: (param) => cy.contains('.class', param),
    }

    // Action methods — user interactions
    clickSomething() {
        this.elements.buttonName().should('be.visible').click()
    }

    fillForm(email, password) {
        this.elements.emailInput().should('be.visible').clear().type(email)
        this.elements.passwordInput().should('be.visible').clear().type(password)
    }

    // Verification methods — assertions only
    verifySomethingVisible() {
        this.elements.something().should('be.visible')
    }
}

export default PageName
```

**6 Page Objects**:

| Class | BaseTest Property | Responsibility |
|-------|------------------|----------------|
| HomePage | `test.homePage` | Nav buttons, user chip, cart badge |
| LoginPage | `test.loginPage` | Login form, credentials, sign-in |
| SignUpPage | `test.signUpPage` | Signup form, account creation |
| FilterBars | `test.filterBars` | Category filter chips |
| Catalogue | `test.catalogue` | Product grid, cards, results info |
| CartDrawer | `test.cart` | Cart drawer, checkout, items |

---

## 6. BaseTest Pattern

```javascript
import HomePage from "../pages/homePage"
// ... all 6 PO imports

export class BaseTest {
    homePage = new HomePage()
    loginPage = new LoginPage()
    signUpPage = new SignUpPage()
    filterBars = new FilterBars()
    catalogue = new Catalogue()
    cart = new Cart()
    users = {}

    constructor() {
        before(() => {
            cy.fixture('users').then((data) => { this.users = data })
        })
        beforeEach(() => {
            cy.seedUser(this.users.validUser)
            cy.visit('/eclat-shop.html')
        })
    }
}
```

**Spec files import and use**:
```javascript
import { BaseTest } from "../base/baseTest"
const test = new BaseTest()

describe("Feature", () => {
  it("TC-01 test", () => {
    test.homePage.clickLogIn()
    test.loginPage.login(test.users.validUser.email, test.users.validUser.password)
    test.homePage.verifyUserChipAfterLogin(test.users.validUser.name)
  })
})
```

---

## 7. Guardrails & Validation

| Guardrail | Where | What It Catches |
|-----------|-------|-----------------|
| JSON Schema (strict: true) | Stage 0 | Guarantees valid PO definition structure |
| Test count validation | Stage 2 | Specs with fewer tests than test cases |
| PO method cross-validation | Stage 2 | Spec calls methods not in PO catalog |
| BaseTest property check | Stage 2 | Wrong property names (cartDrawer vs cart) |
| File path protection | Stage 4 | Fixer touching infrastructure files |
| DOM sanitization | Stage 0 | Prompt injection via HTML comments/attrs |
| Assertion normalization | Template | LLM returns "visible" → template outputs "be.visible" |

---

## 8. Observability

- **pipeline.log**: `[timestamp] [STAGE] action — detail` for every step
- **cypress-failure.log**: Full Cypress stdout/stderr on failure
- **cypress-failure-context.json**: `{ timestamp, exitCode, type, specs }`
- **LangSmith**: All LLM calls traced to project `ai-sdet`
- **DOM snapshots**: `cypress/dom-snapshots/homepage.html` captured after each test

---

## 9. Commands

```bash
# Serve the target app (required)
python3 -m http.server 8080

# Run all stories
node index.js

# Run single story
node index.js browse-products

# Ad-hoc story
USER_STORY="User can add product to cart" node index.js

# Run Cypress manually
npx cypress run --spec "cypress/e2e/user-login.cy.js"
npx cypress open

# Force PO regeneration (delete compiled cache)
rm -rf cypress/compiled && node index.js
```

---

## 10. Technology Stack

| Component | Technology |
|-----------|-----------|
| LLM | OpenAI gpt-4o via GreatLearning proxy |
| Agent Framework | LangChain + LangGraph (createReactAgent) |
| Tracing | LangSmith |
| Test Runner | Cypress 15 |
| Runtime | Node.js (ESM) |
| Target App | Static HTML SPA (eclat-shop.html) |

---

## 11. Roadmap

### Completed

- [x] Two-stage design: Designer (test cases) + Generator (specs)
- [x] Stage 0: PO compilation from DOM with OpenAI Structured Outputs
- [x] Deterministic code templates (JSON → JavaScript)
- [x] BaseTest + 6 focused Page Objects (cypress-ecommerce pattern)
- [x] Guardrail validator (test count, PO method cross-check, property names)
- [x] Self-healing fixer (spec-only, infrastructure protected)
- [x] Pipeline log trail
- [x] LangSmith integration
- [x] Prompt injection protection
- [x] gpt-4o-mini → gpt-4o upgrade

### In Progress

- [ ] Template edge case fixes (assertion normalization, parameterized elements)
- [ ] First-run pass rate: currently ~60-80%, target 100%

### Next Steps

- [ ] **True ReAct agents** with tools (DOM reader, file writer, Cypress runner) for autonomous reasoning
- [ ] **Multi-attribute element fingerprinting** for self-healing (ID + class + text + position)
- [ ] **CI/CD integration** — GitHub Actions workflow with story matrix
- [ ] **Visual regression** — screenshot comparison between runs
- [ ] **Case-level result reporting** — per-TC pass/fail feeding back to LangSmith
- [ ] **Playwright support** — same JSON definitions, different code template
- [ ] **Dynamic PO updates** — detect app changes via DOM diff, regenerate only affected POs

### Future Vision

- [ ] Natural language test execution: `node index.js "test that checkout works"`
- [ ] PR-triggered test generation: new story in PR → auto-generate specs
- [ ] Cross-browser matrix execution
- [ ] Performance test generation from user stories
- [ ] API test generation (when backend is added)

---

## 12. Design Decisions

| Decision | Rationale |
|----------|-----------|
| LLM outputs JSON, not code | Eliminates non-deterministic code patterns; code templates guarantee consistency |
| One-time PO compilation | Avoid redundant LLM calls; POs only change when app DOM changes |
| Fixer restricted to spec files | Prevents cascading failures from PO/infrastructure modifications |
| BaseTest with constructor hooks | Matches cypress-ecommerce pattern; specs stay clean |
| DOM snapshot as source of truth | LLM discovers selectors from actual rendered HTML, not hardcoded catalogues |
| Per-story fixtures | Prevents cross-story data collisions |
| Structured Outputs for PO schema | 100% JSON compliance via constrained decoding |
| gpt-4o over gpt-4o-mini | Better DOM comprehension, rule following, and multi-step reasoning |

---

## 13. Lessons Learned

1. **LLMs can't reliably write code in a specific pattern** — they mix getters, methods, arrow functions. The fix: don't let them write code at all. JSON in, template out.

2. **Prompt rules get ignored proportionally to distance from the top** — the #1 rule must be the first thing the LLM reads.

3. **External formatters/linters break LLM-generated code** — another reason to use deterministic templates that regenerate from JSON.

4. **Cross-story PO overwrites** were the most damaging bug — solved by one-time compilation + file protection.

5. **DOM snapshots must be cleaned** — raw Cypress-injected DOM is 43K chars of JavaScript. Cleaning to 16K chars of HTML made selector discovery work.

6. **OpenAI Structured Outputs** (`strict: true`) guarantee valid JSON but may truncate long responses — use for schema-critical output (PO definitions), not for variable-length content (spec definitions).

7. **The fixer is a safety net, not a crutch** — if the architecture is right, the fixer should rarely be needed. First-run pass rate is the true measure of quality.
