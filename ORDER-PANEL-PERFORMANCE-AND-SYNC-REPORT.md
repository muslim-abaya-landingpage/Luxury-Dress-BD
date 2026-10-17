# Order Panel Performance, Product Library Sync ও Variant Matrix

**রিপোর্টের তারিখ:** ১৭ অক্টোবর ২০২৬  
**Repository branch:** `feat/product-csv-import`  
**সীমা:** এটি source-code/implementation report; Apps Script deploy, `main` merge বা production publish করা হয়নি।

## সারসংক্ষেপ

| বিষয় | বর্তমান অবস্থা | প্রস্তাব/উদাহরণ |
|---|---|---|
| Order list | `admin-orders.html` একবারে `Limit: 300` চায়; Apps Script পুরো order table পড়ে counts বানায় | ৫০–১০০ row cursor page, আলাদা compact counts summary cache |
| Client cache | session-scoped cache/deduplication ও mutation invalidation আছে; Order page-এর initial `maxAgeMs` ৫ মিনিটে cache hit হলে request পুরোটাই cache থেকেই মেটে | stale snapshot সঙ্গে সঙ্গে দেখিয়ে live background revalidation, visible-tab timer |
| Search/filter | UI-তে local filtering কেবল বর্তমানে লোড করা সর্বশেষ ৩০০ অর্ডারে | Load More-সহ progressive search; খুব বড় archive হলে indexed search |
| Product Library Sheet | owner-only Apps Script example আছে; `ProductLibrary` নামে আলাদা mirror tab | preview/stage/publish এবং version check-সহ manual two-way sync |
| Color × size | বর্তমান storefront color/size আলাদা বেছে নেয়; cart/order/stock path-এ একক variant key নেই | matrix render + একই `variantKey` cart → checkout → Apps Script stock ledger-এ বহন |
| Merge | সব পরিবর্তন `feat/product-csv-import`-এ; `main`-এ merge/publish করা হয়নি | review/CI-এর পর Pull Request বা fast-forward; production deploy আলাদা করে যাচাই |

> **গুরুত্বপূর্ণ:** `AdminOrderListV2`-এর route/source branch-এ যোগ হয়েছে, কিন্তু Order page এখনও পুরনো `AdminOrderList` call করে এবং Apps Script source deploy হয়নি। UI page wiring ও নতুন Apps Script version deploy না হওয়া পর্যন্ত live behavior বদলাবে না।

---

## 1. Order panel: প্রমাণভিত্তিক bottleneck

পর্যালোচিত ফাইল: `admin-orders.html`, `apps-script/AdminOrders.gs`, `apps-script/Code.gs`, `admin-api.js` ও `admin-api-instant.js`।

