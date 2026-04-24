class Catalogue {
    elements = {
        grid: () => cy.get('#grid'),
        productCards: () => cy.get('.pcard'),
        resultsInfo: () => cy.get('#results-info'),
        noResults: () => cy.get('#no-results'),
        firstCard: () => cy.get('.pcard:first'),
        productName: () => cy.get('.pcard-name'),
        productCategory: () => cy.get('.pcard-cat'),
        productPrice: () => cy.get('.pcard-price'),
        addToCartButton: () => cy.get('.add-btn')
    }

    addToCart(productName) {
        this.elements.productName().should('be.visible').click()
        this.elements.addToCartButton().should('be.visible').click()
    }

    verifyGridVisible() {
        this.elements.grid().should('be.visible')
    }

    verifyProductCardDetails() {
        this.elements.productCards().should('be.visible')
    }

    verifyResultsInfo() {
        this.elements.resultsInfo().should('not.be.empty')
    }

}

export default Catalogue
