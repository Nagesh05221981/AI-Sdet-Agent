class SignUpPage {
    elements = {
        signupTab: () => cy.get('#tab-signup'),
        nameInput: () => cy.get('#s-name'),
        emailInput: () => cy.get('#s-email'),
        passwordInput: () => cy.get('#s-pass'),
        submitButton: () => cy.get('#form-signup .msubmit'),
        statusMessage: () => cy.get('#s-msg')
    }

    switchToSignup() {
        this.elements.signupTab().should('be.visible').click()
    }

    signup(name, email, password) {
        this.elements.signupTab().should('be.visible').click()
        this.elements.nameInput().should('be.visible').clear().type(value)
        this.elements.nameInput().should('be.visible').type(name)
        this.elements.emailInput().should('be.visible').clear().type(value)
        this.elements.emailInput().should('be.visible').type(email)
        this.elements.passwordInput().should('be.visible').clear().type(value)
        this.elements.passwordInput().should('be.visible').type(password)
        this.elements.submitButton().should('be.visible').click()
    }

    verifySignupFormVisible() {
        cy.get('#form-signup').should('be.visible')
    }

    verifySuccessMessage() {
        cy.get('#s-msg').should('contain.text', 'Account created')
    }

    verifyErrorMessage(message) {
        cy.get('#s-msg').should('contain.text', message)
    }

}

export default SignUpPage