1. `admin-orders.html`-এর `load()` `{ Limit: 300 }` পাঠায়। `AdminOrders.gs`-এর `adminOrderList_()` `admReadAll_()` ডেকে শীটের সব order row, সর্বোচ্চ `ADM_LAST_COL` (৪৬) কলাম পর্যন্ত, পড়ে; তারপর ওই full scan-এ `all/today/status` count করে, সর্বশেষ ৩০০টি response-এ দেয়। প্রতিবার পুরো `Blocked` sheet-ও পড়ে। অর্থাৎ response ছোট হলেও query-এর কাজ row count-এর সঙ্গে বাড়ে।
2. Search, Today tab, status tab ও issue filter browser-এ কেবল `all` array-এ থাকা ৩০০টি row-এর ওপর চলে। পুরোনো অর্ডার খুঁজতে UI-তে কোনো page cursor নেই।
3. Status/Today count বের করার জন্য full order row দরকার নেই: মূলত timestamp, name/phone আছে কি না, ও status column যথেষ্ট। সেগুলো আলাদা compact read করে ২০ সেকেন্ড cache-এ রাখলে detail payload scan কমবে।
4. `admin-orders.html` প্রথমে ৫ মিনিট পর্যন্ত পুরোনো snapshot দেখায়, তারপর `MaAdmin.call(..., options)`-এও সেই ৫ মিনিটের `maxAgeMs` দেয়। Cache hit হলে `admin-api.js`-এর request path live fetch না করে cached promise ফেরত দেয়—এটি stale-while-revalidate নয়। Refresh বোতাম options ছাড়া চলে, তাই manual refresh server-এ যায়। স্বয়ংক্রিয় polling/visibility refresh নেই।
5. `admin-api.js` এবং `admin-api-instant.js` বর্তমানে byte-identical; Order panel দ্বিতীয় ফাইলটি load করে। API cache generation, same-read request deduplication, session-bound cache ও write-এর আগে/পরে cache invalidation আছে—এগুলো রেখে background refresh যোগ করা উচিত।
6. পুরনো list response `admRowToOrder_()`-এর বিস্তৃত order object পাঠায়—address, transaction/reference, customer/courier notes এবং raw design/item data-ও যায়, যদিও তালিকা view-তে সব field লাগে না। V2 example-এর list projection এসব সংবেদনশীল field বাদ দেয়; full detail কেবল `AdminOrderGet`-এ রাখে।
7. `AdminOrderGet`-এ একটি order খোঁজার জন্য ID column scan হয় এবং customer history করতে আবার `admReadAll_()` চলে। Order ID index বা compact customer-history index বড় শীটে detail view-এর latency কমাবে।
8. অতিরিক্ত action correctness issue: `admin-order.html`-এ save failure toast দেখিয়ে promise false ফল দেয়; courier button আগে `save().then(AdminSendCourier)` করে বলে save ব্যর্থ হলেও courier submit হতে পারত। Feature branch-এ save success/failure boolean ফেরানো হয়েছে এবং save ব্যর্থ হলে courier call থামানো হয়েছে।

### 1.1 Apps Script cursor endpoint

সম্পূর্ণ উদাহরণ ফাইল: [`AdminOrderListV2.example.gs`](</home/ubuntu/Luxury-Dress-BD/apps-script/AdminOrderListV2.example.gs>)। `Code.gs` ও `AdminOrders.gs`-এর route branch-এ যোগ হয়েছে; API allowlist-এ নতুন type-ও আছে। এটি বিদ্যমান helper (`verifyAdminSession_`, `admGetSheet_`, `readOnlineOrderRows_`, `admRowToOrder_`, `admBlockedMap_`, `dayKeyFromCell_`) reuse করে এবং:

- default ৫০, সর্বোচ্চ ১০০ row/response;
- cursor-এ `maxRow` snapshot watermark, `beforeRow` row-boundary থাকে; HMAC-SHA-256 signature যাচাই হয়, তাই client cursor ইচ্ছেমতো বদলে অন্য row boundary চাইতে পারে না;
- detail payload-এ page range-টাই পড়ে;
- list projection address/transaction ID/private note বাদ দেয়; Blocked map ও tab count—দুটিই ২০-সেকেন্ড `CacheService`-এ;
- invalid/expired cursor হলে `INVALID_CURSOR` দেয়, তাই UI প্রথম page refresh করতে পারে।

#### Apps Script-এ যুক্ত করার ধাপ

1. Apps Script project-এ নতুন `AdminOrderListV2.gs` file বানিয়ে example code paste করুন। একই project-এ `Code.gs` ও `AdminOrders.gs`-এর shared helpers লাগবে। Feature branch-এ `orderPanelTypes` তালিকা এবং `handleAdminOrderRequest_()` switch-case ইতিমধ্যে যোগ করা আছে; Apps Script editor-এও সেই source update করুন।
2. `apps-script/AdminOrders.gs`-এর `handleAdminOrderRequest_(type, e)` switch-এ source থেকে এই case রাখুন:

```javascript
case 'AdminOrderListV2': return adminOrderListV2_(e);
```

