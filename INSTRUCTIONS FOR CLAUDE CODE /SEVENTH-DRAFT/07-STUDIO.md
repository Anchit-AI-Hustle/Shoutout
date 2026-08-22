# 07 — Studio

Make music, and — more importantly — **describe the sound you want to someone else**.

## Positioning discipline

**Never market ShoutOut as an AI music generator.** The market is crowded, margins are poor, and it actively repels the working musicians who are the entire supply side.

Studio is a **communication tool**. The hardest problem in music collaboration is describing a sound in words. Producers, artists and brands all fail at it, and every mismatched collab traces back to it. You don't describe the reference — you generate it and attach it.

## Two assets merged, not one ported

| Source                                        | Contributes                                                                                                                                                                                     | Becomes                                     |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| **MusicGenAI / MuseForge Pro** _(front half)_ | 19-field → deterministic intent JSON semantic engine; AI-suggest that **enhances** existing input rather than replacing it; Web Audio in-browser synthesis; album mode with semantic drift      | `packages/intent` + instant scratch preview |
| **Third Eye music studio** _(back half)_      | Nine-stage pipeline; Redis + BullMQ queue with worker execution; Python ML inference via subprocess; section-by-section generation; FFmpeg post-processing; S3 lifecycle; separate video worker | `packages/studio-core` + `apps/workers`     |

**Neither is complete alone.** One captures intent and previews instantly; the other runs the durable, queue-driven pipeline that actually produces and stores finished audio.

## The nine-stage pipeline — carried over intact

No stage is skippable or combinable.

```
1  Input Freeze          input locked, no mutation past this point
2  Text to Meaning       semantic analysis
3  MUSIC BRIEF OBJECT    ← this IS the intent schema. The seam.
4  Structure Planning    sections, arrangement, arc
5  Section-by-Section    not single-pass — this is what yields usable stems
6  Combine Sections
7  Decode to Audio
8  Post-Processing       FFmpeg; also where sync variants are cut
9  Encode + Persist      object storage, lifecycle managed
```

**Stage 3 is where the two projects join.** MusicGenAI produces the brief object; the Third Eye pipeline consumes it from stage 4. Both were already built around the same object without being connected — that is why the merge is cheap.

**Before porting, confirm:** which repo the nine-stage pipeline actually lives in — standalone, or inside `The-Third-Eye` alongside the JARVIS tool system — and whether the Python ML stage is real inference or currently scaffolded. That single answer moves the estimate by weeks.

## `MUSIC_BRIEF` — one schema, four consumers

The intent object is not a generation artifact. It is a **universal sonic brief** used by:

| Consumer         | Uses it for                                                                          |
| ---------------- | ------------------------------------------------------------------------------------ |
| Studio pipeline  | Stage 3 input — generating the audio                                                 |
| Collabs matching | Matching a request to vocalists, writers, players on genre, BPM, key, mood, language |
| Gigs matching    | Genre and energy fit between an organiser's brief and an artist's actual sound       |
| Credits / sync   | Tagging and retrieving catalogue works                                               |

One schema, four consumers. **This is the strongest reason to fold both projects in rather than run them beside** — the semantic engine is worth more as shared infrastructure than as any single app's internals.

## Features

| Feature                 | Serves                        | Built from                                                                                                                                                                                                                     |
| ----------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Reference generator** | Collab requests, brand briefs | Full nine-stage pipeline. Generate a 30-second reference to attach instead of writing "make it vibey". Three variations so the user picks a direction.                                                                         |
| **Scratch preview**     | Fast iteration                | MuseForge Web Audio — instant, in-browser, no queue. Commit to the real pipeline only when the direction is right.                                                                                                             |
| **Audio analysis**      | **Every match engine**        | Essentia/librosa in `apps/workers`. BPM, key, mode, genre, mood, loudness, quality gate. Runs on **every audio upload anywhere in the product** — this is the quiet backbone that makes matching work without manual metadata. |
| **Stem separation**     | Collabs, remix, live backing  | Extends to uploaded audio. Outputs vocals, drums, bass, other — stored versioned in the Room.                                                                                                                                  |
| **Sync variants**       | Sync licensing revenue        | Stage 8 — auto-cut to 6s / 15s / 30s preserving the hook, not truncating.                                                                                                                                                      |
| **Demo-to-brief**       | Collabs, Profiles             | Voice note → BPM/key/mood → drafted brief → pre-filled composer.                                                                                                                                                               |
| **Album mode**          | Artist planning               | Controlled semantic drift across tracks for coherent multi-track projects.                                                                                                                                                     |
| **Video assets**        | Promotion                     | Third Eye's separate video worker — **fails gracefully without affecting audio job status.**                                                                                                                                   |

## Queue rules

Generation **never** blocks a request. It is a job, not a synchronous call.

- Job status endpoint plus realtime subscription
- Per-org rate limits and a cost ceiling
- Graceful degradation: if generation fails, the collab request still posts without a reference
- BullMQ, separate from Inngest — different jobs, different tools, never merged

## Provenance

Every generated asset carries: generated flag, model, brief object, timestamp, commissioning human.

**Enforced in code, not policy:**

- Generated audio is never presented as a finished work
- Generated audio never enters the sync catalogue as a licensable asset without human authorship recorded in Credits
- Provenance travels with the file into Rooms and exports
- Disclosed in the UI wherever a generated asset appears

## Acceptance criteria

- Reference generation returns three options, asynchronously, without blocking any request
- Every audio upload anywhere in the product is auto-tagged with BPM, key and genre
- Voice note to structured brief in under 60 seconds
- A failed generation never blocks the collab request from posting
- No generated asset can reach the sync catalogue without recorded human authorship
