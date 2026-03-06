/**
 * packages/core/src/stores/pvotStore.ts
 * PVOT — Master Temporal Global Store  v16
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * v16 — TIME TRAVELLER INVESTIGATION NODE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * NEW FIELD: investigatedCity
 *   • IANA timezone string for Node B — the "Investigation" target city.
 *   • null means no city is under investigation (standard dashboard mode).
 *   • Deliberately NOT persisted across sessions (ephemeral investigation
 *     state should never survive a page reload).
 *
 * NEW ACTION: setInvestigatedCity(tz: string | null)
 *   • Sets Node B. Pass null to clear.
 *
 * NEW ACTION: realitySync()
 *   • Atomic reset: timeTravelOffset → 0, investigatedCity → null.
 *   • This is the "Reality Sync" button action — one call, full reset.
 *   • Also resets viewDate to today in the anchor timezone.
 *
 * UPDATED ACTION: resetTimeTravel()
 *   • Now also clears investigatedCity (consistent with realitySync minus
 *     the date reset). Use realitySync() for the full reset button.
 *
 * UPDATED ACTION: goToToday()
 *   • Now also clears investigatedCity.
 *
 * STORAGE KEY: bumped to 'pvot-storage-v16'
 *   • investigatedCity is intentionally excluded from partialize.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * PREVIOUS VERSIONS (all changes retained)
 * ═══════════════════════════════════════════════════════════════════════════
 * v15 — workHours slice, soundSignature, breatherWarning in AlarmConfig
 * v9  — date desync fix via getAnchorTodayStr()
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  ActiveAlarm,
  Workspace,
} from '../types';
import type { Conflict } from '../engine/ConflictEngine';

// ─── TYPES ────────────────────────────────────────────────────────────────────

export interface LaneConfig {
  accountId:   string;
  visible:     boolean;
  order:       number;
  customLabel: string | null;
}

export interface WorkHours {
  enabled: boolean;
  /** "HH:00" start of focus window e.g. "08:00" */
  start:   string;
  /** "HH:00" end of focus window e.g. "18:00" */
  end:     string;
}

export interface AlarmConfig {
  enabled:            boolean;
  gentlePingMins:     number;
  urgentTakeoverMins: number;
  soundEnabled:       boolean;
  vibrationEnabled:   boolean;
  snoozeMinutes:      number;
  /** v15 — acoustic style */
  soundSignature:     'zen' | 'professional' | 'urgent';
  /** v15 — warn when consecutive cross-lane meetings have < 5 min gap */
  breatherWarning:    boolean;
}

interface PVOTState {
  // ── TEMPORAL COORDINATES ──────────────────────────────────────────────────
  viewDate:            string;
  setViewDate:         (date: string) => void;

  timeTravelOffset:    number;
  setTimeTravelOffset: (ms: number) => void;
  resetTimeTravel:     () => void;
  goToToday:           () => void;

  /**
   * v16 — INVESTIGATION NODE (Node B)
   *
   * IANA timezone string for the "Investigation" city the executive is
   * comparing against the Anchor (Node A). null = no investigation active.
   *
   * Ephemeral: NOT persisted. Cleared by realitySync() and resetTimeTravel().
   */
  investigatedCity:    string | null;
  setInvestigatedCity: (tz: string | null) => void;

  /**
   * v16 — REALITY SYNC
   *
   * Single atomic action for the "Reality Sync" button:
   *   1. timeTravelOffset  → 0
   *   2. investigatedCity  → null
   *   3. viewDate          → today in anchor timezone
   */
  realitySync: () => void;

  // ── SOVEREIGN HOME CLOCKS ─────────────────────────────────────────────────
  homeZones:    string[];
  setHomeZones: (zones: string[]) => void;

  // ── LANE ARCHITECTURE ─────────────────────────────────────────────────────
  laneConfigs:       LaneConfig[];
  setLaneConfigs:    (configs: LaneConfig[]) => void;
  toggleLaneVisible: (accountId: string) => void;
  setLaneLabel:      (accountId: string, label: string | null) => void;
  reorderLanes:      (fromId: string, toId: string) => void;

