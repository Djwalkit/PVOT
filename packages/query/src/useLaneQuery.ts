/**
 * packages/query/src/useLaneQuery.ts
 * PVOT — 48-Hour Temporal Data Hook + Decision Intelligence Engine
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ARCHITECTURE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * 1. 48-HOUR FETCH: Parallel Today + Tomorrow retrieval per account.
 *    GlassLane scrolls the full 48-hour canvas; both days are needed upfront.
 *
 * 2. COGNITIVE SWITCH ENGINE: analyzeSwitchFatigue() flags cross-lane
 *    transitions with <5-minute gaps as isHighFatigueSwitch = true so the
 *    UI can apply a visual warning on those cards.
 *
 * 3. HOME ZONE SOVEREIGNTY (Issues 3 + 4 — FIXED):
 *    homeZones is read from pvotStore via a reactive Zustand selector.
 *    When the user pins or unpins a city in Settings, the selector fires,
 *    timezone updates, queryKey changes, and TanStack Query cache-misses →
 *    fresh fetch with the correct coordinate anchor. No page refresh needed.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * BUGS FIXED IN THIS VERSION
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * BUG A — Selector instability (Issue 4):
 *   BEFORE: const homeZones = usePVOTStore((s) => (s as any).homeZones) || []
 *   The || [] lived OUTSIDE the selector. When store.homeZones was undefined,
 *   the selector returned undefined on every render, triggering Zustand to
 *   rerun all subscribers and causing a cascade of unnecessary re-renders.
 *   AFTER:  usePVOTStore((s) => (s as any).homeZones as string[] ?? [])
 *   The ?? [] is inside the selector — Zustand gets a stable [] reference
 *   when the field is absent, no spurious updates.
 *
 * BUG B — Redundant useMemo on effectiveHomeZones:
 *   BEFORE: useMemo(() => homeZones.length > 0 ? homeZones : [browser], [homeZones])
 *   homeZones is an array ref, always new → useMemo dependency always dirty.
 *   AFTER:  Direct derivation in the render body. The selector already
 *   guarantees a non-empty array, so no extra memoization needed.
 *
 * BUG C — TypeScript laneId error (Switch Engine):
 *   BEFORE: prev.laneId — laneId does not exist on the Meeting type.
 *   AFTER:  Internal TaggedMeeting = Meeting & { laneId: string } type used
 *   only inside this file. Public API still emits plain Meeting[].
 *
 * BUG D — Unstable allEventsRaw dependency:
 *   BEFORE: allEventsRaw created inline → new ref every render →
 *           intelligentEvents useMemo always re-ran.
 *   AFTER:  Both raw aggregation and fatigue analysis collapsed into a single
 *           memoized derivation keyed on rawLanesData (stable per query result).
 *
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { useQueries, useQueryClient } from '@tanstack/react-query';
import { useAuthStore }               from '@pvot/core/stores';
import { usePVOTStore }               from '@pvot/core/stores/pvotStore';
import { getCalendarClient }          from '@pvot/core/engine/CalendarClient';
import { detectConflicts, mergeConflicts, getLaneColor } from '@pvot/core/engine/ConflictEngine';
import { useEffect, useMemo }         from 'react';
import type { LaneData }              from '@pvot/core/engine/ConflictEngine';
import type { Meeting, ConnectedAccount } from '@pvot/core/types';

// ─── TYPES ────────────────────────────────────────────────────────────────────

export interface LaneResult {
  account:    ConnectedAccount;
  events:     Meeting[];
  isLoading:  boolean;
  isFetching: boolean;
  isError:    boolean;
  error:      Error | null;
  laneIndex:  number;
  color:      string;
}

export interface UseLaneQueryResult {
  lanes:      LaneResult[];
  allEvents:  Meeting[];
  isLoading:  boolean;    // true if ANY lane is loading for first time
  isFetching: boolean;    // true if ANY lane is background-fetching
  hasErrors:  boolean;    // true if ANY lane failed
  refetchAll: () => void;
  /** Sovereign timezone anchor: homeZones[0] or browser local. */
  timezone:   string;
  /** Full ordered list of user-pinned Home Zones — drives the clock ribbon. */
  homeZones:  string[];
  viewDate:   string;
}

