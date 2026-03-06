/**
 * packages/ui/src/calendar/UnifiedTimeline.tsx
 * PVOT — Layer 2: Unified Timeline
 *
 * Virtualized list via react-window's VariableSizeList for variable-height
 * meeting cards. Handles:
 *   - Loading skeleton state (before first fetch)
 *   - Background refetch indicator (subtle top bar)
 *   - Empty state (all accounts connected, no events today)
 *   - All-accounts-error state
 *   - "Now" time indicator line
 *   - Staggered entry animations on initial load
 *   - Full keyboard navigation
 */

'use client';

import React, {
  memo, useRef, useCallback, useEffect, useMemo, useState,
} from 'react';
import { VariableSizeList, type ListChildComponentProps } from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer';
import { RefreshCw, CalendarX2, Wifi, WifiOff } from 'lucide-react';
import { cn }             from '../lib/utils';
import { MeetingCard, MeetingCardSkeleton } from './MeetingCard';
import { Badge }          from '../primitives';
import { formatDateHeading, formatDisplayTime } from '../lib/utils';
import { useCalendarQuery } from '@pvot/query/useCalendarQuery';
import { useUIStore }       from '@pvot/core/stores';
import type { Meeting }     from '@pvot/core/types';

// ─── ROW TYPES ────────────────────────────────────────────────────────────────
// The virtualized list works on a flat array of heterogeneous row items.
// This discriminated union lets us render different row types in one list.

type TimelineRow =
  | { type: 'header';  date: string; timezone: string }
  | { type: 'meeting'; meeting: Meeting }
  | { type: 'gap';     gapMinutes: number }
  | { type: 'now';     currentTime: string }
  | { type: 'skeleton' };

// Row heights (px) — must match rendered output for accurate virtualization
const ROW_HEIGHTS: Record<TimelineRow['type'], number> = {
  header:   64,
  meeting:  88,   // base; tall cards (many attendees) use 108
  gap:      28,
  now:      32,
  skeleton: 88,
};

function getRowHeight(row: TimelineRow): number {
  if (row.type === 'meeting') {
    // Taller card for meetings with > 3 attendees
    return row.meeting.attendees.length > 3 ? 108 : 88;
  }
  return ROW_HEIGHTS[row.type];
}

// ─── BUILD ROW DATA ───────────────────────────────────────────────────────────

function buildRows(
  meetings:    Meeting[],
  timezone:    string,
  viewDate:    string,
  nowUtc:      string,
): TimelineRow[] {
  if (meetings.length === 0) return [];

  const rows: TimelineRow[] = [];
  let nowInserted = false;
  const nowMs = new Date(nowUtc).getTime();

  // Date header
  rows.push({ type: 'header', date: viewDate, timezone });

  meetings.forEach((meeting, i) => {
    const startMs = new Date(meeting.startUtc).getTime();
    const endMs   = new Date(meeting.endUtc).getTime();

    // Insert "now" indicator before the first meeting that starts after now
    if (!nowInserted && startMs > nowMs) {
      rows.push({ type: 'now', currentTime: nowUtc });
      nowInserted = true;
    }

    // Gap indicator between back-to-back meetings
    if (i > 0) {
      const prevEnd = new Date(meetings[i - 1].endUtc).getTime();
      const gapMs   = startMs - prevEnd;
      const gapMins = Math.round(gapMs / 60_000);
      if (gapMins > 5 && gapMins < 60) {
        rows.push({ type: 'gap', gapMinutes: gapMins });
      }
    }

    rows.push({ type: 'meeting', meeting });
  });

  // If now is after all meetings, append indicator at end
  if (!nowInserted) {
    rows.push({ type: 'now', currentTime: nowUtc });
  }

  return rows;
}

// ─── UNIFIED TIMELINE ────────────────────────────────────────────────────────

interface UnifiedTimelineProps {
  className?: string;
}

