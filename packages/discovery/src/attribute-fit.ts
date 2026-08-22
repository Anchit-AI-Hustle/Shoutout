// The Collabs side of the one discovery engine (docs/02-ARCHITECTURE.md
// ADR-002) — same "one engine, weighted per use case" as Gigs' shortlist.ts,
// a different weighted call over role-attribute data instead of
// genre/city.
//
// docs/06-COLLABS.md names five attribute-fit signals: vocal range against
// the song's key, language against lyric language, timbre tags against
// mood, BPM comfort against the track, turnaround against the deadline.
// Only language overlap is implemented here — it's the one signal with a
// consistent shape across role families (packages/identity's voice and
// writing families both carry `languages: string[]`) and a matching field
// on the brief side. The other four need either semantic matching (timbre
// tags against a mood description — the doc's own "embeddings over
// MUSIC_BRIEF" plan, not built) or richer brief data this project doesn't
// capture yet (a target vocal key, a track's actual BPM). Flagged rather
// than faked with a placeholder number, same discipline as Gigs'
// scoreByGenreAndCity.

export interface AttributeFitComponents {
  languageFit: number;
}

export interface AttributeFitResult {
  score: number;
  components: AttributeFitComponents;
}

function languageFit(wanted: string[], candidate: string[]): number {
  if (wanted.length === 0) return 0.5; // no language requirement stated
  if (candidate.length === 0) return 0.4; // candidate hasn't declared any
  const candidateSet = new Set(candidate.map((l) => l.toLowerCase()));
  const overlap = wanted.filter((l) => candidateSet.has(l.toLowerCase())).length;
  return overlap / wanted.length;
}

export function scoreByLanguageFit(
  wantedLanguages: string[],
  candidateLanguages: string[],
): AttributeFitResult {
  const components: AttributeFitComponents = {
    languageFit: languageFit(wantedLanguages, candidateLanguages),
  };
  return { score: components.languageFit, components };
}
