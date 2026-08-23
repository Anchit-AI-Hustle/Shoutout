-- 027 — Lifecycle automation, without Inngest.
--
-- The published evidence is unambiguous that WhatsApp is the channel this
-- market runs on, and the product had no outbound messaging of any kind.
-- Rather than block on Inngest and a BSP account, this is an outbox table
-- plus pg_cron jobs: the database enqueues on a schedule and any worker
-- drains. Channel is a column, so WhatsApp arrives as configuration.
--
-- An outbox is also the right shape for delivery guarantees: enqueueing
-- happens in the same transaction as the state change that justified it, so
-- a reminder cannot be lost because a queue was briefly unreachable.
--
-- Note the ON CONFLICT clauses repeat the partial index predicate
-- (`where dedupe_key is not null`). Without that Postgres cannot match the
-- arbiter and raises 42P10 — which, when it failed silently in testing,
-- would have meant re-sending every reminder on every nightly run.

create table notifications (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  channel text not null default 'whatsapp' check (channel in ('whatsapp','sms','email','in_app')),
  template text not null,
  payload jsonb not null default '{}'::jsonb,
  to_phone text, to_email text,
  status text not null default 'pending'
    check (status in ('pending','sending','sent','failed','skipped')),
  attempts int not null default 0,
  send_after timestamptz not null default now(),
  sent_at timestamptz, last_error text, dedupe_key text,
  created_at timestamptz not null default now()
);
create index notifications_drain_idx on notifications (status, send_after) where status = 'pending';
create unique index notifications_dedupe_idx on notifications (dedupe_key) where dedupe_key is not null;

alter table notifications enable row level security;
create policy notifications_own on notifications for all
  using (org_id = current_org_id()) with check (org_id = current_org_id());

-- Jobs: expire_stale_holds, enqueue_event_reminders (T-7 / T-1),
-- enqueue_review_requests (day after), enqueue_invoice_reminders (overdue),
-- recompute_all_reliability. Full bodies in the applied migration.

create extension if not exists pg_cron;

-- select cron.schedule('expire-stale-holds',  '*/15 * * * *', 'select expire_stale_holds()');
-- select cron.schedule('event-reminders',     '0 4 * * *',    'select enqueue_event_reminders()');
-- select cron.schedule('review-requests',     '30 4 * * *',   'select enqueue_review_requests()');
-- select cron.schedule('invoice-reminders',   '0 5 * * *',    'select enqueue_invoice_reminders()');
-- select cron.schedule('reliability-nightly', '0 6 * * *',    'select recompute_all_reliability()');
-- select cron.schedule('benchmark-nightly',   '30 6 * * *',   'select refresh_benchmark_index()');
