-- Limit accidental or abusive anonymous chat bursts and avoid duplicate open sessions.
create unique index if not exists support_one_open_thread_per_visitor_idx
  on public.support_conversations (visitor_id)
  where status in ('open', 'pending');

create or replace function public.enforce_support_message_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  recent_count integer;
begin
  if new.sender_role = 'customer' then
    select count(*) into recent_count
      from public.support_messages m
     where m.sender_id = new.sender_id
       and m.sender_role = 'customer'
       and m.created_at > now() - interval '1 minute';
    if recent_count >= 8 then
      raise exception 'Please wait before sending more support messages.' using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.enforce_support_message_rate_limit() from public, anon, authenticated;

drop trigger if exists support_message_rate_limit on public.support_messages;
create trigger support_message_rate_limit
before insert on public.support_messages
for each row execute function public.enforce_support_message_rate_limit();

create or replace function public.enforce_support_event_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  recent_count integer;
begin
  select count(*) into recent_count
    from public.support_events e
   where e.visitor_id = new.visitor_id
     and e.created_at > now() - interval '1 minute';
  if recent_count >= 30 then
    raise exception 'Please wait before selecting more support actions.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
revoke all on function public.enforce_support_event_rate_limit() from public, anon, authenticated;

drop trigger if exists support_event_rate_limit on public.support_events;
create trigger support_event_rate_limit
before insert on public.support_events
for each row execute function public.enforce_support_event_rate_limit();
