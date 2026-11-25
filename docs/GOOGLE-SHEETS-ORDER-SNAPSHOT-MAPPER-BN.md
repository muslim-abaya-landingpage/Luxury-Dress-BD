# Google Sheets Order Snapshot Mapper (Read-only)

## Scope

`OrderSnapshotMapper` is a pure mapper for a future, separately approved Google Sheets `Online Order` reader. It accepts already-fetched header and row arrays. It does not authenticate, call Google APIs, write cells, change order status, or mutate stock.

## Mapping rules

- Resolve columns by normalized header name, never by fixed column position.
- Require `Order ID`, `Status` and `StockStage` headers.
- Reject duplicate headers, missing identity/status, and duplicate Order IDs.
- Preserve a blank legacy StockStage as `null`; never infer a stock operation from it.
- Accept `Updated At` only as ISO-8601 with an explicit timezone; otherwise reject the snapshot.
- Skip fully blank rows and cap each mapping batch at 5,000 rows.
- Return only order ID, status, stock stage and source timestamp; do not copy customer PII.

## Not yet implemented

- Google OAuth/service-account authentication or credential storage.
- Spreadsheet ID or tab selection.
- Google Sheets API pagination/retry/backoff.
- Header alias approval against the live sheet.
- Production service-container binding or API route.

Those items require a separate review and explicit approval. Tests use synthetic arrays only. Production remains unchanged.
