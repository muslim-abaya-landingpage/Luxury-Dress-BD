# Catalog Source Mapping and Reconciliation

Audit basis: production `main` source code, read-only inspection on 2026-11-25.
Implementation branch: `migration/nextjs-laravel-foundation`.

## 1. Source roles

- GitHub `main` is the committed catalog source. The catalog payload is four files:
  - `category-products.js`
  - `product-links-data.js`
  - `product-catalog-sections.js`
  - `product-config.js`
- Cloudflare D1 `STOCK_DB.live_catalog` stores one `state` row containing a saved GitHub commit SHA, those four file contents, the generated `catalog-validation.json` string, product page index/name maps, and publication metadata. It is an instant-publish overlay while the Pages deployment catches up; it is not an independent catalog master.
- `catalog-validation.json` is a derived order-validation projection generated from `product-config.js`, `product-utils.js`, `category-products.js`, `product-links-data.js`, and `product-catalog-sync.js` using `catalog-validation-core.js`.
- Product images are referenced by URL/path in the catalog. New image bytes are uploaded through the R2 flow; the live-publish endpoint rejects inline image assets.

## 2. Product field mapping

| Target concept | Production source | Mapping / caution |
|---|---|---|
| Immutable Product ID | `CATEGORY_PRODUCTS[category][].id` | Preserve exact string; do not derive from name or slug. |
| Primary SKU | `product.sku` | The validation projection currently uses trimmed SKU, falling back to Product ID when SKU is blank. Treat fallback as a legacy synthetic identity, not proof that a merchant-assigned SKU exists. |
| Variation SKU | `product.variations[].sku` | Separate identity namespace for variations; production publisher checks product and variation SKU uniqueness together. Do not collapse variation SKUs into the parent SKU. |
| Name | `product.name` | Preserve source text and language. |
| Category | category key after `maCatalog.normalizeAll` | Prefer normalized category key; product category property may be absent or normalized. |
| Price | `product.price` and `product.priceByType` | Validation projection also incorporates active/scheduled sale prices. Preserve price-by-type and sale windows; a single price is not the whole pricing model. |
| Images | `image`, `imageCard`, `images[]`, plus R2 URLs | Preserve original URLs and object paths; verify object existence before any future migration. |
| Sizes / measurements | `sizes`, `bodySizes`, `lengthSizes`, size config, `measures` | Keep legacy size slots and category size configuration. |
| Publication state | product status/visibility/schedule fields interpreted by `maCatalog` | Validation projection includes published and eligible scheduled items; draft/trash/pending/private are excluded. |
| Stock | product fields plus stock/size operational sources | Do not infer a complete stock ledger from catalog product records. |
| Delivery | `SITE_LINKS.delivery` via `maDelivery.settings()` | Stored as a separate validation delivery object, not per-product data. |

## 3. Validation projection shape

`catalog-validation-core.js` produces a compact order-check row with fields including:
`id`, `sku`, `name`, `category`, `price`, `prices`, `sizes`, `bodySizes`, `lengths`, `dressLengths`, `palazzoLengths`, `custom`, `kind`, `sizeLegacy`, optional sale metadata, variation attributes and variation rows.

This is not the complete storefront product record: it omits most descriptions, image URLs, SEO content and other display fields. It must not be used as a replacement catalog import by itself.

## 4. Reconciliation rules

1. Read the committed GitHub files and D1 state without writes.
2. Require all four catalog files in each snapshot.
3. Compare the saved release SHA first.
4. If SHAs differ, report `different_release`; do not union, overlay or choose a winner automatically.
5. If SHAs match, compare SHA-256 hashes of each exact file body. Any mismatch is a conflict.
6. If D1 validation JSON exists, require `validation.releaseSha` to equal the D1 state SHA and require a products array.
7. Only matching release SHA and file hashes count as `in_sync`.
8. Keep product identity validation separate: exact Product ID / exact SKU only; duplicate identities are conflicts, never arbitrary matches.

The Laravel `CatalogSnapshotReconciler` implements envelope, release, file-hash and validation-release checks. It is pure comparison logic and is not connected to Cloudflare, GitHub credentials, D1 or any write endpoint.

## 5. Explicitly not done

- No Production D1 read/write was performed by the Laravel branch.
- No live GitHub catalog data was copied into Laravel fixtures or committed to the migration branch.
- No product upsert, deletion, stock change, or image migration was performed.
- No Production deployment, DNS change, or paid service was initiated.
