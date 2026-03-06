/**
 * packages/ui/src/lanes/GlassLane.tsx
 * PVOT — Executive Command Center · Calendar Lane  v13
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * GEOMETRY CONTRACT
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * HOUR_HEIGHT       = 54px    One clock-hour = 54px of vertical space
 * GRID_START_HOUR   = 0       Canvas begins at 00:00 (midnight)
 * GRID_END_HOUR     = 24      Canvas ends at 24:00 (next midnight)
 * GRID_TOTAL_HEIGHT = 1296px  24 × 54 = 1296px pure event area
 *
 * PIXEL-PERFECT GEOMETRY:
 *   topPx    = Math.round((startMins  / 60) * HOUR_HEIGHT)
 *   heightPx = Math.round((durationMins / 60) * HOUR_HEIGHT)
 *   All coordinates snap to the nearest physical pixel — zero sub-pixel blur.
 *
 * LANE IDENTITY HEADER (v14 — Dual-Tier + Structural Ownership):
 *   Each lane column has a 44px sticky header that exactly mirrors the
 *   TimeRuler's 44px sticky spacer.  Both use LANE_HEADER_HEIGHT.
 *   "00:00" ruler label is at scroll-y = LANE_HEADER_HEIGHT.
 *   Canvas topPx=0 is at scroll-y = LANE_HEADER_HEIGHT.
 *
 *   DUAL-TIER IDENTITY:
 *     Row 1: laneLabel (alias/name) — bold 11px, high-contrast textPri
 *     Row 2: laneEmail (source account) — 9px, muted mono, truncates
 *     Privacy mode: both rows redacted with block glyphs.
 *
 *   STRUCTURAL OWNERSHIP:
 *     Header background = accent color at 8% opacity — a subtle tint
 *     that "claims" the vertical column space without competing with cards.
 *     Left border = 2px accent line — lane ownership mark.
 *     Bottom border = 1px divider — clean separation from grid.
 *     The tint + border system prevents the grid from floating as
 *     an undifferentiated spreadsheet.
 *
 *   The event count badge was REMOVED from the lane header — it caused a
 *   "ghost number" artifact in the empty grid area.  Count is in the
 *   command strip instead.
 *
 * CARD INFORMATION DENSITY (v13):
 *   JOIN link and attendee count are now "etched" into the card:
 *   • A green camera dot appears in the time row when a videoLink is present
 *   • Attendee count appears in the duration badge (e.g. "28 · 1h 30m")
 *   • These are visible in COMPACT tier (≥27px) and above
 *   • No separate "↗ Join" widget needed — info density without UI noise
 *
 * CARD CONTENT TIERS (HOUR_HEIGHT=54):
 *   FULL    (≥44px) → ≥48min: time row + title rows + join/live
 *   COMPACT (≥27px) → ≥30min: single line "HH:MM · Title · [dot]"
 *   MICRO   (<27px) → <30min: title only, 9px, no waste
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * PRIVACY MODE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Internal to MeetingCard — no external overlay.
 * Privacy overrides: BG → purpleSoft, stripe → purple, content → "BUSY".
 * Hover / click events are suppressed. Border-bleed impossible.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * BUG HISTORY
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * BUG 1 (v10) — Tomorrow's events bleeding: fixed by viewDate filter in
 *   calculateEventLayouts.
 * BUG 2 (v10) — 116px misalignment: fixed by matching spacers.
 * BUG 3 (v12) — paddingTop+marginTop negative hack: replaced with proper
 *   position:sticky spacer identical to TimeRuler.
 * BUG 4 (v13) — Ghost count badge artifact: event count removed from
 *   lane header. Lane header reduced to 32px label-only.
 * ═══════════════════════════════════════════════════════════════════════════
 */

'use client';

import { useMemo }         from 'react';
import type { LaneResult } from '@pvot/query/useLaneQuery';
import type { Conflict }   from '@pvot/core/engine/ConflictEngine';
import type { Meeting }    from '@pvot/core/types';

// ─── DESIGN TOKENS ────────────────────────────────────────────────────────────

