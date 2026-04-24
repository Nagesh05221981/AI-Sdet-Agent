class CartDrawer {
    elements = {
        drawer: () => cy.get('#drawer'),
        drawerBody: () => cy.get('#drawer-body'),
        cartItem: (param) => cy.contains('.ci', param),
        cartItemName: (param) => cy.contains('.ci-name', param),
        quantityValue: (param) => cy.contains('.qval', param),
        quantityButton: (param) => cy.contains('.qbtn', param),
        deleteButton: (param) => cy.contains('.del-btn', param),
        cartTotal: () => cy.get('#cart-total'),
        checkoutButton: () => cy.get('#checkout-btn'),
        orderConfirmationModal: () => cy.get('#confirm-modal'),
        orderId: () => cy.get('#order-id'),
        modalCloseButton: () => cy.get('#confirm-modal').find('.modal-close')
    }

    clickCheckout() {
        this.elements.checkoutButton().should('be.visible').click()
    }

    removeItem(name) {
        cy.get('#drawer-body').contains('.ci-name', name).parents('.ci').find('.del-btn').click()
    }

    increaseQty(name) {
        cy.get('#drawer-body').contains('.ci-name', name).parents('.ci').find('.qbtn').contains('+').click()
    }

    decreaseQty(name) {
        cy.get('#drawer-body').contains('.ci-name', name).parents('.ci').find('.qbtn').contains('-').click()
    }

    dismissOrderConfirmation() {
        cy.get('#confirm-modal').contains('button', 'Continue Shopping').should('be.visible').click()
    }

    verifyCartEmpty() {
        cy.get('#drawer-body').should('be.empty')
    }

    verifyCartItemPresent(name) {
        cy.get('#drawer-body').should('contain', name)
    }

    verifyCartItemQuantity(name, quantity) {
        cy.get('#drawer-body').contains('.ci-name', name).parents('.ci').find('.qval').should('contain', String(quantity))
    }

    verifyCheckoutDisabled() {
        cy.get('#checkout-btn').should('be.disabled')
    }

    verifyCheckoutEnabled() {
        cy.get('#checkout-btn').should('not.be.disabled')
    }

    verifyOrderConfirmationVisible() {
        cy.get('#confirm-modal').should('be.visible')
    }

    verifyOrderIdVisible() {
        cy.get('#order-id').should('be.visible')
    }

    verifyOrderId() {
        cy.get('#order-id').should('be.visible').and('not.be.empty')
    }

}

export default CartDrawer
