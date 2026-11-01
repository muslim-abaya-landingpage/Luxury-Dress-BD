# Muslim Abaya — Support Chat Setup

## What is in this implementation

- `support-chat.js` keeps the storefront widget and WhatsApp/Messenger fallbacks, and adds Supabase anonymous sign-in, per-customer conversations, saved messages, quick-action audit events and a Realtime listener.
- `admin-support-inbox.html` is a separate authenticated agent workspace with conversation search/status filters, saved transcript, quick-action history, assignment, status changes and replies.
- `supabase/migrations/202610220001_support_chat.sql` creates the support tables, RLS policies, message activity trigger and Realtime publication entries.
- `supabase/migrations/202610220002_support_rate_limits.sql` limits customer messages to 8/minute, quick-action events to 30/minute and keeps one open/pending thread per anonymous visitor.
- `supabase/migrations/202610220003_private_agent_helper.sql` moves the `SECURITY DEFINER` helper out of the exposed `public` schema and adds foreign-key indexes.
- `supabase/migrations/202610220004_agent_policy_tighten.sql` stops non-agent users from probing the support-agent allow-list.
- `site-footer-config.js` contains only the Supabase project URL and publishable key. It does not contain a service-role or secret key.

All four migrations have been applied to the existing Free Supabase project. Customer/agent access is enforced by RLS; visitors must use Supabase anonymous Auth and can only read/write their own conversation. The admin inbox checks the signed-in email against `support_agents` before loading any conversations.

## Required one-time configuration