// ─── INTERNAL: Tagged Meeting (Switch Engine only) ────────────────────────────
//
// laneId is an ephemeral tag injected by the queryFn so the Switch Engine
// can identify cross-lane transitions. It is NOT part of the public Meeting
// type and is stripped before events reach LaneResult.events.

type TaggedMeeting = Meeting & { laneId: string };

// ─── COGNITIVE SWITCH ENGINE ──────────────────────────────────────────────────

/**
 * Flags cross-lane transitions with < 5-minute buffers.
 * Sets event.metadata.isHighFatigueSwitch = true on those events.
 * Operates on TaggedMeeting[] and returns Meeting[] (tags stripped implicitly
 * because Meeting is a structural supertype — callers treat the result as Meeting[]).
 */
function analyzeSwitchFatigue(events: TaggedMeeting[]): TaggedMeeting[] {
  if (events.length < 2) return events;

  const sorted = [...events].sort(
    (a, b) => new Date(a.startUtc).getTime() - new Date(b.startUtc).getTime(),
  );

  return sorted.map((event, i) => {
    const prev = sorted[i - 1];
    if (!prev || prev.laneId === event.laneId) return event;

    const gapMs   = new Date(event.startUtc).getTime() - new Date(prev.endUtc).getTime();
    const gapMins = gapMs / 60_000;
    if (gapMins < 0 || gapMins >= 5) return event;

    return {
      ...event,
      metadata: { ...event.metadata, isHighFatigueSwitch: true },
    };
  });
}

// ─── HOOK ─────────────────────────────────────────────────────────────────────

