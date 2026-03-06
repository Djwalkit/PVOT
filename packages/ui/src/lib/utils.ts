/**
 * packages/ui/src/lib/utils.ts  (Phase 3 — complete)
 * PVOT — UI Display Utilities
 *
 * All timezone operations delegate to Intl. Pure functions, no side effects.
 */

import { clsx, type ClassValue } from 'clsx';
import { twMerge }               from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

const PALETTE = ['#3D87FF','#10B981','#F59E0B','#E879F9','#38BDF8','#FB923C','#A78BFA'] as const;
export function getAccountColor(colorIndex: 0|1|2|3|4|5|6): string {
  return PALETTE[colorIndex] ?? PALETTE[0];
}

export function formatDisplayTime(utcIso: string, timezone: string): string {
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric', minute: '2-digit', hour12: true, timeZone: timezone,
  }).format(new Date(utcIso));
}

export function formatTimeRange(startUtc: string, endUtc: string, timezone: string): string {
  const fmt = (iso: string) => new Intl.DateTimeFormat('en-US', {
    hour: 'numeric', minute: '2-digit', hour12: true, timeZone: timezone,
  }).format(new Date(iso));
  const start = fmt(startUtc);
  const end   = fmt(endUtc);
  const startPeriod = start.split(' ')[1];
  const endPeriod   = end.split(' ')[1];
  return startPeriod === endPeriod
    ? `${start.replace(` ${startPeriod}`, '')}–${end}`
    : `${start}–${end}`;
}

export function formatDuration(startUtc: string, endUtc: string): string {
  const mins = Math.round((new Date(endUtc).getTime() - new Date(startUtc).getTime()) / 60_000);
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

export function formatDateHeading(utcIso: string, timezone: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: timezone,
  }).format(new Date(utcIso));
}

export function formatLiveClock(timezone: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, timeZone: timezone,
  }).format(new Date());
}

export function formatTimezoneLabel(timezone: string): string {
  const now   = new Date();
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone, timeZoneName: 'short',
  }).formatToParts(now);
  const abbr = parts.find((p) => p.type === 'timeZoneName')?.value ?? '';
  const localMs = new Date(now.toLocaleString('en-US', { timeZone: timezone })).getTime();
  const utcMs   = new Date(now.toLocaleString('en-US', { timeZone: 'UTC' })).getTime();
  const offsetMin = Math.round((localMs - utcMs) / 60_000);
  const sign = offsetMin >= 0 ? '+' : '-';
  const h    = Math.floor(Math.abs(offsetMin) / 60);
  const m    = Math.abs(offsetMin) % 60;
  const offset = m === 0 ? `${sign}${h}` : `${sign}${h}:${String(m).padStart(2,'0')}`;
  return `${abbr} (UTC${offset})`;
}

export function gapMinutes(endUtc: string, nextStartUtc: string): number {
  return Math.round(
    (new Date(nextStartUtc).getTime() - new Date(endUtc).getTime()) / 60_000,
  );
}

export function doMeetingsOverlap(
  a: { startUtc: string; endUtc: string },
  b: { startUtc: string; endUtc: string },
): boolean {
  return new Date(a.startUtc).getTime() < new Date(b.endUtc).getTime() &&
         new Date(a.endUtc).getTime()   > new Date(b.startUtc).getTime();
}
