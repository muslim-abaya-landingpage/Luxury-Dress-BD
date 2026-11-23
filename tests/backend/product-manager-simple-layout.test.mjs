import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../../product-manager.html", import.meta.url), "utf8");
const css = readFileSync(new URL("../../product-manager-woo-native.css", import.meta.url), "utf8");

test("Product editor defaults to the WooCommerce classic two-column layout", () => {
  assert.ok(html.includes('new URLSearchParams(location.search).get("layout") !== "guided"'));

  // The editor is rendered dynamically into #pmMain. Check the actual template
  // source rather than looking for rendered IDs in the outer HTML document.
  assert.ok(html.includes('id="pmMain"'), "missing dynamic Product Manager mount point");
  assert.ok(html.includes('function box(id, title, body, cls)'), "missing WooCommerce product panel renderer");
  for (const id of [
    "pmDescBox", "pmShortBox"
  ]) assert.ok(html.includes('box("' + id + '"'), "missing dynamically rendered WooCommerce product panel: " + id);

  for (const id of [
    "pmDataBox", "pmSeoBox", "pmPublishBox", "pmImgBox", "pmGalBox",
    "pmTagBox", "pmBrandBox", "pmSlugBox", "pmCatBox"
  ]) assert.ok(html.includes('id="' + id + '"'), "missing WooCommerce product panel template: " + id);

  assert.ok(html.includes('root.querySelector(".pm-wp-columns")'));
  assert.ok(html.includes('columns.querySelector(".pm-wp-col-main")'));
  assert.ok(html.includes('columns.querySelector(".pm-wp-col-side")'));
});

test("The four-step guided editor remains available only by explicit opt-in", () => {
  for (const title of [
    "1. Basic Information",
    "2. Product Images",
    "3. Options & Stock",
    "4. Additional Information"
  ]) assert.ok(html.includes(title), "missing optional guided section: " + title);
  assert.ok(css.includes("grid-template-columns: minmax(0, 1fr) 300px"));
  assert.ok(css.includes("@media (max-width: 980px)"));
  assert.ok(css.includes("@media (max-width: 640px)"));
});


test("Bangla onboarding guidance stays visible in the redesigned Product Manager", () => {
  const redesign = readFileSync(new URL("../../product-manager-redesign.css", import.meta.url), "utf8");
  assert.ok(html.includes('class="pm-guide"'), "missing Bangla onboarding guidance");
  assert.match(redesign, /\.pm-wp-admin \.pm-guide\s*\{[^}]*display:\s*flex\s*!important/s);
  assert.match(redesign, /Keep the Bangla onboarding hint visible/);
  assert.match(redesign, /\.pm-wp-admin \.pl-admin-header > \.adm-menu-btn/);
});

import vm from "node:vm";

test("Product categories support safe one-level parent/subcategory hierarchy without changing legacy categories", () => {
  const source = readFileSync(new URL("../../product-category-hierarchy.js", import.meta.url), "utf8");
  const window = {};
  vm.runInNewContext(source, { window });
  const api = window.MaCategoryHierarchy;
  const legacy = [{ key: "abaya" }, { key: "hijab" }];
  assert.deepEqual(Array.from(api.ordered(legacy), (x) => x.key), ["abaya", "hijab"]);
  const sections = [{ key: "abaya" }, { key: "hijab" }, { key: "premium-abaya", parentKey: "abaya" }];
  assert.deepEqual(Array.from(api.parentOptions(sections, "hijab"), (x) => x.key), ["abaya"]);
  assert.equal(api.validateParent(sections, "hijab", "abaya"), "abaya");
  assert.deepEqual(Array.from(api.ordered(sections), (x) => x.key), ["abaya", "premium-abaya", "hijab"]);
  assert.throws(() => api.validateParent(sections, "abaya", "premium-abaya"), /must remain a top-level/);
  assert.throws(() => api.validateParent(sections, "hijab", "missing"), /valid top-level parent/);
  assert.throws(() => api.validateParent(sections, "abaya", "hijab"), /must remain a top-level/);
});

test("Product Manager persists parentKey only for explicit subcategories", () => {
  assert.ok(html.includes('id="pmCatParent"'));
  assert.ok(html.includes('if (parentKey) entry.parentKey = parentKey;'));
  assert.ok(html.includes('if (sec.parentKey) lines.push("    parentKey: " + jsStr(sec.parentKey));'));
});


test("The action=new route opens the product editor after publisher catalog initialization", () => {
  const routeHandler = html.indexOf('openNewProductOnLoad = new URLSearchParams(location.search).get("action") === "new"');
  const reloadFunction = html.indexOf("function reloadPublishingData()");
  const publisherInit = html.indexOf("MaCatalogPublisher.init(", reloadFunction);
  const initCallback = html.indexOf("function(){window.MA_RAW_CATEGORY_PRODUCTS", publisherInit);
  const catalogInit = html.indexOf("loadState();", initCallback);
  const editorOpen = html.indexOf('if(new URLSearchParams(location.search).get("action")==="new")startNewProduct();', catalogInit);
  assert.ok(routeHandler >= 0, "missing action=new route detection");
  assert.ok(reloadFunction >= 0 && publisherInit > reloadFunction && initCallback > publisherInit, "missing publisher initialization callback");
  assert.ok(catalogInit > initCallback && editorOpen > catalogInit, "new-product editor must open after publisher callback initializes the catalog");
  assert.ok(!html.includes('want = new URLSearchParams(location.search).get("action") === "new"'), "action=new must not use the legacy delayed route handler");
});
