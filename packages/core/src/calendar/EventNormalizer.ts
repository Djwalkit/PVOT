/**
 * packages/core/src/calendar/EventNormalizer.ts
 * PVOT — Google Calendar → Meeting Normalizer
 *
 * Converts raw GoogleCalendarEvent API responses into the canonical
 * Meeting interface. This is the single boundary where Google's
 * schema is translated into PVOT's internal language.
 *
 * All timezone handling happens here via TimezoneUtils.
 * Conflict detection is run AFTER normalization by ConflictDetector.
 */

import type {
  Meeting,
  Attendee,
  GoogleCalendarEvent,
  GoogleAttendee,
  ConnectedAccount,
} from '../types';
import { toUtcIso }          from '../timezone/TimezoneUtils';
import { extractVideoLinks, getPrimaryVideoLink } from './LinkExtractor';

// ─── NORMALIZER ───────────────────────────────────────────────────────────────

/**
 * Normalize a single raw Google Calendar event for a given account.
 * The `userTimezone` is the PVOT user's configured display timezone
 * (used as fallback when the event has no declared timezone).
 */
export function normalizeEvent(
  raw:         GoogleCalendarEvent,
  account:     ConnectedAccount,
  userTimezone: string,
): Meeting {
  const eventTimezone = raw.start.timeZone ?? raw.end.timeZone ?? userTimezone;

  const startUtc = toUtcIso(raw.start.dateTime, raw.start.date, eventTimezone, userTimezone);
  const endUtc   = toUtcIso(raw.end.dateTime,   raw.end.date,   eventTimezone, userTimezone);
  const isAllDay = !raw.start.dateTime && !!raw.start.date;

  const attendees  = normalizeAttendees(raw.attendees ?? []);
  const organizer  = raw.organizer ? normalizeAttendee(raw.organizer) : null;

  const allVideoLinks  = extractVideoLinks(raw);
  const primaryLink    = getPrimaryVideoLink(raw);

  const selfAttendee = attendees.find((a) => a.self);
  const selfRsvp     = selfAttendee
    ? (selfAttendee.responseStatus as Meeting['selfRsvp'])
    : null;

  const status = normalizeStatus(raw.status);

  return {
    // Identity
    id:            `${account.id}::${raw.id}`,
    googleEventId: raw.id,
    accountId:     account.id,

    // Time
    startUtc,
    endUtc,
    isAllDay,
    timezone: eventTimezone,

    // Content
    title:       sanitizeTitle(raw.summary, isAllDay),
    description: raw.description ?? null,
    location:    raw.location ?? null,
    attendees,
    organizer,

    // Extracted intelligence
    videoLink:     primaryLink,
    allVideoLinks,

    // Conflict (defaults — annotated by ConflictDetector later)
    isConflict:  false,
    conflictWith:[],
    hasNoBuffer: false,

    // Display metadata
    colorIndex:       account.colorIndex,
    calendarName:     account.displayName,
    recurringEventId: raw.recurringEventId ?? null,
    status,
    selfRsvp,

    // Source
    htmlLink: raw.htmlLink,
    raw,
  };
}

/**
 * Normalize an array of raw events, filtering out cancelled events
 * and sorting chronologically by start time.
 */
export function normalizeEvents(
  rawEvents: GoogleCalendarEvent[],
  account:   ConnectedAccount,
  userTimezone: string,
): Meeting[] {
  return rawEvents
    .filter((e) => e.status !== 'cancelled')
    .map((e) => normalizeEvent(e, account, userTimezone))
    .sort((a, b) => new Date(a.startUtc).getTime() - new Date(b.startUtc).getTime());
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function normalizeAttendees(attendees: GoogleAttendee[]): Attendee[] {
  return attendees.map(normalizeAttendee);
}

function normalizeAttendee(a: GoogleAttendee): Attendee {
  return {
    email:          a.email,
    displayName:    a.displayName ?? null,
    responseStatus: normalizeRsvp(a.responseStatus),
    self:           a.self ?? false,
    organizer:      a.organizer ?? false,
  };
}

function normalizeRsvp(raw: string): Attendee['responseStatus'] {
  const valid: Attendee['responseStatus'][] = ['accepted', 'declined', 'tentative', 'needsAction'];
  return valid.includes(raw as any) ? (raw as Attendee['responseStatus']) : 'needsAction';
}

function normalizeStatus(raw: string): Meeting['status'] {
  if (raw === 'confirmed')  return 'confirmed';
  if (raw === 'tentative')  return 'tentative';
  if (raw === 'cancelled')  return 'cancelled';
  return 'confirmed';
}

/**
 * Sanitize and provide fallback for missing event titles.
 * Never render "[No Title]" to an executive — use contextual fallbacks.
 */
function sanitizeTitle(summary: string | null, isAllDay: boolean): string {
  if (summary && summary.trim()) return summary.trim();
  return isAllDay ? 'All-Day Event' : 'Untitled Meeting';
}
