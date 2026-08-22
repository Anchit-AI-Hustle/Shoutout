import { randomUUID } from 'node:crypto';
import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// RLS cross-tenant isolation — docs/10-TESTING.md Gate 1.
//
// Requires SUPABASE_DB_URL: a direct Postgres connection string for the
// project, using a role that can bypass RLS for seeding (the `postgres`
// role, not `authenticated`). This is test infrastructure, not a user path —
// distinct from the service-role-key-in-a-route-handler rule in
// docs/02-ARCHITECTURE.md, which is about production request paths.
//
// Cross-org checks use direct Postgres role-switching
// (SET LOCAL ROLE authenticated + request.jwt.claims), not real phone-OTP
// sessions — auth itself is a separate, already-tested concern (see the
// auth-phone-otp PR). This tests RLS policy correctness directly and
// deterministically.
//
// SCOPE, STATED PLAINLY (no silent caps — docs/09-BUILD-SEQUENCE.md pattern):
// this suite covers direct-SQL access only. "cannot reach B's rows via
// PostgREST, Realtime, or a storage object path" (docs/10-TESTING.md) is
// NOT covered here — that needs a running app instance and real HTTP
// requests against PostgREST/Realtime/Storage, which is a meaningfully
// different test harness. Flagging the gap rather than claiming coverage
// this suite doesn't have.

const DATABASE_URL = process.env.SUPABASE_DB_URL;

if (!DATABASE_URL) {
  throw new Error(
    'SUPABASE_DB_URL is required — a direct Postgres connection string ' +
      '(postgres role, bypasses RLS for seeding). Get it from Supabase ' +
      'dashboard → Settings → Database → Connection string, or construct it ' +
      'from the project ref + db password: ' +
      'postgresql://postgres.<ref>:<password>@aws-1-ap-south-1.pooler.supabase.com:5432/postgres',
  );
}

let admin: Client;

const orgA = randomUUID();
const orgB = randomUUID();
const userA = randomUUID();
const userB = randomUUID();
const artistA = randomUUID();
const artistB = randomUUID();

async function withSession<T>(
  userId: string,
  orgId: string,
  fn: (client: Client) => Promise<T>,
): Promise<T> {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();
  try {
    await client.query('BEGIN');
    await client.query('SET LOCAL ROLE authenticated');
    await client.query("SELECT set_config('request.jwt.claims', $1, true)", [
      JSON.stringify({ sub: userId, role: 'authenticated', org_id: orgId }),
    ]);
    const result = await fn(client);
    await client.query('ROLLBACK'); // every session-scoped check is read-only or self-reverting
    return result;
  } finally {
    await client.end();
  }
}

beforeAll(async () => {
  admin = new Client({ connectionString: DATABASE_URL });
  await admin.connect();

  await admin.query('BEGIN');
  await admin.query(`insert into auth.users (id, email) values ($1, $2), ($3, $4)`, [
    userA,
    `rls-test-a-${userA}@shoutout.test`,
    userB,
    `rls-test-b-${userB}@shoutout.test`,
  ]);
  await admin.query(`insert into orgs (id, type, name) values ($1, 'self', 'RLS Test Org A')`, [
    orgA,
  ]);
  await admin.query(`insert into orgs (id, type, name) values ($1, 'self', 'RLS Test Org B')`, [
    orgB,
  ]);
  await admin.query(
    `insert into org_members (org_id, user_id, role) values ($1, $2, 'owner'), ($3, $4, 'owner')`,
    [orgA, userA, orgB, userB],
  );
  await admin.query(
    `insert into artists (id, org_id, stage_name, slug) values ($1, $2, 'Artist A', $3)`,
    [artistA, orgA, `artist-a-${artistA}`],
  );
  await admin.query(
    `insert into artists (id, org_id, stage_name, slug) values ($1, $2, 'Artist B', $3)`,
    [artistB, orgB, `artist-b-${artistB}`],
  );
  await admin.query('COMMIT');
});

afterAll(async () => {
  await admin.query('BEGIN');
  await admin.query('delete from artists where id in ($1, $2)', [artistA, artistB]);
  await admin.query('delete from org_members where org_id in ($1, $2)', [orgA, orgB]);
  await admin.query('delete from orgs where id in ($1, $2)', [orgA, orgB]);
  await admin.query('delete from auth.users where id in ($1, $2)', [userA, userB]);
  await admin.query('COMMIT');
  await admin.end();
});

describe('every public table has RLS enabled and at least one policy', () => {
  it('enumerates from pg_class/pg_policies — a new table with no policy fails automatically', async () => {
    const tables = await admin.query<{
      table_name: string;
      rls_enabled: boolean;
      policy_count: string;
    }>(`
      select
        c.relname as table_name,
        c.relrowsecurity as rls_enabled,
        (select count(*) from pg_policies p where p.schemaname = 'public' and p.tablename = c.relname) as policy_count
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r'
      order by c.relname
    `);

    expect(tables.rows.length).toBeGreaterThan(0);

    const failures = tables.rows.filter((t) => !t.rls_enabled || Number(t.policy_count) === 0);

    if (failures.length > 0) {
      const detail = failures
        .map((t) => `${t.table_name} (rls_enabled=${t.rls_enabled}, policies=${t.policy_count})`)
        .join(', ');
      throw new Error(`Tables missing RLS or a policy: ${detail}`);
    }
  });
});

