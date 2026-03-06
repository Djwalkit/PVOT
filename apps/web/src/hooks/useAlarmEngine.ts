/**
 * apps/web/src/hooks/useAlarmEngine.ts
 * PVOT — React hook that starts the AlarmEngine and feeds it meetings.
 *
 * Drop this in your dashboard layout. It:
 *   1. Requests notification permission on first load
 *   2. Starts the alarm tick
 *   3. Feeds updated meetings to the engine whenever they change
 *   4. Stops cleanly on unmount
 */

'use client';

import { useEffect } from 'react';
import { getAlarmEngine } from '@pvot/core/engine/AlarmEngine';
import type { Meeting }   from '@pvot/core/types';

export function useAlarmEngine(meetings: Meeting[]): void {
  // Request notification permission once
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('Notification' in window)) return;
    if (Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // Start engine on mount, stop on unmount
  useEffect(() => {
    const engine = getAlarmEngine();
    engine.start();
    return () => engine.stop();
  }, []);

  // Feed meetings to engine whenever they change
  useEffect(() => {
    if (meetings.length === 0) return;
    getAlarmEngine().setMeetings(meetings);
  }, [meetings]);
}