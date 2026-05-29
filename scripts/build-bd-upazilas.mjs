/**
 * Build district → thana/upazila map (~654 police stations) for checkout.
 * Primary source: bddata.org police thana list (2021, ~651).
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { parseBddataThanas } from "./parse-bddata-thanas.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const outDir = path.join(root, "data");
const outFile = path.join(outDir, "bd-upazilas-by-district.json");
const embedFile = path.join(root, "checkout-locations-data.js");

const NUHIL_DISTRICTS_URL =
  "https://raw.githubusercontent.com/nuhil/bangladesh-geocode/master/districts/districts.json";
const NUHIL_UPAZILAS_URL =
  "https://raw.githubusercontent.com/nuhil/bangladesh-geocode/master/upazilas/upazilas.json";
const SOHAN_URL =
  "https://raw.githubusercontent.com/sohan-99/bangladesh-location-data/main/locationBdDivisonsToUnionsBangla.json";

async function loadCached(url, cacheName) {
  const cache = path.join(root, ".cache", cacheName);
  if (fs.existsSync(cache)) return fs.readFileSync(cache, "utf8");
  const res = await fetch(url);
  if (!res.ok) throw new Error("Fetch failed " + url + " " + res.status);
  const text = await res.text();
  fs.mkdirSync(path.dirname(cache), { recursive: true });
  fs.writeFileSync(cache, text, "utf8");
  return text;
}

function normName(name) {
  return String(name || "")
    .trim()
    .normalize("NFC")
    .replace(/\u09AF\u09BC/g, "\u09DF")
    .replace(/\u09A1\u09BC/g, "\u09DC")
    .replace(/\u09A2\u09BC/g, "\u09DD")
    .replace(/\u09C0/g, "\u09BF")
    .replace(/\u09C1/g, "\u0981");
}

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

/** Collapse common EN spelling variants (Hajiganj/Haziganj, Austagram/Astagram, …). */
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

