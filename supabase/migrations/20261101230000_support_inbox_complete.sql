-- Support inbox completion: customer contact details, image attachments, Realtime for quick-action events,
-- and closing the open authenticated write policies on orders/products.

-- 1) Customer contact details (optional; customers set them only through a checked RPC).
alter table public.support_conversations
  add column if not exists customer_name text,
  add column if not exists customer_phone text;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'support_conversations_contact_length'
                 and conrelid = 'public.support_conversations'::regclass) then
    alter table public.support_conversations add constraint support_conversations_contact_length check (
      (customer_name is null or length(customer_name) <= 80)
      and (customer_phone is null or customer_phone ~ '^[0-9+ -]{6,24}$')
    );
  end if;
end $$;
-- Agents may correct contact details from the inbox (row access is still limited to agents by RLS).
grant update (customer_name, customer_phone) on public.support_conversations to authenticated;

create or replace function public.set_support_contact(p_conversation_id uuid, p_name text, p_phone text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := nullif(left(btrim(coalesce(p_name, '')), 80), '');
  v_phone text := nullif(regexp_replace(coalesce(p_phone, ''), '[^0-9+ -]', '', 'g'), '');
begin
  if (select auth.uid()) is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  if v_phone is not null and v_phone !~ '^[0-9+ -]{6,24}$' then
    raise exception 'Invalid phone number' using errcode = '22023';
  end if;
  update public.support_conversations
     set customer_name = coalesce(v_name, customer_name),
         customer_phone = coalesce(v_phone, customer_phone),
         updated_at = now()
   where id = p_conversation_id
     and visitor_id = (select auth.uid())
     and status <> 'closed';
  if not found then
    raise exception 'Conversation not found' using errcode = '42501';
  end if;
end;
$$;
revoke all on function public.set_support_contact(uuid, text, text) from public, anon;
grant execute on function public.set_support_contact(uuid, text, text) to authenticated;

-- 2) Image attachments in a private bucket: <conversation_id>/<file>.
alter table public.support_messages add column if not exists attachment_path text;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'support_messages_attachment_path_check'
                 and conrelid = 'public.support_messages'::regclass) then
    alter table public.support_messages add constraint support_messages_attachment_path_check check (
      attachment_path is null
      or (length(attachment_path) <= 200 and attachment_path like conversation_id::text || '/%')
    );
  end if;
end $$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('support-attachments', 'support-attachments', false, 5242880,
        array['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
on conflict (id) do update
  set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create or replace function private.can_access_support_folder(p_folder text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select private.is_support_agent())
      or exists (
        select 1 from public.support_conversations c
         where c.id::text = p_folder and c.visitor_id = (select auth.uid())
      );
$$;
create or replace function private.support_upload_allowed(p_folder text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select private.is_support_agent())
      or (
        exists (
          select 1 from public.support_conversations c
           where c.id::text = p_folder and c.visitor_id = (select auth.uid()) and c.status <> 'closed'
        )
        -- At most 10 customer uploads per 10 minutes per signed-in visitor.
        and (select count(*) from storage.objects o
              where o.bucket_id = 'support-attachments'
                and o.owner_id = (select auth.uid())::text
                and o.created_at > now() - interval '10 minutes') < 10
      );
$$;
revoke all on function private.can_access_support_folder(text) from public, anon;
revoke all on function private.support_upload_allowed(text) from public, anon;
grant execute on function private.can_access_support_folder(text) to authenticated;
grant execute on function private.support_upload_allowed(text) to authenticated;

drop policy if exists support_attachments_read on storage.objects;
create policy support_attachments_read on storage.objects for select to authenticated
  using (bucket_id = 'support-attachments' and private.can_access_support_folder((storage.foldername(name))[1]));
drop policy if exists support_attachments_upload on storage.objects;
create policy support_attachments_upload on storage.objects for insert to authenticated
  with check (bucket_id = 'support-attachments' and private.support_upload_allowed((storage.foldername(name))[1]));

-- 3) The inbox listens for quick-action events; they were never published to Realtime.
do $$ begin
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'support_events') then
    alter publication supabase_realtime add table public.support_events;
  end if;
end $$;

-- 4) Security: anonymous chat visitors are in the `authenticated` role, so these "admin" policies let any
-- visitor read/modify orders and products. Nothing in the site uses them; the Telegram bot uses the
-- service role, which bypasses RLS. Public product reads and the existing order insert policy are kept.
drop policy if exists "orders admin select" on public.orders;
drop policy if exists "orders admin update" on public.orders;
drop policy if exists "orders admin delete" on public.orders;
drop policy if exists "products admin insert" on public.products;
drop policy if exists "products admin update" on public.products;
drop policy if exists "products admin delete" on public.products;
