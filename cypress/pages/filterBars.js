class FilterBars {
    elements = {
        filterBar: () => cy.get('.filters-bar'),
        filterChip: (param) => cy.contains('.fchip', param)
    }

    clickFilterButton(category) {
        cy.contains('.fchip', category).click()
    }

    verifyFiltersVisible() {
        cy.get('.filters-bar').should('be.visible')
    }

    verifyFilterActive(category) {
        cy.contains('.fchip', category).should('have.class', 'active')
    }

}

export default FilterBars
