-- Keep the support-agent SECURITY DEFINER helper out of PostgREST's exposed public schema.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;

create or replace function private.is_support_agent()
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
      and a.email = lower(coalesce((select auth.jwt() ->> 'email'), ''))
  );
$$;
revoke all on function private.is_support_agent() from public, anon;
grant execute on function private.is_support_agent() to authenticated;

-- Replace every policy reference with a scalar subquery so the helper is evaluated once per statement.
drop policy if exists support_agents_read_self_or_agent on public.support_agents;
create policy support_agents_read_self_or_agent
  on public.support_agents for select to authenticated
  using (email = lower(coalesce((select auth.jwt() ->> 'email'), '')) or (select private.is_support_agent()));

drop policy if exists support_conversations_read_own_or_agent on public.support_conversations;
create policy support_conversations_read_own_or_agent
  on public.support_conversations for select to authenticated
  using (visitor_id = (select auth.uid()) or (select private.is_support_agent()));

drop policy if exists support_conversations_update_agent on public.support_conversations;
create policy support_conversations_update_agent
  on public.support_conversations for update to authenticated
  using ((select private.is_support_agent()))
  with check ((select private.is_support_agent()));

drop policy if exists support_messages_read_own_or_agent on public.support_messages;
create policy support_messages_read_own_or_agent
  on public.support_messages for select to authenticated
  using (
    (select private.is_support_agent())
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
    or (sender_role = 'agent' and sender_id = (select auth.uid()) and (select private.is_support_agent()))
  );

drop policy if exists support_messages_mark_read_own_or_agent on public.support_messages;
create policy support_messages_mark_read_own_or_agent
  on public.support_messages for update to authenticated
  using (
    (select private.is_support_agent())
    or (sender_role = 'agent' and exists (
      select 1 from public.support_conversations c
      where c.id = conversation_id and c.visitor_id = (select auth.uid())
    ))
  )
  with check (
    (select private.is_support_agent())
    or (sender_role = 'agent' and exists (
      select 1 from public.support_conversations c
      where c.id = conversation_id and c.visitor_id = (select auth.uid())
    ))
  );

drop policy if exists support_events_read_agent on public.support_events;
create policy support_events_read_agent
  on public.support_events for select to authenticated
  using ((select private.is_support_agent()));

-- The public helper is no longer referenced by policies and is not exposed to signed-in clients.
revoke all on function public.is_support_agent() from public, anon, authenticated;
drop function public.is_support_agent();

create index if not exists support_conversations_assigned_agent_idx
  on public.support_conversations (assigned_agent_email);
create index if not exists support_messages_sender_id_idx
  on public.support_messages (sender_id);
create index if not exists support_events_visitor_id_idx
  on public.support_events (visitor_id);
