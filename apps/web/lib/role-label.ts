// Roles the spec writes as acronyms (docs/04-PROFILES.md's role table).
// Naive capitalisation turns these into "Dj", "Md", "Foh engineer".
const ACRONYMS: Record<string, string> = {
  dj: 'DJ',
  md: 'MD',
  dop: 'DOP',
  vfx: 'VFX',
  foh: 'FOH',
};

/** 'backing_vocalist' -> 'Backing vocalist'. The vocabulary is stored snake_case. */
export function roleLabel(role: string): string {
  const words = role.split('_').map((w, i) => {
    const acronym = ACRONYMS[w];
    if (acronym) return acronym;
    return i === 0 ? w.charAt(0).toUpperCase() + w.slice(1) : w;
  });
  return words.join(' ');
}

// Roles in the `players` and `engineering` families are named after the
// instrument or the task, not the person - so the label is not a noun you can
// pluralise. Adding "s" to them produced page titles like "Tablas in Chennai
// to book" and "Mixs in Mumbai", which is what shipped the moment /artists
// started generating titles from filters.
//
// Everything absent from this map pluralises correctly with a plain "s"
// (vocalists, songwriters, managers), so only the exceptions are listed.
const PLURAL_OVERRIDES: Record<string, string> = {
  // Players: instrument names.
  guitar: 'Guitarists',
  bass: 'Bassists',
  drums: 'Drummers',
  keys: 'Keys players',
  tabla: 'Tabla players',
  sitar: 'Sitar players',
  flute: 'Flautists',
  strings: 'String players',
  brass: 'Brass players',
  percussion: 'Percussionists',
  // Engineering: task names.
  mix: 'Mix engineers',
  mastering: 'Mastering engineers',
  tuning: 'Tuning engineers',
  // Stage and voice: labels that read wrong with a bare "s".
  hype: 'Hype artists',
  voice_over: 'Voice over artists',
  backline_tech: 'Backline techs',
};

/**
 * The plural person-noun for a role, for headings and page titles:
 * 'tabla' -> 'Tabla players', 'vocalist' -> 'Vocalists'.
 */
export function roleNounPlural(role: string): string {
  return PLURAL_OVERRIDES[role] ?? `${roleLabel(role)}s`;
}
