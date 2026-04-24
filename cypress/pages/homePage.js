class HomePage {
    elements = {
        logInButton: () => cy.get('#auth-btns').find('.btn-ghost'),
        signUpButton: () => cy.get('#auth-btns').find('.btn-fill'),
        userChip: () => cy.get('#user-chip'),
        userNameLabel: () => cy.get('#uname-label'),
        logoutButton: () => cy.get('#user-chip').find('.btn-ghost'),
        cartIcon: () => cy.get('.cart-pill'),
        cartBadge: () => cy.get('#cart-count')
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
        this.elements.userNameLabel().should('contain.text', expectedName)
    }

    verifyLogout() {
        this.elements.userChip().should('not.be.visible')
    }

    verifyCartCount(expectedCount) {
        this.elements.cartBadge().should('contain.text', expectedCount)
    }

}

export default HomePage