3. `apps-script/Code.gs`-এর `orderPanelTypes` তালিকায় `AdminOrderListV2` রাখুন। এতে আগের order-panel route-এর মতো token-verified handler চলবে।
4. `admin-api.js` **এবং** `admin-api-instant.js`-এর `READ_TYPES`-এ `'AdminOrderListV2'` থাকবে, যাতে এটি read হিসেবে deduplicate/cache/invalidate হয়। Feature branch-এ দুই bundle-ই update করা হয়েছে।
5. Apps Script-এ **Deploy → Manage deployments → Edit → New version → Deploy** করুন। একই web-app URL থাকে; API code না deploy করলে নতুন endpoint `UNKNOWN_TYPE` দেবে।

#### Cursor-কে UI-তে ব্যবহার

`admin-orders.html`-এ page size ৫০ দিয়ে `Cursor: ""` প্রথমে পাঠান। Response-এর `orders` প্রথমবার `all`-এ বসান, `nextCursor` ও `hasMore` রাখুন; **আরও অর্ডার** চাপলে ওই cursor-সহ একই endpoint কল করে নতুন `orders` `all`-এ append করুন। Refresh-এ cursor খালি করে pages reset হবে। `counts` server-এর global count; insight-গুলোর scope কেবল browser-এ এখন পর্যন্ত লোড হওয়া rows—UI-তে সেটি স্পষ্ট লিখুন। বর্তমান local search-ও loaded rows-এ সীমাবদ্ধ থাকবে; পুরোনো ফল পেতে Load More দরকার।

```javascript
// Minimal client-side paging shape (existing admin-orders.html state-এ মানিয়ে নিন)
var all = [], nextCursor = '', hasMore = false, loading = false, generation = 0;
function fetchOrderPage(reset) {
  if (loading) return Promise.resolve();
  if (reset) { generation++; all = []; nextCursor = ''; hasMore = false; }
  if (!reset && !hasMore) return Promise.resolve();
  var requestGeneration = generation;
  loading = true;
  return MaAdmin.call('AdminOrderListV2', {
    Limit: 50,
    Cursor: reset ? '' : nextCursor
  }, { maxAgeMs: 0 }).then(function (res) {
    if (requestGeneration !== generation) return; // search/refresh race guard
    all = reset ? (res.orders || []) : all.concat(res.orders || []);
    nextCursor = res.nextCursor || '';
    hasMore = !!res.hasMore;
    counts = res.counts || {};
    statuses = res.statuses || [];
    renderTabs(); renderRows();
    renderInsights({ orders: all, counts: counts, statuses: statuses });
    document.getElementById('ordLoadMore').hidden = !hasMore;
  }).finally(function () { loading = false; });
}
```

পেজিং row-number ভিত্তিক—sheet-কে মাঝপথে sort/insert/delete করলে cursor reset করে প্রথম page আনুন। বহু বছরের archive বা কয়েক দশ হাজার rows হলে বছর/মাস archive tab এবং dedicated search/index sheet বিবেচনা করুন; cursor নিজে arbitrary full-text search-কে constant-time করে না।

### 1.2 Summary cache invalidation

Example-এ `admBumpOrderSummaryRevisionV2_()` আছে। Script-owned যেকোনো order create/status/amount edit, courier callback, `AdminOrderUpdate` ও `AdminSendCourier`-এর **successful write-পর** এটি কল করুন। `LockService`-এর ভিতরে nested script lock নেওয়ার দরকার নেই—helper শুধু script property revision বদলায়। Google Sheet-এ হাতে edit হলে ২০-সেকেন্ড TTL শেষ হলে নতুন summary আসবে। `CacheService` best-effort হওয়ায় cache miss হলে code-টি summary পুনরায় গণনা করে।

---

## 2. Admin cache ও background refresh (stale-while-revalidate)

প্রস্তাবিত UX:

