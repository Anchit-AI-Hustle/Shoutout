export default function HomePage() {
  return (
    <main
      style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 'var(--space-4)',
        padding: 'var(--space-5)',
        textAlign: 'center',
      }}
    >
      <h1 style={{ fontSize: 'var(--text-2xl)', margin: 0 }}>SHOUTOUT</h1>
      <p style={{ fontSize: 'var(--text-md)', color: 'var(--ink-soft)', maxWidth: 480 }}>
        A Shout is a call that someone answers. Building in public — put out a shout soon.
      </p>
    </main>
  );
}