const DS = {
  canvas:     '#F5F4F0',
  surface:    '#FFFFFF',
  accent:     '#E8441A',
  divider:    '#DAD6CE',
  textPri:    '#1A1A18',
  textSec:    '#6B6860',
  textMut:    '#A8A49F',
  red:        '#DC2626',
  amber:      '#D4830A',
  green:      '#2D9E5F',
  purple:     '#7C3AED',
  purpleSoft: '#F3EEFF',
  body:       '"IBM Plex Sans", system-ui, sans-serif',
  mono:       '"IBM Plex Mono", monospace',
  ease:       'cubic-bezier(0.4, 0, 0.2, 1)',
} as const;

// Lane colour palette — index wraps for lanes beyond 5
const LANE_ACCENTS = ['#E8441A', '#D4830A', '#2D9E5F', '#7C3AED', '#0891B2'] as const;
const LANE_SOFT    = ['#FFF1ED', '#FFF5E0', '#EDFAF3', '#F3EEFF', '#E0F7FF'] as const;

// ─── GEOMETRY CONSTANTS ───────────────────────────────────────────────────────

export const HOUR_HEIGHT       = 54;
export const GRID_START_HOUR   = 0;
export const GRID_END_HOUR     = 24;
export const GRID_TOTAL_HEIGHT = (GRID_END_HOUR - GRID_START_HOUR) * HOUR_HEIGHT; // 1296px

export const RULER_WIDTH = 52;

/**
 * LANE_HEADER_HEIGHT = 44px
 *
 * This is the ONE shared constant that governs:
 *   • The height of the sticky dual-tier lane-identity header in GlassLane
 *   • The height of the sticky blank spacer in TimeRuler
 *   • The auto-scroll offset arithmetic in page.tsx
 *
 * Both components render a sticky div of exactly this height.
 * "00:00" ruler label sits at scroll-y = LANE_HEADER_HEIGHT.
 * Canvas origin (topPx=0) sits at scroll-y = LANE_HEADER_HEIGHT.
 * Perfect pixel alignment, zero drift.
 *
 * 44px = 8px top pad + 11px alias + 3px gap + 9px email + 13px bottom pad
 * (generous breathing room for the dual-tier identity block)
 */
export const LANE_HEADER_HEIGHT = 44;

const MIN_CARD_HEIGHT_PX = 14; // floor so even 1-minute events are tappable

const GRID_HOURS = Array.from(
  { length: GRID_END_HOUR - GRID_START_HOUR },
  (_, i) => GRID_START_HOUR + i,
);

// ─── TIMEZONE HELPERS ─────────────────────────────────────────────────────────

function utcToLocalParts(
  utcIso:   string,
  timezone: string,
): { hour: number; minute: number } | null {
  try {
    const d = new Date(utcIso);
    if (isNaN(d.getTime())) return null;

    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour:     'numeric',
      minute:   'numeric',
      hour12:   false,
    }).formatToParts(d);

    const raw    = Number(parts.find(p => p.type === 'hour')?.value   ?? '0');
    const minute = Number(parts.find(p => p.type === 'minute')?.value ?? '0');

    return { hour: raw === 24 ? 0 : raw, minute };
  } catch {
    return null;
  }
}

function utcToLocalDateStr(utcIso: string, timezone: string): string {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year:     'numeric',
      month:    '2-digit',
      day:      '2-digit',
    }).formatToParts(new Date(utcIso));
    const g = (t: string) => parts.find(p => p.type === t)?.value ?? '00';
    return `${g('year')}-${g('month')}-${g('day')}`;
  } catch {
    return '';
  }
}

// ─── DISPLAY HELPERS ──────────────────────────────────────────────────────────

function fmtTime(utcIso: string, timezone: string): string {
  try {
    return new Intl.DateTimeFormat('en-GB', {
      hour:     '2-digit',
      minute:   '2-digit',
      hour12:   false,
      timeZone: timezone,
    }).format(new Date(utcIso));
  } catch {
    return '--:--';
  }
}

function fmtDuration(startUtc: string, endUtc: string): string {
  try {
    const mins = Math.round(
      (new Date(endUtc).getTime() - new Date(startUtc).getTime()) / 60_000,
    );
    if (mins < 60) return `${mins}m`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m === 0 ? `${h}h` : `${h}h\u202f${m}m`;
  } catch {
    return '';
  }
}

function isHappeningNow(startUtc: string, endUtc: string, timeOffsetMs = 0): boolean {
  try {
    const now = Date.now() + timeOffsetMs;
    return now >= new Date(startUtc).getTime() && now <= new Date(endUtc).getTime();
  } catch {
    return false;
  }
}

