-- 026 — Revenue that works before a payment aggregator exists.
--
-- docs/14-BUILD-SEQUENCE.md's own launch plan: "don't hold money. Organiser
-- pays the artist directly; invoice your fee separately." That is a real
-- commercial model, not a stopgap, and it means the business can charge
-- today rather than waiting weeks on PA onboarding.
--
-- A settlement therefore has a mode. 'direct' records the economics for
-- accounting and invoices our fee; money never touches us. 'split' is the
-- aggregator path from migration 023, unchanged.
--
-- The KYC gate is scoped to 'split' deliberately: it exists because we are
-- about to disburse someone's money. In direct mode we disburse nothing, so
-- demanding the artist's bank details before we may even record the booking
-- is both wrong and a needless barrier to adoption.

alter table settlements add column mode text not null default 'direct'
  check (mode in ('direct', 'split'));

-- (assert_settlement_balances recreated with `if new.mode = 'split'`
-- guarding the KYC block — see the applied migration for the full body.)

create table invoices (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  settlement_id uuid references settlements(id) on delete set null,
  booking_id uuid references bookings(id) on delete set null,
  invoice_number text not null,
  bill_to_name text not null,
  bill_to_org_id uuid references orgs(id),
  amount_paise bigint not null check (amount_paise > 0),
  tax_paise bigint not null default 0 check (tax_paise >= 0),
  total_paise bigint not null check (total_paise > 0),
  status text not null default 'draft' check (status in ('draft','sent','paid','void')),
  due_on date, sent_at timestamptz, paid_at timestamptz, payment_ref text, notes text,
  public_token text not null default encode(extensions.gen_random_bytes(16), 'hex'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, invoice_number)
);
create index invoices_org_idx on invoices (org_id, status, created_at desc);
create unique index invoices_public_token_idx on invoices (public_token);
create sequence if not exists invoice_seq;

create or replace function next_invoice_number(p_org_id uuid)
returns text language sql volatile set search_path = public as $$
  select 'SO-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('invoice_seq')::text, 6, '0');
$$;

alter table invoices enable row level security;
create policy invoices_own on invoices for all
  using (org_id = current_org_id()) with check (org_id = current_org_id());

-- The payer is usually not a ShoutOut user, so reading by token is the only
-- way they can see what they owe — same pattern as the public rider page.
create or replace function get_invoice_public(p_token text)
returns table (invoice_number text, bill_to_name text, amount_paise bigint, tax_paise bigint,
               total_paise bigint, status text, due_on date, notes text, issued_by text)
language sql security definer set search_path = public stable as $$
  select i.invoice_number, i.bill_to_name, i.amount_paise, i.tax_paise,
         i.total_paise, i.status, i.due_on, i.notes, o.name
  from invoices i join orgs o on o.id = i.org_id
  where i.public_token = p_token and i.status <> 'draft' limit 1;
$$;
revoke execute on function get_invoice_public(text) from public;
grant execute on function get_invoice_public(text) to anon, authenticated;
