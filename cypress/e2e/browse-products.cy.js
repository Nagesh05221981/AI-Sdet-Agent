import ShopPage from '../support/pages/ShopPage.js';

describe('Browse Products', () => {
  const page = new ShopPage();

  beforeEach(() => {
    cy.visit('/eclat-shop.html');
  });

  it('TC-01 grid renders on load', () => {
    page.grid.should('be.visible');
    page.productCards.should('have.length.greaterThan', 0);
    page.resultsInfo.should('be.visible').and('not.be.empty');
  });

  it('TC-02 product cards display correct information', () => {
    page.productCards.should('have.length.greaterThan', 0);
    page.firstProductCard.should('be.visible');
    page.productName.should('be.visible').and('not.be.empty');
    page.productCategory.should('be.visible').and('not.be.empty');
    page.productPrice.should('be.visible').and('not.be.empty');
  });
});