// ─── POSITIONED EVENT TYPE ────────────────────────────────────────────────────

export type PositionedEvent = {
  event:       Meeting;
  topPx:       number;
  heightPx:    number;
  widthPct:    number;
  leftPct:     number;
  hasConflict: boolean;
};

// ─── LAYOUT ALGORITHM ─────────────────────────────────────────────────────────
//
// Pipeline:
//   1. Filter to events whose local start date === viewDate
//   2. Convert UTC → local {startMins, endMins}
//   3. Sort by start time (ties broken by longest duration first)
//   4. Sweep-line cluster detection
//   5. Greedy column assignment within each cluster
//   6. Emit PositionedEvent with pixel coordinates + width/left percentages

function calculateEventLayouts(
  events:    Meeting[],
  timezone:  string,
  conflicts: Conflict[],
  viewDate:  string,
): PositionedEvent[] {
  if (!events || events.length === 0) return [];

  const mapped = events.map(ev => {
    if (utcToLocalDateStr(ev.startUtc, timezone) !== viewDate) return null;

    const localStart = utcToLocalParts(ev.startUtc, timezone);
    const localEnd   = utcToLocalParts(ev.endUtc,   timezone);
    if (!localStart || !localEnd) return null;

    const startMins = localStart.hour * 60 + localStart.minute;
    let   endMins   = localEnd.hour   * 60 + localEnd.minute;

    if (endMins <= startMins && localEnd.hour === 0) endMins = 24 * 60;
    else if (endMins <= startMins)                   endMins = startMins + 30;

    return { event: ev, startMins, endMins, durationMins: endMins - startMins };
  }).filter(Boolean) as {
    event: Meeting; startMins: number; endMins: number; durationMins: number;
  }[];

  mapped.sort((a, b) =>
    a.startMins !== b.startMins
      ? a.startMins - b.startMins
      : b.endMins   - a.endMins,
  );

  const clusters: (typeof mapped)[] = [];
  let   currentCluster: typeof mapped = [];
  let   clusterEnd = 0;

  for (const item of mapped) {
    if (currentCluster.length > 0 && item.startMins >= clusterEnd) {
      clusters.push(currentCluster);
      currentCluster = [];
      clusterEnd     = 0;
    }
    currentCluster.push(item);
    clusterEnd = Math.max(clusterEnd, item.endMins);
  }
  if (currentCluster.length > 0) clusters.push(currentCluster);

  const positioned: PositionedEvent[] = [];

  for (const cluster of clusters) {
    const columns: (typeof mapped)[] = [];

    for (const item of cluster) {
      let placed = false;
      for (let c = 0; c < columns.length; c++) {
        const last = columns[c][columns[c].length - 1];
        if (item.startMins >= last.endMins) {
          columns[c].push(item);
          (item as any)._col = c;
          placed = true;
          break;
        }
      }
      if (!placed) {
        (item as any)._col = columns.length;
        columns.push([item]);
      }
    }

    const maxCols = columns.length;

    for (const item of cluster) {
      positioned.push({
        event:    item.event,
        topPx:    Math.round((item.startMins   / 60) * HOUR_HEIGHT),
        heightPx: Math.max(MIN_CARD_HEIGHT_PX, Math.round((item.durationMins / 60) * HOUR_HEIGHT)),
        widthPct: 100 / maxCols,
        leftPct:  (item as any)._col * (100 / maxCols),
        hasConflict: conflicts.some(
          c => c.eventA?.id === item.event.id || c.eventB?.id === item.event.id,
        ),
      });
    }
  }

  return positioned;
}

// ─── HOUR GRID LINES ──────────────────────────────────────────────────────────

function HourGrid() {
  return (
    <>
      {GRID_HOURS.map(h => (
        <div
          key={`h-${h}`}
          aria-hidden
          style={{
            position:      'absolute',
            left:          0,
            right:         0,
            top:           (h - GRID_START_HOUR) * HOUR_HEIGHT,
            height:        1,
            background:    DS.divider,
            opacity:       0.9,
            pointerEvents: 'none',
          }}
        />
      ))}
      {GRID_HOURS.map(h => (
        <div
          key={`hh-${h}`}
          aria-hidden
          style={{
            position:      'absolute',
            left:          0,
            right:         0,
            top:           (h - GRID_START_HOUR) * HOUR_HEIGHT + HOUR_HEIGHT / 2,
            height:        1,
            background:    DS.divider,
            opacity:       0.25,
            pointerEvents: 'none',
          }}
        />
      ))}
    </>
  );
}

