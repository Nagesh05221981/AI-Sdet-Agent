# Filter by category

As a shopper, I want to filter the product grid by category so I can browse a
single section without scrolling through everything.

## Acceptance criteria

- All filter chips (.fchip) are visible after the page loads.
- Clicking the "Tech" .fchip activates it (it gains the .active class).
- After filtering, only products whose .pcard-cat matches "Tech" are visible.
- #results-info updates to reflect the new, smaller count.
- Clicking the "All" .fchip resets the filter and the original products reappear.
