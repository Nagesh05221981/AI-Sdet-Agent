class CartDrawer {
    elements = {
        drawer: () => cy.get('#drawer'),
        drawerBody: () => cy.get('#drawer-body'),
        cartTotal: () => cy.get('#cart-total'),
        checkoutButton: () => cy.get('#checkout-btn')
    }

    clickCheckout() {
        this.elements.checkoutButton().should('be.visible').click()
    }

    verifyCartEmpty() {
        this.elements.drawerBody().should('be.empty')
    }

    verifyCheckoutDisabled() {
        this.elements.checkoutButton().should('be.disabled')
    }

}

export default CartDrawer
