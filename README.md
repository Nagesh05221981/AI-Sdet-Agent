# AI-SDET Agent

An autonomous AI-powered test automation pipeline that converts plain-language user stories into passing Cypress test suites using the **Compiled AI** architecture.

## How It Works

```
User Story (.md) → LLM designs test cases → LLM generates spec JSON → Code template → Cypress tests → Self-heal if needed
```

The LLM decides **WHAT** to test (selectors, actions, assertions). Deterministic code templates decide **HOW** to write the code (JavaScript patterns, POM structure). This separation eliminates non-deterministic code generation.

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Serve the target app
python3 -m http.server 8080

# 3. Run the pipeline
node index.js
```

## Pipeline Stages

| Stage | What It Does |
|-------|-------------|
| **Stage 0** | Compile Page Objects from DOM snapshot (one-time) |
| **Stage 1** | Designer LLM reads story → structured test cases JSON |
| **Stage 2** | Generator LLM reads test cases + PO catalog → spec JSON → code template → .cy.js |
| **Stage 2.5** | Validator checks test count, PO method names, BaseTest properties |
| **Stage 3** | Run Cypress (all specs together) |
| **Stage 4** | Self-healing: spec fixer + locator healer |

## Run Modes

```bash
node index.js                          # All stories (skip existing specs)
node index.js browse-products          # Single story
node index.js --force user-login       # Force regenerate
node index.js --force                  # Regenerate everything
```

## Adding a New Story

1. Create `stories/<slug>.md`:
```markdown
# Feature Name

As a user, I want to do X so I can achieve Y.

## Acceptance criteria

- First criterion
- Second criterion
```

2. Run: `node index.js`

The pipeline generates test cases, creates the spec, and runs all tests together.

## Project Structure

```
AI-Sdet-Agent/
├── index.js                    # Pipeline orchestrator
├── llm.js                      # ChatOpenAI wrapper (gpt-4o)
├── agents/                     # LLM agents (LangGraph)
├── prompts/                    # System prompts (prompt-injection hardened)
├── tools/                      # Code generators & utilities
│   ├── schemas.js             # OpenAI Structured Output schemas
│   ├── po_template.js         # PO JSON → JavaScript generator
│   ├── spec_template.js       # Spec JSON → JavaScript generator
│   ├── locator_healer.js      # Self-healing broken selectors
│   └── cypress_runner.js      # Spawn + capture Cypress
├── stories/                    # Input: user stories (.md)
├── cypress/
│   ├── compiled/              # PO definition JSON (source of truth)
│   ├── pages/                 # Generated Page Objects (6 focused POs)
│   ├── base/baseTest.js       # BaseTest class with fixtures
│   ├── e2e/                   # Generated spec files
│   └── test-cases/            # Designed test cases JSON
├── eclat-shop.html            # Target SPA
└── pipeline.log               # Execution trace
```

## Page Object Pattern

Follows the [cypress-ecommerce](https://github.com/Nagesh05221981/cypress-ecommerce) reference framework:

```javascript
class HomePage {
    elements = {
        logInButton: () => cy.get('#auth-btns').contains('button', 'Login'),
        cartBadge: () => cy.get('#cart-count'),
    }

    clickLogIn() {
        this.elements.logInButton().should('be.visible').click()
    }

    verifyCartCount(expectedCount) {
        this.elements.cartBadge().should('contain.text', expectedCount)
    }
}
export default HomePage
```

**6 Page Objects**: HomePage, LoginPage, SignUpPage, FilterBars, Catalogue, CartDrawer

**Specs use BaseTest**:
```javascript
import { BaseTest } from "../base/baseTest"
const test = new BaseTest()

describe("Browse Products", () => {
  it("TC-01 Grid renders on load", () => {
    test.catalogue.verifyGridVisible()
    test.homePage.verifyCartCount(0)
  })
})
```

## Guardrails

- **Validator**: Checks test count, PO method cross-validation, BaseTest property names
- **Protected files**: Fixer cannot modify POs, BaseTest, commands.js, e2e.js
- **Locator healer**: Auto-detects and fixes broken selectors via DOM comparison
- **Prompt injection protection**: DOM sanitized before sending to LLM
- **Empty story rejection**: Prevents LLM hallucination on empty files

## Self-Healing

When selectors break (app DOM changes):
1. Detects `selector_issue` from Cypress failure
2. Extracts broken selectors from error log
3. LLM compares against live DOM snapshot → suggests replacements
4. Validates replacements exist in DOM
5. Updates `po-definition.json` → regenerates PO code
6. Re-runs Cypress

## Tech Stack

| Component | Technology |
|-----------|-----------|
| LLM | OpenAI gpt-4o |
| Agent Framework | LangChain + LangGraph |
| Tracing | LangSmith |
| Test Runner | Cypress 15 |
| Target App | Static HTML SPA (eclat-shop.html) |

## Architecture

See [AI_SDET_ARCHITECTURE.md](AI_SDET_ARCHITECTURE.md) for the full architecture document including design decisions, lessons learned, and roadmap.

## Results

- **26 tests** across **6 stories**
- **First-run pass rate**: ~90%+ (most stories pass without fixer)
- **Self-healing**: Locator healer fixes broken selectors automatically

## Environment Variables

```
OPENAI_API_KEY=...
OPENAI_API_BASE=...
API_BASE_URL=http://localhost:8080
LANGCHAIN_TRACING_V2=true
LANGCHAIN_API_KEY=...
LANGCHAIN_PROJECT=ai-sdet
```
