class LoginPage {
    elements = {
        loginTab: () => cy.get('#tab-login'),
        emailInput: () => cy.get('#l-email'),
        passwordInput: () => cy.get('#l-pass'),
        signInButton: () => cy.get('#form-login').find('.msubmit'),
        loginStatus: () => cy.get('#l-msg'),
    }

    login(email, password) {
        this.elements.loginTab().click()
        this.elements.emailInput().should('be.visible').clear().type(email)
        this.elements.passwordInput().should('be.visible').clear().type(password)
        this.elements.signInButton().should('be.visible').click()
    }

    switchToLogin() {
        this.elements.loginTab().click()
    }

    verifyLoginFormVisible() {
        this.elements.emailInput().should('be.visible')
        this.elements.passwordInput().should('be.visible')
    }

    verifySigningInMessage() {
        this.elements.loginStatus()
            .should('be.visible')
            .and('contain.text', 'Signing you in')
    }
}

export default LoginPage