describe('cross-org isolation', () => {
  it('org A cannot SELECT org B artists', async () => {
    const result = await withSession(userA, orgA, (c) =>
      c.query('select id from artists where id = $1', [artistB]),
    );
    expect(result.rows).toHaveLength(0);
  });

  it('org A cannot UPDATE org B artists', async () => {
    const result = await withSession(userA, orgA, (c) =>
      c.query("update artists set stage_name = 'pwned' where id = $1 returning id", [artistB]),
    );
    expect(result.rows).toHaveLength(0);

    const check = await admin.query('select stage_name from artists where id = $1', [artistB]);
    expect(check.rows[0]?.stage_name).toBe('Artist B');
  });

  it('org A cannot DELETE org B artists', async () => {
    const result = await withSession(userA, orgA, (c) =>
      c.query('delete from artists where id = $1 returning id', [artistB]),
    );
    expect(result.rows).toHaveLength(0);

    const check = await admin.query('select id from artists where id = $1', [artistB]);
    expect(check.rows).toHaveLength(1);
  });

  it('org A can SELECT its own artists', async () => {
    const result = await withSession(userA, orgA, (c) =>
      c.query('select id from artists where id = $1', [artistA]),
    );
    expect(result.rows).toHaveLength(1);
  });

  it('org A cannot SELECT org B org_members', async () => {
    const result = await withSession(userA, orgA, (c) =>
      c.query('select user_id from org_members where org_id = $1', [orgB]),
    );
    expect(result.rows).toHaveLength(0);
  });

  it('a session cannot SELECT another org row directly by id', async () => {
    const result = await withSession(userA, orgA, (c) =>
      c.query('select id from orgs where id = $1', [orgB]),
    );
    expect(result.rows).toHaveLength(0);
  });
});

describe('org_id escalation is rejected', () => {
  it('org A cannot INSERT an artist row claiming org_id = org B', async () => {
    await expect(
      withSession(userA, orgA, (c) =>
        c.query(
          "insert into artists (org_id, stage_name, slug) values ($1, 'Escalation Attempt', $2)",
          [orgB, `escalation-${randomUUID()}`],
        ),
      ),
    ).rejects.toThrow();
  });
});

describe('Credits: cross-org isolation on works and contributors', () => {
  it('org A cannot SELECT a work belonging to org B', async () => {
    const workId = randomUUID();
    await admin.query('BEGIN');
    await admin.query(`insert into works (id, org_id, title) values ($1, $2, 'Org B Song')`, [
      workId,
      orgB,
    ]);
    await admin.query('COMMIT');

    try {
      const result = await withSession(userA, orgA, (c) =>
        c.query('select id from works where id = $1', [workId]),
      );
      expect(result.rows).toHaveLength(0);
    } finally {
      await admin.query('delete from works where id = $1', [workId]);
    }
  });

  it('org A cannot SELECT contributors on org B works', async () => {
    const workId = randomUUID();
    const contributorId = randomUUID();
    await admin.query('BEGIN');
    await admin.query(`insert into works (id, org_id, title) values ($1, $2, 'Org B Song')`, [
      workId,
      orgB,
    ]);
    await admin.query(
      `insert into contributors (id, work_id, org_id, name, phone, role, signature_ref)
       values ($1, $2, $3, 'Writer B', '+910000000000', 'songwriter', 'tok')`,
      [contributorId, workId, orgB],
    );
    await admin.query('COMMIT');

    try {
      const result = await withSession(userA, orgA, (c) =>
        c.query('select id from contributors where id = $1', [contributorId]),
      );
      expect(result.rows).toHaveLength(0);
    } finally {
      await admin.query('delete from works where id = $1', [workId]);
    }
  });
});

describe('Profiles: cross-org isolation on artist_roles and roster', () => {
  it('org A cannot SELECT a role declared by an org B artist', async () => {
    const artistRoleId = randomUUID();
    await admin.query('BEGIN');
    await admin.query(
      `insert into artist_roles (id, artist_id, org_id, role, attributes)
       values ($1, $2, $3, 'vocalist', '{}'::jsonb)`,
      [artistRoleId, artistB, orgB],
    );
    await admin.query('COMMIT');

    try {
      const result = await withSession(userA, orgA, (c) =>
        c.query('select id from artist_roles where id = $1', [artistRoleId]),
      );
      expect(result.rows).toHaveLength(0);
    } finally {
      await admin.query('delete from artist_roles where id = $1', [artistRoleId]);
    }
  });

  it('org A cannot SELECT org B roster / commission data', async () => {
    await admin.query('BEGIN');
    await admin.query(
      `insert into roster (org_id, artist_id, commission_pct) values ($1, $2, 15)`,
      [orgB, artistB],
    );
    await admin.query('COMMIT');

    try {
      const result = await withSession(userA, orgA, (c) =>
        c.query('select artist_id from roster where org_id = $1', [orgB]),
      );
      expect(result.rows).toHaveLength(0);
    } finally {
      await admin.query('delete from roster where org_id = $1 and artist_id = $2', [orgB, artistB]);
    }
  });
});
