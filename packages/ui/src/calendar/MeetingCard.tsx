/**
 * packages/ui/src/calendar/MeetingCard.tsx
 * PVOT — Meeting Card Component
 *
 * The primary unit of the timeline. Handles:
 *   - Normal, conflict, no-buffer, tentative, cancelled states
 *   - Privacy mode (blur title and attendees)
 *   - One-click join button (video link extraction)
 *   - Keyboard navigation (Enter to select, focus-visible ring)
 *   - React.memo — virtualized list renders many of these
 *
 * Visual hierarchy:
 *   [account color bar] [time] [title] [badges] [join button]
 *                              [attendee avatars]
 */

import React, { memo, useCallback } from 'react';
import { Video, ExternalLink, AlertTriangle, Clock, Users, MapPin } from 'lucide-react';
import { cn }             from '../lib/utils';
import { Badge, Avatar, IconButton } from '../primitives';
import { formatTimeRange, formatDuration } from '../lib/utils';
import type { Meeting } from '@pvot/core/types';

// ─── ACCOUNT COLOR MAP ────────────────────────────────────────────────────────

const ACCOUNT_COLORS = [
  '#3D87FF', '#10B981', '#F59E0B',
  '#E879F9', '#38BDF8', '#FB923C', '#A78BFA',
] as const;

// ─── PROPS ────────────────────────────────────────────────────────────────────

interface MeetingCardProps {
  meeting:     Meeting;
  timezone:    string;
  isSelected:  boolean;
  isPrivate:   boolean;   // privacy mode active
  onSelect:    (id: string) => void;
  onJoin?:     (url: string) => void;
  style?:      React.CSSProperties; // from react-window
  className?:  string;
}

// ─── COMPONENT ────────────────────────────────────────────────────────────────

