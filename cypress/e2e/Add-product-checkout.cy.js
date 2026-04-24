import { BaseTest } from "../base/baseTest"
const test = new BaseTest()

describe("Cart and Checkout", () => {
  it("TC-01 Add product to cart", () => {
    test.catalogue.verifyGridVisible()
    test.catalogue.addToCart("Wireless Noise-Cancelling Headphones")
    test.homePage.verifyCartCount(1)
    test.cart.verifyCartItemPresent("Wireless Noise-Cancelling Headphones")
  })

  it("TC-02 Verify product details in cart", () => {
    test.catalogue.verifyGridVisible()
    test.catalogue.addToCart("Wireless Noise-Cancelling Headphones")
    test.homePage.clickCartIcon()
    test.cart.verifyCartItemPresent("Wireless Noise-Cancelling Headphones")
    test.cart.verifyCartItemQuantity("Wireless Noise-Cancelling Headphones", 1)
  })

  it("TC-03 Checkout with a product in cart", () => {
    test.catalogue.verifyGridVisible()
    test.catalogue.addToCart("Wireless Noise-Cancelling Headphones")
    test.homePage.clickCartIcon()
    test.cart.clickCheckout()
    test.cart.verifyOrderConfirmationVisible()
  })

  it("TC-04 Dismiss order confirmation", () => {
    test.catalogue.verifyGridVisible()
    test.catalogue.addToCart("Wireless Noise-Cancelling Headphones")
    test.homePage.clickCartIcon()
    test.cart.clickCheckout()
    test.cart.verifyOrderConfirmationVisible()
    test.cart.dismissOrderConfirmation()
  })

  it("TC-05 Add multiple products to cart", () => {
    test.catalogue.verifyGridVisible()
    test.catalogue.addToCart("Wireless Noise-Cancelling Headphones")
    test.catalogue.verifyGridVisible()
    test.catalogue.addToCart("Smart LED Desk Lamp")
    test.homePage.verifyCartCount(2)
  })

  it("TC-06 Remove product from cart", () => {
    test.catalogue.verifyGridVisible()
    test.catalogue.addToCart("Wireless Noise-Cancelling Headphones")
    test.catalogue.verifyGridVisible()
    test.catalogue.addToCart("Smart LED Desk Lamp")
    test.homePage.clickCartIcon()
    test.cart.removeItem("Wireless Noise-Cancelling Headphones")
    test.homePage.verifyCartCount(1)
    test.cart.verifyCartItemPresent("Smart LED Desk Lamp")
  })

  it("TC-07 Adjust product quantity in cart", () => {
    test.catalogue.verifyGridVisible()
    test.catalogue.addToCart("Wireless Noise-Cancelling Headphones")
    test.homePage.clickCartIcon()
    test.cart.increaseQty("Wireless Noise-Cancelling Headphones")
    test.cart.verifyCartItemQuantity("Wireless Noise-Cancelling Headphones", 2)
    test.cart.decreaseQty("Wireless Noise-Cancelling Headphones")
    test.cart.verifyCartItemQuantity("Wireless Noise-Cancelling Headphones", 1)
  })

})