- sessionStorage snapshot থাকলে তাৎক্ষণিক render (এখানে stale window ৫ মিনিটের বেশি নয়);
- একই সঙ্গে `maxAgeMs: 0` দিয়ে network request—cache hit হলে live request বাদ যাবে না;
- response এলে বর্তমান request generation-এর সঙ্গে মিলিয়ে UI update;
- ৬০ সেকেন্ডে refresh কেবল tab visible থাকলে; hidden tab-এ pause, visible হলে last success ৬০s-এ পুরোনো হলে refresh;
- refresh ব্যর্থ হলে cached list অক্ষত থাকবে, ছোট “শেষ সফল আপডেট”/stale indicator দেখাবে;
- network request overlap হবে না; order mutation-এর পরে বিদ্যমান `MaAdmin` invalidation ব্যবহার হবে।

```javascript
// SWR pattern; existing admin-orders.html-এর load/apply/controls-এ মিশিয়ে নিন
var liveBusy = false, liveGeneration = 0, lastLiveAt = 0, refreshTimer = 0;
var LIST_FIELDS = { Limit: 50, Cursor: '' };
function refreshLatestPage(manual) {
  if (liveBusy || (!manual && document.hidden)) return Promise.resolve();
  liveBusy = true;
  var myGeneration = ++liveGeneration;
  var old = MaAdmin.cached('AdminOrderListV2', LIST_FIELDS, 5 * 60 * 1000);
  if (old && !ordersShown) applyPage1(old); // instant stale display
  setRefreshLabel(old ? 'পুরোনো ডেটা · আপডেট হচ্ছে…' : 'আপডেট হচ্ছে…');
  return MaAdmin.call('AdminOrderListV2', LIST_FIELDS, { maxAgeMs: 0 })
    .then(function (fresh) {
      if (myGeneration !== liveGeneration) return;
      applyPage1(fresh);
      lastLiveAt = Date.now();
      setRefreshLabel('সর্বশেষ আপডেট ' + new Date(lastLiveAt).toLocaleTimeString());
    })
    .catch(function (err) {
      if (myGeneration === liveGeneration) {
        setRefreshLabel(old ? 'সাময়িক সংযোগ সমস্যা · পুরোনো ডেটা দেখানো হচ্ছে' : 'লোড হয়নি');
        if (!old) MaPanel.toast('অর্ডার লোড করা যায়নি: ' + err.message, true);
      }
    })
    .finally(function () { liveBusy = false; scheduleNextRefresh(); });
}
function scheduleNextRefresh() {
  clearTimeout(refreshTimer);
  if (document.hidden) return;
  refreshTimer = setTimeout(function () { refreshLatestPage(false); }, 60000);
}
document.addEventListener('visibilitychange', function () {
  if (document.hidden) clearTimeout(refreshTimer);
  else if (!lastLiveAt || Date.now() - lastLiveAt > 60000) refreshLatestPage(false);
  else scheduleNextRefresh();
});
window.addEventListener('pagehide', function () { clearTimeout(refreshTimer); });
```

কোডটি example: `applyPage1()`-এ প্রথম page reset, cache/live response ordering এবং Load More cursor state আপনার UI-তে বসাতে হবে। বর্তমান `MaAdmin.call`-এ `maxAgeMs: 0` একটি live read; API read allowlist-এ নতুন record type না থাকলে call-টি read হিসেবে কাজ করবে না।

---

## 3. Google Sheets-এর সঙ্গে two-way Product Library sync

সম্পূর্ণ owner-only Apps Script উদাহরণ: [`ProductLibrarySync.example.gs`](</home/ubuntu/Luxury-Dress-BD/apps-script/ProductLibrarySync.example.gs>)। Product Manager UI import/export glue: [`product-sheet-sync.example.js`](</home/ubuntu/Luxury-Dress-BD/product-sheet-sync.example.js>)। পূর্বের bulk-import, sheet sync ও variant guide: [`PRODUCT-LIBRARY-BULK-SHEETS-VARIANTS.md`](</home/ubuntu/Luxury-Dress-BD/PRODUCT-LIBRARY-BULK-SHEETS-VARIANTS.md>)। Feature branch-এ Product Manager-এ button/preview ও `Code.gs` route, দুই admin API bundle-এর read allowlist, typed JSON staging support যোগ হয়েছে; Apps Script production version এখনও deploy হয়নি।

