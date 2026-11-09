# On-site popup checkout (Order Now / অর্ডার করুন)

Branch `feature/popup-checkout`, based on `main` at `29495cc`. That commit is the backup point:
reverting this PR brings the site back to it.

## What the customer sees

- **Product page and quick view, Buy Now**: opens a popup on the same page. It does not go to `/checkout` any more.
- **Shop grid card “অর্ডার করুন”**: this used to open WhatsApp. It is now a button.
  - If the product has more than one size, the quick view opens first so the customer picks a size.
  - If the product has only one size, the popup opens straight away.
- **Detail card “Order Now”**: opens the popup.
- **Home page and Related Products cards “অর্ডার করুন”**: this used to open WhatsApp. It now opens the product page,
  where the customer picks size and colour and then uses Buy Now. Home cards have no size picker, so the popup
  cannot know the size there.
- **Popup contents**:
  - Product photo, name, type, size, Size Manager measurements, colour and price.
  - Quantity stepper. It is capped by stock when that size's stock is tracked, and at 10 otherwise.
  - Subtotal, delivery charge and grand total.
  - Required fields: full name, mobile number, district, upazila/area, full address.
  - Optional field: order note.
  - Payment: Cash on Delivery only.
- **After the order is saved**:
  - The order ID with a copy button, and the full order details.
  - **কেনাকাটা চালিয়ে যান** (Continue Shopping).
  - **WhatsApp-এ অর্ডারের বিবরণ পাঠান (ঐচ্ছিক)**. It is optional, includes the order ID, and appears only after the order is saved.
- **What stays the same**:
  - The cart and the `/checkout` page work as before.
  - An Order Now order does not change the cart.
  - If the popup cannot load, Buy Now falls back to the old behaviour: add to cart, then go to `/checkout`.

## Changelog

| File | Change |
|---|---|
| `checkout-popup.js` (new) | The popup: form, BD mobile check (accepts +880 and Bangla digits), totals, sending, success screen. Its CSS is inside the file. |
| `cart-utils.js` | `window.maOpenCheckoutPopup()`: loads the popup and the district/upazila lists on the first Order Now press. It starts the download on pointer-down. If loading fails, it calls the fallback. |
| `category-renderer.js` | Buy Now builds the same cart line as Add to Cart, with the same variation and stock checks, and hands it to the popup (`shopPrepareDirectOrderLine`). The old route is kept as `shopGoToCheckoutWithLine`. The grid card's WhatsApp link is now a Buy Now button. The Related cards' link now points to the product page. |
| `index-home-muslim-abaya.js`, `home-render.min.js` (rebuilt) | The home card's “অর্ডার করুন” now links to the product page instead of WhatsApp. |
| `apps-script/Code.gs` | Order ID is checked against existing IDs, inside the order lock (`generateUniqueOrderId_`). The EventID retry lookup, per-phone rate-limit counter, duplicate-signature guard, Sheet append and 6-hour idempotency-cache write now run under the same script lock. A concurrent retry with the same EventID and phone waits, then returns the saved order ID instead of appending a second row. Cache eviction still means the 6-hour cache is best-effort, not permanent idempotency. The order note (`SpecialNotes`) is cleaned (`sanitizeCellText_`, 1000 characters). The **Processing** status is added to the sheet dropdown and to the stuck-order check. |
| `apps-script/AdminOrders.gs`, `admin-order-new.js` | **Processing** status in the admin order editor and the manual order form. |
| `admin-dashboard-main.js`, `admin-dashboard-logic.js` | Processing is counted with Confirmed in the dashboard. |
| `functions/_lib/gs-core.js`, `apps-script-copy.html` | Regenerated from the Apps Script sources (`build-gs-core.mjs`, `build-apps-script-copy.mjs`). |
| `tests/backend/popup-checkout.test.cjs`, `tests/e2e/popup-checkout.spec.cjs` (new) | Tests listed below. |

The Google Sheet needs no new columns:

- The order note goes in the existing **নোট** column.
- Processing becomes a dropdown option the next time the status dropdown is refreshed. That happens on every new order.
- Stock does not change when an order moves to Processing. Units reserved at Confirmed stay reserved, exactly as for Shipped.

## QA report

