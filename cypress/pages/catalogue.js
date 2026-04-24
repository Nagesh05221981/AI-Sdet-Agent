class Catalogue {
    elements = {
        grid: () => cy.get('#grid'),
        productCard: (param) => cy.contains('.pcard', param),
        resultsInfo: () => cy.get('#results-info'),
        noResults: () => cy.get('#no-results')
    }

    addToCart(productName) {
        cy.contains('.pcard', productName).find('.add-btn').should('be.visible').click()
    }

    verifyGridVisible() {
        cy.get('#grid').should('be.visible')
    }

    verifyProductCardDetails() {
        cy.get('.pcard').first().within(() => { cy.get('.pcard-name').should('not.be.empty'); cy.get('.pcard-cat').should('not.be.empty'); cy.get('.pcard-price').should('not.be.empty'); })
    }

    verifyResultsInfo() {
        cy.get('#results-info').should('not.be.empty')
    }

    verifyProductCount(count) {
        cy.get('.pcard').should('have.length', count)
    }

}

export default Catalogue
