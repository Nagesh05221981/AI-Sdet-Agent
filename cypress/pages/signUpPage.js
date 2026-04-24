class SignUpPage {
    elements = {
        signupTab: () => cy.get('#tab-signup'),
        nameInput: () => cy.get('#s-name'),
        emailInput: () => cy.get('#s-email'),
        passwordInput: () => cy.get('#s-pass'),
        createAccountButton: () => cy.get('#form-signup').find('.msubmit'),
        signupStatus: () => cy.get('#s-msg'),
    }

    signup(name, email, password) {
        this.elements.signupTab().click()
        this.elements.nameInput().should('be.visible').clear().type(name)
        this.elements.emailInput().should('be.visible').clear().type(email)
        this.elements.passwordInput().should('be.visible').clear().type(password)
        this.elements.createAccountButton().should('be.visible').click()
    }

    switchToSignup() {
        this.elements.signupTab().click()
    }

    verifySignupFormVisible() {
        this.elements.nameInput().should('be.visible')
        this.elements.emailInput().should('be.visible')
        this.elements.passwordInput().should('be.visible')
    }

    verifySignupSuccessMessage() {
        this.elements.signupStatus()
            .should('be.visible')
            .and('contain.text', 'Account created')
    }

    verifySignupError(message) {
        this.elements.signupStatus()
            .should('be.visible')
            .and('contain.text', message)
    }
}

export default SignUpPage
