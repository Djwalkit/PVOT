/**
 * apps/web/src/components/AlarmOverlay.tsx
 * PVOT — Progressive Alarm Overlay
 *
 * Renders nothing for gentle alarms (those are browser notifications).
 * Renders a bottom sheet for urgent alarms (T-2 mins).
 * Renders a full screen takeover for persistent alarms (meeting started).
 */

'use client';

import { useEffect, useRef }  from 'react';
import { usePVOTStore }        from '@pvot/core/stores/pvotStore';
import type { ActiveAlarm }    from '@pvot/core/types';

export function AlarmOverlay() {
  const activeAlarms  = usePVOTStore((s) => s.activeAlarms);
  const dismissAlarm  = usePVOTStore((s) => s.dismissAlarm);
  const snoozeAlarm   = usePVOTStore((s) => s.snoozeAlarm);
  const alarmConfig   = usePVOTStore((s) => s.alarmConfig);

  const urgentAlarms     = activeAlarms.filter((a) => a.level === 'urgent');
  const persistentAlarms = activeAlarms.filter((a) => a.level === 'persistent');

  // Show persistent first, then urgent
  const topAlarm = persistentAlarms[0] ?? urgentAlarms[0] ?? null;

  if (!topAlarm) return null;

  if (topAlarm.level === 'persistent') {
    return (
      <PersistentOverlay
        alarm={topAlarm}
        snoozeMinutes={alarmConfig.snoozeMinutes}
        onDismiss={() => dismissAlarm(topAlarm.meetingId)}
        onSnooze={() => snoozeAlarm(topAlarm.meetingId)}
      />
    );
  }

  return (
    <UrgentSheet
      alarm={topAlarm}
      snoozeMinutes={alarmConfig.snoozeMinutes}
      onDismiss={() => dismissAlarm(topAlarm.meetingId)}
      onSnooze={() => snoozeAlarm(topAlarm.meetingId)}
    />
  );
}

// ─── PERSISTENT OVERLAY (full screen) ────────────────────────────────────────

function PersistentOverlay({
  alarm,
  snoozeMinutes,
  onDismiss,
  onSnooze,
}: {
  alarm:         ActiveAlarm;
  snoozeMinutes: number;
  onDismiss:     () => void;
  onSnooze:      () => void;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Play alarm sound
  useEffect(() => {
    const audio = new Audio('/sounds/alarm.mp3');
    audio.loop  = true;
    audio.play().catch(() => {}); // user may not have interacted yet
    audioRef.current = audio;
    return () => { audio.pause(); audio.currentTime = 0; };
  }, []);

  const startTime = new Intl.DateTimeFormat('en-GB', {
    hour:   '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(alarm.startUtc));

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center
                    bg-black/90 backdrop-blur-md animate-fade-in">
      {/* Pulse ring */}
      <div className="absolute w-64 h-64 rounded-full bg-red-500/10 animate-ping" />
      <div className="absolute w-48 h-48 rounded-full bg-red-500/20 animate-ping
                      [animation-delay:150ms]" />

      <div className="relative z-10 flex flex-col items-center gap-6 text-center px-8">
        {/* Icon */}
        <div className="w-20 h-20 rounded-full bg-red-500/20 border-2 border-red-500/50
                        flex items-center justify-center">
          <span className="text-4xl">🔔</span>
        </div>

        {/* Meeting info */}
        <div>
          <p className="text-sm text-red-400 uppercase tracking-widest font-medium mb-2">
            Meeting Started
          </p>
          <h1 className="text-3xl font-bold text-white mb-1">
            {alarm.meetingTitle}
          </h1>
          <p className="text-lg text-white/60">{startTime}</p>
        </div>

        {/* Join button */}
        {alarm.videoLink && (
          <a
            href={alarm.videoLink.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={onDismiss}
            className="w-full max-w-xs py-4 rounded-2xl bg-green-500 hover:bg-green-400
                       text-white text-xl font-bold text-center transition-colors
                       shadow-lg shadow-green-500/30"
          >
            Join Now →
          </a>
        )}

        {/* Actions */}
        <div className="flex gap-3 w-full max-w-xs">
          <button
            onClick={onSnooze}
            className="flex-1 py-3 rounded-xl bg-white/10 hover:bg-white/20
                       text-white font-medium transition-colors"
          >
            Snooze {snoozeMinutes}m
          </button>
          <button
            onClick={onDismiss}
            className="flex-1 py-3 rounded-xl bg-white/10 hover:bg-white/20
                       text-white font-medium transition-colors"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── URGENT SHEET (bottom sheet T-2 mins) ────────────────────────────────────

function UrgentSheet({
  alarm,
  snoozeMinutes,
  onDismiss,
  onSnooze,
}: {
  alarm:         ActiveAlarm;
  snoozeMinutes: number;
  onDismiss:     () => void;
  onSnooze:      () => void;
}) {
  const minsLeft = Math.max(
    0,
    Math.round((new Date(alarm.startUtc).getTime() - Date.now()) / 60_000),
  );

  return (
    <div className="fixed bottom-24 left-0 right-0 z-[9998] px-4 animate-slide-up">
      <div className="max-w-lg mx-auto bg-orange-500/95 backdrop-blur-sm
                      rounded-2xl p-4 shadow-2xl shadow-orange-500/30
                      border border-orange-400/30">
        <div className="flex items-center gap-3 mb-3">
          <span className="text-2xl">⏰</span>
          <div className="flex-1">
            <p className="font-bold text-white">{alarm.meetingTitle}</p>
            <p className="text-orange-100 text-sm">
              Starting in {minsLeft} minute{minsLeft !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          {alarm.videoLink && (
            <a
              href={alarm.videoLink.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={onDismiss}
              className="flex-1 py-2.5 rounded-xl bg-white text-orange-600
                         font-bold text-center text-sm hover:bg-orange-50
                         transition-colors"
            >
              Join Meeting
            </a>
          )}
          <button
            onClick={onSnooze}
            className="px-4 py-2.5 rounded-xl bg-orange-600/50 text-white
                       text-sm font-medium hover:bg-orange-600/70 transition-colors"
          >
            {snoozeMinutes}m
          </button>
          <button
            onClick={onDismiss}
            className="px-4 py-2.5 rounded-xl bg-orange-600/50 text-white
                       text-sm font-medium hover:bg-orange-600/70 transition-colors"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}