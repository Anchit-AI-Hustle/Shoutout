// Design system. Tokens live in ./tokens.css. Two registers per
// docs/06-DESIGN-SYSTEM.md: warm for culture surfaces, precise for money —
// enforced by which components you reach for, not a mode switch.
export * from './currency';
export * from './zod-form';
export * from './components/StatusPill';
export * from './components/EmptyState';
export * from './components/MoneyValue';
export * from './components/SplitBar';
export * from './components/ScoreBreakdown';
export * from './components/DataList';
export * from './components/EqualizerAccent';
export * from './components/Reveal';
export * from './components/TiltCard';
export * from './components/Waveform';
// CollabComposer (docs/13-DESIGN-SYSTEM.md) replaces the old ShoutComposer,
// removed with the polymorphic Shout object (migration 008). zod-form.ts
// (the schema-introspection utility ShoutComposer used) is kept — it's
// generic and CollabComposer will need the same approach.
