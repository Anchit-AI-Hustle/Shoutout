// The one discovery engine (docs/02-ARCHITECTURE.md ADR-002: "Gigs and
// Collabs are the same matching operation. Two implementations would
// diverge within a quarter.") What's actually shared is the scoring math —
// DB reads (which table holds "the brief", which holds "the candidate")
// differ per module, so those stay in modules/gigs (and later
// modules/collabs), which call this pure function per candidate.

export interface ScoreComponents {
  genreFit: number;
  cityFit: number;
}

export interface ScoreResult {
  score: number;
  components: ScoreComponents;
}

// Weights are documented, not hidden — docs/12-API.md: "Always return
// score_components — an unexplained ranking is not trusted." Only two of
// the five signals docs/05-GIGS.md names for Gigs are computable today:
// genre fit and city match, both from data that already exists
// (artists.genres, artists.home_city). City fan density (needs Promotion's
// fan data) and organiser settlement reliability (needs Trust/Payments)
// are left out of `components` entirely rather than faked with a
// placeholder number — there is nothing real to compute them from yet.
// Live availability (the fifth named signal) is enforced by the caller as
// a hard exclusion, not a score component (docs/05-GIGS.md: "Never surface
// an artist already held on that date").
const WEIGHTS = { genreFit: 0.65, cityFit: 0.35 };

function genreFit(wantedGenres: string[], candidateGenres: string[]): number {
  if (wantedGenres.length === 0) return 0.5; // no signal either way
  const candidateSet = new Set(candidateGenres.map((g) => g.toLowerCase()));
  const overlap = wantedGenres.filter((g) => candidateSet.has(g.toLowerCase())).length;
  return overlap / wantedGenres.length;
}

function cityFit(wantedCity: string, candidateCity: string | null): number {
  if (!candidateCity) return 0.4; // unknown home city — neither penalised nor rewarded much
  return candidateCity.trim().toLowerCase() === wantedCity.trim().toLowerCase() ? 1 : 0.2;
}

export function scoreByGenreAndCity(
  wanted: { genres: string[]; city: string },
  candidate: { genres: string[]; city: string | null },
): ScoreResult {
  const components: ScoreComponents = {
    genreFit: genreFit(wanted.genres, candidate.genres),
    cityFit: cityFit(wanted.city, candidate.city),
  };
  const score = components.genreFit * WEIGHTS.genreFit + components.cityFit * WEIGHTS.cityFit;
  return { score, components };
}
