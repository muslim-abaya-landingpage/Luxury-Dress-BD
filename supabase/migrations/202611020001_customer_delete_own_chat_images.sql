-- Let a visitor remove only their own recently-sent image message, while its
-- conversation is still open. Agents and other customers cannot use this path.
grant delete on public.support_messages to authenticated;

drop policy if exists support_messages_delete_own_recent_image on public.support_messages;
create policy support_messages_delete_own_recent_image
  on public.support_messages for delete to authenticated
  using (
    sender_role = 'customer'
    and sender_id = (select auth.uid())
    and attachment_path is not null
    and created_at > now() - interval '24 hours'
    and exists (
      select 1 from public.support_conversations c
      where c.id = conversation_id
        and c.visitor_id = (select auth.uid())
        and c.status <> 'closed'
    )
  );

-- Storage cleanup is limited to the caller's own conversation folder and
-- objects they uploaded; this still works after the message row is removed.
drop policy if exists support_attachments_delete_own_recent on storage.objects;
create policy support_attachments_delete_own_recent
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'support-attachments'
    and owner_id = (select auth.uid())::text
    and exists (
      select 1 from public.support_conversations c
      where c.id::text = (storage.foldername(name))[1]
        and c.visitor_id = (select auth.uid())
        and c.status <> 'closed'
    )
  );
