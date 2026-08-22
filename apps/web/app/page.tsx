import { createAnonClient } from '@shoutout/db';

export const dynamic = 'force-dynamic';

interface Shout {
  id: string;
  type: string;
  title: string;
  city: string | null;
  deadline: string | null;
  created_at: string;
}

async function getOpenShouts(): Promise<Shout[]> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) return [];

  const supabase = createAnonClient(supabaseUrl, supabaseAnonKey);
  const { data } = await supabase
    .from('shouts')
    .select('id, type, title, city, deadline, created_at')
    .eq('status', 'open')
    .eq('visibility', 'open')
    .order('created_at', { ascending: false })
    .limit(20);

  return data ?? [];
}

export default async function HomePage() {
  const shouts = await getOpenShouts();

  return (
    <main
      style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 'var(--space-5)',
        padding: 'var(--space-5)',
        textAlign: 'center',
      }}
    >
      <div style={{ marginTop: 'var(--space-7)' }}>
        <h1 style={{ fontSize: 'var(--text-2xl)', margin: 0 }}>SHOUTOUT</h1>
        <p style={{ fontSize: 'var(--text-md)', color: 'var(--ink-soft)', maxWidth: 480 }}>
          A Shout is a call that someone answers.
        </p>
      </div>

      <section style={{ width: '100%', maxWidth: 480, textAlign: 'left' }}>
        <h2 style={{ fontSize: 'var(--text-base)', color: 'var(--ink-soft)' }}>
          Open shouts ({shouts.length})
        </h2>
        {shouts.length === 0 ? (
          <p style={{ color: 'var(--ink-soft)' }}>No shouts yet — put out a shout soon.</p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 'var(--space-2)' }}>
            {shouts.map((shout) => (
              <li
                key={shout.id}
                style={{
                  border: '1px solid var(--line)',
                  borderRadius: 8,
                  padding: 'var(--space-3)',
                }}
              >
                <strong>{shout.title}</strong>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-soft)' }}>
                  {shout.type}
                  {shout.city ? ` · ${shout.city}` : ''}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