এখানে **two-way মানে user-initiated দুই দিকের controlled sync**, real-time trigger নয়:

1. **Catalog → Sheet:** Product Manager-এর current products export করে dedicated `ProductLibrary` mirror tab replace করা; user confirm, `ExpectedHead` version guard, batch write, formula-injection guard, duplicate SKU/price validation।
2. **Sheet → Catalog:** Sheet rows পড়া → Product Manager-এ preview/validate → staging → owner “পরিবর্তন প্রকাশ করুন” চাপলে existing atomic GitHub catalog publish। Sheet-এ row মুছলেই site-এ product delete হবে না; deletions আলাদা explicit action হওয়া উচিত।
3. Source-of-truth হিসেবে Product Manager/GitHub `main` রাখুন। একই সময়ে Sheet ও Product Manager-এ edits হলে `stale`/head mismatch দেখে merge/refresh করুন—automatic last-write-wins নয়।

#### Setup steps

1. Apps Script project-কে দেওয়া spreadsheet-এর সঙ্গে bind করুন (Spreadsheet → **Extensions → Apps Script**)। Standalone project হলে `PRODUCT_LIBRARY_SPREADSHEET_ID` script property-তে spreadsheet ID দিন এবং `SpreadsheetApp.openById()` ব্যবহার করুন। **`ProductList` বা `StockVariants` tab-এ overwrite করবেন না**; code আলাদা `ProductLibrary` tab তৈরি/লিখবে।
2. Apps Script-এ নতুন `ProductLibrarySync.gs` file বানিয়ে `ProductLibrarySync.example.gs` copy করুন। এটি `verifyAdminSession_()`, `requireOwnerAdmin_()` owner check, `cpHead_()`, `param_()` ও `jsonOut_()` shared functions-এর একই project চায়।
3. Feature branch-এর `apps-script/Code.gs`-এ generic `Admin` rate-limit অংশের পরে নিচের route ইতিমধ্যে আছে; Apps Script editor-এ source copy করলে একই route যুক্ত করুন:

```javascript
if (type === 'AdminProductSheetRead' || type === 'AdminProductSheetWrite') {
  return jsonOut_(productLibrarySheetHandle_(type, e));
}
```

4. `admin-api.js` ও `admin-api-instant.js`-এর `READ_TYPES`-এ শুধু `'AdminProductSheetRead'` যোগ হবে; `AdminProductSheetWrite` write-ই থাকবে, যাতে write-পর cache invalidation হয়। Feature branch-এ allowlist আছে। Apps Script-এ **New version** deploy করুন।
5. Feature branch-এর Product Manager-এ **Google Sheet থেকে আনুন** button `AdminProductSheetRead` ডাকে; JSON cell (`sizes/images/variantMatrix/priceByType/colorVariants`) parse করে row-level preview/validation দেখায়। সব validation pass ও stale-head guard confirm হলে `MaProductManagerBulk.apply(rows)` দিয়ে staging হয়। এরপর পৃথকভাবে **পরিবর্তন প্রকাশ করুন** চাপুন।
6. **Google Sheet-এ Export** button `AdminCatalogState` থেকে current head নেয়, `MaProductManagerBulk.exportRows()` সংগ্রহ করে এবং ProductLibrary tab replace করার আগে confirm নেয়; এরপর `AdminProductSheetWrite`-এ `ExpectedHead` ও JSON payload পাঠায়। Head বদলে গেলে API `CATALOG_CONFLICT` দিয়ে export আটকায়।
7. Product Manager import UI-তে batch cap 250; Apps Script mirror API 1000 rows-এ cap করে। 250-এর বেশি catalog Sheet-এ export করা যায়, তবে import করতে 250 বা কম করে batch ভাগ করুন। প্রথমবার owner account দিয়ে import/export পরীক্ষা করুন; পরে `ProductLibrary`-এ SKU, নাম, category, price, sizes JSON, color, stock ও variant JSON যাচাই করুন। Sheet export হলো **mirror replace**, তাই ওই tab-এ নিজস্ব formula/মন্তব্য/অন্য ডেটা রাখবেন না।

