import { BaseTest } from "../base/baseTest"
const test = new BaseTest()

describe("Filter By Category", () => {
  it("TC-01 Filter chips are visible on page load", () => {
    test.filterBars.verifyFiltersBarVisible()
  })

  it("TC-02 Activate 'Tech' filter chip", () => {
    test.filterBars.verifyFiltersBarVisible()
    test.filterBars.clickFilterButton("Tech")
    test.filterBars.verifyFilterApplied("Tech")
  })

  it("TC-03 Filter products by 'Tech' category", () => {
    test.filterBars.verifyFiltersBarVisible()
    test.filterBars.clickFilterButton("Tech")
    test.filterBars.verifyFilterApplied("Tech")
    test.catalogue.verifyGridVisible()
  })

  it("TC-04 Update results-info after filtering by 'Tech'", () => {
    test.filterBars.verifyFiltersBarVisible()
    test.filterBars.clickFilterButton("Tech")
    test.filterBars.verifyFilterApplied("Tech")
    test.catalogue.verifyResultsInfo()
  })

  it("TC-05 Reset filter by clicking 'All' chip", () => {
    test.filterBars.verifyFiltersBarVisible()
    test.filterBars.clickFilterButton("Tech")
    test.filterBars.verifyFilterApplied("Tech")
    test.filterBars.clickFilterButton("All")
    test.catalogue.verifyGridVisible()
  })

})
