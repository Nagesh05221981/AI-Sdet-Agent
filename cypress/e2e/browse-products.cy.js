import { BaseTest } from "../base/baseTest"
const test = new BaseTest()

describe("Browse Products", () => {
  it("TC-01 Grid renders on load", () => {
    test.catalogue.verifyGridVisible()
  })

  it("TC-02 Each product card shows name, category, and price", () => {
    test.catalogue.verifyProductCardDetails()
  })

  it("TC-03 Results info reflects visible product count", () => {
    test.catalogue.verifyResultsInfo().should('not.be.empty')
  })

  it("TC-04 Cart starts empty and checkout button is disabled", () => {
    test.homePage.verifyCartCount(0)
    test.cart.verifyCheckoutDisabled()
  })

})
