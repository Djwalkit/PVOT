/**
 * packages/core/src/calendar/ConflictDetector.ts
 * PVOT — Conflict Detection & Buffer Analysis
 *
 * Operates on an already-normalized, chronologically sorted Meeting[].
 * Mutates `isConflict`, `conflictWith`, and `hasNoBuffer` fields in place.
 *
 * Two types of flagging:
 *   1. OVERLAP:    Two meetings' time ranges intersect (even across accounts).
 *   2. NO BUFFER:  < 5 minutes between the end of one and start of the next.
 *
 * Performance: O(n²) overlap check — acceptable for ≤ 50 events/day.
 * If needed, upgrade to interval tree for 100+ events.
 */

import type { Meeting } from '../types';

// Buffer threshold: meetings with less than this gap are flagged
const BUFFER_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

// ─── CONFLICT DETECTOR ────────────────────────────────────────────────────────

/**
 * Annotate a sorted array of meetings with conflict and buffer gap flags.
 * Returns a new array (does not mutate input).
 */
export function annotateConflicts(meetings: Meeting[]): Meeting[] {
  // Deep copy to avoid mutating the React Query cache
  const annotated: Meeting[] = meetings.map((m) => ({
    ...m,
    isConflict:  false,
    conflictWith:[],
    hasNoBuffer: false,
  }));

  const n = annotated.length;

  // ── Pass 1: Overlap detection (pairwise) ────────────────────────────────────
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const a = annotated[i];
      const b = annotated[j];

      // Optimization: if B starts after A ends, no more overlaps possible for A
      if (new Date(b.startUtc).getTime() >= new Date(a.endUtc).getTime()) break;

      if (overlaps(a, b)) {
        annotated[i] = {
          ...a,
          isConflict:  true,
          conflictWith:[...a.conflictWith, b.id],
        };
        annotated[j] = {
          ...b,
          isConflict:  true,
          conflictWith:[...b.conflictWith, a.id],
        };
      }
    }
  }

  // ── Pass 2: Buffer gap detection (sequential) ───────────────────────────────
  // Only flag non-all-day meetings with insufficient gap before the next one.
  for (let i = 0; i < n - 1; i++) {
    const current = annotated[i];
    const next    = annotated[i + 1];

    if (current.isAllDay || next.isAllDay) continue;

    const gap = new Date(next.startUtc).getTime() - new Date(current.endUtc).getTime();

    if (gap >= 0 && gap < BUFFER_THRESHOLD_MS) {
      // Flag the current meeting as "no buffer after"
      annotated[i] = { ...current, hasNoBuffer: true };
    }
  }

  return annotated;
}

/**
 * Return a summary count for the header conflict badge.
 */
export function getConflictSummary(meetings: Meeting[]): {
  overlapCount: number;
  noBufferCount: number;
  total: number;
} {
  const overlapCount  = meetings.filter((m) => m.isConflict).length;
  const noBufferCount = meetings.filter((m) => m.hasNoBuffer && !m.isConflict).length;
  return { overlapCount, noBufferCount, total: overlapCount + noBufferCount };
}

// ─── HELPER ───────────────────────────────────────────────────────────────────

function overlaps(a: Meeting, b: Meeting): boolean {
  const aStart = new Date(a.startUtc).getTime();
  const aEnd   = new Date(a.endUtc).getTime();
  const bStart = new Date(b.startUtc).getTime();
  const bEnd   = new Date(b.endUtc).getTime();
  return aStart < bEnd && aEnd > bStart;
}
