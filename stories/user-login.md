# User Login

As a returning shopper, I want to log into my account so I can checkout.

## Preconditions

- Login requires an existing user account. Seed the user in localStorage
  before cy.visit() — do NOT sign up through the UI in this test.

## Acceptance criteria

- Clicking the Login button on the home page opens the auth modal.
- The login form displays email and password fields.
- User can log in with seeded credentials and #user-chip becomes visible.
