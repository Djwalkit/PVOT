/**
 * packages/ui/src/layout/GlobalHeader.tsx
 * PVOT — Global Header
 *
 * Shows:
 * - Live clocks for all user-configured home zones (DST-safe)
 * - Active workspace indicator
 * - AI daily briefing button
 * - Privacy mode toggle
 * - Date navigation
 */

'use client';

import { useState, useEffect, useMemo } from 'react';
import { Eye, EyeOff, ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';
import { usePVOTStore } from '@pvot/core/stores/pvotStore';
import { cn }           from '../lib/utils';

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function formatClock(timezone: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false, timeZone: timezone,
  }).format(new Date());
}

function formatTzLabel(timezone: string): string {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone, timeZoneName: 'short',
    }).formatToParts(new Date());
    return parts.find((p) => p.type === 'timeZoneName')?.value ?? timezone;
  } catch { return timezone; }
}

function formatDate(dateStr: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long',
  }).format(new Date(dateStr + 'T12:00:00'));
}

function isToday(dateStr: string): boolean {
  return dateStr === new Date().toISOString().split('T')[0];
}

// ─── LIVE CLOCK ───────────────────────────────────────────────────────────────

function useLiveClock(timezone: string) {
  const [state, setState] = useState({ time: '', label: '' });

  useEffect(() => {
    const update = () => setState({
      time:  formatClock(timezone),
      label: formatTzLabel(timezone),
    });
    update();
    const msUntilNextSecond = 1000 - (Date.now() % 1000);
    let interval: ReturnType<typeof setInterval>;
    const timeout = setTimeout(() => {
      update();
      interval = setInterval(update, 1000);
    }, msUntilNextSecond);
    return () => { clearTimeout(timeout); clearInterval(interval); };
  }, [timezone]);

  return state;
}

// ─── ZONE CLOCK ───────────────────────────────────────────────────────────────

function ZoneClock({ timezone, label }: { timezone: string; label: string }) {
  const clock   = useLiveClock(timezone);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <div className="flex flex-col items-center min-w-[90px]">
      <span className="text-[10px] text-muted uppercase tracking-widest font-medium">
        {label}
      </span>
      <span
        className="font-mono text-sm font-semibold text-primary tabular-nums"
        suppressHydrationWarning
      >
        {mounted ? clock.time : '--:--:--'}
      </span>
      <span
        className="text-[9px] text-muted/70"
        suppressHydrationWarning
      >
        {mounted ? clock.label : ''}
      </span>
    </div>
  );
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────

export function GlobalHeader() {
  const homeZones    = usePVOTStore((s) => s.homeZones);
  const viewDate     = usePVOTStore((s) => s.viewDate);
  const setViewDate  = usePVOTStore((s) => s.setViewDate);
  const goToToday    = usePVOTStore((s) => s.goToToday);
  const privacyMode  = usePVOTStore((s) => s.togglePrivacy);
  const isPrivate    = usePVOTStore((s) => s.privacyMode);
  const workspaces   = usePVOTStore((s) => s.workspaces);
  const aiConfig     = usePVOTStore((s) => s.aiConfig);

  const [showBriefing, setShowBriefing] = useState(false);

  const sortedZones = useMemo(
    () => [...homeZones].sort((a, b) => a.order - b.order),
    [homeZones],
  );

  const prevDay = () => {
    const d = new Date(viewDate + 'T12:00:00');
    d.setDate(d.getDate() - 1);
    setViewDate(d.toISOString().split('T')[0]);
  };

  const nextDay = () => {
    const d = new Date(viewDate + 'T12:00:00');
    d.setDate(d.getDate() + 1);
    setViewDate(d.toISOString().split('T')[0]);
  };

  return (
    <header className="sticky top-0 z-40 glass-bar border-b border-white/10 px-4 py-2">
      <div className="max-w-screen-xl mx-auto flex items-center gap-4">

        {/* ── Logo ── */}
        <div className="flex items-center gap-2 mr-2">
          <span className="text-lg font-bold text-primary tracking-tight">PVOT</span>
          {workspaces.length > 0 && (
            <span className="text-xs text-muted">
              {workspaces.length} workspace{workspaces.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {/* ── Home Zone Clocks ── */}
        <div className="flex items-center gap-1 flex-1">
          {sortedZones.length === 0 ? (
            <span className="text-xs text-muted">
              Add home zones in Settings
            </span>
          ) : (
            <>
              {sortedZones.map((zone, i) => (
                <div key={zone.id} className="flex items-center">
                  <ZoneClock timezone={zone.timezone} label={zone.label} />
                  {i < sortedZones.length - 1 && (
                    <div className="w-px h-8 bg-white/10 mx-2" />
                  )}
                </div>
              ))}
            </>
          )}
        </div>

        {/* ── Date Navigation ── */}
        <div className="flex items-center gap-1">
          <button
            onClick={prevDay}
            className="p-1.5 rounded-lg text-muted hover:text-primary
                       hover:bg-white/5 transition-colors"
            aria-label="Previous day"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <button
            onClick={goToToday}
            className={cn(
              'px-3 py-1 rounded-lg text-xs font-medium transition-colors',
              isToday(viewDate)
                ? 'bg-blue-500/20 text-blue-400'
                : 'text-muted hover:text-primary hover:bg-white/5',
            )}
          >
            {isToday(viewDate) ? 'Today' : formatDate(viewDate)}
          </button>

          <button
            onClick={nextDay}
            className="p-1.5 rounded-lg text-muted hover:text-primary
                       hover:bg-white/5 transition-colors"
            aria-label="Next day"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* ── AI Briefing button ── */}
        {aiConfig.dailyBriefingEnabled && (
          <button
            onClick={() => setShowBriefing((v) => !v)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium',
              'transition-all duration-150 border',
              showBriefing
                ? 'bg-purple-500/20 border-purple-500/40 text-purple-400'
                : 'bg-white/5 border-white/10 text-muted hover:text-primary hover:bg-white/10',
            )}
          >
            <Sparkles className="w-3.5 h-3.5" />
            Briefing
          </button>
        )}

        {/* ── Privacy toggle ── */}
        <button
          onClick={privacyMode}
          className="p-1.5 rounded-lg text-muted hover:text-primary
                     hover:bg-white/5 transition-colors"
          aria-label={isPrivate ? 'Disable privacy mode' : 'Enable privacy mode'}
        >
          {isPrivate
            ? <EyeOff className="w-4 h-4 text-orange-400" />
            : <Eye    className="w-4 h-4" />
          }
        </button>

      </div>
    </header>
  );
}