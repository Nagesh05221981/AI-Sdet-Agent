import { BaseTest } from "../base/baseTest"
const test = new BaseTest()

describe("Filter by Category", () => {
  it("TC-01 All filter chips are visible on load", () => {
    test.filterBars.verifyFiltersBarVisible()
  })

  it("TC-02 Tech filter chip activates on click", () => {
    test.filterBars.clickFilterButton('Tech')
    test.filterBars.verifyFilterApplied('Tech')
  })

  it("TC-03 Only Tech products are visible after filtering", () => {
    test.filterBars.clickFilterButton('Tech')
    test.catalogue.verifyCategoryTitle('Tech')
  })

  it("TC-04 Results info updates after filtering", () => {
    test.filterBars.clickFilterButton('Tech')
    test.catalogue.verifyResultsInfo()
  })

  it("TC-05 Filter resets on clicking 'All' chip", () => {
    test.filterBars.clickFilterButton('Tech')
    test.filterBars.clickFilterButton('All')
    test.catalogue.verifyGridVisible()
  })
})
