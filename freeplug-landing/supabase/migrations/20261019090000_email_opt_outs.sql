-- Oct 19 (Cheke): cold-email opt-outs. LOCAL DB ONLY until Cheke says to apply it anywhere else.
-- Every opt-out is recorded (one row per event: email, when, where it came from). Casey's sender checks
-- public.email_opted_out(...) before each send and skips any address that has a row here.
create table if not exists public.email_opt_outs (
  id bigint generated always as identity primary key,
  email text not null check (email = lower(btrim(email)) and position('@' in email) > 1 and length(email) <= 320),
  opted_out_at timestamptz not null default now(),
  source text not null check (source in ('unsubscribe_page', 'one_click', 'reply_stop', 'admin', 'import')),
  token_kind text check (token_kind in ('signed', 'email')),
  user_agent text check (length(user_agent) <= 500)
);
create index if not exists email_opt_outs_email_idx on public.email_opt_outs (email);

-- Service role only: RLS on with no policies, and no grants to anon/authenticated.
alter table public.email_opt_outs enable row level security;
revoke all on public.email_opt_outs from anon, authenticated;

-- Read path for the sender: which of these addresses opted out (and when, first time).
create or replace function public.email_opted_out(p_emails text[])
returns table (email text, first_opted_out_at timestamptz, last_source text)
language sql
stable
set search_path = ''
as $$
  select o.email, min(o.opted_out_at), (array_agg(o.source order by o.opted_out_at desc))[1]
  from public.email_opt_outs o
  where o.email = any (select lower(btrim(e)) from unnest(p_emails) as e)
  group by o.email
$$;
revoke all on function public.email_opted_out(text[]) from public, anon, authenticated;
grant execute on function public.email_opted_out(text[]) to service_role;
