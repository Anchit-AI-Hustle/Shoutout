-- 029 — Customer discovery as a tracked object, not a memory.
--
-- Validation is the lowest score in the review and the only one that cannot
-- be closed by writing code. What code *can* do is stop the evidence from
-- evaporating: interviews recorded against pre-registered hypotheses, so
-- twenty conversations produce a scoreboard rather than twenty vague
-- impressions and a feeling of encouragement.
--
-- The eight hypotheses are seeded rather than free-text on purpose.
-- Pre-registered claims can be falsified; notes cannot.
--
-- research_scoreboard() refuses to call a hypothesis either way below five
-- responses — the same rule the price index and reliability scores use,
-- applied to the founder's own beliefs. Full DDL in the applied migration:
-- research_hypotheses (seeded H1..H8), research_interviews,
-- research_responses, and research_scoreboard().

-- ---------------------------------------------------------------------------
-- Recovered 2026-09-13.
--
-- This file held only the header comment above and no SQL at all. The schema
-- it describes was applied straight to the live database and never written
-- down here, so `supabase/migrations` could not rebuild it - nine migrations
-- (029 to 036) were in that state, including the paywall and the whole credit
-- graph. The statements below are the exact SQL that was applied, recovered
-- verbatim from the session transcripts, in application order.
-- ---------------------------------------------------------------------------

-- 029 — Customer discovery as a tracked object, not a memory.
--
-- Validation is the lowest score in the review and the only one that cannot
-- be closed by writing code. What code *can* do is stop the evidence from
-- evaporating: interviews recorded against pre-registered hypotheses, so
-- twenty conversations produce a scoreboard rather than twenty vague
-- impressions and a feeling of encouragement.
--
-- The hypotheses are seeded rather than free-text on purpose. Pre-registered
-- claims can be falsified; notes cannot.

create table research_hypotheses (
  id text primary key,
  claim text not null,
  detail text,
  sort_order int not null default 0
);

insert into research_hypotheses (id, claim, detail, sort_order) values
 ('H1','The SaaS buyer is the event company, not the artist manager',
      'Event companies are registered businesses with staff and an existing software budget.',1),
 ('H2','₹4,999/month is too high for managers, about right for event companies',
      'Carries the largest line in the Year-5 model. Say the number out loud and watch the face.',2),
 ('H3','The pain is certainty and payment, not discovery',
      'Strongly supported by published evidence already; confirm it holds in conversation.',3),
 ('H4','Organisers refuse a commission; artists accept a deduction',
      'Indian vendor marketplaces consistently struggle to charge the buyer.',4),
 ('H5','Weddings are cash and cannot be the wedge',
      'Gigstart led with weddings and did not survive as a standalone.',5),
 ('H6','WhatsApp is the interface; a web-only product loses',
      'A competing agency publicly calls the WhatsApp chain unreliable and opaque.',6),
 ('H7','Double-booking only hurts above roughly eight acts on a roster',
      'No public evidence either way. The holds calendar depends on this being true.',7),
 ('H8','Reliability signals matter more than price benchmarks',
      'Agencies sell reliability assessment. Price comps is currently the Pro feature.',8);

create table research_interviews (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  segment text not null check (segment in
    ('event_company','college_fest','artist_manager','musician','wedding_planner','venue')),
  contact_name text,
  company_name text,
  city text,
  held_on date not null default current_date,
  -- Willingness to pay, captured as a number when they name one. This is
  -- the single fact desk research can never produce.
  quoted_price_paise bigint,
  pays_for_software boolean,
  notes text,
  created_at timestamptz not null default now()
);
create index research_interviews_org_idx on research_interviews (org_id, held_on desc);

create table research_responses (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  interview_id uuid not null references research_interviews(id) on delete cascade,
  hypothesis_id text not null references research_hypotheses(id),
  verdict text not null check (verdict in ('supports','kills','unclear')),
  -- Their words, not your summary. A paraphrase is already an interpretation.
  quote text,
  created_at timestamptz not null default now(),
  unique (interview_id, hypothesis_id)
);
create index research_responses_hyp_idx on research_responses (hypothesis_id, verdict);

-- The scoreboard. Deliberately refuses to call a hypothesis either way below
-- five data points — the same rule the price index and reliability scores
-- use, applied to the founder's own beliefs.
create or replace function research_scoreboard()
returns table (
  hypothesis_id text, claim text, supports int, kills int, unclear int,
  n int, status text
)
language sql security definer set search_path = public stable as $$
  select h.id, h.claim,
    count(*) filter (where r.verdict = 'supports')::int,
    count(*) filter (where r.verdict = 'kills')::int,
    count(*) filter (where r.verdict = 'unclear')::int,
    count(r.id)::int,
    case
      when count(r.id) < 5 then 'insufficient_data'
      when count(*) filter (where r.verdict = 'supports') >= count(r.id) * 0.7 then 'supported'
      when count(*) filter (where r.verdict = 'kills')    >= count(r.id) * 0.5 then 'killed'
      else 'contested'
    end
  from research_hypotheses h
  left join research_responses r
    on r.hypothesis_id = h.id and r.org_id = current_org_id()
  group by h.id, h.claim, h.sort_order
  order by h.sort_order;
$$;
revoke execute on function research_scoreboard() from public, anon;
grant execute on function research_scoreboard() to authenticated;

alter table research_hypotheses enable row level security;
alter table research_interviews enable row level security;
alter table research_responses enable row level security;

create policy research_hypotheses_read on research_hypotheses for select to authenticated using (true);
create policy research_interviews_own on research_interviews for all
  using (org_id = current_org_id()) with check (org_id = current_org_id());
create policy research_responses_own on research_responses for all
  using (org_id = current_org_id()) with check (org_id = current_org_id());
