import { BaseTest } from "../base/baseTest"
const test = new BaseTest()

describe("User Signup", () => {
  it("TC-01 Open signup page", () => {
    test.homePage.clickSignup()
    test.signUpPage.verifySignupFormVisible()
  })

  it("TC-02 Signup form fields are visible", () => {
    test.homePage.clickSignup()
    test.signUpPage.verifySignupFormVisible()
  })

  it("TC-03 Create account button is enabled", () => {
    test.homePage.clickSignup()
    test.signUpPage.signup(test.users.newUser.name, test.users.newUser.email, test.users.newUser.password)
  })

  it("TC-04 Account creation success", () => {
    test.homePage.clickSignup()
    test.signUpPage.signup(test.users.newUser.name, test.users.newUser.email, test.users.newUser.password)
    test.homePage.verifyUserLoggedIn(test.users.newUser.name)
  })

})