1. In Supabase Dashboard, open **Authentication → Sign In / Providers** and enable **Anonymous Sign-Ins**. The storefront needs this so visitors can chat without creating an account. See [Supabase Anonymous Sign-Ins](https://supabase.com/docs/guides/auth/auth-anonymous).
2. Create an Auth user for the support administrator (Auth → Users → Add user, or use the Create an account button in the inbox and verify the email if requested).
3. Allow-list the administrator email in SQL Editor. Replace both placeholders first:

   ```sql
   insert into public.support_agents (email, display_name)
   values (lower('ADMIN_EMAIL_HERE'), 'Support Admin')
   on conflict (email) do update
     set display_name = excluded.display_name, active = true;
   ```

4. The admin inbox is at `https://muslimabaya.com/admin-support-inbox.html`. Its password reset page is `/admin-support-reset.html`; a single exact production redirect URL has been added to Supabase Auth so recovery links return to that page.

Anonymous Supabase users are persistent Auth records and Supabase does not automatically clean them up. Supabase recommends CAPTCHA/Cloudflare Turnstile for abuse prevention. This project has database-side chat/event rate limits, but Turnstile is not configured yet. Decide the support-chat retention period and configure CAPTCHA before broad public launch; do not expose an Auth secret/service-role key in the website.

Never put the Supabase service-role key in a browser file. The publishable key is public and relies on the RLS policies applied in the migrations.

## Order status behaviour

The **Order status** action now calls the `order-status` Supabase Edge Function. It requires a signed-in anonymous visitor session, Turnstile verification, and the configured Apps Script `OrderTrack` endpoint. It returns only order ID/date/status/tracking fields and does not store submitted phone/order IDs in the chat log. If required Edge Function secrets or Supabase Auth CAPTCHA configuration are missing, lookup is not fully operational. Never ask customers to post payment-card details or passwords in chat.

Customer replies are stored when sent, but there is no email/SMS notification yet. Realtime delivery is for currently connected storefront and inbox sessions; visitors who clear browser storage or switch devices may not be able to recover their anonymous thread.

## Free-plan note

Supabase Free includes Realtime and Edge Function quotas, but the project can pause after a week of low activity and has no uptime SLA. If it pauses, an owner must restore it from Supabase Dashboard. Monitor database size, Realtime messages and connections against the Free plan quotas.


## Admin inbox access and testing

After the feature branch is merged and the site is deployed, open `https://muslimabaya.com/admin-support-inbox.html`. Locally, serve the repository root with `python3 -m http.server 8000` and open `http://localhost:8000/admin-support-inbox.html`; the live Supabase backend still needs to be reachable. Sign in with an approved Supabase Auth email/password account. To test a new agent, create the account in the inbox, complete email verification if enabled, then have the project owner add that email to `public.support_agents` with `active = true`. Never store or share the inbox password in documentation or chat.

For chat testing after deployment, open the storefront in a private/incognito session, open Customer Support, complete the Turnstile prompt if shown, and send a harmless test message. In a second browser session, sign in to the admin inbox and verify that the conversation appears and replies arrive in real time. Test the Order status action with a known test order ID and the exact phone number used for that order. Confirm that a wrong ID/phone pair reveals no order details. The widget asks for both values and does not store them in the chat message/event log.

## Order lookup and Turnstile rollout

`supabase/functions/order-status/index.ts` is deployed as `order-status` with JWT verification enabled. It reads `TURNSTILE_SECRET_KEY` and `ORDER_TRACK_API_URL` from the Edge Function runtime using `Deno.env.get(...)`; it never reads a secret from browser code. Each lookup is verified by Cloudflare Turnstile for action `order_status` and hostname `muslimabaya.com`, then proxied to the Apps Script `OrderTrack` route. The response is limited to order ID, date, status, courier status, and tracking value.

### Add the Edge Function secret

1. In Cloudflare Turnstile, open the widget for `muslimabaya.com` and copy its **Secret key**. Do not use the **Site key** in this step.
2. Open the Supabase project → **Edge Functions** → **Secrets**.
3. Add a secret with the exact name `TURNSTILE_SECRET_KEY` and paste the Cloudflare **Secret key** only into the Supabase **Value** field. Save it.
4. Verify the name appears in the Custom secrets list. The dashboard intentionally does not show the saved value. Never paste this key into `support-chat.js`, `site-footer-config.js`, GitHub, logs, or chat.
5. Keep the other required settings present: `ORDER_TRACK_API_URL` (the Apps Script `OrderTrack` web app URL) and `ALLOWED_ORIGINS=https://muslimabaya.com`.

The function code checks for missing configuration. It now logs missing variable **names only**; it never logs values. If `TURNSTILE_SECRET_KEY` or `ORDER_TRACK_API_URL` is absent or blank, the request returns `FUNCTION_NOT_CONFIGURED` (HTTP 500). Adding a Supabase Function secret does not require placing or committing the key in source code.

### Configure Supabase Auth CAPTCHA separately

The Edge Function secret and Supabase Auth's CAPTCHA setting are separate configuration surfaces. In Supabase **Authentication → Attack Protection**, enable **CAPTCHA protection**, select Cloudflare Turnstile, enter the widget's Site key and Secret key in the Auth settings, and save. Keep Anonymous Sign-Ins enabled for storefront chat. Only the public Site key may be in `site-footer-config.js`; the Secret key must stay server-side.

### Verify the setup

- Confirm `TURNSTILE_SECRET_KEY`, `ORDER_TRACK_API_URL`, and `ALLOWED_ORIGINS` are listed under Supabase Edge Function Custom secrets; check names only, never reveal values.
- Confirm Supabase Auth Attack Protection shows CAPTCHA protection enabled and Cloudflare Turnstile selected.
- Submit a Turnstile-backed lookup using a designated test order ID and its matching test phone. A missing server secret returns `FUNCTION_NOT_CONFIGURED`; a missing token returns `CAPTCHA_REQUIRED`; an invalid, wrong-action, or wrong-host token returns `CAPTCHA_FAILED`.
- The deployed `order-status` source enforces `verify_jwt=true`. Do not disable JWT verification or store the Turnstile Secret key in the frontend.

Until the server-side secret and Auth CAPTCHA are configured, lookup is not fully operational. Do not publish or paste secret keys in source or chat.


## Admin inbox alerts

In the admin inbox, select **Enable alerts** to grant this browser permission for desktop notifications; browsers require this user gesture. Select **Sound: Off** to enable/disable the short sound. Alerts are generated only for new customer messages while the inbox page is open and subscribed; this is not a background push service and does not alert if the tab/browser is closed or Realtime is disconnected. Browser notification permissions may also be blocked by OS/browser settings.


## Admin password recovery

`admin-support-reset.html` implements Supabase Auth recovery. It requests a recovery email with the exact production redirect `https://muslimabaya.com/admin-support-reset.html`, displays a generic response that does not reveal whether an email exists, and only exposes the new-password form after a valid recovery session. The new password is sent through `supabase.auth.updateUser`; no service-role key or custom password storage is used. Supabase Auth URL Configuration must continue to allow this exact redirect. The existing general `forgot-password.html` page is not used by Admin Inbox.

## Admin inbox alerts code

The full, copyable browser notification and sound integration is documented in [`ADMIN-INBOX-ALERTS-CODE-BN.md`](ADMIN-INBOX-ALERTS-CODE-BN.md) and runs in `admin-support-inbox.html`. It is opt-in and requires the agent's inbox tab to remain open and Realtime-connected; it is not a push-notification service.


## ২০২৬-১১-০১ আপডেট: পূর্ণাঙ্গ সাপোর্ট ইনবক্স

কোডে যা যোগ হয়েছে:
- `admin-support-inbox.html` + `admin-support-inbox.js`: বাংলা UI, অ্যাডমিন মেনু (sync-admin-navigation.py এখন এই পেজও আপডেট করে), মোবাইলে তালিকা/চ্যাট আলাদা স্ক্রিন, ওয়েবসাইট ও টেলিগ্রাম চ্যাট এক তালিকায় (চ্যানেল ফিল্টার), না-পড়া সংখ্যা, খালি চ্যাট লুকানো, দায়িত্ব (আমার/কারো নয়) ফিল্টার, কাস্টমারের নাম/ফোন দেখা ও সংশোধন, রেডিমেড রিপ্লাই (এই ব্রাউজারে সংরক্ষিত), "অর্ডার খুঁজুন" (`admin-orders.html?q=<ফোন>`), পুরোনো মেসেজ লোড, টাইপিং চিহ্ন, ছবি পাঠানো/দেখা।
- `support-chat.js`: ঐচ্ছিক নাম/ফোন ফর্ম, ছবি পাঠানো (৫MB, JPG/PNG/WEBP/GIF), টাইপিং চিহ্ন, প্রতিটি কাস্টমার মেসেজের পর টিমকে টেলিগ্রাম নোটিফিকেশন (সার্ভারে কনফিগার থাকলে)।
- `supabase/functions/telegram-support`: নতুন `POST /notify` (ওয়েবসাইট মেসেজ → টিমের টেলিগ্রাম চ্যাটে অ্যালার্ট, প্রতি চ্যাটে ২ মিনিটে সর্বোচ্চ একটি), টেলিগ্রাম কাস্টমারের নাম সংরক্ষণ, বন্ধ টেলিগ্রাম চ্যাটে নতুন মেসেজ এলে আবার খোলা।
- `supabase/migrations/20261101230000_support_inbox_complete.sql`: `customer_name`/`customer_phone` কলাম + `set_support_contact` RPC, `attachment_path` কলাম + প্রাইভেট `support-attachments` বাকেট ও পলিসি (প্রতি ভিজিটর ১০ মিনিটে সর্বোচ্চ ১০টি আপলোড), `support_events` Realtime-এ যোগ, এবং `orders`/`products` টেবিলের খোলা `authenticated` পলিসি বন্ধ।

পেজটি মাইগ্রেশন ছাড়াও চলে (নাম/ফোন ও ছবির অংশ নিষ্ক্রিয় থাকে), তবে পুরো ফিচারের জন্য নিচের তিনটি ধাপ লাগবে।

### ধাপ ১ — ডাটাবেস আপডেট
Supabase Dashboard → SQL Editor → নতুন query → `supabase/migrations/20261101230000_support_inbox_complete.sql` ফাইলের পুরো লেখা পেস্ট করে **Run**। ফাইলটি একাধিকবার চালালেও সমস্যা নেই।

### ধাপ ২ — Edge Function আপডেট
Supabase Dashboard → Edge Functions → `telegram-support` → Code → পুরো কোড মুছে `supabase/functions/telegram-support/index.ts` পেস্ট করে **Deploy**। "Verify JWT" বন্ধ-ই রাখুন (টেলিগ্রাম webhook-এর জন্য; ফাংশন নিজেই লগইন যাচাই করে)। অথবা CLI: `supabase functions deploy telegram-support --no-verify-jwt`।

### ধাপ ৩ — টিমের টেলিগ্রাম নোটিফিকেশন (ঐচ্ছিক)
1. যে টেলিগ্রাম অ্যাকাউন্টে অ্যালার্ট চান, সেখান থেকে আপনার সাপোর্ট বটকে যেকোনো একটি মেসেজ পাঠান (বট শুধু প্রাইভেট চ্যাটে কাজ করে, গ্রুপে নয়)।
2. `/admin-support-inbox.html`-এ সেই টেলিগ্রাম চ্যাটটি খুলুন; উপরে "টেলিগ্রাম আইডি ..." সংখ্যাটি দেখাবে, সেটি কপি করুন। (webhook চালু থাকলে টেলিগ্রামের `getUpdates` কাজ করে না, তাই এই পথ।)
3. Supabase → Edge Functions → Secrets → `TELEGRAM_ADMIN_CHAT_ID` = সেই সংখ্যা → Save।
সিক্রেট না থাকলে `/notify` কিছু না পাঠিয়ে `skipped: not_configured` ফেরত দেয়; চ্যাট স্বাভাবিকভাবে চলে।

### যাচাই
- প্রাইভেট উইন্ডোতে সাইটের চ্যাট খুলে নাম/ফোন সেভ করুন, একটি মেসেজ ও একটি ছবি পাঠান।
- অন্য ব্রাউজারে `/admin-support-inbox.html`-এ দেখুন: নাম/ফোন, ছবি, না-পড়া সংখ্যা, টাইপিং চিহ্ন আসছে কিনা; উত্তর দিন।
- টেলিগ্রাম বটে একটি মেসেজ পাঠিয়ে দেখুন সেটি একই ইনবক্সে "টেলিগ্রাম" ট্যাগসহ আসে এবং সেখান থেকে উত্তর দিলে বটে পৌঁছায়।
