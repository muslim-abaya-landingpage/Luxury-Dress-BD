-- Support voice recordings and common customer document attachments.
-- Upload size remains capped at 10 MiB and bucket stays private.
alter table public.support_messages
  add column if not exists attachment_name text,
  add column if not exists attachment_mime text;

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'support_messages_attachment_metadata_check'
      and conrelid = 'public.support_messages'::regclass
  ) then
    alter table public.support_messages
      add constraint support_messages_attachment_metadata_check check (
        (attachment_name is null or length(attachment_name) <= 255)
        and (attachment_mime is null or attachment_mime in (
          'image/jpeg','image/png','image/webp','image/gif',
          'audio/webm','audio/ogg','audio/mp4','audio/mpeg','audio/wav','audio/aac','audio/3gpp',
          'application/pdf','application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/vnd.ms-excel',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'text/csv','text/plain'
        ))
      );
  end if;
end $$;

update storage.buckets
set public = false,
    file_size_limit = 10485760,
    allowed_mime_types = array[
      'image/jpeg','image/png','image/webp','image/gif',
      'audio/webm','audio/ogg','audio/mp4','audio/mpeg','audio/wav','audio/aac','audio/3gpp',
      'application/pdf','application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/csv','text/plain'
    ]
where id = 'support-attachments';
