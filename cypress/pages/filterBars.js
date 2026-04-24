export default class FilterBars {
  get filtersBar() { return cy.get('.filters-bar'); }
  get filterChip() { return cy.get('.fchip'); }

  verifyFiltersBarVisible() {
    this.filtersBar.should('be.visible');
  }

  clickFilterButton(category) {
    this.filterChip.contains(category, { timeout: 10000 }).click();
  }

  verifyFilterApplied(category) {
    this.filterChip.contains(category).should('have.class', 'active');
  }
}
