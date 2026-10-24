/**
 * Download bddata.org police thana table into .cache (one-time / refresh).
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const out = path.join(root, ".cache", "bddata-thanas-table.md");
const url = "https://www.bddata.org/db/Thanas_%28Police_Stations%29_List";

const res = await fetch(url);
if (!res.ok) throw new Error("bddata fetch failed: " + res.status);
const html = await res.text();
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, html, "utf8");
console.log("Saved", out, html.length, "bytes");
