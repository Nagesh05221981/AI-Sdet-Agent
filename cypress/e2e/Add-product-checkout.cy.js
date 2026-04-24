import { BaseTest } from "../base/baseTest"
const test = new BaseTest()

describe("Product Selection and Checkout", () => {
  it("TC-01 Add product to cart", () => {
    test.catalogue.verifyGridVisible()
    test.catalogue.addToCart("Wireless Noise-Cancelling Headphones")
    test.homePage.verifyCartCount(1)
  })

  it("TC-02 Verify product in cart", () => {
    test.catalogue.verifyGridVisible()
    test.catalogue.addToCart("Wireless Noise-Cancelling Headphones")
    test.homePage.clickCartIcon()
    test.cart.verifyCartItemPresent("Wireless Noise-Cancelling Headphones")
    test.cart.verifyCartItemQuantity("Wireless Noise-Cancelling Headphones", 1)
  })

  it("TC-03 Checkout button enabled", () => {
    test.catalogue.verifyGridVisible()
    test.catalogue.addToCart("Wireless Noise-Cancelling Headphones")
    test.homePage.clickCartIcon()
    test.cart.verifyCheckoutEnabled()
  })

  it("TC-04 Complete checkout process", () => {
    test.catalogue.verifyGridVisible()
    test.catalogue.addToCart("Wireless Noise-Cancelling Headphones")
    test.homePage.clickCartIcon()
    test.cart.clickCheckout()
    test.cart.verifyOrderConfirmationVisible()
  })

  it("TC-05 Dismiss order confirmation", () => {
    test.catalogue.verifyGridVisible()
    test.catalogue.addToCart("Wireless Noise-Cancelling Headphones")
    test.homePage.clickCartIcon()
    test.cart.clickCheckout()
    test.cart.verifyOrderConfirmationVisible()
    test.cart.dismissOrderConfirmation()
    test.catalogue.verifyGridVisible()
  })
})
