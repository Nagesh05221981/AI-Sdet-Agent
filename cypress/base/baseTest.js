import HomePage from "../pages/homePage.js"
import LoginPage from "../pages/loginPage.js"
import SignUpPage from "../pages/signUpPage.js"
import FilterBars from "../pages/filterBars.js"
import Catalogue from "../pages/catalogue.js"
import CartDrawer from "../pages/cartDrawer.js"

export class BaseTest {
    homePage = new HomePage()
    loginPage = new LoginPage()
    signUpPage = new SignUpPage()
    filterBars = new FilterBars()
    catalogue = new Catalogue()
    cart = new CartDrawer()
    users = {}

    constructor() {
        before(() => {
            cy.fixture('users').then((data) => {
                this.users = data
            })
        })
        beforeEach(() => {
            cy.seedUser(this.users.validUser)
            cy.visit('/eclat-shop.html')
        })
    }
}
