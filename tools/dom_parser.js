export function captureDom(fileName) {
  cy.document().then(doc => {
    cy.writeFile(`dom-snapshots/${fileName}.html`, doc.documentElement.outerHTML);
  });
}