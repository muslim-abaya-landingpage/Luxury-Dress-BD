/**
 * Paths that must never be served from muslimabaya.com: source for other systems (Apps Script, the Worker),
 * tests, build scripts, notes and tool/config files.
 *
 * The build already leaves them out of the upload (scripts/prune-deploy.mjs), but Cloudflare Pages kept serving
 * copies from older deployments for some of these exact URLs (only a query string got the real 404), so the
 * middleware answers 404 for them before any stored file is looked at. _routes.json must include every entry
 * (tests/backend/blocked-paths.test.mjs checks this), otherwise the middleware would not run for that path.
 */
export const BLOCKED_DIRS = ["apps-script", "cloudflare-worker", "scripts", "tests", "supabase", "monitoring", "docs", ".github", "hosting-pack", "muslimabaya-fonts-setup", "src", "tools"];
export const BLOCKED_FILES = [
  "ADMIN-INBOX-ALERTS-CODE-BN.md",
  "ADMIN-ORDERS-PERFORMANCE-AUDIT.md",
  "ADMIN-SETUP.md",
  "ADMIN-প্রক্সি-বন্ধ.bat",
  "ADMIN-লোকাল-টেস্ট.bat",
  "ADMIN-হোস্টিং-আপলোড.bat",
  "API-এক-ক্লিক-সেটআপ.bat",
  "API-কোড-পেস্ট-ও-Deploy.bat",
  "API-দ্রুত-ঠিক.bat",
  "APPS-SCRIPT-AUTO-DEPLOY.md",
  "APPS-SCRIPT-SETUP.md",
  "APPS-SCRIPT-অটো-ডিপ্লয়-সেটআপ.bat",
  "APPS-SCRIPT-দৈনিক-কাজ.md",
  "APPS-SCRIPT-পেস্ট-করুন.md",
  "BACKEND-FILTER-CODE-EXAMPLES.md",
  "BACKEND-FILTER-METAFIELD-TAGGING-GUIDE.md",
  "FILTER-UX-REDESIGN-PLAN.md",
  "GOOGLE-LOGIN-SETUP.md",
  "LIVE-STOCK-ROLLOUT.md",
  "MESSENGER-INBOX-SETUP.md",
  "NOTIFICATION_AUTOMATION_REFERENCE.md",
  "NOTIFICATION_SETUP_GUIDE.md",
  "NOTIFICATION_SLIDES_SCRIPT.md",
  "ORDER-SIZE-SETUP.md",
  "PERFORMANCE-REPORT.md",
  "PERFORMANCE-UPDATE.md",
  "PRESENTATION-SPEAKER-SCRIPT.md",
  "PRODUCT-CATALOG-MAP.md",
  "PRODUCT-GUIDE.md",
  "README.md",
  "SECURITY-GUIDE.md",
  "SECURITY.md",
  "SEO-অর্গানিক-গাইড.md",
  "SOCIAL-LOGIN-SETUP.md",
  "START-HERE.bat",
  "STEADFAST-TRACKING-SETUP.md",
  "STOCK-SYNC-IMPLEMENTATION.md",
  "SUPPORT-CHAT-SETUP.md",
  "apps-script-copy.html",
  "apps-script-subscribe.gs",
  "check_counts.cjs",
  "debug_catalog.cjs",
  "firebase-applet-config.json",
  "firestore.rules",
  "google-apps-script-backend.gs",
  "manus-routes.json",
  "metadata.json",
  "netlify.toml",
  "package-lock.json",
  "package.json",
  "playwright.config.cjs",
  "tsconfig.json",
  "vite.config.ts",
  "দৈনিক-চেকলিস্ট.md",
  "প্রথম-সপ্তাহ-চেকলিস্ট.md",
  "প্রোডাক্ট-এডিট.bat",
  "প্রোডাক্ট-সহজ-গাইড.md",
  "স্টক-গাইড.md"
];

export function isBlockedPath(pathname) {
  let p = String(pathname || '/');
  try { p = decodeURIComponent(p); } catch (e) { /* keep raw */ }
  p = p.replace(/\/+/g, '/');
  if (BLOCKED_DIRS.some((d) => p === '/' + d || p.startsWith('/' + d + '/'))) return true;
  return BLOCKED_FILES.indexOf(p.replace(/^\//, '')) !== -1;
}