// ─── NOW LINE ─────────────────────────────────────────────────────────────────

function NowLine({ topPx }: { topPx: number }) {
  return (
    <div
      aria-hidden
      style={{
        position:      'absolute',
        left:          0,
        right:         0,
        top:           topPx,
        height:        2,
        background:    DS.accent,
        zIndex:        5,
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          position:     'absolute',
          left:         -4,
          top:          -4,
          width:        10,
          height:       10,
          borderRadius: '50%',
          background:   DS.accent,
          boxShadow:    `0 0 0 3px ${DS.accent}35`,
        }}
      />
    </div>
  );
}

// ─── SKELETON LOADER ──────────────────────────────────────────────────────────

function SkeletonCard({ topPx, heightPx }: { topPx: number; heightPx: number }) {
  return (
    <div
      style={{
        position:     'absolute',
        left:         6,
        right:        6,
        top:          topPx,
        height:       Math.max(heightPx, MIN_CARD_HEIGHT_PX),
        borderRadius: 5,
        background:   DS.divider,
        opacity:      0.3,
        animation:    'pvot-shimmer 1.6s ease-in-out infinite',
      }}
    />
  );
}

// ─── MEETING CARD ─────────────────────────────────────────────────────────────
//
// Three content tiers (HOUR_HEIGHT = 54px):
//
//   FULL    (≥44px / ≥48min):
//     Row 1: time range + integrated meta badge (duration · attendees · video dot)
//     Row 2: title (2-line clamp)
//     Row 3: Live indicator (if now + tall enough)
//
//   COMPACT (27–43px / 30–47min):
//     Single line: "HH:MM · Title · [green dot if video]"
//
//   MICRO   (14–26px / <30min floor):
//     Title only at 9px, no wasted padding
//
// Privacy mode overrides ALL tiers internally — border-bleed impossible.

