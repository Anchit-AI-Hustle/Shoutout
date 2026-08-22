'use client';

import { useEffect, useState, type ChangeEvent, type CSSProperties } from 'react';
import Link from 'next/link';
import { ROLE_FAMILIES, type RoleFamily } from '@shoutout/identity';
import { EqualizerAccent, StatusPill, describeAttributeSchema } from '@shoutout/ui';

// Culture surface (docs/13-DESIGN-SYSTEM.md) — staggered rise-in, same
// pattern as the public /a/[slug] page.
function rise(step: number): CSSProperties {
  return { '--motion-delay': step } as CSSProperties;
}

interface Profile {
  id: string;
  stage_name: string;
  home_city: string | null;
  genres: string[];
  bio: string | null;
  roles: { role: string; attributes: Record<string, unknown> }[];
}

interface ApiErrorResponse {
  error?: { message?: string };
}

const inputClass =
  'min-h-11 w-full rounded-md border border-line bg-surface px-3 text-base text-ink focus:outline-none focus:ring-2 focus:ring-trust';
const labelClass = 'text-sm text-ink-soft';

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [stageName, setStageName] = useState('');
  const [homeCity, setHomeCity] = useState('');
  const [bio, setBio] = useState('');
  const [genres, setGenres] = useState('');
  const [family, setFamily] = useState<RoleFamily>('voice');
  const [role, setRole] = useState<string>(ROLE_FAMILIES.voice.roles[0]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    const res = await fetch('/api/profiles/me');
    if (res.status === 404) return; // no profile yet — that's fine
    const json = (await res.json()) as Profile & ApiErrorResponse;
    if (res.ok) {
      setProfile(json);
      setStageName(json.stage_name);
      setHomeCity(json.home_city ?? '');
      setBio(json.bio ?? '');
      setGenres(json.genres.join(', '));
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function saveProfile() {
    setError(null);
    setSaving(true);
    try {
      const res = await fetch('/api/profiles/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stageName,
          homeCity: homeCity || undefined,
          bio: bio || undefined,
          genres: genres
            .split(',')
            .map((g) => g.trim())
            .filter(Boolean),
        }),
      });
      const json = (await res.json()) as ApiErrorResponse;
      if (!res.ok) {
        setError(json.error?.message ?? 'Could not save profile');
        return;
      }
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function addRole() {
    setError(null);
    try {
      const res = await fetch('/api/profiles/roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, attributes: {} }),
      });
      const json = (await res.json()) as ApiErrorResponse;
      if (!res.ok) {
        setError(json.error?.message ?? 'Could not add role');
        return;
      }
      await load();
    } catch {
      setError('Could not add role');
    }
  }

  const familyConfig = ROLE_FAMILIES[family];
  // zod-form.ts's introspection — the same generic approach ShoutComposer
  // used, applied here to a role's attribute schema instead of a Shout
  // type's. Attribute editing itself isn't wired up yet (roles are added
  // with empty attributes for now); this proves the fields render per role.
  const attributeFields = describeAttributeSchema(familyConfig.attributeSchema);

  return (
    <main className="mx-auto flex max-w-xl flex-col gap-8 px-4 py-12">
      <div className="motion-rise" style={rise(0)}>
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-semibold text-ink">Your profile</h1>
          <EqualizerAccent bars={3} />
        </div>
        <p className="text-sm text-ink-soft">
          One account, many roles — matching happens per role, not per person.
        </p>
        <div className="mt-2 flex gap-4">
          <Link href="/gigs" className="text-sm text-trust">
            Gigs pipeline →
          </Link>
          <Link href="/collabs" className="text-sm text-trust">
            Collabs →
          </Link>
        </div>
      </div>

      <section className="motion-rise flex flex-col gap-3" style={rise(1)}>
        <div>
          <label className={labelClass}>Stage name</label>
          <input
            className={inputClass}
            value={stageName}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setStageName(e.target.value)}
          />
        </div>
        <div>
          <label className={labelClass}>Home city</label>
          <input
            className={inputClass}
            value={homeCity}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setHomeCity(e.target.value)}
          />
        </div>
        <div>
          <label className={labelClass}>Genres</label>
          <input
            className={inputClass}
            placeholder="comma separated"
            value={genres}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setGenres(e.target.value)}
          />
        </div>
        <div>
          <label className={labelClass}>Bio</label>
          <textarea
            className={inputClass}
            rows={3}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
          />
        </div>
        <button
          type="button"
          onClick={saveProfile}
          disabled={saving}
          className="motion-lift min-h-11 rounded-md bg-signal px-4 font-medium text-surface disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save profile'}
        </button>
      </section>

      {profile ? (
        <section className="motion-rise flex flex-col gap-3" style={rise(2)}>
          <h2 className="text-sm font-medium text-ink-soft">Roles</h2>
          <ul className="flex flex-wrap gap-2">
            {profile.roles.map((r) => (
              <li key={r.role} className="motion-lift rounded-full">
                <StatusPill label={r.role.replace(/_/g, ' ')} tone="active" />
              </li>
            ))}
          </ul>

          <div className="flex gap-2">
            <select
              className={inputClass}
              value={family}
              onChange={(e: ChangeEvent<HTMLSelectElement>) => {
                const f = e.target.value as RoleFamily;
                setFamily(f);
                setRole(ROLE_FAMILIES[f].roles[0]);
              }}
            >
              {(Object.keys(ROLE_FAMILIES) as RoleFamily[]).map((f) => (
                <option key={f} value={f}>
                  {ROLE_FAMILIES[f].label}
                </option>
              ))}
            </select>
            <select
              className={inputClass}
              value={role}
              onChange={(e: ChangeEvent<HTMLSelectElement>) => setRole(e.target.value)}
            >
              {familyConfig.roles.map((r) => (
                <option key={r} value={r}>
                  {r.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </div>
          <p className="text-xs text-ink-soft">
            {attributeFields.length} match attribute{attributeFields.length === 1 ? '' : 's'} for
            this role family ({attributeFields.map((f) => f.key).join(', ')})
          </p>
          <button
            type="button"
            onClick={addRole}
            className="motion-lift min-h-11 self-start rounded-md border border-line px-4 text-sm text-ink-soft"
          >
            + Declare this role
          </button>
        </section>
      ) : (
        <p className="text-sm text-ink-soft">Save your profile first, then declare roles.</p>
      )}

      {error ? (
        <p className="text-sm text-signal" role="alert">
          {error}
        </p>
      ) : null}
    </main>
  );
}
