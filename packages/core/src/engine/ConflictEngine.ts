/**
 * packages/core/src/engine/ConflictEngine.ts
 * PVOT — Multi-Lane Conflict Detection Engine
 *
 * Detects overlapping events across N calendar lanes.
 * Generates Ghost Block suggestions for conflicting events.
 * 100% pure functions — no side effects, no API calls.
 *
 * Terminology:
 *   Lane      — one connected Google workspace/account
 *   Conflict  — two events from different lanes that overlap in time
 *   GhostBlock— an "Unavailable" placeholder suggested for other lanes
 *               when a conflict is detected
 */

import type { Meeting, ConnectedAccount } from '../types';

// ─── TYPES ────────────────────────────────────────────────────────────────────

export interface LaneEvent extends Meeting {
  accountId:    string;
  accountEmail: string;
  accountColor: string;
  laneIndex:    number;
}

export interface Conflict {
  id:          string;           // stable ID for React keys
  eventA:      LaneEvent;        // first conflicting event
  eventB:      LaneEvent;        // second conflicting event
  overlapStart: string;          // ISO UTC — start of overlap window
  overlapEnd:   string;          // ISO UTC — end of overlap window
  overlapMins:  number;          // duration of overlap in minutes
  ghostBlocks:  GhostBlockSuggestion[];
}

export interface GhostBlockSuggestion {
  id:              string;
  targetAccountId: string;
  targetEmail:     string;
  title:           string;       // "Unavailable" by default, user can rename
  startUtc:        string;
  endUtc:          string;
  sourceConflict:  string;       // conflict.id this was generated from
  status:          'pending' | 'posting' | 'posted' | 'failed';
}

export interface LaneData {
  account:  ConnectedAccount;
  events:   Meeting[];
  laneIndex: number;
}

// ─── ACCOUNT COLOR PALETTE ────────────────────────────────────────────────────

const LANE_COLORS = [
  '#3B82F6', // blue-500
  '#8B5CF6', // violet-500
  '#10B981', // emerald-500
  '#F59E0B', // amber-500
  '#EF4444', // red-500
  '#EC4899', // pink-500
  '#06B6D4', // cyan-500
] as const;

export function getLaneColor(index: number): string {
  return LANE_COLORS[index % LANE_COLORS.length];
}

// ─── CORE ENGINE ──────────────────────────────────────────────────────────────

/**
 * Takes events from N lanes and returns all cross-lane conflicts.
 * O(n²) across lanes — acceptable for typical calendar day views (< 50 events).
 */
export function detectConflicts(lanes: LaneData[]): Conflict[] {
  const conflicts: Conflict[] = [];

  // Flatten all events into LaneEvents with account metadata
  const laneEvents: LaneEvent[] = lanes.flatMap((lane) =>
    lane.events.map((event) => ({
      ...event,
      accountId:    lane.account.id,
      accountEmail: lane.account.email,
      accountColor: getLaneColor(lane.laneIndex),
      laneIndex:    lane.laneIndex,
    })),
  );

  // Compare every pair of events from DIFFERENT lanes
  for (let i = 0; i < laneEvents.length; i++) {
    for (let j = i + 1; j < laneEvents.length; j++) {
      const a = laneEvents[i];
      const b = laneEvents[j];

      // Only cross-lane conflicts matter
      if (a.accountId === b.accountId) continue;

      const overlap = getOverlap(a.startUtc, a.endUtc, b.startUtc, b.endUtc);
      if (!overlap) continue;

      const conflictId = `conflict-${a.id}-${b.id}`;

      conflicts.push({
        id:           conflictId,
        eventA:       a,
        eventB:       b,
        overlapStart: overlap.start,
        overlapEnd:   overlap.end,
        overlapMins:  overlap.minutes,
        ghostBlocks:  generateGhostBlocks(conflictId, a, b, overlap),
      });
    }
  }

  // Sort by overlap start time
  return conflicts.sort(
    (a, b) => new Date(a.overlapStart).getTime() - new Date(b.overlapStart).getTime(),
  );
}

/**
 * Calculate the overlap window between two time ranges.
 * Returns null if no overlap.
 */
function getOverlap(
  startA: string, endA: string,
  startB: string, endB: string,
): { start: string; end: string; minutes: number } | null {
  const startAMs = new Date(startA).getTime();
  const endAMs   = new Date(endA).getTime();
  const startBMs = new Date(startB).getTime();
  const endBMs   = new Date(endB).getTime();

  const overlapStart = Math.max(startAMs, startBMs);
  const overlapEnd   = Math.min(endAMs, endBMs);

  if (overlapStart >= overlapEnd) return null;

  return {
    start:   new Date(overlapStart).toISOString(),
    end:     new Date(overlapEnd).toISOString(),
    minutes: Math.round((overlapEnd - overlapStart) / 60_000),
  };
}

/**
 * Generate Ghost Block suggestions for all OTHER accounts
 * involved in a conflict — one ghost block per affected account.
 */
function generateGhostBlocks(
  conflictId: string,
  eventA:     LaneEvent,
  eventB:     LaneEvent,
  overlap:    { start: string; end: string },
): GhostBlockSuggestion[] {
  // The ghost block covers the FULL duration of the conflicting event
  // (not just the overlap) — this is intentional: it blocks the whole meeting
  return [
    {
      id:              `ghost-${conflictId}-for-${eventB.accountId}`,
      targetAccountId: eventB.accountId,
      targetEmail:     eventB.accountEmail,
      title:           'Unavailable',
      startUtc:        eventA.startUtc,
      endUtc:          eventA.endUtc,
      sourceConflict:  conflictId,
      status:          'pending',
    },
    {
      id:              `ghost-${conflictId}-for-${eventA.accountId}`,
      targetAccountId: eventA.accountId,
      targetEmail:     eventA.accountEmail,
      title:           'Unavailable',
      startUtc:        eventB.startUtc,
      endUtc:          eventB.endUtc,
      sourceConflict:  conflictId,
      status:          'pending',
    },
  ];
}

/**
 * Merge new conflicts with existing ones, preserving ghost block status.
 * Called on every refetch so "posted" ghost blocks aren't reset to "pending".
 */
export function mergeConflicts(
  existing: Conflict[],
  fresh:    Conflict[],
): Conflict[] {
  const existingMap = new Map(existing.map((c) => [c.id, c]));

  return fresh.map((freshConflict) => {
    const existingConflict = existingMap.get(freshConflict.id);
    if (!existingConflict) return freshConflict;

    // Preserve ghost block statuses from existing
    const ghostMap = new Map(
      existingConflict.ghostBlocks.map((g) => [g.id, g.status]),
    );

    return {
      ...freshConflict,
      ghostBlocks: freshConflict.ghostBlocks.map((g) => ({
        ...g,
        status: ghostMap.get(g.id) ?? g.status,
      })),
    };
  });
}

/**
 * Count how many conflicts affect a specific account.
 * Used for the lane header badge.
 */
export function getConflictCountForAccount(
  conflicts: Conflict[],
  accountId: string,
): number {
  return conflicts.filter(
    (c) => c.eventA.accountId === accountId || c.eventB.accountId === accountId,
  ).length;
}
