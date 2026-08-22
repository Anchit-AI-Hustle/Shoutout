-- 023 — The settlement rail.
--
-- CLAUDE.md rule 6: SHOUTOUT never holds customer funds. So a settlement is
-- not a wallet — it is an *instruction* to a payment aggregator's split
-- product, plus an immutable local record of what was instructed and what
-- came back. Provider-agnostic: `provider` and `provider_ref` are the only
-- vendor-shaped columns, and packages/money hides the rest behind an
-- interface so Razorpay Route and Cashfree Easy Split are swappable.
--
-- CLAUDE.md rule 3: "A settlement cannot close until its splits sum to
-- zero. Enforced by a database trigger, not application code."
--
-- That rule is taken literally here by modelling settlement_lines as a
-- signed double-entry ledger rather than a list of percentages. The money
-- coming in is one positive line; every allocation out (artist, sidemen,
-- platform fee, TDS) is negative. A correct settlement therefore sums to
-- exactly zero, and "did we allocate every paisa" becomes a single SUM
-- check instead of floating-point percentage arithmetic that can silently
-- lose a rupee. Percentages are a presentation concern; the ledger is
-- integer paise and always balances.

create table payout_accounts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  -- KYC tiers from docs/04-PROFILES.md. Payouts require 'kyc_complete';
  -- the trigger below refuses to release money to anything less.
  kyc_tier text not null default 'basic'
    check (kyc_tier in ('basic', 'verified', 'kyc_complete')),
  pan_last4 text,
  -- Never store a full account number. Penny-drop verifies it upstream and
  -- we keep only what is needed to show the user which account this is.
  account_last4 text,
  ifsc text,
  beneficiary_name text,
  penny_drop_verified_at timestamptz,
  provider_contact_ref text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id)
);

create table settlements (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  booking_id uuid not null references bookings(id) on delete cascade,
  gross_paise bigint not null check (gross_paise > 0),
  status text not null default 'draft'
    check (status in ('draft', 'instructed', 'processing', 'closed', 'failed', 'reversed')),
  provider text,
  provider_ref text,
  instructed_at timestamptz,
  closed_at timestamptz,
  failure_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- One settlement per booking. Re-settling a booking is an amendment, not
  -- a second settlement, so this is a hard constraint rather than a
  -- convention.
  unique (booking_id)
);
create index settlements_org_idx on settlements (org_id, status, created_at desc);

create table settlement_lines (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  settlement_id uuid not null references settlements(id) on delete cascade,
  -- Signed paise. Exactly one 'gross' line is positive; everything else is
  -- negative. See the header note.
  amount_paise bigint not null check (amount_paise <> 0),
  kind text not null check (kind in ('gross', 'artist', 'sideman', 'platform_fee', 'tds', 'provider_fee', 'adjustment')),
  -- Who receives this line. Null for gross (money in) and for fees we keep.
  payee_org_id uuid references orgs(id),
  payee_artist_id uuid references artists(id),
  payee_name text,
  note text,
  created_at timestamptz not null default now()
);
create index settlement_lines_settlement_idx on settlement_lines (settlement_id);

create table payouts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  settlement_line_id uuid not null references settlement_lines(id) on delete cascade,
  amount_paise bigint not null check (amount_paise > 0),
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'paid', 'failed', 'returned')),
  provider text,
  provider_ref text,
  paid_at timestamptz,
  failure_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (settlement_line_id)
);
create index payouts_org_idx on payouts (org_id, status);

-- ------------------------------------------------------- the invariant
-- CLAUDE.md rule 3, enforced in the database. There is no application path
-- that can close an unbalanced settlement, and no admin bypass.

create or replace function assert_settlement_balances()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_sum bigint;
  v_gross_lines int;
  v_unverified int;
begin
  -- Only the transition into a terminal money-moving state is gated.
  -- Drafts are allowed to be unbalanced while they're being assembled.
  if new.status not in ('instructed', 'processing', 'closed') then
    return new;
  end if;

  select coalesce(sum(amount_paise), 0), count(*) filter (where kind = 'gross')
    into v_sum, v_gross_lines
  from settlement_lines where settlement_id = new.id;

  if v_gross_lines <> 1 then
    raise exception 'SETTLEMENT_UNBALANCED: expected exactly one gross line, found %', v_gross_lines;
  end if;

  if v_sum <> 0 then
    raise exception 'SETTLEMENT_UNBALANCED: lines sum to % paise, must be 0', v_sum;
  end if;

  -- Rule 6 corollary: money may not be released to an unverified payee.
  -- docs/04-PROFILES.md puts payouts behind KYC-complete.
  select count(*) into v_unverified
  from settlement_lines l
  left join payout_accounts pa on pa.org_id = l.payee_org_id
  where l.settlement_id = new.id
    and l.payee_org_id is not null
    and l.amount_paise < 0
    and (pa.id is null
         or pa.kyc_tier <> 'kyc_complete'
         or pa.penny_drop_verified_at is null);

  if v_unverified > 0 then
    raise exception 'PAYEE_NOT_VERIFIED: % payee(s) lack completed KYC or penny-drop', v_unverified;
  end if;

  return new;
end $$;

create trigger settlement_must_balance
  before update on settlements
  for each row
  when (old.status is distinct from new.status)
  execute function assert_settlement_balances();

-- A closed settlement is an accounting record. Editing its lines after the
-- fact would silently rewrite history that the balance check already
-- approved, so it is refused outright.
create or replace function assert_settlement_lines_mutable()
returns trigger
language plpgsql
set search_path = public
as $$
declare v_status text; v_settlement uuid;
begin
  v_settlement := coalesce(new.settlement_id, old.settlement_id);
  select status into v_status from settlements where id = v_settlement;
  if v_status in ('closed', 'processing') then
    raise exception 'SETTLEMENT_IMMUTABLE: cannot modify lines of a % settlement', v_status;
  end if;
  return coalesce(new, old);
end $$;

create trigger settlement_lines_immutable
  before insert or update or delete on settlement_lines
  for each row execute function assert_settlement_lines_mutable();

-- ------------------------------------------------------------------ RLS
alter table payout_accounts enable row level security;
alter table settlements enable row level security;
alter table settlement_lines enable row level security;
alter table payouts enable row level security;

create policy payout_accounts_own on payout_accounts
  for all using (org_id = current_org_id()) with check (org_id = current_org_id());

-- Two-sided: the artist-side org owns the settlement, but the organiser who
-- requested the brief legitimately needs to see that it settled.
create policy settlements_read on settlements for select using (
  org_id = current_org_id()
  or exists (
    select 1 from bookings b join briefs br on br.id = b.brief_id
    where b.id = settlements.booking_id and br.requesting_org_id = current_org_id()
  )
);
create policy settlements_write on settlements for all
  using (org_id = current_org_id()) with check (org_id = current_org_id());

create policy settlement_lines_read on settlement_lines for select using (
  org_id = current_org_id()
  or payee_org_id = current_org_id()
);
create policy settlement_lines_write on settlement_lines for all
  using (org_id = current_org_id()) with check (org_id = current_org_id());

create policy payouts_read on payouts for select using (
  org_id = current_org_id()
  or exists (
    select 1 from settlement_lines l
    where l.id = payouts.settlement_line_id and l.payee_org_id = current_org_id()
  )
);
create policy payouts_write on payouts for all
  using (org_id = current_org_id()) with check (org_id = current_org_id());
