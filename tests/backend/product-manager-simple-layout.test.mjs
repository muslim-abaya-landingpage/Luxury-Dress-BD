import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../../product-manager.html", import.meta.url), "utf8");
const css = readFileSync(new URL("../../product-manager-woo.css", import.meta.url), "utf8");

test("Product editor groups existing controls into four simple sections", () => {
  for (const title of [
    "1. Basic Information",
    "2. Product Images",
    "3. Options & Stock",
    "4. Additional Information"
  ]) assert.ok(html.includes(title), "missing section: " + title);
  for (const id of [
    "pmDescBox", "pmCatBox", "pmImgBox", "pmGalBox", "pmDataBox",
    "pmShortBox", "pmSeoBox", "pmBrandBox", "pmTagBox", "pmSlugBox"
  ]) assert.ok(html.includes('move("' + id + '"'), "existing control not assigned: " + id);
});

test("Product editor keeps existing product action and adds responsive accordion styling", () => {
  assert.ok(html.includes('root.querySelector("#pmEditAddNew")'));
  assert.ok(html.includes('redundantAdd.hidden = true'));
  assert.ok(css.includes(".pm-simple-step"));
  assert.ok(css.includes("@media(max-width:560px)"));
});
