-- Shared rate limiter (Aria's outreach review, section 3).
--
-- The old in-memory counters are per server instance, so they don't hold on serverless. This is
-- one shared table plus one SECURITY DEFINER function, used by the outreach preview (token lookups,
-- preview forms) and the dashboard help chat. Callers pass an already-hashed key (for example
-- sha256 of the IP address); raw IPs are never stored.
--
-- Only the service role may call rate_check(); nobody can read or write the table directly.

create table if not exists public.rate_limit_hits (
  id bigint generated always as identity primary key,
  bucket text not null check (length(bucket) between 1 and 64),
  key_hash text not null check (length(key_hash) between 1 and 128),
  hit_at timestamptz not null default now()
);

create index if not exists rate_limit_hits_bucket_key_time_idx
  on public.rate_limit_hits (bucket, key_hash, hit_at desc);

alter table public.rate_limit_hits enable row level security;
revoke all on table public.rate_limit_hits from public, anon, authenticated;
grant select, insert, delete on table public.rate_limit_hits to service_role;

-- Returns true (and records the hit) when the caller is under p_limit hits in the last
-- p_window_seconds for (p_bucket, p_key); returns false (and records nothing) when over.
create or replace function public.rate_check(
  p_bucket text,
  p_key text,
  p_limit integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  if p_bucket is null or p_key is null or p_limit is null or p_window_seconds is null
     or p_limit < 1 or p_window_seconds < 1 then
    raise exception using message = 'rate_check: invalid arguments', errcode = '22023';
  end if;

  -- Serialize concurrent calls for the same bucket + key so two requests can't both slip in.
  perform pg_advisory_xact_lock(hashtextextended(p_bucket || ':' || p_key, 0));

  delete from public.rate_limit_hits
  where bucket = p_bucket and key_hash = p_key
    and hit_at < now() - make_interval(secs => p_window_seconds);

  select count(*) into n
  from public.rate_limit_hits
  where bucket = p_bucket and key_hash = p_key;

  if n >= p_limit then
    return false;
  end if;

  insert into public.rate_limit_hits (bucket, key_hash) values (p_bucket, p_key);

  -- Occasional global cleanup so keys that stop calling don't pile up (nothing needs > 2 days).
  if random() < 0.01 then
    delete from public.rate_limit_hits where hit_at < now() - interval '2 days';
  end if;

  return true;
end;
$$;

revoke execute on function public.rate_check(text, text, integer, integer) from public, anon, authenticated;
grant execute on function public.rate_check(text, text, integer, integer) to service_role;
