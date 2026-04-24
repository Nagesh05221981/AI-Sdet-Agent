import { BaseTest } from "../base/baseTest"
const test = new BaseTest()

describe("Filter by Category", () => {
  it("TC-01 Filter chips are visible on page load", () => {
    test.filterBars.verifyFiltersVisible()
  })

  it("TC-02 Activate Tech filter chip", () => {
    test.filterBars.verifyFiltersVisible()
    test.filterBars.clickFilterButton("Tech")
    test.filterBars.verifyFilterActive("Tech")
  })

  it("TC-03 Filter products by Tech category", () => {
    test.filterBars.verifyFiltersVisible()
    test.filterBars.clickFilterButton("Tech")
    test.filterBars.verifyFilterActive("Tech")
    test.catalogue.verifyGridVisible()
  })

  it("TC-04 Update results info after filtering", () => {
    test.filterBars.verifyFiltersVisible()
    test.filterBars.clickFilterButton("Tech")
    test.filterBars.verifyFilterActive("Tech")
    test.catalogue.verifyResultsInfo("Tech")
  })

  it("TC-05 Reset filter with All chip", () => {
    test.filterBars.verifyFiltersVisible()
    test.filterBars.clickFilterButton("Tech")
    test.filterBars.verifyFilterActive("Tech")
    test.filterBars.clickFilterButton("All")
    test.catalogue.verifyGridVisible()
  })

})
