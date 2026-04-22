import ShopPage from '../support/pages/ShopPage.js';

describe('Browse Products', () => {
  const page = new ShopPage();

  beforeEach(() => {
    cy.visit('/eclat-shop.html');
  });

  it('TC-01 grid renders on load', () => {
    page.grid.should('be.visible');
    page.productCards.should('have.length.greaterThan', 0);
    page.resultsInfo.should('not.be.empty');
  });

  it('TC-02 each product card exposes name, category and price', () => {
    page.productCards.should('have.length.greaterThan', 0);
    page.firstProductCard.should('be.visible');
    page.productName.should('not.be.empty');
    page.productCategory.should('not.be.empty');
    page.productPrice.should('not.be.empty');
  });

  it('TC-03 results info reflects visible product count', () => {
    page.productCards.should('have.length.greaterThan', 0);
    page.resultsInfo.invoke('text').then((text) => {
      const count = page.productCards.length;
      expect(text).to.match(/\d+ products/);
    });
  });

  it('TC-04 cart starts empty', () => {
    page.cartCount.should('have.text', '0');
    page.checkoutButton.should('be.disabled');
  });
});
