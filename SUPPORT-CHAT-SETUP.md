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

4. Publish the feature branch only after reviewing the storefront widget and admin route. The live website does not change until the branch is merged/deployed. The inbox route will be `/admin-support-inbox.html` after deployment.

Anonymous Supabase users are persistent Auth records and Supabase does not automatically clean them up. Supabase recommends CAPTCHA/Cloudflare Turnstile for abuse prevention. This project has database-side chat/event rate limits, but Turnstile is not configured yet. Decide the support-chat retention period and configure CAPTCHA before broad public launch; do not expose an Auth secret/service-role key in the website.

Never put the Supabase service-role key in a browser file. The publishable key is public and relies on the RLS policies applied in the migrations.

## Order status behaviour

The **Order status** Quick Action is logged in `support_events` as `order_status_request` and opens a live conversation for an agent to answer. It does not yet search or disclose an order record automatically. The current Supabase `orders` table was present but empty when inspected; the website's order system needs a verified, privacy-safe lookup connection before automatic status responses can be added. Do not ask customers to post payment-card details or passwords in chat.

Customer replies are stored when sent, but there is no email/SMS notification yet. Realtime delivery is for currently connected storefront and inbox sessions; visitors who clear browser storage or switch devices may not be able to recover their anonymous thread.

## Free-plan note

Supabase Free includes Realtime and Edge Function quotas, but the project can pause after a week of low activity and has no uptime SLA. If it pauses, an owner must restore it from Supabase Dashboard. Monitor database size, Realtime messages and connections against the Free plan quotas.
