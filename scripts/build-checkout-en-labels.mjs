/**
 * Build English display labels for checkout district / upazila selects.
 * Order sheet values stay Bengali; UI shows English.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

function normalizeDistrictName(name) {
  return String(name || "")
    .trim()
    .normalize("NFC")
    .replace(/\u09AF\u09BC/g, "\u09DF")
    .replace(/\u09A1\u09BC/g, "\u09DC")
    .replace(/\u09A2\u09BC/g, "\u09DD")
    .replace(/\u09C0/g, "\u09BF")
    .replace(/\u09C1/g, "\u0981")
    .replace(/\u09AF\u09BC/g, "\u09DF");
}

function isAsciiLabel(name) {
  return !/[\u0980-\u09FF]/.test(String(name || ""));
}

function phpmyadminRows(jsonText) {
  const parsed = JSON.parse(jsonText);
  const table = parsed.find((x) => x.type === "table" && Array.isArray(x.data));
  return table ? table.data : [];
}

function readCheckoutDistrictList() {
  const labelsPath = path.join(root, "checkout-location-labels.js");
  if (fs.existsSync(labelsPath)) {
    const src = fs.readFileSync(labelsPath, "utf8");
    const match = src.match(/window\.CHECKOUT_DISTRICTS=([\s\S]*?);/);
    if (match) {
      return JSON.parse(match[1]).map(function (row) {
        return row.bn;
      });
    }
  }
  return Object.keys(
    JSON.parse(
      fs.readFileSync(path.join(root, "data", "bd-upazilas-by-district.json"), "utf8")
    )
  );
}

async function main() {
  const cacheDir = path.join(root, ".cache");
  const districts = phpmyadminRows(
    fs.readFileSync(path.join(cacheDir, "nuhil-districts.json"), "utf8")
  );
  const upazilas = phpmyadminRows(
    fs.readFileSync(path.join(cacheDir, "nuhil-upazilas.json"), "utf8")
  );
  const bnData = JSON.parse(
    fs.readFileSync(path.join(root, "data", "bd-upazilas-by-district.json"), "utf8")
  );

  const districtNormToEn = {};
  districts.forEach(function (d) {
    districtNormToEn[normalizeDistrictName(d.bn_name)] = d.name;
  });
  Object.assign(districtNormToEn, {
    [normalizeDistrictName("\u099a\u099f\u09cd\u099f\u0997\u09cd\u09b0\u09be\u09ae")]: "Chittagong",
    [normalizeDistrictName("\u09ac\u0997\u09c1\u09dc\u09be")]: "Bogura",
    [normalizeDistrictName("\u09af\u09b6\u09cb\u09b0")]: "Jashore",
    [normalizeDistrictName("\u099d\u09be\u09b2\u0995\u09be\u09a0\u09bf")]: "Jhalokati",
    [normalizeDistrictName("\u09ae\u09cc\u09b2\u09ad\u09c0\u09ac\u09be\u099c\u09be\u09b0")]: "Moulvibazar",
    [normalizeDistrictName("\u09a8\u09c7\u09a4\u09cd\u09b0\u0995\u09cb\u09a8\u09be")]: "Netrokona",
    [normalizeDistrictName("\u09ae\u09c1\u09a8\u09cd\u09b8\u09c0\u0997\u099e\u09cd\u099c")]: "Munshiganj",
    [normalizeDistrictName("\u09ae\u09df\u09cd\u09af\u09ae\u09a8\u09b8\u09bf\u0982\u09b9")]: "Mymensingh",
    [normalizeDistrictName("\u09aa\u099f\u09c1\u09af\u09bc\u09be\u0996\u09be\u09b2\u09c0")]: "Patuakhali",
    [normalizeDistrictName("\u099a\u09c1\u09af\u09bc\u09be\u09a1\u09be\u0999\u09cd\u0997\u09be")]: "Chuadanga",
    [normalizeDistrictName("\u0995\u09c1\u09b7\u09cd\u099f\u09bf\u09af\u09bc\u09be")]: "Kushtia",
    [normalizeDistrictName("\u0995\u09bf\u09b6\u09cb\u09b0\u0997\u099e\u09cd\u099c")]: "Kishoreganj",
    [normalizeDistrictName("\u09a8\u09be\u09b0\u09be\u09af\u09bc\u09a3\u0997\u099e\u09cd\u099c")]: "Narayanganj",
    [normalizeDistrictName("\u0995\u0995\u09cd\u09b8\u09ac\u09be\u099c\u09be\u09b0")]: "Cox's Bazar",
  });

  const districtBnToEn = {};
  Object.keys(bnData).forEach(function (bn) {
    districtBnToEn[bn] =
      districtNormToEn[normalizeDistrictName(bn)] || (isAsciiLabel(bn) ? bn : bn);
  });

  const upazilaNormToEn = {};
  upazilas.forEach(function (u) {
    upazilaNormToEn[normalizeDistrictName(u.bn_name)] = u.name;
  });

  const upazilaBnToEn = {};
  Object.keys(bnData).forEach(function (distBn) {
    const distEn = districtBnToEn[distBn] || distBn;
    (bnData[distBn] || []).forEach(function (raw) {
      if (upazilaBnToEn[raw]) return;
      if (isAsciiLabel(raw)) {
        upazilaBnToEn[raw] = String(raw).trim();
        return;
      }
      const hit = upazilaNormToEn[normalizeDistrictName(raw)];
      if (hit) {
        upazilaBnToEn[raw] = hit;
        return;
      }
      if (raw.indexOf("\u09b8\u09a6\u09b0") !== -1) {
        upazilaBnToEn[raw] = distEn + " Sadar";
        return;
      }
      upazilaBnToEn[raw] = raw;
    });
  });

  const dhakaNearby = [
    "\u0997\u09be\u099c\u09c0\u09aa\u09c1\u09b0",
    "\u09a8\u09be\u09b0\u09be\u09af\u09bc\u09a3\u0997\u099e\u09cd\u099c",
    "\u09a8\u09b0\u09b8\u09bf\u0982\u09a6\u09c0",
    "\u09ae\u09c1\u09a8\u09cd\u09b8\u09c0\u0997\u099e\u09cd\u099c",
    "\u09ae\u09be\u09a8\u09bf\u0997\u099e\u09cd\u099c",
    "\u099f\u09be\u0999\u09cd\u0997\u09be\u0987\u09b2",
    "\u0995\u09bf\u09b6\u09cb\u09b0\u0997\u099e\u09cd\u099c",
    "\u09ae\u09af\u09bc\u09ae\u09a8\u09b8\u09bf\u0982\u09b9",
    "\u09ab\u09b0\u09bf\u09a6\u09aa\u09c1\u09b0",
    "\u09b0\u09be\u099c\u09ac\u09be\u09a1\u09bc\u09c0",
    "\u09ae\u09be\u09a6\u09be\u09b0\u09c0\u09aa\u09c1\u09b0",
    "\u0997\u09cb\u09aa\u09be\u09b2\u0997\u099e\u09cd\u099c",
    "\u09b6\u09b0\u09c0\u09af\u09bc\u09a4\u09aa\u09c1\u09b0",
    "\u099c\u09be\u09ae\u09be\u09b2\u09aa\u09c1\u09b0",
    "\u09b6\u09c7\u09b0\u09aa\u09c1\u09b0",
    "\u09a8\u09c7\u09a4\u09cd\u09b0\u0995\u09cb\u09a8\u09be",
  ];
  const allDistricts = readCheckoutDistrictList();
  const nearbySet = {};
  dhakaNearby.forEach(function (d) {
    nearbySet[d] = 1;
  });

  const checkoutDistricts = [];
  function pushDistrict(bn) {
    checkoutDistricts.push({
      bn: bn,
      en: districtBnToEn[bn] || districtNormToEn[normalizeDistrictName(bn)] || bn,
      fee: bn === "\u09a2\u09be\u0995\u09be" ? 80 : 150,
    });
  }
  pushDistrict("\u09a2\u09be\u0995\u09be");
  dhakaNearby.forEach(function (bn) {
    if (allDistricts.indexOf(bn) !== -1) pushDistrict(bn);
  });
  allDistricts
    .filter(function (bn) {
      return bn !== "\u09a2\u09be\u0995\u09be" && !nearbySet[bn];
    })
    .sort(function (a, b) {
      return (districtBnToEn[a] || a).localeCompare(districtBnToEn[b] || b, "en");
    })
    .forEach(pushDistrict);

  let stillBn = 0;
  Object.keys(upazilaBnToEn).forEach(function (k) {
    if (/[\u0980-\u09FF]/.test(upazilaBnToEn[k])) stillBn++;
  });

  const out =
    "window.CHECKOUT_DISTRICTS=" +
    JSON.stringify(checkoutDistricts) +
    ";\n" +
    "window.CHECKOUT_DISTRICT_BN_TO_EN=" +
    JSON.stringify(districtBnToEn) +
    ";\n" +
    "window.CHECKOUT_UPAZILA_BN_TO_EN=" +
    JSON.stringify(upazilaBnToEn) +
    ";\n";

  fs.writeFileSync(path.join(root, "checkout-location-labels.js"), out, "utf8");
  console.log(
    "Wrote checkout-location-labels.js —",
    checkoutDistricts.length,
    "districts,",
    Object.keys(upazilaBnToEn).length,
    "upazila labels,",
    stillBn,
    "still Bengali"
  );
}

main().catch(function (err) {
  console.error(err);
  process.exit(1);
});
