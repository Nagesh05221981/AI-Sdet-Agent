class CartDrawer {
    elements = {
        drawer: () => cy.get('#drawer'),
        drawerBody: () => cy.get('#drawer-body'),
        cartTotal: () => cy.get('#cart-total'),
        checkoutButton: () => cy.get('#checkout-btn'),
        cartItems: () => cy.get('.drawer-body .pcard'),
        removeButton: (productName) => cy.contains('.drawer-body .pcard', productName).find('.remove-btn'),
    }

    clickCheckout() {
        this.elements.checkoutButton().should('be.visible').click()
    }

    removeItem(productName) {
        this.elements.removeButton(productName).should('be.visible').click()
    }

    verifyCartEmpty() {
        this.elements.drawerBody().should('not.contain', '.pcard')
    }

    verifyCartItem(name) {
        this.elements.cartItems().contains('.pcard-name', name).should('be.visible')
    }

    verifyCheckoutDisabled() {
        this.elements.checkoutButton().should('be.disabled')
    }
}

export default CartDrawer
