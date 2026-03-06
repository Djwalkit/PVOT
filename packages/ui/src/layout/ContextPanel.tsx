/**
 * packages/ui/src/layout/ContextPanel.tsx
 * PVOT — Layer 3: Context Panel (Right, 320px)
 *
 * Two modes:
 *   IDLE:    Live local clock widget. Date, time, timezone label.
 *            Conflict summary badge if any exist.
 *   DETAIL:  Full meeting detail: title, time range, attendees with RSVP status,
 *            description (sanitized), extracted video links, location.
 *
 * Transition: cross-fade between modes with slide-in-right animation.
 * Keyboard: Esc closes detail mode and returns to idle.
 */

'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  X, Video, MapPin, Users, Clock, ExternalLink,
  Copy, Check, Calendar, ChevronDown,
} from 'lucide-react';
import { cn }            from '../lib/utils';
import { Avatar, Badge, Button, IconButton, Divider, Tooltip } from '../primitives';
import {
  formatDisplayTime, formatTimeRange, formatDuration,
  formatDateHeading, formatTimezoneLabel, formatLiveClock,
} from '../lib/utils';
import { useCalendarQuery }  from '@pvot/query/useCalendarQuery';
import { useUIStore }        from '@pvot/core/stores';
import { getConflictSummary }from '@pvot/core/calendar/ConflictDetector';
import { getProviderName }   from '@pvot/core/calendar/LinkExtractor';
import type { Meeting, Attendee, VideoLink } from '@pvot/core/types';

// ─── CONTEXT PANEL ────────────────────────────────────────────────────────────

interface ContextPanelProps {
  className?: string;
}

export function ContextPanel({ className }: ContextPanelProps) {
  const selectedEventId  = useUIStore((s) => s.selectedEventId);
  const closeContextPanel= useUIStore((s) => s.closeContextPanel);
  const privacyMode      = useUIStore((s) => s.privacyMode);
  const { meetings, timezone } = useCalendarQuery();

  const selectedMeeting  = meetings.find((m) => m.id === selectedEventId) ?? null;

  // Keyboard: Esc closes detail
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selectedEventId) {
        e.preventDefault();
        closeContextPanel();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedEventId, closeContextPanel]);

  return (
    <aside
      aria-label={selectedMeeting ? `Event detail: ${selectedMeeting.title}` : 'Context panel'}
      className={cn(
        'flex flex-col h-full bg-base border-l border-divider',
        'w-context-panel flex-shrink-0',
        className,
      )}
    >
      {selectedMeeting ? (
        <MeetingDetail
          key={selectedMeeting.id}
          meeting={selectedMeeting}
          timezone={timezone}
          privacyMode={privacyMode}
          onClose={closeContextPanel}
        />
      ) : (
        <IdlePanel timezone={timezone} meetings={meetings} />
      )}
    </aside>
  );
}

// ─── IDLE PANEL ───────────────────────────────────────────────────────────────

function IdlePanel({ timezone, meetings }: { timezone: string; meetings: Meeting[] }) {
  const [clock, setClock] = useState(() => formatLiveClock(timezone));

  useEffect(() => {
    const id = setInterval(() => setClock(formatLiveClock(timezone)), 1000);
    return () => clearInterval(id);
  }, [timezone]);

  const conflicts = getConflictSummary(meetings);
  const tzLabel   = formatTimezoneLabel(timezone);

  return (
    <div className="flex flex-col h-full px-5 py-6 animate-fade-in">
      {/* Live clock widget */}
      <section aria-label="Local time" className="mb-6">
        <div className="text-display-sm font-mono text-primary tracking-tighter tabular-nums leading-none">
          {clock}
        </div>
        <div className="mt-2 text-body-sm font-body text-secondary">
          {formatDateHeading(new Date().toISOString(), timezone)}
        </div>
        <div className="mt-1 flex items-center gap-2">
          <span className="text-label-xs font-mono text-muted">{tzLabel}</span>
        </div>
      </section>

      <Divider />

      {/* Day summary */}
      <section aria-label="Day summary" className="mt-5 space-y-3">
        <h2 className="text-label-xs font-body font-medium text-muted uppercase tracking-widest">
          Day Summary
        </h2>

        <SummaryRow
          label="Total meetings"
          value={String(meetings.filter((m) => !m.isAllDay).length)}
        />
        <SummaryRow
          label="All-day events"
          value={String(meetings.filter((m) => m.isAllDay).length)}
        />

        {conflicts.total > 0 && (
          <div className="mt-3 p-3 rounded-md bg-warning/5 border border-warning/15 space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-label-xs font-body font-medium text-warning uppercase tracking-widest">
                Conflicts detected
              </span>
            </div>
            {conflicts.overlapCount > 0 && (
              <SummaryRow
                label="Overlapping meetings"
                value={String(conflicts.overlapCount)}
                valueClassName="text-warning"
              />
            )}
            {conflicts.noBufferCount > 0 && (
              <SummaryRow
                label="Back-to-back transitions"
                value={String(conflicts.noBufferCount)}
                valueClassName="text-warning"
              />
            )}
          </div>
        )}
      </section>

      <Divider className="mt-5" />

      {/* Upcoming event hint */}
      <UpcomingHint meetings={meetings} timezone={timezone} />
    </div>
  );
}