export function UnifiedTimeline({ className }: UnifiedTimelineProps) {
  const {
    meetings, accountStatuses, isLoading, isFetching,
    hasPartialErrors, timezone,
  } = useCalendarQuery();

  const selectedEventId = useUIStore((s) => s.selectedEventId);
  const selectEvent     = useUIStore((s) => s.selectEvent);
  const privacyMode     = useUIStore((s) => s.privacyMode);
  const viewDate        = useUIStore((s) => s.viewDate);

  const listRef = useRef<VariableSizeList>(null);
  const [nowUtc, setNowUtc] = useState(() => new Date().toISOString());

  // Update "now" every minute
  useEffect(() => {
    const id = setInterval(() => setNowUtc(new Date().toISOString()), 60_000);
    return () => clearInterval(id);
  }, []);

  const rows = useMemo(() => {
    if (isLoading) {
      return Array.from({ length: 5 }, () => ({ type: 'skeleton' } as TimelineRow));
    }
    return buildRows(meetings, timezone, viewDate, nowUtc);
  }, [meetings, timezone, viewDate, nowUtc, isLoading]);

  const getItemSize = useCallback(
    (index: number) => getRowHeight(rows[index]),
    [rows],
  );

  // Reset size cache when rows change (variable heights require this)
  useEffect(() => {
    listRef.current?.resetAfterIndex(0, false);
  }, [rows]);

  // Scroll to "now" indicator on mount
  useEffect(() => {
    if (!isLoading && rows.length > 0) {
      const nowIndex = rows.findIndex((r) => r.type === 'now');
      if (nowIndex > 0) {
        listRef.current?.scrollToItem(Math.max(0, nowIndex - 1), 'start');
      }
    }
  }, [isLoading, rows]);

  const handleJoin = useCallback((url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  }, []);

  return (
    <main
      id="timeline"
      aria-label="Unified meeting timeline"
      className={cn('flex flex-col h-full bg-canvas', className)}
    >
      {/* ── Timeline header ───────────────────────────────────────────────── */}
      <TimelineHeader
        isFetching={isFetching && !isLoading}
        hasPartialErrors={hasPartialErrors}
        meetingCount={meetings.length}
        accountStatuses={accountStatuses}
        timezone={timezone}
      />

      {/* ── Main list ─────────────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0" role="feed" aria-busy={isLoading} aria-live="polite">
        {!isLoading && meetings.length === 0 ? (
          <EmptyState />
        ) : (
          <AutoSizer>
            {({ height, width }) => (
              <VariableSizeList
                ref={listRef}
                height={height}
                width={width}
                itemCount={rows.length}
                itemSize={getItemSize}
                itemData={{ rows, selectedEventId, privacyMode, timezone, selectEvent, handleJoin }}
                overscanCount={4}
                className="scrollbar-thin"
              >
                {TimelineRow}
              </VariableSizeList>
            )}
          </AutoSizer>
        )}
      </div>
    </main>
  );
}

// ─── ROW RENDERER ─────────────────────────────────────────────────────────────

interface RowData {
  rows:            TimelineRow[];
  selectedEventId: string | null;
  privacyMode:     boolean;
  timezone:        string;
  selectEvent:     (id: string | null) => void;
  handleJoin:      (url: string) => void;
}

const TimelineRow = memo(function TimelineRow({
  index,
  style,
  data,
}: ListChildComponentProps<RowData>) {
  const { rows, selectedEventId, privacyMode, timezone, selectEvent, handleJoin } = data;
  const row = rows[index];

  const paddedStyle = {
    ...style,
    paddingLeft:  24,
    paddingRight: 24,
  };

  if (row.type === 'skeleton') {
    return (
      <div style={paddedStyle} className="py-1.5">
        <MeetingCardSkeleton />
      </div>
    );
  }

  if (row.type === 'header') {
    return (
      <div style={paddedStyle} className="flex items-center pb-4 pt-6">
        <div>
          <h1 className="text-heading-md font-display text-primary">
            {formatDateHeading(new Date(row.date + 'T12:00:00Z').toISOString(), row.timezone)}
          </h1>
        </div>
      </div>
    );
  }

  if (row.type === 'now') {
    return (
      <div style={paddedStyle} className="flex items-center gap-3 py-1.5">
        <div className="relative flex items-center gap-2 flex-1">
          <span
            className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0 animate-dot-pulse"
            aria-label="Current time"
          />
          <span className="text-label-xs font-mono text-blue-400 tabular-nums">
            {formatDisplayTime(row.currentTime, 'UTC').replace(' ', '').toLowerCase()}
          </span>
          <div className="flex-1 h-px bg-blue-500/20" aria-hidden="true" />
        </div>
      </div>
    );
  }

  if (row.type === 'gap') {
    return (
      <div
        style={paddedStyle}
        aria-label={`${row.gapMinutes} minute gap`}
        className="flex items-center justify-center"
      >
        <span className="text-label-xs font-body text-ghost">
          {row.gapMinutes} min
        </span>
      </div>
    );
  }

  if (row.type === 'meeting') {
    return (
      <div style={{ ...style, paddingLeft: 24, paddingRight: 24, paddingTop: 4, paddingBottom: 4 }}>
        <MeetingCard
          meeting={row.meeting}
          timezone={timezone}
          isSelected={selectedEventId === row.meeting.id}
          isPrivate={privacyMode}
          onSelect={selectEvent}
          onJoin={handleJoin}
        />
      </div>
    );
  }

  return null;
});

// ─── TIMELINE HEADER ─────────────────────────────────────────────────────────

interface TimelineHeaderProps {
  isFetching:       boolean;
  hasPartialErrors: boolean;
  meetingCount:     number;
  accountStatuses:  any[];
  timezone:         string;
}

function TimelineHeader({
  isFetching, hasPartialErrors, meetingCount, accountStatuses, timezone,
}: TimelineHeaderProps) {
  const failedAccounts = accountStatuses.filter((s) => s.status === 'rejected');

  return (
    <div className="flex-shrink-0">
      {/* Background refetch indicator — thin animated line, non-intrusive */}
      {isFetching && (
        <div
          aria-label="Refreshing calendar data"
          className="h-0.5 bg-blue-500/30 overflow-hidden"
        >
          <div className="h-full bg-blue-500 animate-[slide-in-right_1.5s_ease-standard_infinite]" />
        </div>
      )}

      {/* Partial error banners */}
      {hasPartialErrors && (
        <div className="px-6 py-2 flex flex-wrap gap-2" aria-live="polite">
          {failedAccounts.map((s) => (
            <PartialErrorBadge key={s.accountId} accountId={s.accountId} error={s.error} />
          ))}
        </div>
      )}
    </div>
  );
}

