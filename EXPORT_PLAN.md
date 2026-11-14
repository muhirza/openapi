# Plan: Export products to Excel

**Goal:** Product list page gets two buttons: "Export All" and "Export Filtered" (current search/filters applied).

**Files**
1. `frontend/package.json`: add `xlsx` (SheetJS), the only new dependency.
2. `frontend/src/components/ProductList.tsx`: both buttons, export handler, workbook builder.

**Steps**
1. Install `xlsx` in `frontend`.
2. "Export All": fetch every page with no filters (backend `per_page` max is 100), looping until `page >= total_pages`.
3. "Export Filtered": same loop, using the current filter params.
4. Columns: `Code, Name, Type, Brand, Price, Status, Last Synced`.
5. Download as `products-all-YYYY-MM-DD.xlsx` / `products-filtered-YYYY-MM-DD.xlsx`.
6. Disable buttons while exporting.
7. Verify with lint and typecheck in `frontend`.

**Skipped:** backend export endpoint (adds server code and a Python dependency); CSV (user wants Excel).
