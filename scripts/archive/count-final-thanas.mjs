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

const PKG = {
  "Cox's Bazar": "Cox'S Bazar",
  Chattogram: "Chittagong",
  Bogra: "Bogra",
  Jessore: "Jessore",
  Jhalokati: "Jhalokati",
  Moulvibazar: "Maulvibazar",
  Kishoreganj: "Kishoregonj",
  Netrokona: "Netrakona",
  Chapainawabganj: "C. Nababganj",
  Khagrachari: "Khagrachhari",
};

const SUPPLEMENT = {
  Bhola: ["Dularhat", "Shashibhushan", "South Aicha"],
  Chittagong: ["Anwara"],
  "Cox'S Bazar": ["Eidgaon", "Matarbari"],
  Habiganj: ["Dasar"],
  Sunamganj: ["Madhyanagar"],
  Sylhet: ["Osmani Nagar"],
  Mymensingh: ["Tarakanda"],
  Gazipur: ["Purbachal Uttar"],
  Narayanganj: ["Purbachal Dakshin"],
  Narsingdi: ["Raipura Model"],
  Kishoregonj: ["Kishoregonj Model", "Katiadi Model"],
  Tangail: ["Kalihati Model", "Gopalpur Model"],
  Brahmanbaria: ["Shahbazpur Town"],
  Jamalpur: ["Narundi Police I.C"],
  Lakshmipur: ["Komol Nagar"],
};

const bddata = parseBddataThanas(
  fs.readFileSync(path.join(root, ".cache", "bddata-thanas-table.md"), "utf8")
);
const seen = {};
let total = 0;

function add(distEn, name) {
  if (!seen[distEn]) seen[distEn] = new Set();
  const keySet = allKeys(name);
  for (const k of keySet) {
    if (seen[distEn].has(k)) return false;
  }
  keySet.forEach(function (k) {
    seen[distEn].add(k);
  });
  total++;
  return true;
}

Object.keys(bddata.byDistrictEn).forEach(function (de) {
  (bddata.byDistrictEn[de] || []).forEach(function (n) {
    add(de, n);
  });
});
Object.keys(SUPPLEMENT).forEach(function (de) {
  (SUPPLEMENT[de] || []).forEach(function (n) {
    add(de, n);
  });
});

const gap = [];
up.forEach(function (u) {
  const de = PKG[u.district] || u.district;
  if (u.district === "Madaripur" && u.upazila === "Dasar") {
    if (add("Habiganj", u.upazila)) gap.push("Habiganj: Dasar");
    return;
  }
  if (add(de, u.upazila)) gap.push(de + ": " + u.upazila);
});

console.log("total after bddata + supplement + gap merge:", total);
console.log("gap additions:", gap.length);
gap.forEach(function (line) {
  console.log(line);
});
