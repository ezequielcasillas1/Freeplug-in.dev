-- Aria rulings on picker-notify (Oct 14): the debounce moves to a per-request Cloudflare Durable Object
-- alarm (no cron, no queue processor). template_pick_notify becomes the send LOG: one row per
-- (request_id, event, pick_version) = the idempotency key, with sent_at on success or last_error +
-- attempts on failure. Failed rows are listed on /admin/notify-outbox with a manual Resend button.
-- due_at is no longer used (nullable, kept for the rows already written locally).

alter table public.template_pick_notify alter column due_at drop not null;
-- One pending debounced change per request was a queue rule; the alarm owns that now, and a log may
-- hold more than one failed 'changed' row for different versions.
drop index if exists public.template_pick_notify_one_pending_change;
drop index if exists public.template_pick_notify_due_idx;
create index if not exists template_pick_notify_failed_idx
  on public.template_pick_notify (updated_at desc) where sent_at is null;
