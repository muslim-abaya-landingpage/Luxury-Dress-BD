import { execSync } from "child_process";
import fs from "fs";

const SRC = "7721f89";
const VER = "20260530ft7";

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

function escapeBnJsStrings(block) {
  return block.replace(/'([^'\\]*(?:\\.[^'\\]*)*)'/g, (match, inner) => {
    if (!/[\u0980-\u09FF]/.test(inner)) return match;
    return toJsUnicodeLiteral(inner.replace(/\\'/g, "'"));
  });
}

function applyCheckoutLocations(source) {
  let html = source;
  if (html.includes("checkout-locations.js")) return html;

  html = html.replace(
    /<input type="text" id="userThana" placeholder="Thana \/ Upazila">/,
    '<select id="userThana">\n                        <option value="">Select upazila / thana</option>\n                    </select>'
  );

  html = html.replace(
    /<script src="cart-utils\.js\?v=20260530"><\/script>/,
    '<script src="cart-utils.js?v=20260530"></script>\n<script src="checkout-locations.js?v=20260630th"></script>'
  );

  html = html.replace(
    /sel\.appendChild\(opt\);\s*\n\s*\}\);\s*\n\s*\}\)\(\);/,
    "sel.appendChild(opt);\n        });\n        if (typeof window.refreshCheckoutThanaSelect === 'function') {\n            window.refreshCheckoutThanaSelect();\n        }\n    })();"
  );

  return html;
}