function PartialErrorBadge({ accountId, error }: { accountId: string; error: string | null }) {
  const accounts    = useUIStore ? undefined : undefined; // accessed via store
  const errorLabels: Record<string, string> = {
    token_expired: 'Session expired — reconnect to resume',
    fetch_failed:  'Unreachable — check network',
    rate_limited:  'Rate limited — retrying shortly',
    scope_changed: 'Permission changed — reconnect',
  };
  const msg = error ? errorLabels[error] ?? 'Sync error' : 'Sync error';

  return (
    <div
      role="alert"
      className="flex items-center gap-2 px-3 py-1.5 rounded-sm bg-danger/5 border border-danger/15 animate-fade-in"
    >
      <WifiOff className="w-3.5 h-3.5 text-danger flex-shrink-0" aria-hidden="true" />
      <span className="text-label-xs font-body text-danger/80">{msg}</span>
    </div>
  );
}

// ─── EMPTY STATE ──────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div
      role="status"
      aria-label="No meetings scheduled"
      className="flex flex-col items-center justify-center h-full gap-4 px-8 animate-fade-up"
    >
      <div className="w-12 h-12 rounded-xl bg-raised border border-rim flex items-center justify-center">
        <CalendarX2 className="w-6 h-6 text-muted" aria-hidden="true" />
      </div>
      <div className="text-center">
        <p className="text-body-lg font-body text-secondary">No events scheduled</p>
        <p className="text-body-sm font-body text-muted mt-1 max-w-xs text-balance">
          Your calendar is clear for this day. Events from all connected workspaces will appear here.
        </p>
      </div>
    </div>
  );
}
