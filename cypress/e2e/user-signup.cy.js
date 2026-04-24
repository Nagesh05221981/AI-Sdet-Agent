import { BaseTest } from "../base/baseTest"
const test = new BaseTest()

describe("User Signup", () => {
  it("TC-01 Open Signup page", () => {
    test.homePage.clickSignUp()
    test.signUpPage.verifySignupFormVisible()
  })

  it("TC-02 Signup form fields are visible", () => {
    test.signUpPage.verifySignupFormVisible()
  })

  it("TC-03 Create account button is enabled", () => {
    test.signUpPage.signup(test.users.newUser.name, test.users.newUser.email, test.users.newUser.password)
  })

  it("TC-04 Account creation success", () => {
    test.signUpPage.signup(test.users.newUser.name, test.users.newUser.email, test.users.newUser.password)
    test.signUpPage.verifySignupSuccessMessage()
  })

})