### Product Manager import mapping: সতর্কতা

Feature branch-এর `applyBulkImport()` core field-এর সঙ্গে `priceByType`, `colorVariants` ও `variantMatrix` JSON clone করে staging করে; blank JSON cell মান অপরিবর্তিত রাখে, explicit `[]`/`{}` ওই field clear করে। Sheet importer matrix duplicate SKU/color-size pair, price ও stock validate করে। তবে matrix storefront, checkout ও Apps Script stock reservation-এ এখনও end-to-end wired নয়; matrix rows publish করলেও live product selection/inventory চালু হবে না—পরবর্তী section-এর integration সম্পূর্ণ না হওয়া পর্যন্ত legacy size/color fields বজায় রাখুন।

প্রস্তাবিত column set: `SKU | Name | Category | Price | Image | Sizes JSON | Color | Color Label | Fabric | Stock | Detail Note | Images JSON | Variant Matrix JSON | Price By Type JSON | Color Variants JSON`। SKU/ID অপরিবর্তনীয় রাখুন।

---

## 4. Shopify-এর মতো Color × Size matrix: front-end rendering

বর্তমান product data-তে `colorVariants[]` এবং `sizes[]` আছে; `product-page.js` এগুলো আলাদাভাবে render করে। Matrix row schema প্রস্তাব:

```json
{
  "sku": "ABY-001-BLK-M",
  "color": "black",
  "colorLabel": "Black",
  "size": "M",
  "price": 1450,
  "stock": 4,
  "image": "images/aby-001-black.webp"
}
```

`product-variant-matrix.example.js`-এর `makeVariantKey()`-ই cart/order/inventory-র canonical key দেয়: `color=black|size=m` (URL encoding-সহ)। Frontend render pattern—`product-page.js`-এর `state`, `renderColorOptions()`, `renderSizeOptions()`, `currentPrice()`, `buildCartLine()`-এ এই state integrate করুন:

