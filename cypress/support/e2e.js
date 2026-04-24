import './commands'

afterEach(() => {
    cy.window({ log: false }).then((win) => {
        if (win && win.document) {
            cy.captureDom('homepage')
        }
    })
})
