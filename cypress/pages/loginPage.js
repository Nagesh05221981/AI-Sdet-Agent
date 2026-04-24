class LoginPage {
    elements = {
        loginTab: () => cy.get('#tab-login'),
        emailInput: () => cy.get('#l-email'),
        passwordInput: () => cy.get('#l-pass'),
        signInButton: () => cy.get('#form-login').find('.msubmit'),
        loginStatus: () => cy.get('#l-msg')
    }

    switchToLogin() {
        this.elements.loginTab().should('be.visible').click()
    }

    login(email, password) {
        this.elements.loginTab().should('be.visible').click()
        this.elements.emailInput().should('be.visible').clear().type(email)
        this.elements.passwordInput().should('be.visible').clear().type(password)
        this.elements.signInButton().should('be.visible').click()
    }

    verifySigningInMessage() {
        this.elements.loginStatus().should('be.visible')
    }

    verifyLoginFormVisible() {
        this.elements.loginTab().should('click')
        this.elements.emailInput().should('be.visible')
        this.elements.passwordInput().should('be.visible')
    }

}

export default LoginPage
