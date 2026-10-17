# Product Library: Bulk Import, Google Sheets Sync ও Variant Matrix

## এই পরিবর্তনের অবস্থা

- **CSV/TSV bulk import:** Product Manager-এর সোর্স কোডে যোগ করা হয়েছে। Preview, সম্পূর্ণ ব্যাচ validation, SKU-ভিত্তিক add/update এবং staging আছে। Save/Publish আলাদা ধাপ।
- **Google Sheets সরাসরি দুইমুখী sync:** এখনো live Apps Script deployment-এ যুক্ত নয়। নিরাপদ owner-only endpoint-এর উদাহরণ `apps-script/ProductLibrarySync.example.gs`-এ আছে; route যোগ ও deployment লাগবে। আপাতত Sheet থেকে CSV export করে Product Manager-এ import করা যায়।
- **Color × Size matrix:** প্রয়োজনীয় data model/helper `product-variant-matrix.example.js`-এ আছে, তবে storefront/cart/order/inventory-তে এখনো চালু করা হয়নি। কারণ stock backend বর্তমানে একটিমাত্র variant key—সাইজ, না থাকলে রঙ—মেলায়।
- এই পরিবর্তনগুলো স্থানীয় `feat/product-csv-import` branch-এ; production সাইট বা শিটে publish করা হয়নি।

## ১. CSV / Google Sheet bulk import

Product Manager-এ **“CSV / Sheet CSV আমদানি”** বোতাম যোগ হয়েছে। Google Sheets থেকে `File → Download → Comma-separated values (.csv)` করে CSV বাছুন। TSV ফাইলও পড়া যায়। CSV-তে সর্বোচ্চ **২৫০টি পণ্য/ব্যাচ** রাখা হয়েছে।

### প্রয়োজনীয় কলাম

| কলাম | আবশ্যক? | ব্যবহার |
|---|---:|---|
| `SKU` | হ্যাঁ | স্থায়ী, অনন্য Product ID |
| `Name` | হ্যাঁ | পণ্যের নাম |
| `Price` | হ্যাঁ | সংখ্যামূলক দাম; `৳১,৪৫০`-এর মতো বাংলা অঙ্কও চলে |
| `Category` | হ্যাঁ | বিদ্যমান ক্যাটাগরির key বা নাম; যেমন `abaya`, `premium-two-piece` |
| `Image` | নতুন পণ্যের জন্য হ্যাঁ | প্রধান ছবির URL বা সাইটের image path |
| `Sizes` | না | `50|52|54` ফরম্যাটে |
| `Color` | না | যেমন `black` |
| `Color Label` | না | যেমন `Classic Black` |
| `Fabric` | না | কাপড়ের বিবরণ |
| `Stock` | না | পণ্য-স্তরের stock; variant stock নয় |
| `Detail Note` | না | বিস্তারিত বর্ণনা |
| `Images` | না | গ্যালারি ছবির URL `|` দিয়ে আলাদা করুন |

টেমপ্লেট ডাউনলোডের বোতামও import preview-তে আছে। CSV-তে SKU আগে থেকে থাকলে সেটি **আপডেট** হবে; নতুন SKU হলে নতুন পণ্য যোগ হবে। একই ফাইলে duplicate SKU, অজানা ক্যাটাগরি, ভুল দাম/স্টক বা নতুন পণ্যের ছবি না থাকলে **পুরো ব্যাচ staging হবে না**—ভুলগুলো ঠিক করে আবার import করুন। Update row-তে খালি optional field আগের মান মুছে দেয় না।

Import সফল হলে পণ্যগুলো Product Manager-এ **staging** হয়। সাইটে প্রকাশ করতে আলাদা করে **“পরিবর্তন প্রকাশ করুন”** চাপতে হবে। এভাবে ভুল CSV সরাসরি public site-এ চলে যাওয়ার ঝুঁকি কমে।

> বর্তমান `ProductList` tab-এ শুধু `Name`, `Price`, `Category` আছে। তাই সেটি নতুন পণ্যের CSV হিসেবে একাই যথেষ্ট নয়: `SKU` ও `Image` যোগ করতে হবে। `ProductList`-এ সরাসরি পরিবর্তন করলেও সাইটে ফেরত যায় না।

### কোডে import কীভাবে যুক্ত

- `product-bulk-import.js` CSV/TSV parse করে quoted cells, UTF-8/BOM, বাংলা অঙ্ক, required headers ও batch size যাচাই করে।
- `product-manager.html`-এ `MaProductManagerBulk.preview()` category/SKU মিলিয়ে preview তৈরি করে এবং `apply()` কেবল সম্পূর্ণ বৈধ ব্যাচ staging করে।
- `product-bulk-import.css` preview dialog-এর styling দেয়।

## ২. Google Sheets-এর সাথে দুইমুখী sync