```javascript
// Product detail page-এর existing state-এ যোগ
state.selectedMatrixVariant = null;
function matrixRows() {
  return Array.isArray(state.product.variantMatrix) ? state.product.variantMatrix : [];
}
function matrixKey(row) {
  return 'color=' + encodeURIComponent(String(row.color || row.colorLabel).trim().toLowerCase()) +
    '|size=' + encodeURIComponent(String(row.size).trim().toLowerCase());
}
function findMatrixVariant(color, size) {
  var c = String(color || '').trim().toLowerCase();
  var s = String(size || '').trim().toLowerCase();
  return matrixRows().find(function (v) {
    return String(v.color || v.colorLabel).trim().toLowerCase() === c &&
      String(v.size).trim().toLowerCase() === s;
  }) || null;
}
function selectMatrixColor(color) {
  state.selectedColor = color;
  var sizes = matrixRows().filter(function (v) {
    return String(v.color || v.colorLabel).trim().toLowerCase() === String(color).trim().toLowerCase();
  }).map(function (v) { return String(v.size); });
  state.selectedSize = sizes[0] || '';
  state.selectedMatrixVariant = findMatrixVariant(state.selectedColor, state.selectedSize);
  if (state.selectedMatrixVariant && state.selectedMatrixVariant.image) {
    var image = resolveImg(state.selectedMatrixVariant.image), index = state.galleryImages.indexOf(image);
    if (index >= 0) state.activeImage = index;
  }
  renderMatrixOptions(); renderGallery(); applyStockUi(); renderPrice(); updateSendMessageLink();
}
function renderMatrixOptions() {
  var rows = matrixRows();
  if (!rows.length) return false; // legacy renderer fallback
  var colors = [];
  rows.forEach(function (v) {
    var key = String(v.color || v.colorLabel).trim();
    if (key && !colors.some(function (c) { return c.key.toLowerCase() === key.toLowerCase(); })) {
      colors.push({ key: key, label: v.colorLabel || key });
    }
  });
  if (!colors.some(function (c) { return c.key === state.selectedColor; })) state.selectedColor = colors[0] && colors[0].key;
  var colorEl = document.getElementById('pdColorPickGroup');
  colorEl.innerHTML = '<div class="pd-option-label">Color</div><div class="pd-option-row">' +
    colors.map(function (c) { return '<button type="button" class="pd-option-btn' +
      (c.key === state.selectedColor ? ' is-active' : '') + '" data-color="' + escapeHtml(c.key) + '">' +
      escapeHtml(c.label) + '</button>'; }).join('') + '</div>';
  colorEl.querySelectorAll('[data-color]').forEach(function (btn) {
    btn.addEventListener('click', function () { selectMatrixColor(btn.dataset.color); });
  });
  var availableSizes = rows.filter(function (v) {
    return String(v.color || v.colorLabel).trim().toLowerCase() === String(state.selectedColor).trim().toLowerCase();
  });
  var sizeEl = document.getElementById('pdSizeGroup');
  sizeEl.innerHTML = '<div class="pd-option-label">Size</div><div class="pd-option-row">' +
    availableSizes.map(function (v) { var unavailable = Number(v.stock) <= 0;
      return '<button type="button" class="pd-option-btn' + (v.size === state.selectedSize ? ' is-active' : '') +
        '" data-size="' + escapeHtml(v.size) + '"' + (unavailable ? ' disabled aria-disabled="true"' : '') + '>' +
        escapeHtml(v.size) + (unavailable ? ' · Out of stock' : '') + '</button>'; }).join('') + '</div>';
  sizeEl.querySelectorAll('[data-size]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      state.selectedSize = btn.dataset.size;
      state.selectedMatrixVariant = findMatrixVariant(state.selectedColor, state.selectedSize);
      if (state.selectedMatrixVariant && state.selectedMatrixVariant.image) {
        var image = resolveImg(state.selectedMatrixVariant.image), index = state.galleryImages.indexOf(image);
        if (index >= 0) state.activeImage = index;
      }
      renderMatrixOptions(); renderGallery(); renderPrice(); applyStockUi(); updateSendMessageLink();
    });
  });
  state.selectedMatrixVariant = findMatrixVariant(state.selectedColor, state.selectedSize);
  return true;
}
```

তারপর `renderColorOptions()` ও `renderSizeOptions()`-এর শুরুতে matrix থাকলে `renderMatrixOptions(); return;` branch দিন; size-only legacy options তখন আর render হবে না। `selectedVariant()`-এর শুরুতে matrix row থাকলে raw selected size ফেরত দিন, যাতে abaya sizing formatter সেটিকে বদলে না দেয়। `currentPrice()`-এর শুরুতে `if (state.selectedMatrixVariant) return Number(state.selectedMatrixVariant.price) || 0;` দিন; `buildCartLine()`-এ `variantKey: matrixKey(state.selectedMatrixVariant)` ও `variantSku: state.selectedMatrixVariant.sku` যোগ করুন। `stockStatus()`-এ matrix product হলে `getStockStatus(p, matrixKey(state.selectedMatrixVariant))` পাঠান—এতে UI, cart, stock lookup একই key ব্যবহার করবে।

**End-to-end wiring ছাড়া publish করবেন না:** বর্তমান `checkout.html`-এর `CartJSON` serializer কেবল `size/color/productType/category` রাখে; matrix key/SKU বাদ পড়ে। `apps-script/Code.gs`-এর `cartItemVariantKey_()` size-first, তাই color×size আলাদা stock row match হয় না। Matrix চালুর আগে:

