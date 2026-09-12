-- 031 — Studio: approve the plan before render, revise one unit not all.
--
-- Two patterns, borrowed from Flick (github.com/Creatorberry/flick), which
-- surfaces a compact scene plan for approval and then revises only the
-- scene you name. Flick documents the workflow but not the mechanism for
-- keeping untouched units identical, so that part is designed here.
--
-- 1. APPROVE BEFORE RENDER. docs/07-STUDIO.md's stage 3 is the MUSIC_BRIEF,
--    "the seam" where intent becomes a render. Generation is the expensive
--    irreversible step, so the brief is surfaced as readable text
--    (packages/intent renderPlanText) and nothing renders until a human
--    says yes. Enforced by trigger: a section cannot enter 'rendering'
--    while its plan is unapproved. A check in the worker is a check the
--    worker can skip.
--
-- 2. REVISE ONE UNIT. Every section is content-addressed on
--    (spec, seed, pipeline_version, model_version). Regenerating the chorus
--    changes only the chorus's hash; every other section keeps its hash and
--    therefore its existing artifact. "Byte-identical" is literal — it is
--    the same stored object, not a re-run that happens to match.
--
--    set_section_hash() also short-circuits: if an UPDATE produces an
--    unchanged hash it returns OLD untouched, so a no-op write cannot
--    reset rendered state.
--
--    generation_artifacts is keyed by content hash alone, so reuse works
--    across revisions *and* across plans — revert a change and the original
--    audio comes straight back from cache.
--
-- Album mode falls out of the same structure: plan holds tracks, track
-- holds sections, so "approve the tracklist, regenerate track 4" is the
-- same mechanism one level up. Verified: regenerating track 4 of a 4-track
-- album dirties 2 sections on track 4 and leaves the other 6 untouched.
--
-- compute_section_hash() is mirrored in packages/studio-core with a test
-- pinning it to the value this function produces. If those ever diverge,
-- the client predicts a cache hit the database will not honour.
--
-- Tables: generation_plans, generation_tracks, generation_sections,
-- generation_artifacts. Functions: compute_section_hash,
-- approve_generation_plan, plan_render_manifest, record_section_artifact.

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

-- [applied as: generation_plans_and_sections]
-- 031 — Studio: approve the plan before render, revise one unit not all.
--
-- Two patterns, borrowed from Flick (github.com/Creatorberry/flick), which
-- surfaces a compact scene plan for approval and then revises only the
-- scene you name.
--
-- 1. APPROVE BEFORE RENDER. docs/07-STUDIO.md's stage 3 is the MUSIC_BRIEF —
--    "the seam" where intent becomes a render. Generation is the expensive
--    irreversible step, so the brief is surfaced as a readable plan
--    (structure, sections, drift) and nothing renders until a human says
--    yes. Enforced by trigger: a section cannot enter 'rendering' while its
--    plan is unapproved.
--
-- 2. REVISE ONE UNIT. Every section is content-addressed on
--    (spec, seed, pipeline_version, model_version). Regenerating the chorus
--    changes only the chorus's hash; every other section keeps its hash and
--    therefore its existing artifact — reused verbatim rather than
--    re-rendered. "Byte-identical" is literal: it is the same stored object,
--    not a re-run that happens to match.
--
-- Album mode falls out of the same structure: a plan holds tracks, a track
-- holds sections, so "approve the tracklist, regenerate track 4" is the
-- same mechanism one level up.

