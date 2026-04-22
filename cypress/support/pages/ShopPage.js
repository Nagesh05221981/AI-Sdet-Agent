export default class ShopPage {
  get grid() { return cy.get('#grid'); }
  get productCards() { return cy.get('.pcard'); }
  get resultsInfo() { return cy.get('#results-info'); }
  get filterChips() { return cy.get('.fchip'); }
  get firstProductCard() { return this.productCards.first(); }
  get productName() { return this.firstProductCard.find('.pcard-name'); }
  get productCategory() { return this.firstProductCard.find('.pcard-cat'); }
  get productPrice() { return this.firstProductCard.find('.pcard-price'); }
  get cartCount() { return cy.get('#cart-count'); }
  get checkoutButton() { return cy.get('#checkout-btn'); }
}
