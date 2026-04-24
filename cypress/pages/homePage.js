class HomePage {
    elements = {
        loginButton: () => cy.get('.btn.btn-ghost').contains('Login'),
        signupButton: () => cy.get('.btn.btn-fill').contains('Sign Up'),
        userChip: () => cy.get('#user-chip'),
        usernameLabel: () => cy.get('#uname-label'),
        logoutButton: () => cy.get('#user-chip .btn.btn-ghost'),
        cartIcon: () => cy.get('.cart-pill'),
        cartBadge: () => cy.get('#cart-count'),
        searchInput: () => cy.get('#search-input')
    }

    clickLogin() {
        this.elements.loginButton().should('be.visible').click()
    }

    clickSignup() {
        this.elements.signupButton().should('be.visible').click()
    }

    clickLogout() {
        this.elements.logoutButton().should('be.visible').click()
    }

    clickCartIcon() {
        this.elements.cartIcon().should('be.visible').click()
    }

    typeSearch(text) {
        this.elements.searchInput().should('be.visible').type(text)
    }

    clearSearch() {
        cy.get('#search-input').clear()
    }

    search(term) {
        cy.get('#search-input').clear().type(term)
    }

    verifyUserLoggedIn() {
        cy.get('#user-chip').should('be.visible'); cy.get('#uname-label').should('not.be.empty')
    }

    verifyCartCount(expectedCount) {
        cy.get('#cart-count').should('contain.text', String(expectedCount))
    }

    verifyUserLoggedOut() {
        cy.get('#auth-btns').should('be.visible')
    }

    verifySearchResults() {
        cy.get('#results-info').should('not.be.empty')
    }

}

export default HomePage