create table generation_plans (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  kind text not null default 'single' check (kind in ('single','album','reference')),
  title text,
  -- The MUSIC_BRIEF itself (packages/intent). One schema, four consumers:
  -- pipeline, Collabs matching, Gigs matching, and catalogue tagging.
  brief jsonb not null,
  status text not null default 'draft'
    check (status in ('draft','awaiting_approval','approved','rendering','complete','failed','superseded')),
  approved_at timestamptz,
  approved_by uuid references auth.users(id),
  -- Version stamps are part of every content hash: a pipeline change must
  -- invalidate cached audio rather than silently mixing old and new output.
  pipeline_version text not null default 'v1',
  model_version text not null default 'v1',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index generation_plans_org_idx on generation_plans (org_id, created_at desc);

create table generation_tracks (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  plan_id uuid not null references generation_plans(id) on delete cascade,
  track_index int not null check (track_index >= 1),
  title text not null,
  -- Album mode: controlled semantic drift from the album brief, per track.
  drift jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (plan_id, track_index)
);

create table generation_sections (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  track_id uuid not null references generation_tracks(id) on delete cascade,
  section_index int not null check (section_index >= 1),
  -- intro / verse / pre_chorus / chorus / bridge / solo / outro
  kind text not null,
  bars int,
  spec jsonb not null default '{}'::jsonb,
  seed bigint not null default 1,
  -- sha256 over (spec, seed, pipeline_version, model_version). The cache key.
  content_hash text not null,
  state text not null default 'planned'
    check (state in ('planned','rendering','rendered','failed','reused')),
  artifact_url text,
  duration_ms int,
  rendered_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (track_id, section_index)
);
create index generation_sections_hash_idx on generation_sections (content_hash);
create index generation_sections_track_idx on generation_sections (track_id, section_index);

-- Every rendered artifact, keyed by content hash. This is what makes reuse
-- possible across revisions *and* across plans: two users who ask for the
-- same section under the same pipeline get the same object, rendered once.
create table generation_artifacts (
  content_hash text primary key,
  org_id uuid not null references orgs(id) on delete cascade,
  artifact_url text not null,
  duration_ms int,
  bytes bigint,
  pipeline_version text not null,
  model_version text not null,
  created_at timestamptz not null default now()
);

alter table generation_plans enable row level security;
alter table generation_tracks enable row level security;
alter table generation_sections enable row level security;
alter table generation_artifacts enable row level security;

create policy generation_plans_own on generation_plans for all
  using (org_id = current_org_id()) with check (org_id = current_org_id());
create policy generation_tracks_own on generation_tracks for all
  using (org_id = current_org_id()) with check (org_id = current_org_id());
create policy generation_sections_own on generation_sections for all
  using (org_id = current_org_id()) with check (org_id = current_org_id());
create policy generation_artifacts_own on generation_artifacts for all
  using (org_id = current_org_id()) with check (org_id = current_org_id());

-- [applied as: generation_approval_and_reuse]
-- GATE 1: no render before approval.
--
-- The whole point of surfacing a plan is that compute is not spent until a
-- human has read it. A check in the worker would be a check the worker can
-- skip; this one it cannot.

create or replace function assert_plan_approved_before_render()
returns trigger language plpgsql set search_path = public as $$
declare v_status text;
begin
  if new.state = 'rendering' and coalesce(old.state, '') <> 'rendering' then
    select p.status into v_status
    from generation_plans p
    join generation_tracks t on t.plan_id = p.id
    where t.id = new.track_id;

    if v_status not in ('approved','rendering') then
      raise exception 'PLAN_NOT_APPROVED: the plan must be approved before any section renders (status: %)', v_status;
    end if;
  end if;
  return new;
end $$;

create trigger sections_require_approved_plan
  before insert or update of state on generation_sections
  for each row execute function assert_plan_approved_before_render();

-- Canonical hashing. Key ordering matters — jsonb sorts keys, which is
-- exactly why the spec is stored as jsonb rather than text: two logically
-- identical specs must produce one hash, not two.
create or replace function compute_section_hash(
  p_spec jsonb, p_seed bigint, p_pipeline_version text, p_model_version text
) returns text
language sql immutable set search_path = public as $$
  select encode(extensions.digest(
    coalesce(p_spec, '{}'::jsonb)::text || '|' || p_seed::text || '|' ||
    coalesce(p_pipeline_version,'') || '|' || coalesce(p_model_version,''),
    'sha256'), 'hex');
$$;

-- Keeps content_hash honest: it is derived, never supplied. A caller cannot
-- pin a stale hash to dodge a re-render, and cannot forget to update it.
create or replace function set_section_hash()
returns trigger language plpgsql set search_path = public as $$
declare v_pipeline text; v_model text; v_new_hash text; v_artifact record;
begin
  select p.pipeline_version, p.model_version into v_pipeline, v_model
  from generation_plans p join generation_tracks t on t.plan_id = p.id
  where t.id = new.track_id;

  v_new_hash := compute_section_hash(new.spec, new.seed, v_pipeline, v_model);

  -- Unchanged hash on an already-rendered section: leave it completely
  -- alone. This is the "everything else stays byte-identical" guarantee.
  if tg_op = 'UPDATE' and old.content_hash = v_new_hash then
    return old;
  end if;

  new.content_hash := v_new_hash;

  -- Already rendered this exact unit before? Reuse the object rather than
  -- burning compute to produce a duplicate.
  select * into v_artifact from generation_artifacts where content_hash = v_new_hash;
  if v_artifact.content_hash is not null then
    new.artifact_url := v_artifact.artifact_url;
    new.duration_ms := v_artifact.duration_ms;
    new.state := 'reused';
    new.rendered_at := now();
  elsif tg_op = 'UPDATE' then
    -- Genuinely new content: drop the stale artifact and queue a re-render.
    new.artifact_url := null;
    new.duration_ms := null;
    new.rendered_at := null;
    new.state := 'planned';
  end if;

  new.updated_at := now();
  return new;
end $$;

create trigger sections_hash_before_write
  before insert or update of spec, seed on generation_sections
  for each row execute function set_section_hash();

-- Approval, and the plan-level view a human actually reads.
create or replace function approve_generation_plan(p_plan_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_org uuid; v_status text; v_sections int;
begin
  select org_id, status into v_org, v_status from generation_plans where id = p_plan_id;
  if v_org is null then raise exception 'NOT_FOUND: plan not found'; end if;
  if current_org_id() is null or current_org_id() <> v_org then
    raise exception 'FORBIDDEN: not your plan';
  end if;
  if v_status = 'approved' then return; end if;
  if v_status not in ('draft','awaiting_approval') then
    raise exception 'INVALID_TRANSITION: cannot approve a % plan', v_status;
  end if;

  select count(*) into v_sections
  from generation_sections s join generation_tracks t on t.id = s.track_id
  where t.plan_id = p_plan_id;
  if v_sections = 0 then
    raise exception 'EMPTY_PLAN: nothing to approve';
  end if;

  update generation_plans
  set status = 'approved', approved_at = now(), approved_by = auth.uid(), updated_at = now()
  where id = p_plan_id;
end $$;
revoke execute on function approve_generation_plan(uuid) from public, anon;
grant execute on function approve_generation_plan(uuid) to authenticated;

-- What a re-render would actually cost: which units are dirty, which are
-- reused. Shown before spending compute, and after a revision.
create or replace function plan_render_manifest(p_plan_id uuid)
returns table (
  track_index int, track_title text, section_index int, kind text,
  content_hash text, state text, will_render boolean
)
language sql security definer set search_path = public stable as $$
  select t.track_index, t.title, s.section_index, s.kind, s.content_hash, s.state,
         (s.state in ('planned','failed')) as will_render
  from generation_sections s
  join generation_tracks t on t.id = s.track_id
  join generation_plans p on p.id = t.plan_id
  where t.plan_id = p_plan_id and p.org_id = current_org_id()
  order by t.track_index, s.section_index;
$$;
revoke execute on function plan_render_manifest(uuid) from public, anon;
grant execute on function plan_render_manifest(uuid) to authenticated;

-- Records a finished render so the next identical request reuses it.
create or replace function record_section_artifact(
  p_section_id uuid, p_artifact_url text, p_duration_ms int, p_bytes bigint
) returns void language plpgsql security definer set search_path = public as $$
declare v_org uuid; v_hash text; v_pipeline text; v_model text;
begin
  select s.org_id, s.content_hash, p.pipeline_version, p.model_version
    into v_org, v_hash, v_pipeline, v_model
  from generation_sections s
  join generation_tracks t on t.id = s.track_id
  join generation_plans p on p.id = t.plan_id
  where s.id = p_section_id;

  if v_org is null then raise exception 'NOT_FOUND: section not found'; end if;

  insert into generation_artifacts (content_hash, org_id, artifact_url, duration_ms, bytes, pipeline_version, model_version)
  values (v_hash, v_org, p_artifact_url, p_duration_ms, p_bytes, v_pipeline, v_model)
  on conflict (content_hash) do nothing;

  update generation_sections
  set state = 'rendered', artifact_url = p_artifact_url, duration_ms = p_duration_ms,
      rendered_at = now(), last_error = null, updated_at = now()
  where id = p_section_id;
end $$;
revoke execute on function record_section_artifact(uuid, text, int, bigint) from public, anon;
grant execute on function record_section_artifact(uuid, text, int, bigint) to authenticated;
