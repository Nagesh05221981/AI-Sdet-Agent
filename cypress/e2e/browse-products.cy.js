import { BaseTest } from "../base/baseTest"
const test = new BaseTest()

describe("Browse Products", () => {
  it("TC-01 Grid renders on load", () => {
    test.catalogue.verifyGridVisible()
  })

  it("TC-02 Each product card exposes name, category and price", () => {
    test.catalogue.verifyGridVisible()
    test.catalogue.verifyProductCardDetails()
  })

  it("TC-03 #results-info reflects the visible product count", () => {
    test.catalogue.verifyGridVisible()
    test.catalogue.verifyResultsInfo()
  })

  it("TC-04 Cart starts empty and checkout button is disabled", () => {
    test.cart.verifyCartEmpty()
    test.cart.verifyCheckoutDisabled()
  })

})
