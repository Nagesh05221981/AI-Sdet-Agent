import { BaseTest } from "../base/baseTest"
const test = new BaseTest()

describe("Product Search and Checkout", () => {
  it("TC-01 Search for a product", () => {
    test.homePage.search("headphone")
    test.homePage.verifySearchResults()
  })

  it("TC-02 Add product to cart", () => {
    test.homePage.search("headphone")
    test.catalogue.addToCart("Wireless Noise-Cancelling Headphones")
    test.homePage.verifyCartCount(1)
  })

  it("TC-03 Checkout the cart", () => {
    test.homePage.search("headphone")
    test.catalogue.addToCart("Wireless Noise-Cancelling Headphones")
    test.homePage.clickCartIcon()
    test.cart.clickCheckout()
    test.cart.verifyOrderConfirmationVisible()
  })

  it("TC-04 Dismiss order confirmation", () => {
    test.homePage.search("headphone")
    test.catalogue.addToCart("Wireless Noise-Cancelling Headphones")
    test.homePage.clickCartIcon()
    test.cart.clickCheckout()
    test.cart.verifyOrderConfirmationVisible()
    test.cart.dismissOrderConfirmation()
  })

  it("TC-05 Clear search bar", () => {
    test.homePage.search("headphone")
    test.homePage.clearSearch()
    test.catalogue.verifyGridVisible()
  })

})
