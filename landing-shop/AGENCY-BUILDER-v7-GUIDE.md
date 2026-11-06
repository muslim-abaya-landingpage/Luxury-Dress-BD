# Webzo BD Agency Builder v7 — Order & Sales Desk

V7 adds a local Order & Sales Desk to the existing V6 Agency Workspace.

## Order workflow
1. Deploy the landing page to Cloudflare Pages (Landing Deploy workflow).
2. Export your orders as CSV (or add orders manually).
3. Open `admin.html` → Orders → Import CSV.
4. Manage status: New → Confirmed → Processing → Delivered / Cancelled.
5. Delivered revenue is shown in the dashboard. Export the cleaned order list anytime.
6. WhatsApp/phone orders can be entered with `+ Manual Order`.

## Important limitation
This static edition does not read any hosting account automatically. Orders and statuses are stored in this browser's localStorage. Export the order CSV and agency backup regularly.

A true cross-device live order dashboard requires authentication + a database/backend or an authorized API integration.
