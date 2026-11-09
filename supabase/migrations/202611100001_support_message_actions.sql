-- WhatsApp-style support inbox message actions.
-- Additive only: preserves existing messages and limits action writes to active support agents.

alter table public.support_messages
  add column if not exists reply_to_message_id uuid references public.support_messages(id) on delete set null,
  add column if not exists forwarded_from_message_id uuid references public.support_messages(id) on delete set null,
  add column if not exists deleted_at timestamptz;

-- Composite key supports a conversation-scoped, single pinned-message record.
create unique index if not exists support_messages_id_conversation_uidx
  on public.support_messages (id, conversation_id);

-- Reply targets must be messages in the same conversation. Forward sources may be in another conversation.
create or replace function private.validate_support_message_reply_target()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_conversation_id uuid;
begin
  if new.reply_to_message_id is not null then
    select m.conversation_id into v_conversation_id
      from public.support_messages m
     where m.id = new.reply_to_message_id;
    if v_conversation_id is null or v_conversation_id <> new.conversation_id then
      raise exception 'Reply target must belong to the same conversation' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function private.validate_support_message_reply_target() from public, anon, authenticated;
drop trigger if exists support_messages_validate_reply_target on public.support_messages;
create trigger support_messages_validate_reply_target
before insert or update of reply_to_message_id, conversation_id on public.support_messages
for each row execute function private.validate_support_message_reply_target();

create table if not exists public.support_message_reactions (
  message_id uuid not null references public.support_messages(id) on delete cascade,
  actor_id uuid not null references auth.users(id) on delete cascade,
  emoji text not null check (emoji in ('👍','❤️','😂','😮','😢','🙏')),
  created_at timestamptz not null default now(),
  primary key (message_id, actor_id)
);
alter table public.support_message_reactions enable row level security;
revoke all on public.support_message_reactions from anon, authenticated;
grant select, insert, update, delete on public.support_message_reactions to authenticated;
drop policy if exists support_message_reactions_read_agents on public.support_message_reactions;
create policy support_message_reactions_read_agents on public.support_message_reactions
  for select to authenticated using ((select private.is_support_agent()));
drop policy if exists support_message_reactions_insert_own on public.support_message_reactions;
create policy support_message_reactions_insert_own on public.support_message_reactions
  for insert to authenticated with check (
    actor_id = (select auth.uid()) and (select private.is_support_agent())
    and exists (select 1 from public.support_messages m where m.id = message_id)
  );
drop policy if exists support_message_reactions_update_own on public.support_message_reactions;
create policy support_message_reactions_update_own on public.support_message_reactions
  for update to authenticated using (
    actor_id = (select auth.uid()) and (select private.is_support_agent())
  ) with check (
    actor_id = (select auth.uid()) and (select private.is_support_agent())
    and exists (select 1 from public.support_messages m where m.id = message_id)
  );
drop policy if exists support_message_reactions_delete_own on public.support_message_reactions;
create policy support_message_reactions_delete_own on public.support_message_reactions
  for delete to authenticated using (actor_id = (select auth.uid()) and (select private.is_support_agent()));

create table if not exists public.support_message_stars (
  message_id uuid not null references public.support_messages(id) on delete cascade,
  agent_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (message_id, agent_id)
);
alter table public.support_message_stars enable row level security;
revoke all on public.support_message_stars from anon, authenticated;
grant select, insert, delete on public.support_message_stars to authenticated;
drop policy if exists support_message_stars_read_own on public.support_message_stars;
create policy support_message_stars_read_own on public.support_message_stars
  for select to authenticated using (agent_id = (select auth.uid()) and (select private.is_support_agent()));
drop policy if exists support_message_stars_insert_own on public.support_message_stars;
create policy support_message_stars_insert_own on public.support_message_stars
  for insert to authenticated with check (
    agent_id = (select auth.uid()) and (select private.is_support_agent())
    and exists (select 1 from public.support_messages m where m.id = message_id)
  );
drop policy if exists support_message_stars_delete_own on public.support_message_stars;
create policy support_message_stars_delete_own on public.support_message_stars
  for delete to authenticated using (agent_id = (select auth.uid()) and (select private.is_support_agent()));

