import type { GenerationPlan, MusicBrief, TrackPlan } from './brief';

// The plan a human approves before any compute is spent.
//
// Pattern borrowed from Flick, which surfaces a compact scene plan for
// approval before rendering. The equivalent here is a song plan: structure,
// section lengths, transitions, and — for albums — the drift applied to
// each track.
//
// It is plain text on purpose. The reader is deciding "is this the song I
// asked for", and a JSON blob makes that harder, not easier. If someone
// cannot spot a wrong structure in this, the plan has failed at its only
// job.

function bar(n: number) {
  return `${n} bar${n === 1 ? '' : 's'}`;
}

function describeBrief(brief: MusicBrief): string[] {
  const lines = [
    `${brief.genre}${brief.subgenres.length ? ` (${brief.subgenres.join(', ')})` : ''}`,
    `${brief.bpm} BPM · ${brief.key} ${brief.mode}`,
  ];
  if (brief.mood.length) lines.push(`Mood: ${brief.mood.join(', ')}`);
  if (brief.instrumentation.length) lines.push(`Instruments: ${brief.instrumentation.join(', ')}`);
  lines.push(
    brief.vocals.present
      ? `Vocals: ${
          [brief.vocals.style, brief.vocals.register, brief.vocals.language]
            .filter(Boolean)
            .join(', ') || 'yes'
        }`
      : 'Instrumental',
  );
  if (brief.reference_note) lines.push(`Reference: ${brief.reference_note}`);
  return lines;
}

function describeTrack(track: TrackPlan, index: number, showIndex: boolean): string[] {
  const totalBars = track.sections.reduce((n, s) => n + s.bars, 0);
  const head = showIndex ? `${index}. ${track.title}` : track.title;
  const lines = [`${head}  —  ${track.sections.length} sections, ${bar(totalBars)}`];

  for (const [i, s] of track.sections.entries()) {
    const bits = [`${bar(s.bars)}`, s.density];
    if (s.transition_in) bits.push(`in: ${s.transition_in.replace(/_/g, ' ')}`);
    lines.push(
      `   ${String(i + 1).padStart(2, '0')}  ${s.kind.replace(/_/g, ' ').padEnd(11)} ${bits.join(' · ')}`,
    );
    if (s.notes) lines.push(`       ↳ ${s.notes}`);
  }
  return lines;
}

/**
 * Renders the plan as text for approval.
 *
 * Album drift is shown per track as a concrete delta rather than a
 * coefficient, because "+12 BPM, brighter" is reviewable and
 * "tempo_pct: 0.1" is not.
 */
export function renderPlanText(plan: GenerationPlan): string {
  const out: string[] = [];
  out.push(plan.title);
  out.push('='.repeat(plan.title.length));
  out.push('');
  out.push(...describeBrief(plan.brief));
  out.push('');

  const isAlbum = plan.kind === 'album';
  if (isAlbum) {
    out.push(`${plan.tracks.length} tracks`);
    out.push('');
  }

  for (const [i, track] of plan.tracks.entries()) {
    out.push(...describeTrack(track, i + 1, isAlbum));

    if (isAlbum) {
      const step = i; // track 1 is the reference point, drift accumulates
      const d = plan.brief.drift;
      const deltas: string[] = [];
      if (d.tempo_pct) {
        const bpm = Math.round(plan.brief.bpm * (1 + d.tempo_pct * step));
        if (bpm !== plan.brief.bpm) deltas.push(`${bpm} BPM`);
      }
      if (d.brightness) deltas.push(d.brightness * step > 0 ? 'brighter' : 'darker');
      if (d.energy) deltas.push(d.energy * step > 0 ? 'more energy' : 'calmer');
      if (deltas.length) out.push(`   drift: ${deltas.join(', ')}`);
    }
    out.push('');
  }

  const sections = plan.tracks.reduce((n, t) => n + t.sections.length, 0);
  out.push(`${sections} sections will be generated. Nothing renders until you approve this.`);
  return out.join('\n');
}

/** One-line summary for a list view. */
export function summarisePlan(plan: GenerationPlan): string {
  const sections = plan.tracks.reduce((n, t) => n + t.sections.length, 0);
  return plan.kind === 'album'
    ? `${plan.tracks.length} tracks · ${sections} sections · ${plan.brief.bpm} BPM ${plan.brief.key}`
    : `${sections} sections · ${plan.brief.bpm} BPM ${plan.brief.key}`;
}
