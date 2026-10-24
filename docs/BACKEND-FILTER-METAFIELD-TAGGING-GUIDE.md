# Backend Filter Metadata & Tagging Guide

## লক্ষ্য

Frontend filter যাতে consistent থাকে, product data-কে free-text না রেখে normalized option, taxonomy এবং stock source হিসেবে পরিচালনা করতে হবে। একই attribute-এর spelling সব product-এ এক রাখুন।

## Canonical data dictionary

| UI filter | Canonical key | Shopify | WooCommerce | Example values |
|---|---|---|---|---|
| Category | `category` | Product category / collection | Product category | `abaya`, `hijab` |
| Size | `size` | Variant option `Size` | Global attribute `pa_size` | `50`, `52`, `Free Size` |
| Color | `color` | Variant option `Color` or product metafield | Global attribute `pa_color` | `black`, `maroon` |
| Fabric | `fabric` | Product metafield `custom.fabric` | Global attribute `pa_fabric` | `Dubai Cherry` |
| Availability | `availability` | Native inventory / `available` | Native stock status | `in_stock`, `out_of_stock` |
| Price | `price` | Variant price | `_price` / WooCommerce price | numeric BDT |
| Newness | `created_at` | Product created date | Post date | ISO date |

## Shopify configuration

### 1. Product options

যে attribute বিক্রির variant তৈরি করে, সেটি product option হিসেবে রাখুন:

- Option 1: `Size`
- Option 2: `Color`
- প্রয়োজন হলে Option 3: `Style` বা `Set Type`

Size ও Color variant option হলে Search & Discovery সাধারণত এগুলোকে filter হিসেবে ব্যবহার করতে পারে এবং inventory-র সঙ্গে variant-level availability মিলিয়ে দিতে পারে।

### 2. Product metafields

Settings → Custom data → Products-এ নিম্নোক্ত definition তৈরি করুন:

| Namespace / key | Type | List? | Rule |
|---|---|---:|---|
| `custom.fabric` | Single line text | No | controlled vocabulary দিয়ে লিখুন |
| `custom.collection` | Single line text | No | `eid-2026`, `everyday` |
| `custom.style_code` | Single line text | No | internal SKU family |
| `custom.is_featured` | True/false | No | merchandising-only |
| `custom.length` | Integer | No | inch; size নয়, product spec |

`fabric`-এর জন্য যদি storefront filter প্রয়োজন হয়, free text না রেখে Shopify Search & Discovery-তে product metafield filter হিসেবে enable করুন।

### 3. Tags

Tags শুধুমাত্র merchandising বা migration-এর জন্য ব্যবহার করুন:

- ভালো: `collection:eid-2026`, `fabric:dubai-cherry`, `occasion:daily`
- এড়ান: `black`, `Black`, `classic black`, `colour-black` একসঙ্গে ব্যবহার করা

একটি canonical slug policy রাখুন: lowercase, hyphen-separated, এক ভাষা।

### 4. Search & Discovery filters

Settings → Search & Discovery → Filters-এ enable করুন:

1. Availability
2. Price
3. Product category
4. Size
5. Color
6. Fabric metafield (যদি filterable definition তৈরি করা থাকে)

Theme collection template-এ `collection.filters` render করুন এবং `sort_by` query preserve করুন। Active filters-এর জন্য chips ও `Clear all` দিন।

### 5. Shopify import validation

Bulk CSV/API import-এর আগে validate করুন:

- সব product-এ category আছে
- সব variant-এর size/color একই naming policy মেনে চলে
- stock quantity numeric
- BDT price numeric, currency formatting data-তে নয়
- out-of-stock variant যেন available filter-এ না আসে

## WooCommerce configuration

### 1. Global attributes

Products → Attributes-এ তৈরি করুন:

- `Size` → taxonomy `pa_size`
- `Color` → taxonomy `pa_color`
- `Fabric` → taxonomy `pa_fabric`
- প্রয়োজন হলে `Collection` → taxonomy `pa_collection`

Global attribute ব্যবহার করুন; product-level custom text field ব্যবহার করলে layered navigation ও counts ভেঙে যায়।

### 2. Term naming

| Attribute | Canonical terms |
|---|---|
| `pa_size` | `44`, `46`, `48`, `50`, `52`, `54`, `56`, `free-size` |
| `pa_color` | `black`, `classic-black`, `maroon`, `white` |
| `pa_fabric` | `dubai-cherry`, `georgette`, `cotton` |

বাংলা display label রাখতে পারেন, কিন্তু slug stable রাখুন। যেমন label `ফ্রি সাইজ`, slug `free-size`।

### 3. Product/variation rules

- Variable product হলে Size/Color variation attribute হিসেবে assign করুন।
- Simple product হলে একই global attribute term assign করুন।
- Stock quantity WooCommerce inventory থেকেই আসবে। আলাদা `in_stock` text field ব্যবহার করবেন না।
- Parent product ও variation—দুটির duplicate filter term তৈরি করবেন না।

### 4. Filter implementation

Block theme হলে Product Collection-এর Filter blocks ব্যবহার করুন:

- Filter by price
- Filter by attribute: Size, Color, Fabric
- Filter by stock
- Sort by

Classic theme হলে WooCommerce Layered Nav / Product Filters widget বা custom `pre_get_posts` hook ব্যবহার করুন। URL query sanitize করে `tax_query`, `meta_query` এবং native price query-তে map করুন।

### 5. নিরাপত্তা ও performance

- `sanitize_title`, `sanitize_text_field`, whitelist validation ব্যবহার করুন।
- User-provided term সরাসরি SQL-এ বসাবেন না।
- 100+ product হলে server-side filtering দিন।
- Filtered URL-এর cache variation নিশ্চিত করুন।
- Facet count server-side query থেকে নিন; browser count দিয়ে SEO বা inventory decision নেবেন না।

## QA checklist

- একই product filter করলে Shopify/WooCommerce admin data এবং storefront result একই কি না
- Size + Color combination AND behavior সঠিক কি না
- একই facet-এর দুই term OR behavior সঠিক কি না
- out-of-stock product ভুলভাবে in-stock result-এ আসছে কি না
- refresh, back/forward, shareable URL state বজায় আছে কি না
- mobile drawer, keyboard focus, label association এবং screen-reader text আছে কি না
