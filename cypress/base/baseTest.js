import HomePage from "../pages/homePage"
import LoginPage from "../pages/loginPage"
import SignUpPage from "../pages/signUpPage"
import FilterBars from "../pages/filterBars"
import Catalogue from "../pages/catalogue"
import Cart from "../pages/cartDrawer"

export class BaseTest {
    homePage = new HomePage()
    loginPage = new LoginPage()
    signUpPage = new SignUpPage()
    filterBars = new FilterBars()
    catalogue = new Catalogue()
    cart = new Cart()
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
