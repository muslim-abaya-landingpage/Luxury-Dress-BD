import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";
import { parseBddataThanas } from "./parse-bddata-thanas.mjs";

const require = createRequire(import.meta.url);
const up = require("@bangladeshi/bangladesh-address/build/src/json/bd-upazila.json");
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function normEnKey(name) {
  return String(name || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function fuzzyKey(name) {
  return normEnKey(name).replace(
    /(sadar|south|north|east|west|model|town|corporation|upazila|thana)/g,
    ""
  );
}

function baseKey(name) {
  return fuzzyKey(name)
    .replace(/z/g, "j")
    .replace(/ph/g, "f")
    .replace(/gh/g, "g")
    .replace(/oo/g, "o")
    .replace(/ee/g, "e")
    .replace(/kh/g, "k")
    .replace(/ch/g, "c")
    .replace(/sh/g, "s")
    .replace(/(.)\1+/g, "$1");
}

function allKeys(name) {
  const keys = new Set();
  [normEnKey, fuzzyKey, baseKey].forEach(function (fn) {
    const k = fn(name);
    if (k) keys.add(k);
  });
  return keys;
}

const PKG_DISTRICT_TO_BDDATA = {
  "Cox's Bazar": "Cox'S Bazar",
  Chattogram: "Chittagong",
  Chittagong: "Chittagong",
  Bogra: "Bogra",
  Jessore: "Jessore",
  Jhalokati: "Jhalokati",
  Moulvibazar: "Maulvibazar",
  Kishoreganj: "Kishoregonj",
  Netrokona: "Netrakona",
  Chapainawabganj: "C. Nababganj",
  Khagrachari: "Khagrachhari",
};

const bddata = parseBddataThanas(
  fs.readFileSync(path.join(root, ".cache", "bddata-thanas-table.md"), "utf8")
);
const seen = {};
Object.keys(bddata.byDistrictEn).forEach(function (de) {
  seen[de] = new Set();
  (bddata.byDistrictEn[de] || []).forEach(function (n) {
    allKeys(n).forEach(function (k) {
      seen[de].add(k);
    });
  });
});

const add = [];
up.forEach(function (u) {
  const de = PKG_DISTRICT_TO_BDDATA[u.district] || u.district;
  if (!seen[de]) seen[de] = new Set();
  const k = normEnKey(u.upazila);
  const keySet = allKeys(u.upazila);
  let dup = false;
  keySet.forEach(function (key) {
    if (seen[de].has(key)) dup = true;
  });
  if (!dup) {
    add.push({ dist: de, name: u.upazila });
    keySet.forEach(function (key) {
      seen[de].add(key);
    });
  }
});

console.log("bddata rows:", bddata.count);
console.log("truly missing from package vs bddata:", add.length);
add.forEach(function (row) {
  console.log(row.dist + ": " + row.name);
});
