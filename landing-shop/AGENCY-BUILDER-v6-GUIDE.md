# Webzo BD Agency Builder v6

V6 turns the local builder into an agency workspace while keeping the landing page engine from Smart PRO v4.1.

## New in v6
- Agency KPI cards: projects, total products, tracking-ready projects.
- One-click **Backup All Projects** to a portable JSON file.
- **Restore Backup** to move/recover the agency workspace on another browser/PC.
- **Launch Audit** for the active project: brand, phone, gallery, product/price, delivery, WhatsApp and tracking checks.
- Existing New Client, template selection, clone, save, import/export, live preview and config.js generation remain available.

## Recommended workflow
Create Client → configure brand/theme → add products/gallery → delivery/order → tracking → Save Project → Launch Audit → Preview mobile/tablet/desktop → test order → Download config.js / deploy → Backup All Projects.

## Important security / cloud note
V6 is still a static browser-based agency builder. Projects live in localStorage and can be moved with the backup file. Do not publish `admin.html`, `admin.js` or client backup JSON publicly. Real login, cross-device cloud sync, authoritative orders/stock, roles and a central sales dashboard require a backend/database/auth layer (for example Supabase/Firebase/custom API + Netlify functions).
