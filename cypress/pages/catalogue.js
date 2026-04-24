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

    verifyProductDetailsVisible(productName) {
        cy.contains('.pcard', productName).should('be.visible')
    }

    verifyResultsInfo(info) {
        cy.get('#results-info').should('contain.text', info)
    }

    verifyProductCount(count) {
        cy.get('.pcard').should('have.length', count)
    }

}

export default Catalogue
