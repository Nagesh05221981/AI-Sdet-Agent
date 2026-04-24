// Custom Cypress commands

Cypress.Commands.add('seedUser', (user) => {
    if (!user) return
    const users = JSON.parse(localStorage.getItem('nova_users')) || {}
    users[user.email] = { name: user.name, password: user.password }
    localStorage.setItem('nova_users', JSON.stringify(users))
})

Cypress.Commands.add('captureDom', (name = 'homepage') => {
    cy.document({ log: false }).then((doc) => {
        cy.writeFile(
            `cypress/dom-snapshots/${name}.html`,
            doc.documentElement.outerHTML,
            { log: false }
        )
    })
})