  // ── DECISION INTELLIGENCE ─────────────────────────────────────────────────
  conflicts:           Conflict[];
  dismissedConflicts:  string[];
  setConflicts:        (conflicts: Conflict[]) => void;
  dismissConflict:     (id: string) => void;

  // ── ALARM ENGINE ─────────────────────────────────────────────────────────
  alarmConfig:       AlarmConfig;
  updateAlarmConfig: (updates: Partial<AlarmConfig>) => void;
  activeAlarms:      ActiveAlarm[];
  setActiveAlarms:   (alarms: ActiveAlarm[]) => void;
  dismissAlarm:      (meetingId: string) => void;
  snoozeAlarm:       (meetingId: string) => void;

  // ── PRIVACY MODE ──────────────────────────────────────────────────────────
  privacyMode:   boolean;
  setPrivacyMode: (on: boolean) => void;
  togglePrivacy:  () => void;

  // ── TEMPORAL BOUNDARIES (v15) ─────────────────────────────────────────────
  workHours:    WorkHours;
  setWorkHours: (wh: WorkHours) => void;

  // ── WORKSPACES ────────────────────────────────────────────────────────────
  workspaces: Workspace[];

  // ── HELPERS ───────────────────────────────────────────────────────────────
  getVirtualNow: () => Date;
}

// ─── DEFAULTS ────────────────────────────────────────────────────────────────

export const DEFAULT_ALARM_CONFIG: AlarmConfig = {
  enabled:            true,
  gentlePingMins:     10,
  urgentTakeoverMins: 2,
  soundEnabled:       true,
  vibrationEnabled:   true,
  snoozeMinutes:      5,
  soundSignature:     'professional',
  breatherWarning:    true,
};

export const DEFAULT_WORK_HOURS: WorkHours = {
  enabled: true,
  start:   '08:00',
  end:     '18:00',
};

// ─── ANCHOR TIMEZONE TODAY ────────────────────────────────────────────────────

function getAnchorTodayStr(): string {
  let tz: string;
  try {
    const raw = typeof localStorage !== 'undefined'
      ? localStorage.getItem('pvot-storage-v16')
      : null;
    const persisted = raw ? JSON.parse(raw) : null;
    tz = persisted?.state?.homeZones?.[0]
      ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    tz = 'UTC';
  }
  return todayInTz(tz);
}

function todayInTz(tz: string): string {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
    }).formatToParts(new Date());
    const g = (t: string) => parts.find(p => p.type === t)?.value ?? '00';
    return `${g('year')}-${g('month')}-${g('day')}`;
  } catch {
    return new Date().toISOString().split('T')[0]!;
  }
}

// ─── STORE ────────────────────────────────────────────────────────────────────

