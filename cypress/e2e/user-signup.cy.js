import { BaseTest } from "../base/baseTest"
const test = new BaseTest()

describe("User Signup", () => {
  it("TC-01 Open Signup page", () => {
    test.homePage.clickSignup()
    test.signUpPage.verifySignupFormVisible()
  })

  it("TC-02 Signup with valid details", () => {
    test.homePage.clickSignup()
    test.signUpPage.signup(test.users.newUser.name, test.users.newUser.email, test.users.newUser.password)
    test.signUpPage.verifySuccessMessage()
    test.homePage.verifyUserLoggedIn()
  })

})
