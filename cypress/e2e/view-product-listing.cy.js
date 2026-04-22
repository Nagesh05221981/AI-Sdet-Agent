import ShopPage from '../support/pages/ShopPage.js';

describe('View Product Listing', () => {
  const shopPage = new ShopPage();

  it('User opens the Eclat shop and can see the product listing', () => {
    shopPage.visit();
    shopPage.assertProductListingVisible();
  });
});
