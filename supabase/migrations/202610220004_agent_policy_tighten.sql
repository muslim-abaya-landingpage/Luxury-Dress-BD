-- Agents can read the allow-list, but non-agents cannot probe whether an email is approved.
drop policy if exists support_agents_read_self_or_agent on public.support_agents;
create policy support_agents_read_agents_only
  on public.support_agents for select to authenticated
  using ((select private.is_support_agent()));
