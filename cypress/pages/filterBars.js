class FilterBars {
    elements = {
        filtersBar: () => cy.get('.filters-bar'),
        filterChip: (param) => cy.contains('.fchip', param)
    }

    clickFilterButton(category) {
        this.elements.filterChip(category).should('be.visible').click()
    }

    verifyFiltersBarVisible() {
        this.elements.filtersBar().should('be.visible')
    }

    verifyFilterApplied(category) {
        this.elements.filterChip().should('have.class', 'active')
    }

}

export default FilterBars
