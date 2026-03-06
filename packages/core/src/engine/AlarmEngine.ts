/**
 * packages/core/src/engine/AlarmEngine.ts
 * PVOT — Progressive Intelligent Alarm Engine
 */

import { usePVOTStore }  from '../stores/pvotStore';
import type { Meeting, ActiveAlarm, AlarmLevel } from '../types';

const TICK_MS = 30_000;

export class AlarmEngine {
  private _timer:    ReturnType<typeof setInterval> | null = null;
  private _meetings: Meeting[] = [];

  setMeetings(meetings: Meeting[]): void {
    // Guard: filter out any undefined/null entries defensively
    this._meetings = meetings.filter(Boolean);
    this._tick();
  }

  start(): void {
    if (this._timer) return;
    this._tick();
    this._timer = setInterval(() => this._tick(), TICK_MS);
  }

  stop(): void {
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
  }

  private _tick(): void {
    const store  = usePVOTStore.getState();
    const config = store.alarmConfig;
    if (!config.enabled) return;

    const now       = Date.now();
    const newAlarms: ActiveAlarm[] = [];

    for (const meeting of this._meetings) {
      // Defensive guards — skip malformed entries
      if (!meeting)            continue;
      if (!meeting.startUtc)   continue;
      if (!meeting.endUtc)     continue;
      if (meeting.isAllDay)    continue;
      if (meeting.status === 'cancelled') continue;

      const startMs  = new Date(meeting.startUtc).getTime();
      const endMs    = new Date(meeting.endUtc).getTime();
      const minsLeft = (startMs - now) / 60_000;

      // Meeting already ended
      if (now > endMs) continue;

      // Too far in future — only care about next 60 mins
      if (minsLeft > 60) continue;

      // Check if snoozed
      const existing = store.activeAlarms.find((a) => a.meetingId === meeting.id);
      if (existing?.snoozedUntil && now < existing.snoozedUntil) continue;

      let level: AlarmLevel | null = null;

      if (now >= startMs) {
        level = 'persistent';
      } else if (minsLeft <= config.urgentTakeoverMins) {
        level = 'urgent';
      } else if (minsLeft <= config.gentlePingMins) {
        level = 'gentle';
      }

      if (!level) continue;

      newAlarms.push({
        meetingId:    meeting.id,
        meetingTitle: meeting.title ?? 'Meeting',
        level,
        startUtc:     meeting.startUtc,
        videoLink:    meeting.videoLink ?? null,
        snoozedUntil: existing?.snoozedUntil ?? null,
      });
    }

    store.setActiveAlarms(newAlarms);

    // Fire browser notification for new gentle alarms
    if (typeof window !== 'undefined' && 'Notification' in window) {
      for (const alarm of newAlarms) {
        const wasAlreadyFiring = store.activeAlarms.some(
          (a) => a.meetingId === alarm.meetingId && a.level === alarm.level,
        );
        if (!wasAlreadyFiring && alarm.level === 'gentle') {
          this._sendNotification(alarm);
        }
      }
    }
  }

  private _sendNotification(alarm: ActiveAlarm): void {
    if (Notification.permission !== 'granted') return;
    const minsLeft = Math.round(
      (new Date(alarm.startUtc).getTime() - Date.now()) / 60_000,
    );
    new Notification(`⏰ ${alarm.meetingTitle}`, {
      body: `Starting in ${minsLeft} minutes`,
      icon: '/icon.png',
      tag:  `pvot-alarm-${alarm.meetingId}`,
    });
  }
}

let _engine: AlarmEngine | null = null;

export function getAlarmEngine(): AlarmEngine {
  if (!_engine) _engine = new AlarmEngine();
  return _engine;
}