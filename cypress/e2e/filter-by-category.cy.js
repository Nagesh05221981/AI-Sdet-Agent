import ShopPage from '../support/pages/ShopPage.js';

describe('Filter By Category', () => {
  const page = new ShopPage();

  beforeEach(() => {
    cy.visit('/eclat-shop.html');
  });

  it('TC-01 all filter chips are visible on load', () => {
    page.filterChips.should('be.visible');
  });

  it('TC-02 clicking Tech activates the filter chip', () => {
    page.filterChips.contains('Tech').click();
    page.filterChips.contains('Tech').should('have.class', 'active');
  });

  it('TC-03 filtering by Tech shows relevant products', () => {
    page.filterChips.contains('Tech').click();
    page.productCards.each(($card) => {
      cy.wrap($card).find('.pcard-cat').should('contain', 'Tech');
    });
    page.resultsInfo.should('not.be.empty');
  });

  it('TC-04 clicking All resets the filter', () => {
    page.filterChips.contains('Tech').click();
    page.filterChips.contains('All').click();
    page.productCards.should('be.visible');
    page.resultsInfo.should('not.be.empty');
  });
});
