// Root Cypress config — this is the one Cypress actually picks up.
// Loads .env so BASE_URL is available before defineConfig runs.
require("dotenv").config();

const { defineConfig } = require("cypress");

const baseUrl = process.env.BASE_URL || "http://localhost:8080";

module.exports = defineConfig({
  e2e: {
    baseUrl,
    specPattern: "cypress/e2e/**/*.cy.{js,jsx,ts,tsx}",
    supportFile: "cypress/support/e2e.js",
    video: false,
    screenshotOnRunFailure: true,
    setupNodeEvents(on, config) {
      // Tests resolve URLs against baseUrl directly; no need to expose
      // anything via Cypress.env() (which triggers the allowCypressEnv warning).
      return config;
    },
  },
});
