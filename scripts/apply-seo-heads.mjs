/**
 * Inject static SEO tags + early site-seo scripts into public HTML pages.
 * Run: node scripts/apply-seo-heads.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const SEO_VER = "20260603seo";
const SITE = "https://muslimabaya.com";

const categories = {
  "abaya.html": {
    key: "abaya",
    path: "/abaya",
    title: "Abaya Collection | Muslim Abaya — Buy Online Bangladesh",
    description:
      "Premium abaya collection Bangladesh — soft georgette, modest styles, cash on delivery nationwide. Shop Muslim Abaya at muslimabaya.com.",
  },
  "premium-two-piece.html": {
    key: "premium-two-piece",
    path: "/premium-two-piece",
    title: "Premium Two-Piece Dress | Muslim Abaya — COD Bangladesh",
    description:
      "Premium two-piece modest dress collection — floral prints, georgette fabric, cash on delivery all over Bangladesh. muslimabaya.com.",
  },
  "cover-up.html": {
    key: "cover-up",
    path: "/cover-up",
    title: "Cover Up Collection | Muslim Abaya Bangladesh",
    description: "Modest cover up collection — Muslim Abaya Bangladesh. Order online with cash on delivery.",
  },
  "tops-kurti.html": {
    key: "tops-kurti",
    path: "/tops-kurti",
    title: "Tops & Kurti | Muslim Abaya — Modest Fashion",
    description: "Tops and kurti collection — modest fashion, COD Bangladesh. Muslim Abaya muslimabaya.com.",
  },
  "embroidery.html": {
    key: "embroidery",
    path: "/embroidery",
    title: "Embroidery Abaya & Dress | Muslim Abaya",
    description: "Embroidery abaya and dress collection — premium modest wear, cash on delivery Bangladesh.",
  },
  "karchupi.html": {
    key: "karchupi",
    path: "/karchupi",
    title: "Karchupi Collection | Muslim Abaya Bangladesh",
    description: "Karchupi modest fashion collection — Muslim Abaya. Cash on delivery nationwide.",
  },
  "kaftan.html": {
    key: "kaftan",
    path: "/kaftan",
    title: "Kaftan Collection | Muslim Abaya Bangladesh",
    description: "Kaftan collection — modest fashion Bangladesh. Order with COD at muslimabaya.com.",
  },
  "hijab.html": {
    key: "hijab",
    path: "/hijab",
    title: "Hijab Collection | Muslim Abaya Bangladesh",
    description: "Hijab collection — Muslim Abaya Bangladesh. Cash on delivery.",
  },
};

const staticPages = {
  "category.html": {
    path: "/category",
    title: "All Categories | Muslim Abaya — Shop Modest Fashion",
    description:
      "Browse all categories — abaya, two-piece, embroidery and more. Premium modest fashion with COD in Bangladesh.",
    htmlAttrs: 'lang="bn" data-seo-page="/category"',
  },
  "about.html": {
    path: "/about",
    title: "About Us | Muslim Abaya — muslimabaya.com",
    description:
      "Muslim Abaya — premium abaya and modest fashion in Bangladesh. Cash on delivery nationwide.",
    htmlAttrs: 'lang="bn"',
  },
  "help.html": {
    path: "/help",
    title: "Order Help & FAQ | Muslim Abaya",
    description:
      "Order, delivery, payment and return help — Muslim Abaya (muslimabaya.com).",
    htmlAttrs: 'lang="bn"',
  },
  "video.html": {
    path: "/video",
    title: "Product Videos | Muslim Abaya",
    description:
      "Watch real product videos before you order — Muslim Abaya premium collection.",
    htmlAttrs: 'lang="bn"',
  },
  "terms.html": {
    path: "/terms",
    title: "Terms & Conditions | Muslim Abaya",
    description: "Muslim Abaya terms and conditions — muslimabaya.com.",
    htmlAttrs: 'lang="bn"',
  },
  "privacy.html": {
    path: "/privacy",
    title: "Privacy Policy | Muslim Abaya",
    description: "Muslim Abaya privacy policy — muslimabaya.com.",
    htmlAttrs: 'lang="bn"',
  },
  "refund.html": {
    path: "/refund",
    title: "Refund Policy | Muslim Abaya",
    description: "Muslim Abaya refund and return policy — muslimabaya.com.",
    htmlAttrs: 'lang="bn"',
  },
};

function seoBlock(meta) {
  const canonical = SITE + meta.path + (meta.path === "/" ? "" : "");
  return [
    `<link rel="icon" href="assets/logo-muslim-abaya.svg" type="image/svg+xml">`,
    `<link rel="apple-touch-icon" href="assets/logo-muslim-abaya.svg">`,
    `<meta name="robots" content="index, follow">`,
    `<link rel="canonical" href="${canonical}">`,
    `<meta name="description" content="${meta.description}">`,
    `<link rel="sitemap" type="application/xml" title="Sitemap" href="/sitemap.xml">`,
    `<script src="site-seo-config.js?v=${SEO_VER}"></script>`,
    `<script src="site-seo.js?v=${SEO_VER}"></script>`,
  ].join("\n  ");
}

function patchCategory(file, cfg) {
  const fp = path.join(root, file);
  let html = fs.readFileSync(fp, "utf8");
  html = html.replace(/<html lang="bn">/, `<html lang="bn" data-shop-category="${cfg.key}">`);
  html = html.replace(/<body>/, `<body data-shop-category="${cfg.key}">`);
  html = html.replace(
    /<title>[^<]*<\/title>/,
    `<title>${cfg.title}</title>\n  ${seoBlock(cfg)}`
  );
  fs.writeFileSync(fp, html, "utf8");
  console.log("patched category", file);
}

function patchStatic(file, cfg) {
  const fp = path.join(root, file);
  let html = fs.readFileSync(fp, "utf8");
  html = html.replace(/<html lang="[^"]*">/, `<html ${cfg.htmlAttrs || 'lang="bn"'}>`);
  if (html.includes('rel="canonical"')) {
    console.log("skip static (has canonical)", file);
    return;
  }
  html = html.replace(
    /<title>[^<]*<\/title>/,
    `<title>${cfg.title}</title>\n  ${seoBlock(cfg)}`
  );
  // Remove duplicate meta description if present right after title block
  html = html.replace(/\n  <meta name="description" content="[^"]*">\n(?=  <link href="https:\/\/fonts)/, "\n");
  fs.writeFileSync(fp, html, "utf8");
  console.log("patched static", file);
}

Object.entries(categories).forEach(([f, c]) => patchCategory(f, c));
Object.entries(staticPages).forEach(([f, c]) => patchStatic(f, c));
