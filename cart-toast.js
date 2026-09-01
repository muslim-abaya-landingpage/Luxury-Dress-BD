/**
 * Toast system removed — Add to Cart now opens the Cart Drawer instantly
 * instead of showing a popup (see cart-drawer.js).
 *
 * This file used to render the "Added to bag" / "Removed from bag" toast
 * and its CSS. Per the redesign, that UI is gone: no toast markup, no
 * cart-toast.css load, no toast event listeners.
 *
 * The three globals below are kept as no-ops (not deleted) because
 * showCartAddedToast / showCartRemovedToast / playCartButtonAddedUi are
 * called from page-specific Add to Cart handlers that live in other,
 * unaudited files (home page, category pages, product page — none of
 * these were included in the files provided for this change, so per
 * "don't modify unrelated files" they were left alone). Deleting the
 * globals outright would turn every one of those existing calls into a
 * thrown "X is not a function" and break those pages' add-to-cart flow.
 * Keeping them as safe no-ops preserves current behavior elsewhere while
 * guaranteeing no toast ever renders.
 *
 * If you're wiring up one of those page-specific handlers to the new
 * drawer flow, replace its showCartAddedToast(...) call with
 * window.openCartDrawer() (after confirming the add succeeded) — the same
 * pattern already used in cart-drawer.js's addRelatedProductToCart.
 */
(function (global) {
  function noop() {}
  global.showCartAddedToast = noop;
  global.showCartRemovedToast = noop;
  global.playCartButtonAddedUi = noop;
})(typeof window !== "undefined" ? window : this);
