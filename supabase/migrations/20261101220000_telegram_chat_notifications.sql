-- Idempotency ledger for customer website-chat -> Telegram notifications.
-- Stores message IDs/status only; message content remains in support_messages.
-- (Applied live on 2026-10-31 as "telegram_chat_notifications"; committed here so the repo matches the database.)
create table if not exists public.telegram_support_notification_deliveries (
  message_id uuid primary key references public.support_messages(id) on delete cascade,
  status text not null default 'sending' check (status in ('sending', 'sent')),
  created_at timestamptz not null default now(),
  delivered_at timestamptz
);

alter table public.telegram_support_notification_deliveries enable row level security;
revoke all on table public.telegram_support_notification_deliveries from public, anon, authenticated;
grant all on table public.telegram_support_notification_deliveries to service_role;