function SummaryRow({
  label, value, valueClassName,
}: { label: string; value: string; valueClassName?: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-body-sm font-body text-secondary">{label}</span>
      <span className={cn('text-body-sm font-mono text-primary tabular-nums', valueClassName)}>
        {value}
      </span>
    </div>
  );
}

function UpcomingHint({ meetings, timezone }: { meetings: Meeting[]; timezone: string }) {
  const nowMs   = Date.now();
  const upcoming = meetings.find((m) => new Date(m.startUtc).getTime() > nowMs);
  if (!upcoming) return null;

  return (
    <div className="mt-5 space-y-2">
      <h2 className="text-label-xs font-body font-medium text-muted uppercase tracking-widest">
        Up next
      </h2>
      <div className="p-3 rounded-md bg-raised border border-rim">
        <p className="text-body-sm font-body text-primary font-medium leading-snug truncate">
          {upcoming.title}
        </p>
        <p className="text-label-sm font-mono text-muted mt-1 tabular-nums">
          {formatDisplayTime(upcoming.startUtc, timezone)}
        </p>
      </div>
    </div>
  );
}

// ─── MEETING DETAIL ───────────────────────────────────────────────────────────

interface MeetingDetailProps {
  meeting:     Meeting;
  timezone:    string;
  privacyMode: boolean;
  onClose:     () => void;
}

function MeetingDetail({ meeting, timezone, privacyMode, onClose }: MeetingDetailProps) {
  const closeRef = useRef<HTMLButtonElement>(null);

  // Focus close button on mount for keyboard users
  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  const timeRange = formatTimeRange(meeting.startUtc, meeting.endUtc, timezone);
  const duration  = formatDuration(meeting.startUtc, meeting.endUtc);

  return (
    <div className="flex flex-col h-full animate-slide-in-right">
      {/* Header */}
      <div className="flex items-start gap-3 px-5 pt-5 pb-4 border-b border-divider flex-shrink-0">
        <div className="flex-1 min-w-0">
          <h2
            className={cn(
              'text-heading-sm font-display text-primary leading-snug text-balance',
              privacyMode && 'privacy-blur',
            )}
          >
            {meeting.title}
          </h2>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <time
              dateTime={meeting.startUtc}
              className="text-label-sm font-mono text-secondary tabular-nums"
            >
              {timeRange}
            </time>
            <span className="text-ghost" aria-hidden="true">·</span>
            <span className="text-label-sm font-body text-muted">{duration}</span>
          </div>
        </div>
        <IconButton
          ref={closeRef}
          label="Close event detail"
          size="sm"
          onClick={onClose}
        >
          <X className="w-4 h-4" />
        </IconButton>
      </div>

      {/* Scrollable detail body */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5 min-h-0">

        {/* Status badges */}
        <div className="flex flex-wrap gap-1.5">
          {meeting.isConflict  && <Badge label="Conflict"    variant="amber"   dot />}
          {meeting.hasNoBuffer && <Badge label="Back-to-back" variant="outline" />}
          {meeting.status === 'tentative' && <Badge label="Tentative" variant="outline" />}
          {meeting.selfRsvp === 'declined' && <Badge label="Declined"  variant="danger"  />}
          {meeting.selfRsvp === 'accepted' && <Badge label="Accepted"  variant="emerald" />}
        </div>

        {/* Video join links */}
        {meeting.allVideoLinks.length > 0 && (
          <section aria-label="Video conference links">
            {meeting.allVideoLinks.map((link) => (
              <VideoLinkButton key={link.url} link={link} />
            ))}
          </section>
        )}

        <Divider />

        {/* Time & location */}
        <section aria-label="Event time and location" className="space-y-2.5">
          <DetailRow
            icon={<Clock className="w-4 h-4" aria-hidden="true" />}
            label="Time"
          >
            <span className="text-body-sm font-mono text-primary tabular-nums">{timeRange}</span>
            <span className="text-label-xs font-body text-muted">{formatTimezoneLabel(timezone)}</span>
          </DetailRow>

          {meeting.location && (
            <DetailRow
              icon={<MapPin className="w-4 h-4" aria-hidden="true" />}
              label="Location"
            >
              <span className={cn('text-body-sm font-body text-primary', privacyMode && 'privacy-blur')}>
                {meeting.location}
              </span>
            </DetailRow>
          )}
        </section>

        <Divider />

        {/* Attendees */}
        {meeting.attendees.length > 0 && (
          <section aria-label={`${meeting.attendees.length} attendees`}>
            <h3 className="text-label-xs font-body font-medium text-muted uppercase tracking-widest mb-3">
              Attendees ({meeting.attendees.length})
            </h3>
            <ul
              role="list"
              className={cn('space-y-2', privacyMode && 'privacy-blur')}
              aria-label="Attendee list"
            >
              {meeting.attendees.slice(0, 8).map((attendee) => (
                <AttendeeRow key={attendee.email} attendee={attendee} />
              ))}
              {meeting.attendees.length > 8 && (
                <li className="text-label-xs font-body text-muted pl-9">
                  +{meeting.attendees.length - 8} more attendees
                </li>
              )}
            </ul>
          </section>
        )}

        {/* Description */}
        {meeting.description && (
          <>
            <Divider />
            <section aria-label="Event description">
              <h3 className="text-label-xs font-body font-medium text-muted uppercase tracking-widest mb-2">
                Notes
              </h3>
              <div
                className={cn(
                  'text-body-sm font-body text-secondary leading-relaxed',
                  'max-h-36 overflow-y-auto',
                  privacyMode && 'privacy-blur',
                )}
                // description is from Google Calendar, may contain HTML — strip it
                dangerouslySetInnerHTML={{
                  __html: sanitizeDescription(meeting.description),
                }}
              />
            </section>
          </>
        )}
      </div>

      {/* Footer: open in Google Calendar */}
      <div className="px-5 py-4 border-t border-divider flex-shrink-0">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => window.open(meeting.htmlLink, '_blank', 'noopener')}
          iconLeft={<ExternalLink className="w-3.5 h-3.5" />}
          className="w-full justify-start text-muted hover:text-secondary"
        >
          Open in Google Calendar
        </Button>
      </div>
    </div>
  );
}