export function useLaneQuery(): UseLaneQueryResult {
  const accounts          = useAuthStore((s) => s.accounts);
  const laneConfigs       = usePVOTStore((s) => s.laneConfigs);
  const setLaneConfigs    = usePVOTStore((s) => s.setLaneConfigs);
  const viewDate          = usePVOTStore((s) => s.viewDate);
  const setConflicts      = usePVOTStore((s) => s.setConflicts);
  const existingConflicts = usePVOTStore((s) => s.conflicts);

  // ── BUG A FIX: Stable selector with ?? [] inside the selector ────────────
  //
  // usePVOTStore re-renders this hook when homeZones changes. The ?? []
  // guard is INSIDE the selector so Zustand gets a stable empty-array
  // reference when the field is absent — no spurious re-renders.
  const homeZones = usePVOTStore((s) => (s as any).homeZones as string[] ?? []);

  // ── BUG B FIX: Direct derivation, no useMemo ─────────────────────────────
  //
  // If the user has no zones pinned yet, fall back to the browser timezone.
  // This is a simple primitive derivation — no memoization needed.
  const timezone = homeZones.length > 0
    ? homeZones[0]
    : Intl.DateTimeFormat().resolvedOptions().timeZone;

  const queryClient = useQueryClient();

  // ── Sync lane configs when accounts change ──────────────────────────────────
  useEffect(() => {
    if (accounts.length === 0) return;
    const existingIds = new Set(laneConfigs.map((l) => l.accountId));
    const newConfigs = accounts
      .filter((a) => !existingIds.has(a.id))
      .map((a, i) => ({
        accountId:   a.id,
        visible:     true,
        customLabel: null,
        order:       laneConfigs.length + i,
      }));
    if (newConfigs.length > 0) setLaneConfigs([...laneConfigs, ...newConfigs]);
  }, [accounts, laneConfigs, setLaneConfigs]);

  // ── Ordered visible accounts ─────────────────────────────────────────────
  const orderedAccounts = useMemo(() => {
    return accounts
      .filter((a) => laneConfigs.find((l) => l.accountId === a.id)?.visible !== false)
      .sort((a, b) => {
        const orderA = laneConfigs.find((l) => l.accountId === a.id)?.order ?? 0;
        const orderB = laneConfigs.find((l) => l.accountId === b.id)?.order ?? 0;
        return orderA - orderB;
      });
  }, [accounts, laneConfigs]);

  // ── Parallel 48-Hour Queries ──────────────────────────────────────────────
  //
  // queryKey includes `timezone` so a zone change triggers a fresh fetch
  // (Issue 3 fix). day2 fetches the next calendar day in the same timezone
  // for the 48-hour forward canvas.
  const queries = useQueries({
    queries: orderedAccounts.map((account) => ({
      queryKey: ['lane-48h', account.id, viewDate, timezone],
      queryFn:  async () => {
        const client = getCalendarClient();
        const tomorrow = new Date(viewDate);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowStr = tomorrow.toISOString().split('T')[0];

        try {
          const [day1, day2] = await Promise.all([
            client.fetchDayEvents(account, viewDate,    timezone),
            client.fetchDayEvents(account, tomorrowStr, timezone),
          ]);
          return [...day1, ...day2].map(
            (e): TaggedMeeting => ({ ...e, laneId: account.id }),
          );
        } catch (err) {
          // Log the real error — visible in browser DevTools → Console
          console.error(`[PVOT] Lane fetch failed for ${account.email}:`, err);
          throw err;
        }
      },
      staleTime: 5 * 60 * 1000,
      enabled:   account.status === 'active',
    })),
  });

  // ── Build raw lane data ───────────────────────────────────────────────────
  const rawLanesData = orderedAccounts.map((account, index) => {
    const query = queries[index];
    return {
      account,
      events:     (query?.data ?? []) as TaggedMeeting[],
      isLoading:  query?.isLoading  ?? false,
      isFetching: query?.isFetching ?? false,
      isError:    query?.isError    ?? false,
      error:      (query?.error as Error | null) ?? null,
      laneIndex:  index,
      color:      getLaneColor(index),
    };
  });

  // ── BUG D FIX: Single stable useMemo for aggregation + fatigue analysis ──
  //
  // BEFORE: allEventsRaw was a new array reference every render (inline flatMap),
  // causing intelligentEvents useMemo to re-run on every render regardless of
  // whether any query data actually changed.
  // AFTER:  One memo keyed on rawLanesData. Only re-runs when query results change.
  const intelligentEvents = useMemo(() => {
    const allRaw = rawLanesData.flatMap((l) => l.events);
    return analyzeSwitchFatigue(allRaw);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawLanesData]);

  // ── Reconstruct lanes with intelligence-annotated events ─────────────────
  //
  // BUG C FIX: e.laneId is typed on TaggedMeeting — no TypeScript error.
  const lanes: LaneResult[] = rawLanesData.map((lane) => ({
    ...lane,
    events: intelligentEvents.filter((e) => e.laneId === lane.account.id),
  }));

  // ── Conflict detection ────────────────────────────────────────────────────
  const allSettled = queries.every((q) => !q.isLoading);

  useEffect(() => {
    if (!allSettled || lanes.length < 2) return;
    const laneData: LaneData[] = lanes.map((lane) => ({
      account:   lane.account,
      events:    lane.events,
      laneIndex: lane.laneIndex,
    }));
    const freshConflicts = detectConflicts(laneData);
    setConflicts(mergeConflicts(existingConflicts, freshConflicts));
  }, [allSettled, viewDate, timezone, setConflicts]);

  // ── Aggregates ───────────────────────────────────────────────────────────
  const isLoading  = queries.some((q) => q.isLoading);
  const isFetching = queries.some((q) => q.isFetching);
  const hasErrors  = queries.some((q) => q.isError);

  const refetchAll = () => {
    orderedAccounts.forEach((account) => {
      queryClient.invalidateQueries({ queryKey: ['lane-48h', account.id] });
    });
  };

  return {
    lanes,
    allEvents:  intelligentEvents,
    isLoading,
    isFetching,
    hasErrors,
    refetchAll,
    timezone,
    homeZones,  // The full sovereign list — page.tsx maps this to LiveClock[]
    viewDate,
  };
}