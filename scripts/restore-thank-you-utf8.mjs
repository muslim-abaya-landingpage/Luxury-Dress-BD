import { execSync } from "child_process";
import fs from "fs";

const SRC = "7721f89";

function toHtmlEntities(str) {
  return String(str)
    .split("")
    .map((ch) => {
      const c = ch.charCodeAt(0);
      return c > 127 ? `&#${c};` : ch;
    })
    .join("");
}

function toJsUnicodeLiteral(str) {
  return (
    "'" +
    String(str)
      .split("")
      .map((ch) => {
        const c = ch.charCodeAt(0);
        if (c <= 127 && ch !== "\\" && ch !== "'") return ch;
        if (ch === "\\") return "\\\\";
        if (ch === "'") return "\\'";
        return "\\u" + c.toString(16).padStart(4, "0");
      })
      .join("") +
    "'"
  );
}

let html = execSync(`git show ${SRC}:thank-you.html`, { encoding: "utf8" });

html = html.replace(
  /<link href="https:\/\/fonts\.googleapis\.com[^>]+>/,
  `<link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link rel="preload" href="https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@400;700&display=swap" as="style" onload="this.onload=null;this.rel='stylesheet'">
    <noscript><link href="https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@400;700&display=swap" rel="stylesheet"></noscript>`
);

html = html.replace(
  /<link rel="stylesheet" href="site-footer\.css[^>]+>/,
  `<link rel="stylesheet" href="site-footer.css?v=20260530ft8" media="print" onload="this.media='all'">
  <noscript><link rel="stylesheet" href="site-footer.css?v=20260530ft8"></noscript>`
);

html = html.replace(
  /<link rel="stylesheet" href="https:\/\/cdnjs\.cloudflare\.com[^>]+>/,
  `<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" media="print" onload="this.media='all'">`
);

