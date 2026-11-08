-- Track one-time merch download email per checkout session (retry when null).

alter table public.merch_font_bundle_tokens
  add column if not exists emailed_at timestamptz;

create index if not exists merch_font_bundle_tokens_emailed_at_idx
  on public.merch_font_bundle_tokens (emailed_at)
  where emailed_at is null;
