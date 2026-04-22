// Loaded automatically before every spec file (configured in cypress.config.js).

import "./commands";

// Always snapshot the post-render DOM after each test so the self-healing
// agent has a fresh reference. Wrapped in a try-style afterEach: if the
// document is unavailable (test bailed before cy.visit), Cypress will skip
// the writeFile and continue.
afterEach(() => {
  cy.window({ log: false }).then((win) => {
    if (win && win.document) {
      cy.captureDom("homepage");
    }
  });
});
