import { BaseTest } from "../base/baseTest"
const test = new BaseTest()

describe("User Signup", () => {
  it("TC-01 Display Signup page on button click", () => {
    test.homePage.clickSignUp()
    test.signUpPage.verifySignupFormVisible()
  })

  it("TC-02 Signup form accepts full name, email, and password", () => {
    test.homePage.clickSignUp()
    test.signUpPage.signup(test.users.newUser.name, test.users.newUser.email, test.users.newUser.password)
  })

  it("TC-03 Create account on clicking create account button", () => {
    test.homePage.clickSignUp()
    test.signUpPage.signup(test.users.newUser.name, test.users.newUser.email, test.users.newUser.password)
    test.signUpPage.verifySignupSuccessMessage()
  })

})
