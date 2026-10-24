# Steadfast tracking integration

The admin displays the courier's returned status verbatim. A shop order's workflow value (e.g. Shipped) is separate. The public API status vocabulary is not identical to the portal's Entered / Approved / With a rider timeline. Never map pending to Approved or invent a rider, hub, or location.

## Activate the backend

1. Open `apps-script-copy.html` on the site. Replace Code.gs and AdminOrders.gs in the existing Apps Script project with the corresponding canonical sources. Keep existing project properties, keys and deployment URL.
2. Save, then Deploy → Manage deployments → Edit → New version → Deploy. GitHub deployment only publishes the website; it does not update Apps Script.
3. Open an order, then select “Steadfast থেকে আপডেট আনুন”. This token-gated action reads the status from Steadfast, records the check and updates only the courier-status column. It never changes the shop workflow or finances.

## Receive tracking messages

Use the current Apps Script Web App `/exec` URL as the Steadfast webhook callback, with `?token=` followed by the existing `STEADFAST_WEBHOOK_TOKEN` script property, URL-encoded. Keep this callback URL private. Never put API keys or tokens into this repository or chat. Do not remove the token check: Apps Script doPost does not expose the Authorization header, so this existing integration verifies its callback query token instead.

Configure delivery-status and tracking-update notifications in the Steadfast merchant portal if offered by the account. The actual callback and credentials must be configured by the account owner; this repository cannot configure the merchant portal remotely.

The receiver stores actual `tracking_message`, `status` / `delivery_status`, and `updated_at` values when supplied. Messages are not parsed into guessed locations. New events appear in the order's Steadfast tracking card. History starts when this integration is activated; there is no claimed backfill or portal scraping. A portal link is shown for numeric consignment IDs.

`Courier Tracking` is created on the first valid event, after matching exactly one order. Conflicting identifiers are rejected. Formula-like text is neutralized before writing to Sheets. Identical events are deduplicated under a script lock.

## Verify with a real event

- Read-only load: original stored courier status, stored event history, no external API request.
- Refresh: actual API status and check time; preserve previous data with an explicit warning on API failure.
- Authenticated tracking-update callback: one event with exact message and provider time, no workflow change when no delivery status is included.
- Resend the same callback: no duplicate event.
- Missing/invalid callback token: no event or order changes.
- No message: show “এখনো কোনো ট্র্যাকিং বার্তা পাওয়া যায়নি”; do not infer a location.

Source: https://github.com/steadfast-it/SteadFast-Courier-Laravel-Package (official package documents status responses and authenticated webhooks). Exact tracking-update payload availability must be verified against the merchant account's actual events.
