-- Add Telegram channel support to the existing live support inbox without replacing data.
-- Existing website conversations keep channel='website' and existing visitor IDs.

alter table public.support_conversations
  add column if not exists channel text not null default 'website',
  add column if not exists telegram_chat_id bigint;
alter table public.support_conversations alter column visitor_id drop not null;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'support_conversations_channel_identity_check'
      AND conrelid = 'public.support_conversations'::regclass
  ) THEN
    ALTER TABLE public.support_conversations
      ADD CONSTRAINT support_conversations_channel_identity_check CHECK (
        (channel = 'website' AND visitor_id IS NOT NULL AND telegram_chat_id IS NULL)
        OR (channel = 'telegram' AND visitor_id IS NULL AND telegram_chat_id IS NOT NULL)
      );
  END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS support_conversations_one_telegram_chat
  ON public.support_conversations (telegram_chat_id) WHERE telegram_chat_id IS NOT NULL;

alter table public.support_messages
  add column if not exists sender_external_id text;
alter table public.support_messages alter column sender_id drop not null;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'support_messages_sender_identity_check'
      AND conrelid = 'public.support_messages'::regclass
  ) THEN
    ALTER TABLE public.support_messages
      ADD CONSTRAINT support_messages_sender_identity_check CHECK (
        sender_id IS NOT NULL OR sender_external_id IS NOT NULL
      );
  END IF;
END $$;

-- Existing orders/products are retained; Telegram can be linked to an order later.
alter table public.orders add column if not exists telegram_chat_id bigint;

create table if not exists public.telegram_support_sessions (
  telegram_chat_id bigint primary key,
  stage text not null default 'idle' check (stage in ('idle','awaiting_order','awaiting_phone')),
  order_id text,
  updated_at timestamptz not null default now()
);
create table if not exists public.telegram_support_updates (
  update_id bigint primary key,
  status text not null default 'processing' check (status in ('processing','done')),
  created_at timestamptz not null default now()
);

alter table public.telegram_support_sessions enable row level security;
alter table public.telegram_support_updates enable row level security;
revoke all on public.telegram_support_sessions from anon, authenticated;
revoke all on public.telegram_support_updates from anon, authenticated;