export const usePVOTStore = create<PVOTState>()(
  persist(
    (set, get) => ({
      // ── Initial state ──────────────────────────────────────────────────
      viewDate:           getAnchorTodayStr(),
      timeTravelOffset:   0,
      investigatedCity:   null,   // ephemeral — not persisted
      homeZones:          [],
      laneConfigs:        [],
      conflicts:          [],
      dismissedConflicts: [],
      workspaces:         [],
      privacyMode:        false,
      workHours:          DEFAULT_WORK_HOURS,
      alarmConfig:        DEFAULT_ALARM_CONFIG,
      activeAlarms:       [],

      // ── Temporal ───────────────────────────────────────────────────────
      setViewDate:         (viewDate) => set({ viewDate }),
      setTimeTravelOffset: (timeTravelOffset) => set({ timeTravelOffset }),

      resetTimeTravel: () => set({
        timeTravelOffset: 0,
        investigatedCity: null,   // clear investigation on any reset
      }),

      goToToday: () => {
        const zones = get().homeZones;
        const tz    = zones.length > 0
          ? zones[0]!
          : Intl.DateTimeFormat().resolvedOptions().timeZone;
        set({
          viewDate:         todayInTz(tz),
          timeTravelOffset: 0,
          investigatedCity: null,
        });
      },

      // ── v16: Investigation node ────────────────────────────────────────
      setInvestigatedCity: (tz) => set({ investigatedCity: tz }),

      // ── v16: Reality Sync — one button, full temporal reset ───────────
      realitySync: () => {
        const zones = get().homeZones;
        const tz    = zones.length > 0
          ? zones[0]!
          : Intl.DateTimeFormat().resolvedOptions().timeZone;
        set({
          timeTravelOffset: 0,
          investigatedCity: null,
          viewDate:         todayInTz(tz),
        });
      },

      // ── Home clocks ────────────────────────────────────────────────────
      setHomeZones: (homeZones) => set({ homeZones }),

      // ── Lane architecture ──────────────────────────────────────────────
      setLaneConfigs: (laneConfigs) => set({ laneConfigs }),

      toggleLaneVisible: (accountId) =>
        set((s) => ({
          laneConfigs: s.laneConfigs.map((l) =>
            l.accountId === accountId ? { ...l, visible: !l.visible } : l,
          ),
        })),

      setLaneLabel: (accountId, label) =>
        set((s) => ({
          laneConfigs: s.laneConfigs.map((l) =>
            l.accountId === accountId ? { ...l, customLabel: label } : l,
          ),
        })),

      reorderLanes: (fromId, toId) =>
        set((s) => {
          const configs = [...s.laneConfigs];
          const fi      = configs.findIndex((l) => l.accountId === fromId);
          const ti      = configs.findIndex((l) => l.accountId === toId);
          if (fi < 0 || ti < 0 || fi === ti) return {};
          const tmp        = configs[fi]!.order;
          configs[fi]      = { ...configs[fi]!, order: configs[ti]!.order };
          configs[ti]      = { ...configs[ti]!, order: tmp };
          return { laneConfigs: configs };
        }),

      // ── Conflicts ──────────────────────────────────────────────────────
      setConflicts:    (conflicts) => set({ conflicts }),
      dismissConflict: (id) =>
        set((s) => ({ dismissedConflicts: [...s.dismissedConflicts, id] })),

      // ── Alarms ────────────────────────────────────────────────────────
      updateAlarmConfig: (updates) =>
        set((s) => ({ alarmConfig: { ...s.alarmConfig, ...updates } })),

      setActiveAlarms: (activeAlarms) => set({ activeAlarms }),

      dismissAlarm: (meetingId) =>
        set((s) => ({
          activeAlarms: s.activeAlarms.filter((a) => a.meetingId !== meetingId),
        })),

      snoozeAlarm: (meetingId) =>
        set((s) => {
          const snoozeMs = s.alarmConfig.snoozeMinutes * 60 * 1000;
          return {
            activeAlarms: s.activeAlarms.map((a) =>
              a.meetingId === meetingId
                ? { ...a, snoozedUntil: Date.now() + snoozeMs }
                : a,
            ),
          };
        }),

      // ── Privacy ────────────────────────────────────────────────────────
      setPrivacyMode: (privacyMode) => set({ privacyMode }),
      togglePrivacy:  () => set((s) => ({ privacyMode: !s.privacyMode })),

      // ── Work hours ─────────────────────────────────────────────────────
      setWorkHours: (workHours) => set({ workHours }),

      // ── Virtual now ────────────────────────────────────────────────────
      getVirtualNow: () => new Date(Date.now() + get().timeTravelOffset),
    }),
    {
      name: 'pvot-storage-v16',

      // investigatedCity is intentionally NOT included — ephemeral per session
      partialize: (state) => ({
        homeZones:          state.homeZones,
        laneConfigs:        state.laneConfigs,
        dismissedConflicts: state.dismissedConflicts,
        viewDate:           state.viewDate,
        alarmConfig:        state.alarmConfig,
        workspaces:         state.workspaces,
        privacyMode:        state.privacyMode,
        workHours:          state.workHours,
        // timeTravelOffset intentionally not persisted
      }),

      merge: (persisted: any, current: PVOTState): PVOTState => ({
        ...current,
        ...persisted,
        // Always start with ephemeral fields at their zero state
        timeTravelOffset: 0,
        investigatedCity: null,
        // Deep merge configs with defaults to handle new fields gracefully
        alarmConfig: {
          ...DEFAULT_ALARM_CONFIG,
          ...(persisted?.alarmConfig ?? {}),
        },
        workHours: {
          ...DEFAULT_WORK_HOURS,
          ...(persisted?.workHours ?? {}),
        },
        homeZones:   persisted?.homeZones   ?? [],
        privacyMode: persisted?.privacyMode ?? false,
      }),
    },
  ),
);