// ─── SUB-COMPONENTS ───────────────────────────────────────────────────────────

function VideoLinkButton({ link }: { link: VideoLink }) {
  return (
    <a
      href={link.url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={link.label}
      className={cn(
        'flex items-center gap-3 w-full px-4 py-3 rounded-md',
        'bg-blue-500 hover:bg-blue-600 active:bg-blue-700',
        'text-white transition-all duration-fast ease-standard',
        'focus-ring hover:-translate-y-0.5 hover:shadow-elev-2',
      )}
    >
      <Video className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
      <span className="text-ui-md font-body font-medium">{link.label}</span>
      <ExternalLink className="w-3.5 h-3.5 ml-auto opacity-60" aria-hidden="true" />
    </a>
  );
}

function AttendeeRow({ attendee }: { attendee: Attendee }) {
  const rsvpConfig = {
    accepted:     { label: 'Accepted',     class: 'text-emerald-400' },
    declined:     { label: 'Declined',     class: 'text-danger'      },
    tentative:    { label: 'Maybe',        class: 'text-warning'     },
    needsAction:  { label: 'No response',  class: 'text-muted'       },
  };
  const rsvp = rsvpConfig[attendee.responseStatus];

  return (
    <li className="flex items-center gap-2.5">
      <Avatar
        name={attendee.displayName ?? attendee.email}
        size="sm"
      />
      <div className="flex-1 min-w-0">
        <p className="text-body-sm font-body text-primary truncate leading-tight">
          {attendee.displayName ?? attendee.email}
        </p>
        <p className="text-label-xs font-body text-muted truncate">
          {attendee.email}
        </p>
      </div>
      <span className={cn('text-label-xs font-body flex-shrink-0', rsvp.class)}>
        {rsvp.label}
      </span>
    </li>
  );
}

function DetailRow({
  icon, label, children,
}: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="text-muted mt-0.5 flex-shrink-0" aria-hidden="true">{icon}</span>
      <div className="flex-1 min-w-0 space-y-0.5">
        <span className="sr-only">{label}: </span>
        {children}
      </div>
    </div>
  );
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function sanitizeDescription(html: string): string {
  // Allow only safe inline formatting — strip scripts, iframes, event handlers
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<iframe[^>]*>[\s\S]*?<\/iframe>/gi, '')
    .replace(/on\w+="[^"]*"/gi, '')
    .replace(/on\w+='[^']*'/gi, '');
}

// ─── LIVE CLOCK FORMATTERS (imported from utils) ─────────────────────────────
// Re-exported to keep this file self-contained in reading — implementations live in utils.ts

function formatTimezoneLabel(timezone: string): string {
  const now   = new Date();
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: timezone, timeZoneName: 'short' })
    .formatToParts(now);
  const abbr  = parts.find((p) => p.type === 'timeZoneName')?.value ?? '';
  return abbr;
}

function formatLiveClock(timezone: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false, timeZone: timezone,
  }).format(new Date());
}
