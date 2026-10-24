import fs from "fs";

const data = JSON.parse(fs.readFileSync("data/bd-upazilas-by-district.json", "utf8"));
const keys = Object.keys(data);

function norm(s) {
  return String(s)
    .trim()
    .replace(/\u09af\u09bc/g, "\u09af")
    .replace(/\u09c1/g, "\u0981")
    .replace(/\u09c0/g, "\u09bf");
}

const checkoutBlock = fs.readFileSync("checkout.html", "utf8");
const m = checkoutBlock.match(/var allDistricts = \[([\s\S]*?)\];/);
if (!m) {
  console.error("allDistricts not found");
  process.exit(1);
}
const districts = [...m[1].matchAll(/'((?:\\u[0-9a-fA-F]{4}|[^'\\])*)'/g)].map((x) =>
  JSON.parse('"' + x[1].replace(/\\u/g, "\\u") + '"')
);

districts.forEach((name) => {
  if (data[name]) return;
  const n = norm(name);
  const hit = keys.find((k) => norm(k) === n);
  if (!hit) console.log("NO MATCH:", name);
  else if (hit !== name) console.log("ALIAS:", name, "->", hit);
});
