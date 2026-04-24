import { BaseTest } from "../base/baseTest"
const test = new BaseTest()

describe("User Login", () => {
  it("TC-01 Open auth modal on Login button click", () => {
    test.homePage.clickLogIn()
  })

  it("TC-02 Display email and password fields in login form", () => {
    test.homePage.clickLogIn()
    test.loginPage.switchToLogin()
    test.loginPage.verifyLoginFormVisible()
  })

  it("TC-03 User login with seeded credentials", () => {
    test.homePage.clickLogIn()
    test.loginPage.login(test.users.validUser.email, test.users.validUser.password)
    test.homePage.verifyUserChipAfterLogin(test.users.validUser.name)
  })
})
