class LoginPage {
    elements = {
        loginTab: () => cy.get('#tab-login'),
        emailInput: () => cy.get('#l-email'),
        passwordInput: () => cy.get('#l-pass'),
        submitButton: () => cy.get('#form-login .msubmit'),
        statusMessage: () => cy.get('#l-msg')
    }

    switchToLogin() {
        this.elements.loginTab().should('be.visible').click()
    }

    login(email, password) {
        this.elements.loginTab().should('be.visible').click()
        this.elements.emailInput().should('be.visible').type(email)
        this.elements.passwordInput().should('be.visible').type(password)
        this.elements.submitButton().should('be.visible').click()
    }

    verifyLoginFormVisible() {
        cy.get('#form-login').should('be.visible'); cy.get('#l-email').should('be.visible'); cy.get('#l-pass').should('be.visible')
    }

    verifySigningInMessage() {
        cy.get('#l-msg').should('be.visible').and('not.be.empty')
    }

    verifyErrorMessage(message) {
        cy.get('#l-msg').should('contain.text', message)
    }

}

export default LoginPage
