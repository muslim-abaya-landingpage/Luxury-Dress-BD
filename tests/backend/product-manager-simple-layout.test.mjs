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
