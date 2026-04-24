class Catalogue {
    elements = {
        grid: () => cy.get('#grid'),
        productCards: () => cy.get('.pcard'),
        resultsInfo: () => cy.get('#results-info'),
        noResults: () => cy.get('#no-results'),
    }

    addToCart(productName) {
        this.elements.productCards().contains('.pcard-name', productName).parents('.pcard').find('.add-btn').should('be.visible').click()
    }

    verifyGridVisible() {
        this.elements.grid().should('be.visible')
    }

    verifyProductCardDetails() {
        this.elements.productCards().should('be.visible')
    }

    verifyResultsInfo() {
        this.elements.resultsInfo().should('be.visible')
    }

    verifyCategoryTitle(cat) {
        this.elements.productCards().contains('.pcard-cat', cat).should('be.visible')
    }
}

export default Catalogue
