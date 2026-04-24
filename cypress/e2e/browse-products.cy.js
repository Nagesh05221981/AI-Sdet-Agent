import { BaseTest } from "../base/baseTest"
const test = new BaseTest()

describe("Browse Products", () => {
  it("TC-01 Grid renders on load", () => {
    test.catalogue.verifyGridVisible()
    test.catalogue.verifyResultsInfo()
  })

  it("TC-02 Each product card exposes name, category and price", () => {
    test.catalogue.verifyProductCardDetails()
  })

  it("TC-03 Cart starts empty and checkout button is disabled", () => {
    test.homePage.verifyCartCount(0)
    test.cart.verifyCheckoutDisabled()
  })
})