function applyProEmptyCartUi(source) {
  let html = source;
  if (html.includes("buildEmptyCartHtml")) return html;

  html = html.replace(
    /\.empty-cart-msg \{[\s\S]*?\}\n        \.empty-cart-msg a \{[\s\S]*?\}/,
    `        .empty-cart-msg {
            text-align: center;
            padding: 22px 18px;
            background: #fafafa;
            border-radius: 12px;
            border: 1px solid var(--line);
            color: var(--ink-soft);
        }
        .empty-cart-title {
            margin: 0 0 6px;
            font-size: 15px;
            font-weight: 700;
            color: var(--ink);
            letter-spacing: -0.01em;
        }
        .empty-cart-desc {
            margin: 0 0 16px;
            font-size: 13px;
            line-height: 1.55;
            color: var(--muted);
            max-width: 360px;
            margin-left: auto;
            margin-right: auto;
        }
        .empty-cart-actions {
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
            justify-content: center;
        }
        .empty-cart-btn {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            min-height: 38px;
            padding: 0 16px;
            border-radius: 8px;
            font-size: 13px;
            font-weight: 700;
            text-decoration: none;
            transition: background 0.2s ease, color 0.2s ease, border-color 0.2s ease;
        }
        .empty-cart-btn-primary {
            background: var(--ink);
            color: #fff;
            border: 1px solid var(--ink);
        }
        .empty-cart-btn-primary:hover {
            background: #333;
            border-color: #333;
        }
        .empty-cart-btn-ghost {
            background: #fff;
            color: var(--ink);
            border: 1px solid var(--line);
        }
        .empty-cart-btn-ghost:hover {
            border-color: #bbb;
            background: #fff;
        }`
  );

  const buildFn = `
    function buildEmptyCartHtml() {
        return (
            '<div class="empty-cart-msg">' +
            '<p class="empty-cart-title">' + '\\u0995\\u09BE\\u09B0\\u09CD\\u099F\\u09C7 \\u098F\\u0996\\u09A8\\u09CB \\u0995\\u09CB\\u09A8\\u09CB \\u09AA\\u09A3\\u09CD\\u09AF \\u09A8\\u09C7\\u0987' + '</p>' +
            '<p class="empty-cart-desc">' + '\\u0986\\u09AC\\u09BE\\u09AF\\u09BC\\u09BE \\u0995\\u09BE\\u09B2\\u09C7\\u0995\\u09B6\\u09A8 \\u09A5\\u09C7\\u0995\\u09C7 \\u09AA\\u099B\\u09A8\\u09CD\\u09A6\\u09C7\\u09B0 \\u09AA\\u09A3\\u09CD\\u09AF \\u09AF\\u09CB\\u09A7 \\u0995\\u09B0\\u09C1\\u09A8\\u0964 \\u0995\\u09CD\\u09AF\\u09BE\\u09B6 \\u0985\\u09A8 \\u09A1\\u09C7\\u09B2\\u09BF\\u09AD\\u09BE\\u09B0\\u09BF\\u09A4\\u09C7 \\u0985\\u09B0\\u09A1\\u09BE\\u09B0 \\u0995\\u09B0\\u09C1\\u09A8\\u0964' + '</p>' +
            '<div class="empty-cart-actions">' +
            '<a href="' + pageLink('/category') + '" class="empty-cart-btn empty-cart-btn-primary">' + '\\u0995\\u09BE\\u09B2\\u09C7\\u0995\\u09B6\\u09A8 \\u09A6\\u09C7\\u0996\\u09C1\\u09A8' + '</a>' +
            '<a href="' + pageLink('/') + '" class="empty-cart-btn empty-cart-btn-ghost">' + '\\u09B9\\u09CB\\u09AE\\u09C7 \\u09AB\\u09BF\\u09B0\\u09C7 \\u09AF\\u09BE\\u09A8' + '</a>' +
            '</div></div>'
        );
    }
`;

  html = html.replace(
    /function displayOrder\(\) \{\s*if \(!summaryDiv\) return;\s*\n\s*if \(cart\.length === 0\) \{\s*summaryDiv\.innerHTML = [\s\S]*?return;\s*\}/,
    buildFn +
      `
    function displayOrder() {
        if (!summaryDiv) return;
        
        if (cart.length === 0) {
            summaryDiv.innerHTML = buildEmptyCartHtml();`
  );

  html = html.replace(
    /return false;">Clear cart<\/a>/g,
    'return false;">\\u0995\\u09BE\\u09B0\\u09CD\\u099F \\u0996\\u09BE\\u09B2\\u09BF \\u0995\\u09B0\\u09C1\\u09A8</a>'
  );

  return html;
}

let html = execSync(`git show ${SRC}:checkout.html`, {
  encoding: "utf8",
  maxBuffer: 20 * 1024 * 1024,
}).replace(/^\uFEFF/, "");

const bnBefore = (html.match(/[\u0980-\u09FF]/g) || []).length;
if (bnBefore < 800) {
  console.error("Source missing Bengali:", bnBefore);
  process.exit(1);
}

html = html.replace(
  /<script>\(function\(w,d,s,l,i\)[\s\S]*?GTM-ML7RL6BR'\);<\/script>\s*/i,
  ""
);

html = html.replace(
  /<meta charset="UTF-8">/,
  '<meta charset="UTF-8">\n    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">'
);

html = html.replace(
  /<link href="https:\/\/fonts\.googleapis\.com\/css2\?family=Inter[^>]+>/,
  `<link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link rel="preload" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Hind+Siliguri:wght@400;600;700&display=swap" as="style" onload="this.onload=null;this.rel='stylesheet'">
    <noscript><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Hind+Siliguri:wght@400;600;700&display=swap" rel="stylesheet"></noscript>`
);

html = html.replace(/site-footer\.css\?v=[^"]+/, `site-footer.css?v=${VER}`);
html = html.replace(/site-footer\.js\?v=[^"]+/, `site-footer.js?v=${VER}`);
html = html.replace(
  /<script defer src="site-header\.js[^>]*>/,
  '<script defer src="site-header.js?v=20260531nav">'
);

html = html.replace(
  /font-family: 'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif;/,
  "font-family: 'Inter', 'Hind Siliguri', system-ui, -apple-system, 'Segoe UI', sans-serif;"
);

html = html.replace(
  /\.summary-item strong \{ font-weight: 700; color: #111; \}/,
  ".summary-item strong { font-weight: 700; color: #111; font-family: 'Hind Siliguri', 'Inter', sans-serif; }\n        #orderReviewMeta { font-family: 'Hind Siliguri', 'Inter', sans-serif; }"
);

html = html.replace(
  /\.gb-order-price \{\n            font-weight: 700;/,
  ".gb-order-price {\n            font-family: 'Hind Siliguri', 'Inter', sans-serif;\n            font-weight: 700;"
);

html = html.replace(
  /<strong id="side-subtotal">[^<]+<\/strong>/,
  '<strong id="side-subtotal">&#2547;0</strong>'
);
html = html.replace(
  /<strong id="side-delivery">[^<]+<\/strong>/,
  '<strong id="side-delivery">&#2547;0</strong>'
);
html = html.replace(
  /<strong id="side-total">[^<]+<\/strong>/,
  '<strong id="side-total">&#2547;0 BDT</strong>'
);

html = html.replace(
  /function formatBdt\(amount\) \{\s*var n = parseInt\(amount, 10\) \|\| 0;\s*return '[^']*' \+/,
  "function formatBdtCheckout(amount) {\n        if (typeof window.formatBdt === 'function') return window.formatBdt(amount);\n        var n = parseInt(amount, 10) || 0;\n        return '\\u09F3' +"
);

html = html.replace(/\bformatBdt\(/g, "formatBdtCheckout(");
html = html.replace(/function formatBdtCheckoutCheckout/g, "function formatBdtCheckout");
html = html.replace(/window\.formatBdtCheckout\(/g, "window.formatBdt(");

html = html.replace(
  /<p class="delivery-fee-hint">[\s\S]*?<\/p>/,
  (m) => {
    const text = m.replace(/<[^>]+>/g, "").trim();
    return `<p class="delivery-fee-hint">${toHtmlEntities(text)}</p>`;
  }
);

html = html.replace(
  /<p class="checkout-trust-note"[^>]*>[\s\S]*?<\/p>/,
  (m) => {
    const open = m.match(/^<p class="checkout-trust-note"[^>]*>/)[0];
    const text = m.replace(/<[^>]+>/g, "").trim();
    return `${open}${toHtmlEntities(text)}</p>`;
  }
);

html = html.replace(
  /\(function initDistrictSelect\(\) \{[\s\S]*?\}\)\(\);/,
  (block) => escapeBnJsStrings(block)
);

html = applyProEmptyCartUi(html);
html = applyCheckoutLocations(html);

fs.writeFileSync("checkout.html", html, { encoding: "utf8" });

const out = fs.readFileSync("checkout.html", "utf8");
const bn = (out.match(/[\u0980-\u09FF]/g) || []).length;
const bad = (out.match(/\?\?\?\?/g) || []).length;
const entities = (out.match(/&#(\d+);/g) || []).length;
console.log("checkout.html Bengali chars:", bn, "???? blocks:", bad, "html entities:", entities);
if (bad > 0) process.exit(1);
if (!out.includes("delivery-fee-hint") || !out.includes("\\u09")) {
  console.error("ASCII-safe district escapes missing");
  process.exit(1);
}
if (!out.includes("checkout-locations-data.js")) {
  console.error("Checkout location data embed missing");
  process.exit(1);
}
if (!out.includes("checkout-locations.js")) {
  console.error("Checkout location select missing");
  process.exit(1);
}
if (!out.includes("buildEmptyCartHtml")) {
  console.error("Pro empty cart UI missing");
  process.exit(1);
}