### নিরাপদ প্রস্তাবিত পদ্ধতি: Sheet = সম্পাদনাযোগ্য mirror, GitHub catalog = প্রকাশিত source

বর্তমান সাইট static catalog থেকে চলে। তাই Sheet-এ edit হলেই সাইটে তাৎক্ষণিকভাবে প্রতিফলিত করা হবে না। **Import → preview → Product Manager-এ Save/Publish → Export back to Sheet**—এই স্পষ্ট ধাপ রাখলে ভুল overwrite ও race condition এড়ানো যায়। দুইমুখী মানে দুই দিকেই তথ্য আদান-প্রদান; নীরবে background-এ overwrite নয়।

আলাদা `ProductLibrary` tab ব্যবহার করুন; বর্তমান `ProductList` tab order-picker snapshot হিসেবে রেখে দিন। `ProductLibrarySync.example.gs`-এর API contract:

- `AdminProductSheetRead`: admin token দিয়ে `ProductLibrary` পড়বে; `baseHead` ও বর্তমান GitHub `currentHead` আলাদা হলে `stale:true` দেবে।
- `AdminProductSheetWrite`: Product Manager-এর full catalog dedicated tab-এ লিখবে; `ExpectedHead` বর্তমান GitHub head-এর সাথে না মিললে write প্রত্যাখ্যান করবে। Sheet text formula হিসেবে চালু হওয়া থেকেও রক্ষা করে।
- দুই endpoint-ই **শুধু owner Admin**-এর জন্য; write-এ lock, row validation, অনন্য SKU ও batch validation আছে। Tab অনুপস্থিত হলে sync endpoint সেটি তৈরি করবে।

Apps Script-এর `doPost(e)`-এ existing `Admin*` rate limit-এর পরে route যোগ করতে হবে:

```javascript
if (type === 'AdminProductSheetRead' || type === 'AdminProductSheetWrite') {
  return jsonOut_(productLibrarySheetHandle_(type, e));
}
```

এরপর `ProductLibrarySync.example.gs`-এর function একই Apps Script project-এ যোগ করে **Deploy → Manage deployments → Edit → New version → Deploy** করতে হবে। এটি এখনো আপনার live Apps Script-এ deploy করা হয়নি।

### Product Manager থেকে export-এর frontend উদাহরণ

`product-manager.html`-এ `MaProductManagerBulk.exportRows()` বর্তমান ক্যাটালগের row snapshot দেয়। ভবিষ্যৎ “Sheet-এ Export” বোতাম এভাবে call করতে পারে:

```javascript
async function exportCatalogToSheet() {
  const state = await MaAdmin.call('AdminCatalogState', {});
  const items = MaProductManagerBulk.exportRows();
  return MaAdmin.call('AdminProductSheetWrite', {
    ExpectedHead: state.head,
    Payload: JSON.stringify({ items })
  });
}
```

Sheet থেকে পড়া JSON fields-কে array-তে ফেরত নিয়ে Product Manager-এর preview দিয়ে যাচাই করুন:

```javascript
function parseJsonArray(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed : []; }
  catch (_) { return String(value).split(/[|;]/).map(x => x.trim()).filter(Boolean); }
}

async function readCatalogFromSheet() {
  const result = await MaAdmin.call('AdminProductSheetRead', {});
  if (result.stale) throw new Error('Sheet শেষ export-এর পর সাইটের catalog বদলেছে; আগে latest catalog লোড করে তুলনা করুন।');
  const rows = result.items.map(row => ({
    id: row.id, name: row.name, category: row.category,
    price: Number(String(row.price).replace(/[৳,\s]/g, '')),
    image: row.image, sizes: parseJsonArray(row.sizes),
    color: row.color, colorLabel: row.colorLabel, fabric: row.fabric,
    stock: row.stock === '' ? undefined : Number(row.stock),
    detailNote: row.detailNote, images: parseJsonArray(row.images)
  }));
  const preview = MaProductManagerBulk.preview(rows);
  // UI-তে preview.errors দেখিয়ে Admin অনুমোদনের পরেই apply(rows) ডাকুন।
  return { rows, preview };
}
```

**Delete policy:** Sheet-এ কোনো SKU না থাকা মানেই সেটি delete—এমন নিয়ম দেবেন না। Import শুধু SKU-গুলো add/update করবে; মুছে ফেলা Product Manager-এ আলাদা করে নিশ্চিত করতে হবে। Export একটি dedicated `ProductLibrary` mirror tab প্রতিস্থাপন করে, তাই ব্যবহারকারীদের হাতে পরিবর্তন করা অন্য tab-এ নয়।

এই sync pattern-টি file-এর Apps Script bridge ও frontend example দিয়ে দেখানো; `doPost` route, dedicated UI buttons, conflict-resolution modal ও live deployment এখনো যোগ করা হয়নি। তাই বর্তমানে ব্যবহারযোগ্য Sheet path হলো **Download CSV → Product Manager import**।

