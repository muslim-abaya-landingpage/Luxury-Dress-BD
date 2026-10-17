# Admin Orders — Performance & Missing-Feature Audit

**Audit URL:** `https://muslimabaya.com/admin-orders`

## Live verification

- Unauthenticated request correctly redirects to `admin-login?next=admin-orders`.
- The admin shell is protected; no order data is exposed without an authorized session.
- The page is served successfully, but authenticated data timing depends mainly on the Google Apps Script + Google Sheet request.

## Why the first authenticated load is slow

1. `AdminOrderList` reads the complete `Online Order` sheet on every request.
2. It reads up to 46 columns for every row even though the table displays a smaller subset.
3. It computes counts across all rows before returning only the requested list limit.
4. It reads the complete `Blocked` sheet again to build the blocked-phone map.
5. `admin-orders.html` runs the full `MaOrderInsights.analyze()` pass after the response arrives.
6. Google Apps Script cold starts and Google Sheets calls add network latency that frontend JavaScript cannot eliminate.
7. The existing frontend cache was capped at 15 seconds, so normal navigation often showed the loading state again.

## What is missing or should be added

### High priority

- Cursor-based backend pagination (`pageToken`/row cursor), not only `Limit`.
- Server-side date range and status filtering before reading/serializing rows.
- A lightweight list endpoint with only table columns; load full order details only on `admin-order.html`.
- Cached server-side order summaries with invalidation after an order update.
- A visible API health/last-synced indicator.

### Medium priority

- Mobile card view instead of horizontal table scrolling.
- Date range filter and courier filter.
- CSV export based on the current filtered view.
- Column visibility control.
- Bulk status/assignment actions with audit confirmation.
- Empty-state explanation distinguishing “no orders” from “API failed”.

### Data quality gaps surfaced by the existing insights layer

- Missing or duplicate Order ID
- Missing size
- Invalid/future/mismatched date
- Invalid total or quantity
- Advance greater than total
- Unknown status
- Review note requiring manual verification

## Frontend changes deployed in this release

- Increased read snapshot reuse from 15 seconds to up to 5 minutes for navigation.
- Added stale-while-revalidate behavior: cached orders render immediately, then a background request refreshes the list.
- The Refresh button still bypasses cache and fetches live data.
- Added an immediate skeleton first-paint instead of a blank `Loading…` row.
- Added cache-busting version to `admin-api.js` and `admin-panel.css`.

## Deployment boundary

The frontend improvements are safe to deploy through GitHub Pages. The major backend improvement—true pagination and reduced Google Sheet reads—requires publishing a new Google Apps Script deployment version. The source can be prepared in `apps-script/AdminOrders.gs`, but it must not be described as live until the Apps Script deployment is published and verified against the authorized backend.

## Recommended next backend release

```text
AdminOrderList({ Token, Limit, Cursor, Status, FromDate, ToDate, Query })
  -> read only the required columns
  -> apply status/date/query filtering in Apps Script
  -> return { orders, counts, nextCursor, generatedAt }
```

This is the change that can materially reduce server time; frontend-only changes can remove blank/loading perception but cannot make Google Sheets network latency literally zero.
