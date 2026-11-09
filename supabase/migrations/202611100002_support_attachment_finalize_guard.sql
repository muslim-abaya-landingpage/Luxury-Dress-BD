-- Do not clear a tombstoned message's attachment pointer until the private Storage object is gone.
create or replace function public.support_agent_finalize_message_delete(p_message_id uuid)
returns void
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
   where m.id = p_message_id and m.deleted_at is not null
   for update;
  if not found then
    raise exception 'Deleted message not found' using errcode = 'P0002';
  end if;
  if v_attachment_path is not null and exists (
    select 1 from storage.objects o
     where o.bucket_id = 'support-attachments' and o.name = v_attachment_path
  ) then
    raise exception 'Attachment must be removed from private storage first' using errcode = '55000';
  end if;
  update public.support_messages
     set attachment_path = null, attachment_name = null, attachment_mime = null
   where id = p_message_id and deleted_at is not null;
end;
$$;
revoke all on function public.support_agent_finalize_message_delete(uuid) from public, anon;
grant execute on function public.support_agent_finalize_message_delete(uuid) to authenticated;