function MeetingCard({
  layout,
  accent,
  accentSoft,
  timezone,
  isNow,
  privacyMode,
}: {
  layout:      PositionedEvent;
  accent:      string;
  accentSoft:  string;
  timezone:    string;
  isNow:       boolean;
  privacyMode: boolean;
}) {
  const { event, topPx, heightPx, widthPct, leftPct, hasConflict } = layout;

  // ── Content tier ─────────────────────────────────────────────────────────
  const isFull    = heightPx >= 44;
  const isCompact = !isFull && heightPx >= 27;
  // isMicro = !isFull && !isCompact — implicit

  const isFatigue    = (event as any).metadata?.isHighFatigueSwitch === true;
  const hasVideo     = !!(event as any).videoLink?.url;
  const attendeeCount = ((event as any).attendees as any[] | undefined)?.length ?? 0;

  // ── Colour state machine ──────────────────────────────────────────────────
  const cardBg = privacyMode    ? DS.purpleSoft
    : hasConflict               ? '#FEF2F2'
    : isNow                     ? accentSoft
    : DS.surface;

  const cardBorder = privacyMode ? `${DS.purple}40`
    : hasConflict               ? DS.red
    : isNow                     ? accent
    : DS.divider;

  const stripeColor = privacyMode ? DS.purple
    : hasConflict               ? DS.red
    : isFatigue                 ? DS.amber
    : accent;

  const cardShadow = privacyMode ? 'none'
    : hasConflict               ? '0 0 0 2px #DC262618, 0 1px 4px rgba(220,38,38,0.10)'
    : isNow                     ? `0 0 0 2px ${accent}20, 0 1px 6px rgba(0,0,0,0.08)`
    : '0 1px 2px rgba(0,0,0,0.05)';

  // Integrated meta badge content: "28 · 1h 30m" or just "1h 30m"
  const metaBadge = (() => {
    if (hasConflict) return '⚠';
    if (isFatigue)   return '⚡';
    const dur = fmtDuration(event.startUtc, event.endUtc);
    return attendeeCount > 1 ? `${attendeeCount} · ${dur}` : dur;
  })();

  return (
    <div
      data-meeting-id={event.id}
      style={{
        position:     'absolute',
        boxSizing:    'border-box',
        left:         `calc(${leftPct}% + 4px)`,
        width:        `calc(${widthPct}% - 8px)`,
        top:          topPx,
        height:       heightPx,
        borderRadius: 5,
        overflow:     'hidden',
        cursor:       privacyMode ? 'default' : 'pointer',
        background:   cardBg,
        border:       `1.5px solid ${cardBorder}`,
        boxShadow:    cardShadow,
        zIndex:       hasConflict ? 3 : isNow ? 2 : 1,
        outline:      !privacyMode && isFatigue && !hasConflict
          ? `1.5px solid ${DS.amber}`
          : undefined,
        transition: privacyMode
          ? 'none'
          : `box-shadow 0.15s ${DS.ease}, transform 0.12s ${DS.ease}`,
      }}
      onMouseEnter={e => {
        if (privacyMode) return;
        const el = e.currentTarget as HTMLElement;
        el.style.transform = 'translateY(-1px)';
        el.style.boxShadow = `0 0 0 2px ${hasConflict ? DS.red : accent}28, 0 4px 10px rgba(0,0,0,0.10)`;
      }}
      onMouseLeave={e => {
        if (privacyMode) return;
        const el = e.currentTarget as HTMLElement;
        el.style.transform = 'translateY(0)';
        el.style.boxShadow = cardShadow;
      }}
    >
      {/* Left accent stripe — 3px, always present */}
      <div
        style={{
          position:     'absolute',
          left:         0,
          top:          0,
          bottom:       0,
          width:        3,
          background:   stripeColor,
          borderRadius: '5px 0 0 5px',
        }}
      />

      {/* ── PRIVACY MODE ─────────────────────────────────────────────────── */}
      {privacyMode ? (
        <div
          style={{
            position:    'absolute',
            left:        3, top: 0, right: 0, bottom: 0,
            display:     'flex',
            alignItems:  'center',
            paddingLeft: 8,
          }}
        >
          {heightPx >= 14 && (
            <span
              style={{
                fontFamily:    DS.body,
                fontSize:      10,
                fontWeight:    700,
                color:         DS.purple,
                letterSpacing: '0.04em',
                textTransform: 'uppercase' as const,
              }}
            >
              Busy
            </span>
          )}
        </div>

      ) : isFull ? (
        /* ── FULL TIER ────────────────────────────────────────────────────── */
        <div
          style={{
            position:      'absolute',
            left:          3, top: 0, right: 0, bottom: 0,
            paddingLeft:   6,
            paddingRight:  5,
            paddingTop:    4,
            paddingBottom: 2,
            overflow:      'hidden',
            display:       'flex',
            flexDirection: 'column',
            gap:           2,
          }}
        >
          {/* Time row + integrated meta */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
            {/* Start time */}
            <span
              style={{
                fontFamily:    DS.mono,
                fontSize:      9,
                fontWeight:    600,
                color:         hasConflict ? DS.red : accent,
                letterSpacing: '0.03em',
                lineHeight:    1,
                flexShrink:    0,
              }}
            >
              {fmtTime(event.startUtc, timezone)}
            </span>
            {/* End time */}
            <span
              style={{
                fontFamily: DS.mono,
                fontSize:   9,
                color:      DS.textMut,
                lineHeight: 1,
                flexShrink: 0,
              }}
            >
              –{fmtTime(event.endUtc, timezone)}
            </span>

            {/* Video presence dot — green, always visible if video exists */}
            {hasVideo && (
              <div
                title="Video link available"
                style={{
                  width:        5,
                  height:       5,
                  borderRadius: '50%',
                  background:   DS.green,
                  flexShrink:   0,
                  boxShadow:    `0 0 0 2px ${DS.green}25`,
                }}
              />
            )}

            {/* Integrated meta badge: attendee count · duration (or ⚠/⚡) */}
            <span
              style={{
                marginLeft:   'auto',
                fontFamily:   DS.body,
                fontSize:     8,
                fontWeight:   500,
                color:        hasConflict ? DS.red : isFatigue ? DS.amber : DS.textMut,
                background:   hasConflict ? '#FEF2F2' : isFatigue ? '#FFF5E0' : DS.canvas,
                border:       `1px solid ${hasConflict ? '#DC262630' : isFatigue ? '#D4830A30' : DS.divider}`,
                padding:      '1px 4px',
                borderRadius: 3,
                lineHeight:   1.3,
                whiteSpace:   'nowrap',
                flexShrink:   0,
              }}
            >
              {metaBadge}
            </span>
          </div>

          {/* Title */}
          <div
            style={{
              fontFamily:      DS.body,
              fontSize:        11,
              fontWeight:      600,
              color:           DS.textPri,
              lineHeight:      1.25,
              overflow:        'hidden',
              display:         '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical' as const,
              flexShrink:      0,
            }}
          >
            {event.title || 'Untitled'}
          </div>

          {/* Live indicator — only for in-progress meetings on tall cards */}
          {isNow && heightPx >= 76 && (
            <div
              style={{
                display:       'flex',
                alignItems:    'center',
                gap:           3,
                fontFamily:    DS.body,
                fontSize:      7,
                fontWeight:    700,
                color:         accent,
                letterSpacing: '0.07em',
                textTransform: 'uppercase' as const,
                marginTop:     'auto',
                flexShrink:    0,
              }}
            >
              <span
                style={{
                  width:        4,
                  height:       4,
                  borderRadius: '50%',
                  background:   accent,
                  flexShrink:   0,
                  animation:    'pvot-pulse 1.6s ease-in-out infinite',
                }}
              />
              Live
            </div>
          )}
        </div>

      ) : isCompact ? (
        /* ── COMPACT TIER ─────────────────────────────────────────────────── */
        <div
          style={{
            position:     'absolute',
            left:         3, top: 0, right: 0, bottom: 0,
            paddingLeft:  6,
            paddingRight: 5,
            display:      'flex',
            alignItems:   'center',
            gap:          4,
            overflow:     'hidden',
          }}
        >
          {/* Start time */}
          <span
            style={{
              fontFamily:    DS.mono,
              fontSize:      9,
              fontWeight:    700,
              color:         hasConflict ? DS.red : accent,
              letterSpacing: '0.03em',
              lineHeight:    1,
              flexShrink:    0,
            }}
          >
            {fmtTime(event.startUtc, timezone)}
          </span>
          {/* Separator */}
          <span style={{ color: DS.divider, fontSize: 9, lineHeight: 1, flexShrink: 0 }}>·</span>
          {/* Title */}
          <span
            style={{
              fontFamily:   DS.body,
              fontSize:     10,
              fontWeight:   600,
              color:        DS.textPri,
              lineHeight:   1,
              overflow:     'hidden',
              whiteSpace:   'nowrap',
              textOverflow: 'ellipsis',
              flex:         1,
            }}
          >
            {event.title || 'Untitled'}
          </span>
          {/* Video dot or warning/fatigue glyph */}
          {hasVideo && !hasConflict && !isFatigue && (
            <div
              style={{
                width:        5,
                height:       5,
                borderRadius: '50%',
                background:   DS.green,
                flexShrink:   0,
              }}
            />
          )}
          {(hasConflict || isFatigue) && (
            <span style={{ fontSize: 9, lineHeight: 1, flexShrink: 0 }}>
              {hasConflict ? '⚠' : '⚡'}
            </span>
          )}
        </div>

      ) : (
        /* ── MICRO TIER (14–26px) ─────────────────────────────────────────── */
        <div
          style={{
            position:    'absolute',
            left:        3, top: 0, right: 0, bottom: 0,
            paddingLeft: 6,
            paddingRight: 4,
            display:     'flex',
            alignItems:  'center',
            overflow:    'hidden',
          }}
        >
          <span
            style={{
              fontFamily:   DS.body,
              fontSize:     9,
              fontWeight:   600,
              color:        DS.textPri,
              lineHeight:   1,
              overflow:     'hidden',
              whiteSpace:   'nowrap',
              textOverflow: 'ellipsis',
            }}
          >
            {event.title || 'Untitled'}
          </span>
        </div>
      )}
    </div>
  );
}

// ─── TIME RULER ───────────────────────────────────────────────────────────────
//
// Sticky spacer height = LANE_HEADER_HEIGHT = 44px.
// This is IDENTICAL to the GlassLane dual-tier sticky header height.
// "00:00" ruler label is at scroll-y = 44px.
// Canvas topPx=0 is at scroll-y = 44px.
// Perfect temporal alignment by construction — one constant governs both.

export function TimeRuler() {
  return (
    <div
      style={{
        width:       RULER_WIDTH,
        flexShrink:  0,
        background:  DS.canvas,
        borderRight: `1px solid ${DS.divider}`,
      }}
    >
      {/* Sticky blank spacer — matches lane header height exactly */}
      <div
        style={{
          position:     'sticky',
          top:          0,
          zIndex:       11,
          height:       LANE_HEADER_HEIGHT,
          flexShrink:   0,
          background:   DS.canvas,
          borderBottom: `1px solid ${DS.divider}`,
          borderRight:  `1px solid ${DS.divider}`,
        }}
      />

      {/* Hour label column — starts immediately after spacer */}
      <div
        style={{
          position: 'relative',
          height:   GRID_TOTAL_HEIGHT,
          width:    '100%',
        }}
      >
        {GRID_HOURS.map(hour => (
          <div
            key={hour}
            style={{
              position: 'absolute',
              top:      (hour - GRID_START_HOUR) * HOUR_HEIGHT,
              left:     0,
              right:    0,
              height:   HOUR_HEIGHT,
            }}
          >
            <span
              style={{
                position:      'absolute',
                top:           -6,
                right:         8,
                fontFamily:    DS.mono,
                fontSize:      9,
                fontWeight:    500,
                color:         DS.textMut,
                letterSpacing: '0.04em',
                lineHeight:    1,
                userSelect:    'none',
              }}
            >
              {String(hour).padStart(2, '0')}:00
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── GLASS LANE PROPS ─────────────────────────────────────────────────────────

export interface GlassLaneProps {
  lane:         LaneResult;
  conflicts:    Conflict[];
  /** Pixel offset from canvas top for the current-time indicator. Null hides it. */
  nowTopPx:     number | null;
  /** IANA timezone string for the anchor city. */
  timezone:     string;
  /** Millisecond offset applied by the Time Traveller slider. 0 = now. */
  timeOffsetMs: number;
  /** YYYY-MM-DD in the anchor timezone — filters 48h prefetch to today only. */
  viewDate:     string;
  /** When true every card renders as "BUSY". Internal — no external overlay. */
  privacyMode?: boolean;
  /**
   * Lane display label — shown bold in the dual-tier sticky header.
   * Derived from customLabel > displayName > email prefix in page.tsx.
   */
  laneLabel?: string;
  /**
   * Source account email — shown beneath the alias in muted mono.
   * Gives the executive instant context: "who does this lane belong to?"
   * Falls back to lane.account.email if not provided.
   */
  laneEmail?: string;
}

// ─── GLASS LANE ───────────────────────────────────────────────────────────────

export function GlassLane({
  lane,
  conflicts,
  nowTopPx,
  timezone,
  timeOffsetMs,
  viewDate,
  privacyMode = false,
  laneLabel   = '',
  laneEmail   = '',
}: GlassLaneProps) {
  const accent     = LANE_ACCENTS[lane.laneIndex % LANE_ACCENTS.length];
  const accentSoft = LANE_SOFT[lane.laneIndex    % LANE_SOFT.length];

  const positioned = useMemo(
    () => calculateEventLayouts(lane.events, timezone, conflicts, viewDate),
    [lane.events, timezone, conflicts, viewDate],
  );

  return (
    <div
      style={{
        display:       'flex',
        flexDirection: 'column',
        minWidth:      200,
        background:    DS.canvas,
      }}
    >
      {/* Network error banner */}
      {lane.isError && (
        <div
          style={{
            padding:      '6px 10px',
            fontFamily:   DS.body,
            fontSize:     11,
            fontWeight:   500,
            color:        DS.red,
            background:   '#FEF2F2',
            border:       `1px solid ${DS.red}33`,
            margin:       4,
            borderRadius: 4,
            flexShrink:   0,
          }}
        >
          {lane.error?.message ?? 'Could not load events. Check your connection.'}
        </div>
      )}

      {/*
       * ── Lane identity sticky header — Dual-Tier + Structural Ownership ───
       *
       * Height = LANE_HEADER_HEIGHT = 44px.
       * Exactly mirrors the TimeRuler sticky spacer.
       *
       * DUAL-TIER IDENTITY:
       *   Row 1: alias / display name — bold, high-contrast
       *   Row 2: source email — muted mono, truncates with ellipsis
       *   Both rows redacted in privacy mode.
       *
       * STRUCTURAL OWNERSHIP:
       *   Background = accent at 8% opacity — subtle tint claims the column.
       *   Left border = 2px accent — visible lane ownership mark.
       *   This prevents the grid from reading as a floating spreadsheet.
       */}
      <div
        style={{
          position:       'sticky',
          top:            0,
          zIndex:         10,
          height:         LANE_HEADER_HEIGHT,
          flexShrink:     0,
          // Accent tint background — structural ownership
          background:     `${accent}0D`,  // 5% opacity
          borderBottom:   `1px solid ${accent}30`,
          borderLeft:     `2px solid ${accent}`,
          display:        'flex',
          flexDirection:  'column',
          justifyContent: 'center',
          paddingLeft:    10,
          paddingRight:   8,
          paddingTop:     8,
          paddingBottom:  8,
          gap:            2,
        }}
      >
        {/* Row 1: Alias / display name — bold, high-contrast */}
        <span
          style={{
            fontFamily:   DS.body,
            fontSize:     11,
            fontWeight:   700,
            color:        privacyMode ? DS.textMut : DS.textPri,
            letterSpacing:'0.005em',
            overflow:     'hidden',
            whiteSpace:   'nowrap',
            textOverflow: 'ellipsis',
            lineHeight:   1.2,
          }}
        >
          {privacyMode ? '████████' : (laneLabel || lane.account.email.split('@')[0])}
        </span>

        {/* Row 2: Source email — muted mono, smaller */}
        <span
          style={{
            fontFamily:   DS.mono,
            fontSize:     9,
            fontWeight:   400,
            color:        privacyMode ? `${DS.textMut}60` : `${accent}90`,
            letterSpacing:'0.01em',
            overflow:     'hidden',
            whiteSpace:   'nowrap',
            textOverflow: 'ellipsis',
            lineHeight:   1.2,
          }}
        >
          {privacyMode ? '███@████████' : (laneEmail || lane.account.email)}
        </span>
      </div>

      {/* Coordinate canvas — starts at scroll-y = LANE_HEADER_HEIGHT */}
      <div
        style={{
          position:  'relative',
          width:     '100%',
          height:    GRID_TOTAL_HEIGHT,
          flexShrink: 0,
        }}
      >
        <HourGrid />

        {/* Loading skeletons */}
        {lane.isLoading && !lane.isError && (
          <>
            <SkeletonCard topPx={Math.round(9    * HOUR_HEIGHT)} heightPx={HOUR_HEIGHT} />
            <SkeletonCard topPx={Math.round(10   * HOUR_HEIGHT)} heightPx={HOUR_HEIGHT} />
            <SkeletonCard topPx={Math.round(10.5 * HOUR_HEIGHT)} heightPx={Math.round(0.5 * HOUR_HEIGHT)} />
          </>
        )}

        {/* Empty state — centered in the viewport, not at a fixed grid position */}
        {!lane.isLoading && !lane.isError && positioned.length === 0 && !privacyMode && (
          <div
            style={{
              position:       'absolute',
              top:            '35%',
              left:           0,
              right:          0,
              display:        'flex',
              flexDirection:  'column',
              alignItems:     'center',
              gap:            6,
              opacity:        0.35,
              pointerEvents:  'none',
            }}
          >
            <span style={{ fontFamily: DS.body, fontSize: 11, fontWeight: 500, color: DS.textMut }}>
              No meetings
            </span>
          </div>
        )}

        {/* Meeting cards */}
        {!lane.isLoading && positioned.map(layout => (
          <MeetingCard
            key={layout.event.id}
            layout={layout}
            accent={accent}
            accentSoft={accentSoft}
            timezone={timezone}
            isNow={isHappeningNow(layout.event.startUtc, layout.event.endUtc, timeOffsetMs)}
            privacyMode={privacyMode}
          />
        ))}

        {/* Current-time indicator */}
        {nowTopPx !== null && <NowLine topPx={nowTopPx} />}
      </div>
    </div>
  );
}