export const MeetingCard = memo(function MeetingCard({
  meeting,
  timezone,
  isSelected,
  isPrivate,
  onSelect,
  onJoin,
  style,
  className,
}: MeetingCardProps) {
  const accentColor = ACCOUNT_COLORS[meeting.colorIndex];
  const isCancelled = meeting.status === 'cancelled';
  const isTentative = meeting.status === 'tentative';
  const isDeclined  = meeting.selfRsvp === 'declined';
  const dimmed      = isCancelled || isDeclined;

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onSelect(meeting.id);
      }
    },
    [meeting.id, onSelect],
  );

  const handleJoinClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (meeting.videoLink?.url) {
        onJoin?.(meeting.videoLink.url);
        window.open(meeting.videoLink.url, '_blank', 'noopener,noreferrer');
      }
    },
    [meeting.videoLink, onJoin],
  );

  const timeRange = formatTimeRange(meeting.startUtc, meeting.endUtc, timezone);
  const duration  = formatDuration(meeting.startUtc, meeting.endUtc);

  return (
    <article
      role="button"
      tabIndex={0}
      aria-selected={isSelected}
      aria-label={`${meeting.title}, ${timeRange}, ${duration}`}
      aria-describedby={meeting.isConflict ? `conflict-${meeting.id}` : undefined}
      style={style}
      onClick={() => onSelect(meeting.id)}
      onKeyDown={handleKeyDown}
      data-color-index={meeting.colorIndex}
      className={cn(
        // Base
        'group relative flex gap-3 rounded-md cursor-pointer',
        'border transition-all duration-base ease-standard',
        'focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 focus-visible:ring-offset-canvas',
        'outline-none select-none',

        // Padding
        'px-3 py-3',

        // Default state
        !isSelected && 'bg-raised border-rim hover:bg-overlay hover:border-divider',
        !isSelected && 'hover:-translate-y-0.5 hover:shadow-elev-2',

        // Selected state
        isSelected && 'bg-overlay border-blue-500/50 shadow-elev-2',

        // Conflict state
        meeting.isConflict && !isSelected && 'border-warning/30 bg-warning/5',

        // Dimmed states
        dimmed && 'opacity-50',

        className,
      )}
    >
      {/* ── Account color bar ─────────────────────────────────────────────── */}
      <div
        aria-hidden="true"
        className="absolute left-0 top-3 bottom-3 w-0.5 rounded-full"
        style={{ backgroundColor: accentColor }}
      />

      {/* ── Time column ──────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 w-[72px] pt-px">
        <time
          dateTime={meeting.startUtc}
          className="text-label-sm font-mono text-secondary tabular-nums block"
        >
          {timeRange.split('–')[0].trim()}
        </time>
        <span className="text-label-xs font-mono text-muted tabular-nums block mt-0.5">
          {duration}
        </span>
      </div>

      {/* ── Content ──────────────────────────────────────────────────────── */}
      <div className="flex-1 min-w-0">
        {/* Title row */}
        <div className="flex items-start gap-2 mb-1">
          <h3
            className={cn(
              'text-ui-md font-body font-medium text-primary leading-snug',
              'flex-1 min-w-0',
              isCancelled && 'line-through text-muted',
              isPrivate && 'privacy-blur',
            )}
          >
            {meeting.title}
          </h3>

          {/* Join button — only when video link present */}
          {meeting.videoLink && !isCancelled && (
            <button
              onClick={handleJoinClick}
              aria-label={`Join ${meeting.title} via ${meeting.videoLink.label}`}
              className={cn(
                'flex-shrink-0 inline-flex items-center gap-1.5',
                'px-2.5 py-1 rounded-sm text-label-sm font-body font-medium',
                'bg-blue-500 text-white',
                'opacity-0 group-hover:opacity-100',
                isSelected && 'opacity-100',
                'transition-all duration-fast ease-standard',
                'hover:bg-blue-600 active:bg-blue-700',
                'focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none',
              )}
            >
              <Video className="w-3 h-3" aria-hidden="true" />
              Join
            </button>
          )}
        </div>

        {/* Badges row */}
        <div className="flex flex-wrap items-center gap-1.5">
          {/* Conflict badge */}
          {meeting.isConflict && (
            <span id={`conflict-${meeting.id}`}>
              <Badge
                label="Conflict"
                variant="amber"
                dot
              />
            </span>
          )}

          {/* No buffer badge */}
          {meeting.hasNoBuffer && !meeting.isConflict && (
            <Badge label="Back-to-back" variant="outline" />
          )}

          {/* Tentative badge */}
          {isTentative && <Badge label="Tentative" variant="outline" />}

          {/* Declined badge */}
          {isDeclined && <Badge label="Declined" variant="outline" />}

          {/* Account name badge */}
          <span
            className="text-label-xs font-body"
            style={{ color: `${accentColor}aa` }}
          >
            {meeting.calendarName}
          </span>
        </div>

        {/* Attendees row — max 4 visible */}
        {meeting.attendees.length > 0 && (
          <div
            className={cn('flex items-center gap-1 mt-2', isPrivate && 'privacy-blur')}
            aria-label={`${meeting.attendees.length} attendees`}
          >
            <div className="flex -space-x-1">
              {meeting.attendees.slice(0, 4).map((attendee) => (
                <Avatar
                  key={attendee.email}
                  name={attendee.displayName ?? attendee.email}
                  size="xs"
                  className="ring-1 ring-canvas"
                />
              ))}
            </div>
            {meeting.attendees.length > 4 && (
              <span className="text-label-xs font-body text-muted ml-1">
                +{meeting.attendees.length - 4}
              </span>
            )}
          </div>
        )}
      </div>
    </article>
  );
});

// ─── SKELETON VARIANT ─────────────────────────────────────────────────────────

export function MeetingCardSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="flex gap-3 px-3 py-3 rounded-md bg-raised border border-rim"
    >
      <div className="flex-shrink-0 w-[72px] space-y-2 pt-1">
        <div className="skeleton h-3 w-14" />
        <div className="skeleton h-2.5 w-10" />
      </div>
      <div className="flex-1 min-w-0 space-y-2">
        <div className="skeleton h-4 w-3/4" />
        <div className="skeleton h-3 w-1/3" />
        <div className="flex gap-1 mt-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton w-5 h-5 rounded-full" />
          ))}
        </div>
      </div>
    </div>
  );
}
