// Custom Cypress commands.
//
// captureDom(name = 'homepage')
//   Writes the current document's outerHTML to cypress/dom-snapshots/<name>.html.
//   The AI-SDET fixer agent reads these snapshots so it can heal selectors
//   against the real, post-render DOM rather than guessing.
Cypress.Commands.add("captureDom", (name = "homepage") => {
  cy.document({ log: false }).then((doc) => {
    cy.writeFile(
      `cypress/dom-snapshots/${name}.html`,
      doc.documentElement.outerHTML,
      { log: false }
    );
  });
});