These were run locally on 2026-11-02: a local static server with headless Chromium. **The order server
(Apps Script) was mocked in the browser tests**, so they prove what the popup sends and shows, not that a row reached the live Google Sheet.

| # | Spec test | How it was tested | Result |
|---|---|---|---|
| 1 | Abaya checkout | ABY-MAROON-1, Length 54 chosen; size text, CartJSON, totals | Pass |
| 2 | Two-piece checkout | TP-6 | Pass |
| 3 | Kurti checkout | KURTI-02 | Pass |
| 4 | Panjabi checkout | PAN-001 | Pass |
| 5 | Sizes and quantities | Length 54, qty 1→3→2; stock cap shown when tracked | Pass |
| 6 | Delivery charge | Dhaka ৳80, Chattogram ৳150, 3+ items free; the posted Total matches the server rule | Pass |
| 7 | Invalid mobile | `0171234` and `012…` refused; `+৮৮০ ১৮১২-৩৪৫৬৭৮` sent as `01812345678` | Pass |
| 8 | Missing information | Every required field is marked; nothing is sent | Pass |
| 9 | Out of stock | Buy Now disabled for an out-of-stock product; the server's OUT_OF_STOCK message is shown with no success screen | Pass |
| 10 | Duplicate submission | Double tap and form re-submit while sending: 1 request. Backend contract verifies that concurrent retries serialize the EventID lookup, rate limit, duplicate check, row append and cache write under one script lock | Pass |
| 11 | Network failure | Request aborted: clear message, no success; the retry sends the same EventID and succeeds | Pass |
| 12 | Google Sheets submission | Mocked only. **Must be checked on the live site** (see Deployment) | Not run live |
| 13 | Mobile and desktop | 360, 390 and 1280 px: the panel fits, no sideways scroll, button ≥ 48 px, inputs 16 px, Esc closes | Pass |
| — | Popup cannot load | Buy Now falls back to the cart and `/checkout` | Pass |
| — | Grid card no longer goes to WhatsApp | It opens the quick view or the popup | Pass |

Other checks:

- `npm run test:backend` passes (193 tests, including 6 new ones).
- `node scripts/build-gs-core.mjs --check` passes.
- The full E2E suite result is in the PR.

## Performance

- Page load gets **no new requests**:
  - The popup (`checkout-popup.js`, about 12 KB gzipped) loads only when Order Now is pressed.
  - The district and upazila lists (about 15 KB gzipped together) load at the same moment.
  - `cart-utils.js` grows by about 2.4 KB uncompressed.
- **No layout shift (CLS)**: the popup is a fixed overlay above the page, and the page behind it does not move.
- **SEO**: product URLs, metadata and page markup are unchanged. The card buttons are not links search engines use.
  The home card link now points to the product page instead of `wa.me`.

## Deployment

1. Merge the PR. Cloudflare Pages deploys the site, and the Apps Script deploy workflow deploys `Code.gs` and `AdminOrders.gs`.
2. On the live site, place one real test order:
   - Open a product, press Buy Now, fill in the form, and confirm.
   - The success screen must show an order ID.
   - The **Online Order** sheet must have that order ID, the note in **নোট**, the full address with upazila and district, and status Pending.
3. Delete or cancel the test order. Cancelling releases its reserved stock.
4. In the admin order editor, check that **Processing** appears in the status list.

## Rollback

- Revert the PR's merge commit on GitHub (the Revert button). Pages and Apps Script deploy the previous code again.
- No data needs undoing:
  - No new sheet columns were added.
  - Orders that were set to Processing keep that text. They can be changed back to Confirmed or Shipped by hand.

## Known limits / not done

- Only Cash on Delivery in the popup. bKash, Nagad and coupons remain on `/checkout`.
- The popup orders one product. The whole cart still goes through `/checkout`.
- `product.html?id=…` (the older product page script `product-page.js`) still has its own optional “WhatsApp-এ অর্ডার”
  button. Live product URLs (`/product/ID`) use the new flow.
- Found while reading the code, not changed: `/checkout` sends `Thana`, but the order server never stores it. The popup
  adds the upazila and district into the address so they reach the sheet.
- The Purchase event to GTM is pushed the same way as on `/checkout` (`purchase_complete`). Whether any GTM tag
  depends on the `/thank-you` page URL was not checked.
