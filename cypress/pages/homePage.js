class HomePage {
    elements = {
        logInButton: () => cy.get('#auth-btns').contains('button', 'Login'),
        signUpButton: () => cy.get('#auth-btns').contains('button', 'Sign Up'),
        userChip: () => cy.get('#user-chip'),
        userNameLabel: () => cy.get('#uname-label'),
        logoutButton: () => cy.get('#user-chip').find('button').contains('Out'),
        cartIcon: () => cy.get('.cart-pill'),
        cartBadge: () => cy.get('#cart-count'),
    }

    clickLogIn() {
        this.elements.logInButton().should('be.visible').click()
    }

    clickSignUp() {
        this.elements.signUpButton().should('be.visible').click()
    }

    openCart() {
        this.elements.cartIcon().should('be.visible').click()
    }

    clickLogOut() {
        this.elements.logoutButton().should('be.visible').click()
    }

    verifyUserChipAfterLogin(expectedName) {
        this.elements.userChip().should('be.visible')
        this.elements.userNameLabel().should('be.visible').and('contain', expectedName)
    }

    verifyLogout() {
        this.elements.userChip().should('not.be.visible')
        this.elements.logInButton().should('be.visible')
    }

    verifyCartCount(expectedCount) {
        this.elements.cartBadge().should('be.visible').and('contain.text', expectedCount)
    }
}

export default HomePage