create table if not exists public.support_conversation_pins (
  conversation_id uuid primary key references public.support_conversations(id) on delete cascade,
  message_id uuid not null,
  pinned_by uuid not null references auth.users(id) on delete cascade,
  pinned_at timestamptz not null default now(),
  constraint support_conversation_pins_message_same_thread_fk
    foreign key (message_id, conversation_id)
    references public.support_messages(id, conversation_id) on delete cascade
);
alter table public.support_conversation_pins enable row level security;
revoke all on public.support_conversation_pins from anon, authenticated;
grant select, insert, update, delete on public.support_conversation_pins to authenticated;
drop policy if exists support_conversation_pins_read_agents on public.support_conversation_pins;
create policy support_conversation_pins_read_agents on public.support_conversation_pins
  for select to authenticated using ((select private.is_support_agent()));
drop policy if exists support_conversation_pins_insert_agents on public.support_conversation_pins;
create policy support_conversation_pins_insert_agents on public.support_conversation_pins
  for insert to authenticated with check (
    pinned_by = (select auth.uid()) and (select private.is_support_agent())
    and exists (
      select 1 from public.support_messages m
      where m.id = message_id and m.conversation_id = conversation_id
    )
  );
drop policy if exists support_conversation_pins_update_agents on public.support_conversation_pins;
create policy support_conversation_pins_update_agents on public.support_conversation_pins
  for update to authenticated using ((select private.is_support_agent()))
  with check (
    pinned_by = (select auth.uid()) and (select private.is_support_agent())
    and exists (
      select 1 from public.support_messages m
      where m.id = message_id and m.conversation_id = conversation_id
    )
  );
drop policy if exists support_conversation_pins_delete_agents on public.support_conversation_pins;
create policy support_conversation_pins_delete_agents on public.support_conversation_pins
  for delete to authenticated using ((select private.is_support_agent()));

-- Mark the content deleted but retain a tombstone so replies/forwards remain coherent.
-- Keep attachment_path temporarily so its object can be removed through Storage's narrow policy below.
create or replace function public.support_agent_mark_message_deleted(p_message_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_attachment_path text;
begin
  if (select auth.uid()) is null or not (select private.is_support_agent()) then
    raise exception 'Active support agent required' using errcode = '42501';
  end if;
  select m.attachment_path into v_attachment_path
    from public.support_messages m
   where m.id = p_message_id and m.deleted_at is null
   for update;
  if not found then
    raise exception 'Message not found or already deleted' using errcode = 'P0002';
  end if;
  update public.support_messages
     set body = 'এই মেসেজটি মুছে ফেলা হয়েছে।', deleted_at = now()
   where id = p_message_id;
  delete from public.support_message_reactions where message_id = p_message_id;
  delete from public.support_message_stars where message_id = p_message_id;
  delete from public.support_conversation_pins where message_id = p_message_id;
  return v_attachment_path;
end;
$$;
revoke all on function public.support_agent_mark_message_deleted(uuid) from public, anon;
grant execute on function public.support_agent_mark_message_deleted(uuid) to authenticated;

create or replace function public.support_agent_finalize_message_delete(p_message_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or not (select private.is_support_agent()) then
    raise exception 'Active support agent required' using errcode = '42501';
  end if;
  update public.support_messages
     set attachment_path = null, attachment_name = null, attachment_mime = null
   where id = p_message_id and deleted_at is not null;
  if not found then
    raise exception 'Deleted message not found' using errcode = 'P0002';
  end if;
end;
$$;
revoke all on function public.support_agent_finalize_message_delete(uuid) from public, anon;
grant execute on function public.support_agent_finalize_message_delete(uuid) to authenticated;

-- Agents may remove only their own failed uploads or an attachment attached to a tombstoned message.
grant delete on storage.objects to authenticated;
drop policy if exists support_attachments_delete_agent_action on storage.objects;
create policy support_attachments_delete_agent_action on storage.objects
  for delete to authenticated using (
    bucket_id = 'support-attachments'
    and (select private.is_support_agent())
    and (
      owner_id = (select auth.uid())::text
      or exists (
        select 1 from public.support_messages m
        where m.attachment_path = name and m.deleted_at is not null
      )
    )
  );

-- Keep reaction, star, and pin state live across agents' inbox sessions.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'support_message_reactions') then
      alter publication supabase_realtime add table public.support_message_reactions;
    end if;
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'support_message_stars') then
      alter publication supabase_realtime add table public.support_message_stars;
    end if;
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'support_conversation_pins') then
      alter publication supabase_realtime add table public.support_conversation_pins;
    end if;
  end if;
end;
$$;
