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
        this.elements.searchInput().should('be.visible').clear().type(value)
        this.elements.searchInput().should('be.visible').type(text)
    }

    verifyUserLoggedIn(username) {
        cy.get('#uname-label').should('contain.text', username)
    }

    verifyCartCount(count) {
        cy.get('#cart-count').should('have.text', count)
    }

    verifyUserLoggedOut() {
        cy.get('#auth-btns').should('be.visible')
    }

}

export default HomePage