html = html.replace(/site-header\.js\?v=[^"]+/, "site-header.js?v=20260531perf");
html = html.replace(/site-footer\.js\?v=[^"]+/, "site-footer.js?v=20260629post");

html = html.replace(/\s*<script>\(function\(w,d,s,l,i\)[\s\S]*?<\/script>\s*/m, "\n    ");

html = html.replace(/<title>[^<]+<\/title>/, (m) => {
  const text = m.replace(/<\/?title>/g, "");
  return `<title>${toHtmlEntities(text)}</title>`;
});

html = html.replace(/<p class="thank-message">[^<]+<\/p>/, (m) => {
  const text = m.replace(/<\/?p[^>]*>/g, "").replace(/class="thank-message"/, "").trim();
  return `<p class="thank-message">${toHtmlEntities(text.replace(/^thank-message/, "").trim() || m.match(/>([^<]+)</)[1])}</p>`;
});

html = html.replace(
  /<p style="font-size:14px;color:#6b7280[^"]*">[^<]+<\/p>/,
  (m) => {
    const text = m.replace(/<[^>]+>/g, "").trim();
    const open = m.match(/^<p[^>]+>/)[0];
    return `${open}${toHtmlEntities(text)}</p>`;
  }
);

html = html.replace(
  /<a href="\/" class="btn btn-dark">[\s\S]*?<\/a>/,
  (m) => {
    const inner = m.replace(/<\/?a[^>]*>/g, "").trim();
    const icon = inner.match(/<i class="fas fa-shopping-bag"><\/i>/);
    const text = inner.replace(/<i[^>]*><\/i>\s*/, "").trim();
    return `<a href="/" class="btn btn-dark">${icon ? '<i class="fas fa-shopping-bag"></i> ' : ""}${toHtmlEntities(text)}</a>`;
  }
);

html = html.replace(
  /<a href="https:\/\/wa\.me[^"]+" class="btn btn-light"[^>]*>[^<]+<\/a>/,
  (m) => {
    const open = m.match(/^<a[^>]+>/)[0];
    const text = m.replace(/<[^>]+>/g, "").trim();
    return `${open}${toHtmlEntities(text)}</a>`;
  }
);

html = html.replace(
  /<a href="help\.html#order-status" class="btn btn-light">[^<]+<\/a>/,
  (m) => {
    const open = m.match(/^<a[^>]+>/)[0];
    const text = m.replace(/<[^>]+>/g, "").trim();
    return `${open}${toHtmlEntities(text)}</a>`;
  }
);

html = html.replace(
  /el\.textContent = '([^']*)' \+ oid;/,
  (m, prefix) => `el.textContent = ${toJsUnicodeLiteral(prefix)} + oid;`
);

fs.writeFileSync("thank-you.html", html, { encoding: "utf8" });

const out = fs.readFileSync("thank-you.html", "utf8");
const bn = (out.match(/[\u0980-\u09FF]/g) || []).length;
const bad = (out.match(/\?\?\?\?/g) || []).length;
const entities = (out.match(/&#(\d+);/g) || []).length;
console.log("thank-you.html Bengali chars:", bn, "???? blocks:", bad, "html entities:", entities);
if (bad > 0) process.exit(1);
if (entities < 50) {
  console.error("Expected HTML entities for Bengali copy");
  process.exit(1);
}

// success.html (legacy route)
let success = execSync(`git show ${SRC}:success.html`, { encoding: "utf8" });
success = success.replace(
  /<link href="https:\/\/fonts\.googleapis\.com[^>]+>/,
  `<link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@400;600;700&display=swap" rel="stylesheet">`
);
success = success.replace(/site-header\.css[^"]*/, "site-header.css?v=20260530c");
success = success.replace(
  /<link rel="stylesheet" href="site-footer\.css[^>]+>/,
  `<link rel="stylesheet" href="site-footer.css?v=20260530ft8" media="print" onload="this.media='all'">
  <noscript><link rel="stylesheet" href="site-footer.css?v=20260530ft8"></noscript>`
);
success = success.replace(/site-header\.js\?v=[^"]+/, "site-header.js?v=20260531perf");
success = success.replace(/site-footer\.js\?v=[^"]+/, "site-footer.js?v=20260629post");
success = success.replace(/<a href="index\.html"/, '<a href="/"');

["<h1>[^<]+</h1>", "<p>[^<]+</p>", '<div class="order-id">[^<]+<span', '<a href="/" class="btn-home">[^<]+</a>'].forEach(
  (pattern) => {
    success = success.replace(new RegExp(pattern), (m) => {
      if (!/[\u0980-\u09FF]/.test(m)) return m;
      if (m.startsWith("<h1>")) {
        const text = m.replace(/<\/?h1>/g, "");
        return `<h1>${toHtmlEntities(text)}</h1>`;
      }
      if (m.startsWith("<p>")) {
        const text = m.replace(/<\/?p>/g, "");
        return `<p>${toHtmlEntities(text)}</p>`;
      }
      if (m.startsWith('<div class="order-id">')) {
        const text = m.match(/>([^<]+)</)[1].replace(/#\s*$/, "").trim();
        return `<div class="order-id">${toHtmlEntities(text)} #<span id="order-id-display"></span></div>`;
      }
      if (m.includes("btn-home")) {
        const text = m.replace(/<[^>]+>/g, "").trim();
        return `<a href="/" class="btn-home">${toHtmlEntities(text)}</a>`;
      }
      return m;
    });
  }
);

success = success.replace(/<div class="icon-box">[^<]+<\/div>/, '<div class="icon-box">&#10003;</div>');

fs.writeFileSync("success.html", success, { encoding: "utf8" });
const successOut = fs.readFileSync("success.html", "utf8");
console.log(
  "success.html ???? blocks:",
  (successOut.match(/\?\?\?\?/g) || []).length,
  "entities:",
  (successOut.match(/&#(\d+);/g) || []).length
);
