import { BaseTest } from "../base/baseTest"
const test = new BaseTest()

describe("Product Selection and Checkout", () => {
  it("TC-01 Add product to cart", () => {
    test.catalogue.addToCart("Wireless Noise-Cancelling Headphones")
    test.homePage.verifyCartCount(1)
  })

  it("TC-02 Verify product in cart", () => {
    test.catalogue.addToCart("Wireless Noise-Cancelling Headphones")
    test.homePage.clickCartIcon()
    test.cart.verifyCartItemPresent("Wireless Noise-Cancelling Headphones")
    test.cart.verifyCartItemQuantity("Wireless Noise-Cancelling Headphones", 1)
  })

  it("TC-03 Checkout button enabled when cart is not empty", () => {
    test.catalogue.addToCart("Wireless Noise-Cancelling Headphones")
    test.homePage.clickCartIcon()
    test.cart.verifyCheckoutEnabled()
  })

  it("TC-04 Checkout process", () => {
    test.catalogue.addToCart("Wireless Noise-Cancelling Headphones")
    test.homePage.clickCartIcon()
    test.cart.clickCheckout()
    test.cart.verifyOrderConfirmationVisible()
  })

  it("TC-05 Dismiss order confirmation", () => {
    test.catalogue.addToCart("Wireless Noise-Cancelling Headphones")
    test.homePage.clickCartIcon()
    test.cart.clickCheckout()
    test.cart.dismissOrderConfirmation()
  })

})
