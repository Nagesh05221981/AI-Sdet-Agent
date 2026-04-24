import { BaseTest } from "../base/baseTest"
const test = new BaseTest()

describe("User Login", () => {
  it("TC-01 Auth modal opens on login button click", () => {
    test.homePage.clickLogin()
    test.loginPage.verifyLoginFormVisible()
  })

  it("TC-02 Login form displays email and password fields", () => {
    test.homePage.clickLogin()
    test.loginPage.verifyLoginFormVisible()
  })

  it("TC-03 User logs in with seeded credentials", () => {
    test.homePage.clickLogin()
    test.loginPage.login(test.users.validUser.email, test.users.validUser.password)
    test.homePage.verifyUserLoggedIn(test.users.validUser.name)
  })

})
