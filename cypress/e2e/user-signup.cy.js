import { BaseTest } from "../base/baseTest"
const test = new BaseTest()

describe("User Signup", () => {
  it("TC-01 Open signup modal from home page", () => {
    test.homePage.clickSignUp()
    test.signUpPage.switchToSignup()
  })

  it("TC-02 Display signup form fields", () => {
    test.homePage.clickSignUp()
    test.signUpPage.switchToSignup()
    test.signUpPage.verifySignupFormVisible()
  })

  it("TC-03 Create account with valid details", () => {
    test.homePage.clickSignUp()
    test.signUpPage.signup(test.users.newUser.name, test.users.newUser.email, test.users.newUser.password)
    test.signUpPage.verifySignupSuccessMessage()
  })

  it("TC-04 Show error for invalid password", () => {
    test.homePage.clickSignUp()
    test.signUpPage.signup(test.users.newUser.name, test.users.newUser.email, "12345")
    test.signUpPage.verifySignupError("Password must be at least 6 characters.")
  })
})