## ৩. Shopify-ধাঁচের Color × Size variant matrix

### বর্তমান সীমাবদ্ধতা

বর্তমানে Product Manager-এ পণ্য-স্তরের `sizes`, `color`/`colorLabel`, gallery এবং কিছু category-তে `priceByType` আছে। StockVariants sheet-এর key হলো `Product ID + Variant`; storefront থেকে stock check-এ এখন **size থাকলে size**, না থাকলে color পাঠানো হয়। অর্থাৎ `black × 52` এবং `maroon × 52` আলাদা inventory row হিসেবে সঠিকভাবে distinguish হয় না।

### প্রস্তাবিত product data model

একটি parent Product-এ matrix-টি রাখুন; প্রত্যেক বিক্রিযোগ্য combination-এর SKU, price, image, stock key আলাদা:

```javascript
{
  id: "ABY-100",
  name: "Premium Abaya",
  category: "abaya",
  variantMatrix: [
    { sku: "ABY-100-BLK-50", color: "black", colorLabel: "Black", size: "50", price: 1450, image: "images/abaya-black.jpg" },
    { sku: "ABY-100-BLK-52", color: "black", colorLabel: "Black", size: "52", price: 1450, image: "images/abaya-black.jpg" },
    { sku: "ABY-100-MRN-50", color: "maroon", colorLabel: "Maroon", size: "50", price: 1490, image: "images/abaya-maroon.jpg" }
  ]
}
```

শুধু বাস্তবে বিক্রিযোগ্য combination রাখুন; সব color × size combination সবসময় মজুত থাকে—এমন ধরে Cartesian product auto-create করবেন না। Variant SKU এবং color-size combination দুটোই অনন্য হতে হবে। `product-variant-matrix.example.js` এই validation, option list, exact lookup ও compound stock key-এর helper দেয়।

### প্রয়োজনীয় পরিবর্তন

1. **Product Manager UI:** variant table যোগ করুন: Color, Size, Variant SKU, Price, Image, Available quantity, Enabled; row add/duplicate/delete; duplicate SKU/combination ও negative quantity আটকান।
2. **Storefront selector:** Color বদলালে সেই রঙে থাকা Sizes-ই দেখান। Color + Size নির্বাচনে একটি নির্দিষ্ট `variantMatrix` row resolve করে price, image ও availability দিন।
3. **Cart/order payload:** selected `variantSku`, `color`, `size`, `variantKey` একসঙ্গে রাখুন; শুধু display label পাঠালে stock row ভুল মিলতে পারে।
4. **Inventory key:** নতুন combination-এর জন্য deterministic key ব্যবহার করুন:

```javascript
function variantStockKey(v) {
  const enc = value => encodeURIComponent(String(value).trim().toLowerCase());
  return `color=${enc(v.color)}|size=${enc(v.size)}`;
}
// উদাহরণ: color=black|size=52
```

Apps Script-এর বিদ্যমান compatibility রেখে নতুন key-কে আগে নিন:

```javascript
function cartItemVariantKey_(item) {
  if (item && item.variantKey) return normStockVariant_(item.variantKey);
  // legacy products: আগের size-only / color-only key অপরিবর্তিত রাখুন
  var size = String((item && item.size) || '').trim();
  if (size) return size;
  return String((item && item.color) || '').trim();
}
```

5. **Apps Script/Sheet:** `StockVariants`-এর `Variant` cell-এ compound key রাখুন; stock decrement, reservation, release, ledger, order-status change ও CSV inventory import একই key ব্যবহার করবে। আলাদা price `variantMatrix`-এ; inventory quantity StockVariants-এ—দুই source গুলিয়ে ফেলবেন না। Existing legacy size-only rows-কে একবারে বদলাবেন না; নতুন matrix row seed/verify করে তারপর matrix SKU-গুলো stock tracking-এ নিন।
6. **Data migration:** parent product-এর বিদ্যমান size/color তথ্য থেকে matrix তৈরি করতে হলে আগে CSV/Sheet backup নিন, SKU map করুন, তারপর preview ও test order দিয়ে confirm করুন। পুরোনো orders ও ledger-এর variant keys historical হিসেবে রেখে দিন।

> Matrix helper code ও model এখানে উদাহরণ; storefront/cart/Apps Script integration না করে শুধু data field যোগ করলে variant-wise inventory কাজ করবে না। পূর্ণ implementation-এর আগে cart serialization, order sheet, stock reservation এবং order cancellation/refund-এ একই `variantKey` end-to-end চালাতে হবে।

## যাচাই

CSV parser ও variant helper-এর unit tests:

```bash
node --test tests/product-bulk-import.test.cjs tests/product-variant-matrix.example.test.cjs
```

অ্যাপ্লিকেশন পরিবর্তনগুলো `feat/product-csv-import`-এ রাখা হয়েছে; production deploy বা Google Sheet write করা হয়নি।
