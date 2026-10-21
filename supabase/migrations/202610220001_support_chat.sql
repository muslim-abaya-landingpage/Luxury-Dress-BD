-- Muslim Abaya support inbox: customer-owned anonymous conversations, agent inbox, and quick-action audit.
-- Public browser clients use the Supabase publishable key only. RLS restricts every row.

create table if not exists public.support_agents (
  email text primary key,
  display_name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint support_agents_email_lowercase check (email = lower(email))
);

create table if not exists public.support_conversations (
  id uuid primary key default gen_random_uuid(),
  visitor_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'open' check (status in ('open', 'pending', 'closed')),
  subject text,
  page_path text not null default '/',
  assigned_agent_email text references public.support_agents(email) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_message_at timestamptz not null default now(),
  constraint support_conversation_subject_length check (subject is null or length(subject) <= 120),
  constraint support_conversation_path_length check (length(page_path) <= 512)
);

create table if not exists public.support_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.support_conversations(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  sender_role text not null check (sender_role in ('customer', 'agent')),
  body text not null check (length(trim(body)) between 1 and 2000),
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create table if not exists public.support_events (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.support_conversations(id) on delete cascade,
  visitor_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null check (event_type in ('quick_action', 'order_status_request', 'conversation_started')),
  action_key text not null check (length(action_key) between 1 and 64),
  page_path text not null default '/',
  created_at timestamptz not null default now(),
  constraint support_event_path_length check (length(page_path) <= 512)
);

create index if not exists support_conversations_status_activity_idx
  on public.support_conversations (status, last_message_at desc);
create index if not exists support_conversations_visitor_activity_idx
  on public.support_conversations (visitor_id, last_message_at desc);
create index if not exists support_messages_conversation_created_idx
  on public.support_messages (conversation_id, created_at asc);
create index if not exists support_events_conversation_created_idx
  on public.support_events (conversation_id, created_at desc);

create or replace function public.is_support_agent()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.support_agents a
    where a.active = true
      and a.email = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;
revoke all on function public.is_support_agent() from public, anon;
grant execute on function public.is_support_agent() to authenticated;

create or replace function public.touch_support_conversation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.support_conversations
     set updated_at = now(), last_message_at = now()
   where id = new.conversation_id;
  return new;
end;
$$;
revoke all on function public.touch_support_conversation() from public, anon, authenticated;

drop trigger if exists support_message_touch_conversation on public.support_messages;
create trigger support_message_touch_conversation
after insert on public.support_messages
for each row execute function public.touch_support_conversation();

alter table public.support_agents enable row level security;
alter table public.support_conversations enable row level security;
alter table public.support_messages enable row level security;
alter table public.support_events enable row level security;

-- No anonymous table access. Anonymous chat users must first sign in anonymously through Supabase Auth,
-- which supplies a scoped auth.uid(); service role is reserved for trusted backend administration.
revoke all on public.support_agents, public.support_conversations, public.support_messages, public.support_events from anon, authenticated;
grant select on public.support_agents to authenticated;
grant select, insert on public.support_conversations to authenticated;
grant update (status, assigned_agent_email, updated_at) on public.support_conversations to authenticated;
grant select, insert on public.support_messages to authenticated;
grant update (read_at) on public.support_messages to authenticated;
grant select, insert on public.support_events to authenticated;

drop policy if exists support_agents_read_self_or_agent on public.support_agents;
create policy support_agents_read_self_or_agent
  on public.support_agents for select to authenticated
  using (email = lower(coalesce(auth.jwt() ->> 'email', '')) or public.is_support_agent());

drop policy if exists support_conversations_read_own_or_agent on public.support_conversations;
create policy support_conversations_read_own_or_agent
  on public.support_conversations for select to authenticated
  using (visitor_id = (select auth.uid()) or public.is_support_agent());

drop policy if exists support_conversations_create_own on public.support_conversations;
create policy support_conversations_create_own
  on public.support_conversations for insert to authenticated
  with check (visitor_id = (select auth.uid()) and status = 'open' and assigned_agent_email is null);

drop policy if exists support_conversations_update_agent on public.support_conversations;
create policy support_conversations_update_agent
  on public.support_conversations for update to authenticated
  using (public.is_support_agent())
  with check (public.is_support_agent());

drop policy if exists support_messages_read_own_or_agent on public.support_messages;
create policy support_messages_read_own_or_agent
  on public.support_messages for select to authenticated
  using (
    public.is_support_agent()
    or exists (
      select 1 from public.support_conversations c
      where c.id = conversation_id and c.visitor_id = (select auth.uid())
    )
  );

drop policy if exists support_messages_insert_customer_or_agent on public.support_messages;
create policy support_messages_insert_customer_or_agent
  on public.support_messages for insert to authenticated
  with check (
    (sender_role = 'customer' and sender_id = (select auth.uid()) and exists (
      select 1 from public.support_conversations c
      where c.id = conversation_id and c.visitor_id = (select auth.uid()) and c.status <> 'closed'
    ))
    or (sender_role = 'agent' and sender_id = (select auth.uid()) and public.is_support_agent())
  );

drop policy if exists support_messages_mark_read_own_or_agent on public.support_messages;
create policy support_messages_mark_read_own_or_agent
  on public.support_messages for update to authenticated
  using (
    public.is_support_agent()
    or (sender_role = 'agent' and exists (
      select 1 from public.support_conversations c
      where c.id = conversation_id and c.visitor_id = (select auth.uid())
    ))
  )
  with check (
    public.is_support_agent()
    or (sender_role = 'agent' and exists (
      select 1 from public.support_conversations c
      where c.id = conversation_id and c.visitor_id = (select auth.uid())
    ))
  );

drop policy if exists support_events_read_agent on public.support_events;
create policy support_events_read_agent
  on public.support_events for select to authenticated
  using (public.is_support_agent());

drop policy if exists support_events_insert_own on public.support_events;
create policy support_events_insert_own
  on public.support_events for insert to authenticated
  with check (
    visitor_id = (select auth.uid())
    and exists (
      select 1 from public.support_conversations c
      where c.id = conversation_id and c.visitor_id = (select auth.uid())
    )
  );

-- Enable secure Postgres Changes for customer threads and the agent inbox.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'support_messages'
    ) then
      alter publication supabase_realtime add table public.support_messages;
    end if;
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'support_conversations'
    ) then
      alter publication supabase_realtime add table public.support_conversations;
    end if;
  end if;
end;
$$;