1. `checkout.html` CartJSON-এ `variantKey` ও `variantSku` serialize করুন;
2. checkout stock lookup-এ key first-এ ব্যবহার করুন;
3. Apps Script `cartItemVariantKey_(item)`-এ non-empty `item.variantKey`-কে legacy size/color fallback-এর আগে রাখুন;
4. StockVariants-এর `Variant` value-কে একই `makeVariantKey()` output-এ সংরক্ষণ করুন;
5. cart merge key-তে key/SKU semantics যাচাই করুন—বর্তমান `cartLineMergeKey()` ইতিমধ্যে product id + size + color + type ব্যবহার করে;
6. size-only legacy products, unavailable combination, price, reserved stock, order edit/return ও checkout retry tests চালান।

`product-variant-matrix.example.js` helper ও tests schema/duplicate validation reference; এগুলো live page-এ loaded নয়।

---

## 5. `feat/product-csv-import` → `main` merge

প্রাথমিক যাচাইয়ে `git rev-list --left-right --count origin/main...HEAD` ফল ছিল `0 1` (এ কাজের commit-এর আগে)। Merge করার আগে `git fetch origin` করে বর্তমান divergence পরীক্ষা করুন; `main`-এ push hosting workflow থাকলে production deploy শুরু হতে পারে।

### Pull Request (প্রস্তাবিত)

1. GitHub-এ `feat/product-csv-import` → `main` PR খুলুন।
2. Diff, Apps Script deployment requirement, Sheet overwrite confirmation এবং variant matrix-র end-to-end status review করুন।
3. CI pass হলে PR merge করুন; Apps Script code আলাদা করে Apps Script editor-এ New version deploy করতে হবে।

### Local fast-forward script (review/CI-এর পরই)

```bash
git fetch origin
git switch main
git pull --ff-only origin main
git merge --ff-only origin/feat/product-csv-import
node --test tests/product-bulk-import.test.cjs tests/product-variant-matrix.example.test.cjs tests/product-sheet-sync.example.test.cjs scripts/test-admin-speed.mjs scripts/test-order-size-columns.mjs scripts/test-order-insights.cjs
node --check product-bulk-import.js
git diff --check
git push origin main
```

`--ff-only` ব্যর্থ হলে merge force করবেন না—`main`-এ নতুন commit এসেছে; branch update করে নতুন diff/test/PR review করুন। Merge করলেই Apps Script deploy হয় না; website hosting auto-deploy workflow আলাদা।

---

## 6. Verification / deliverable map

কোড-উদাহরণ ও পূর্ববর্তী tested helpers:

- [Apps Script cursor paging + summary cache example](</home/ubuntu/Luxury-Dress-BD/apps-script/AdminOrderListV2.example.gs>)
- [Apps Script ProductLibrary two-way sync example](</home/ubuntu/Luxury-Dress-BD/apps-script/ProductLibrarySync.example.gs>)
- [Product Manager Google Sheet import/export UI glue](</home/ubuntu/Luxury-Dress-BD/product-sheet-sync.example.js>)
- [CSV bulk import, Sheet sync ও variant setup guide](</home/ubuntu/Luxury-Dress-BD/PRODUCT-LIBRARY-BULK-SHEETS-VARIANTS.md>)
- [Color × size matrix helper](</home/ubuntu/Luxury-Dress-BD/product-variant-matrix.example.js>)
- [Matrix validation tests](</home/ubuntu/Luxury-Dress-BD/tests/product-variant-matrix.example.test.cjs>)
- [Product Library sync/variant mapper tests](</home/ubuntu/Luxury-Dress-BD/tests/product-sheet-sync.example.test.cjs>)

`node --test`-এ নতুন Sheet mapper, CSV, matrix, admin-cache, order-layout ও order-insight tests চালানো হয়েছে; Apps Script/browser/inline HTML syntax, Admin API bundle parity ও `git diff --check`-ও যাচাই করা হয়েছে। `scripts/test-order-size-columns.mjs` test fixture-এ production-only `opsVerifiedPricing_` dependency mock দেওয়া আছে। **Live website, Google Sheet data, Apps Script deployment বা `main` পরিবর্তন করা হয়নি**; Apps Script deploy ও Order page V2 wiring এখনও প্রয়োজন।