/** Post-2021 / split police stations missing from bddata.org table (613 rows). */
const SUPPLEMENT_BY_DIST_EN = {
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

function phpmyadminRows(jsonText) {
  const parsed = JSON.parse(jsonText);
  const table = parsed.find((x) => x.type === "table" && Array.isArray(x.data));
  return table ? table.data : [];
}

async function main() {
  const bddataPath = path.join(root, ".cache", "bddata-thanas-table.md");
  if (!fs.existsSync(bddataPath)) {
    throw new Error("Missing .cache/bddata-thanas-table.md");
  }

  const bddata = parseBddataThanas(fs.readFileSync(bddataPath, "utf8"));
  const nuhilDistricts = phpmyadminRows(await loadCached(NUHIL_DISTRICTS_URL, "nuhil-districts.json"));
  const nuhilUpazilas = phpmyadminRows(await loadCached(NUHIL_UPAZILAS_URL, "nuhil-upazilas.json"));
  const sohan = JSON.parse(await loadCached(SOHAN_URL, "locationBdDivisonsToUnionsBangla.json"));

  const districtEnToBn = {};
  nuhilDistricts.forEach(function (d) {
    districtEnToBn[d.name] = d.bn_name;
  });
  Object.assign(districtEnToBn, {
    Chittagong: districtEnToBn.Chattogram,
    Bogra: districtEnToBn.Bogura,
    Jessore: districtEnToBn.Jashore,
    Comilla: districtEnToBn.Comilla || "\u0995\u09c1\u09ae\u09bf\u09b2\u09cd\u09b2\u09be",
    "Cox's Bazar": districtEnToBn.Coxsbazar,
    "Cox'S Bazar": districtEnToBn.Coxsbazar,
    "C. Nababganj": districtEnToBn.Chapainawabganj,
    Kishoregonj: districtEnToBn.Kishoreganj,
    Jhalokati: districtEnToBn.Jhalakathi,
    Jhalakathi: districtEnToBn.Jhalakathi,
    Maulvibazar: districtEnToBn.Moulvibazar,
    Netrakona: districtEnToBn.Netrokona,
  });

  const bnLookup = {};
  nuhilUpazilas.forEach(function (u) {
    const dist = nuhilDistricts.find(function (d) {
      return String(d.id) === String(u.district_id);
    });
    if (!dist) return;
    if (!bnLookup[dist.name]) bnLookup[dist.name] = {};
    bnLookup[dist.name][normEnKey(u.name)] = u.bn_name;
    bnLookup[dist.name][normEnKey(u.bn_name)] = u.bn_name;
  });
  ["Chittagong", "Bogra", "Jessore", "Jhalokati", "Maulvibazar", "Kishoregonj", "Netrakona"].forEach(
    function (alias) {
      const map = {
        Chittagong: "Chattogram",
        Bogra: "Bogura",
        Jessore: "Jashore",
        Jhalokati: "Jhalakathi",
        Maulvibazar: "Moulvibazar",
        Kishoregonj: "Kishoreganj",
        Netrakona: "Netrokona",
      };
      const canonical = map[alias];
      if (bnLookup[canonical] && !bnLookup[alias]) bnLookup[alias] = bnLookup[canonical];
    }
  );

  const sohanBnByDistBn = {};
  Object.keys(sohan.districts_bn || {}).forEach(function (divKey) {
    (sohan.districts_bn[divKey] || []).forEach(function (dist) {
      if (!sohanBnByDistBn[dist.title]) sohanBnByDistBn[dist.title] = {};
      (sohan.upazilas_bn[dist.value] || []).forEach(function (u) {
        sohanBnByDistBn[dist.title][normEnKey(u.title)] = u.title;
      });
    });
  });

  let byDistrict = {};
  const seen = {};

  function ensure(distBn) {
    if (!byDistrict[distBn]) {
      byDistrict[distBn] = [];
      seen[distBn] = new Set();
    }
  }

  function nuhilDistEn(distEn) {
    const map = {
      Chittagong: "Chattogram",
      Bogra: "Bogura",
      Jessore: "Jashore",
      Jhalokati: "Jhalakathi",
      Maulvibazar: "Moulvibazar",
      Kishoregonj: "Kishoreganj",
      Netrakona: "Netrokona",
      "C. Nababganj": "Chapainawabganj",
      Khagrachhari: "Khagrachari",
    };
    return map[distEn] || distEn;
  }

  function labelFor(distEn, rawName) {
    const nuhilDist = nuhilDistEn(distEn);
    const bn =
      (bnLookup[nuhilDist] && bnLookup[nuhilDist][normEnKey(rawName)]) ||
      (bnLookup[distEn] && bnLookup[distEn][normEnKey(rawName)]) ||
      null;
    if (bn) return bn;
    const distBn = districtEnToBn[distEn] || distEn;
    const sohanBn =
      sohanBnByDistBn[distBn] && sohanBnByDistBn[distBn][normEnKey(rawName)];
    return sohanBn || rawName;
  }

  function keysFor(rawName, label) {
    const keys = new Set();
    [rawName, label].forEach(function (n) {
      [normEnKey, fuzzyKey, baseKey].forEach(function (fn) {
        const k = fn(n);
        if (k) keys.add(k);
      });
    });
    return keys;
  }

  function hasAnyKey(distBn, keySet) {
    for (const k of keySet) {
      if (seen[distBn].has(k)) return true;
    }
    return false;
  }

  function addKeys(distBn, keySet) {
    keySet.forEach(function (k) {
      seen[distBn].add(k);
    });
  }

  function addThana(distEn, rawName) {
    const distBn = districtEnToBn[distEn] || distEn;
    ensure(distBn);
    const label = labelFor(distEn, rawName);
    const keySet = keysFor(rawName, label);
    if (hasAnyKey(distBn, keySet)) return;
    addKeys(distBn, keySet);
    byDistrict[distBn].push(label);
  }

  Object.keys(bddata.byDistrictEn).forEach(function (distEn) {
    (bddata.byDistrictEn[distEn] || []).forEach(function (name) {
      addThana(distEn, name);
    });
  });

  Object.keys(SUPPLEMENT_BY_DIST_EN).forEach(function (distEn) {
    (SUPPLEMENT_BY_DIST_EN[distEn] || []).forEach(function (name) {
      addThana(distEn, name);
    });
  });

  const normToKey = {};
  Object.keys(byDistrict).forEach(function (key) {
    normToKey[normName(key)] = key;
    byDistrict[key].sort(function (a, b) {
      return a.localeCompare(b, "bn");
    });
  });

  const manualAliases = {
    "\u09a8\u09c7\u09a4\u09cd\u09b0\u0995\u09cb\u09a8\u09be": "\u09a8\u09c7\u09a4\u09cd\u09b0\u0995\u09cb\u09a3\u09be",
    "\u09ae\u09c1\u09a8\u09cd\u09b8\u09c0\u0997\u099e\u09cd\u099c": "\u09ae\u09c1\u09a8\u09cd\u09b8\u09bf\u0997\u09b0\u09c0",
    "\u09a8\u09be\u09b0\u09be\u09af\u09bc\u09a3\u0997\u099e\u09cd\u099c": "\u09a8\u09be\u09df\u09bc\u09a3\u09b8\u09c0",
    "\u09ae\u09c1\u09a8\u09cd\u09b8\u09bf\u0997\u09b0\u09c0": "\u09ae\u09c1\u09a8\u09cd\u09b8\u09bf\u0997\u09b0\u09c0",
  };
  Object.keys(manualAliases).forEach(function (alias) {
    const canonical = manualAliases[alias];
    if (byDistrict[canonical] && !byDistrict[alias]) {
      byDistrict[alias] = byDistrict[canonical].slice();
    }
  });

  const canonicalBn = new Set(
    nuhilDistricts.map(function (d) {
      return d.bn_name;
    })
  );
  let canonicalTotal = 0;
  canonicalBn.forEach(function (bn) {
    if (byDistrict[bn]) canonicalTotal += byDistrict[bn].length;
  });

  let checkoutHtml = "";
  try {
    checkoutHtml = fs.readFileSync(path.join(root, "checkout.html"), "utf8");
  } catch (_) {}
  const districtMatch = checkoutHtml.match(/var allDistricts = \[([\s\S]*?)\];/);
  if (districtMatch) {
    const re = /'((?:\\u[0-9a-fA-F]{4}|[^'\\])*)'/g;
    let m;
    while ((m = re.exec(districtMatch[1]))) {
      const label = JSON.parse('"' + m[1].replace(/\\u/g, "\\u") + '"');
      const canonical = normToKey[normName(label)];
      if (canonical && !byDistrict[label]) {
        byDistrict[label] = byDistrict[canonical].slice();
      }
    }
  }

  const byDistrictRaw = byDistrict;
  byDistrict = {};
  Object.keys(byDistrictRaw).forEach(function (k) {
    if (/[\u0980-\u09FF]/.test(k)) byDistrict[k] = byDistrictRaw[k];
  });
  Object.keys(byDistrictRaw).forEach(function (k) {
    if (/[\u0980-\u09FF]/.test(k)) return;
    const bn = districtEnToBn[k];
    if (!bn) return;
    if (!byDistrict[bn]) byDistrict[bn] = byDistrictRaw[k].slice();
  });

  let total = 0;
  Object.keys(byDistrict).forEach(function (k) {
    total += byDistrict[k].length;
  });

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outFile, JSON.stringify(byDistrict), "utf8");
  const embedLine =
    "window.CHECKOUT_UPAZILAS_BY_DISTRICT=" + JSON.stringify(byDistrict) + ";";
  fs.writeFileSync(embedFile, embedLine + "\n", "utf8");

  const locJs = path.join(root, "checkout-locations.js");
  const locSrc = fs.readFileSync(locJs, "utf8");
  const startMark = "/** @checkout-thana-data-start */";
  const endMark = "/** @checkout-thana-data-end */";
  const startIdx = locSrc.indexOf(startMark);
  const endIdx = locSrc.indexOf(endMark);
  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    const merged =
      locSrc.slice(0, startIdx + startMark.length) +
      "\n" +
      embedLine +
      "\n" +
      locSrc.slice(endIdx);
    fs.writeFileSync(locJs, merged, "utf8");
    console.log("Embedded thana data in", locJs);
  }

  console.log(
    "Wrote",
    outFile,
    "—",
    Object.keys(byDistrict).length,
    "district keys,",
    total,
    "thanas (64 districts:",
    canonicalTotal + ", bddata:",
    bddata.count + ")"
  );
  console.log(
    "Dhaka:",
    (byDistrict["\u09a2\u09be\u0995\u09be"] || []).length,
    "| Chattogram:",
    (byDistrict["\u099a\u099f\u09cd\u099f\u0997\u09cd\u09b0\u09be\u09ae"] || []).length
  );
  console.log("Wrote", embedFile);
}

main().catch(function (err) {
  console.error(err);
  process.exit(1);
});
