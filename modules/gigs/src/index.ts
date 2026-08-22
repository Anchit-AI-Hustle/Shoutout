// Gigs — briefs, shortlists, quotes, holds, riders (docs/02-ARCHITECTURE.md).
// Route handlers import only from here, never reaching into
// @shoutout/calendar or @shoutout/discovery directly — this module is the
// single orchestration point over those shared services.
export * from './errors';
export * from './briefs';
export * from './shortlist';
export * from './quotes';
export * from './benchmark';
export * from './riders';
export * from './organiser';
export {
  createHold,
  challengeHold,
  confirmHold,
  releaseHold,
  listCalendar,
} from '@shoutout/calendar';
export type { CreateHoldInput, CalendarEntry } from '@shoutout/calendar';
