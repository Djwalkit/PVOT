/**
 * packages/core/src/types/index.ts
 * PVOT — Canonical Type Definitions
 */

// ─── WORKSPACE (replaces "Job 1 / Job 2" — fully user-defined) ──────────────

export interface Workspace {
  id:          string;        // uuid
  alias:       string;        // user-defined: "Accenture", "Side Hustle", "Personal"
  emoji:       string;        // user-defined: "💼", "🚀", "🏠"
  color:       string;        // hex color for lane
  accountIds:  string[];      // which Google accounts belong to this workspace
  timezone:    string;        // primary IANA timezone for this workspace
  isVisible:   boolean;
  order:       number;
}

// ─── HOME ZONES (the 3 clocks in the global header) ─────────────────────────

export interface HomeZone {
  id:       string;
  label:    string;   // "London HQ", "Dubai Client", "Lagos"
  timezone: string;   // IANA timezone
  order:    number;
}

// ─── ALARM CONFIG ─────────────────────────────────────────────────────────────

export interface AlarmConfig {
  enabled:          boolean;
  gentlePingMins:   number;   // default 10 — gentle notification
  urgentTakeoverMins: number; // default 2  — full screen takeover
  soundEnabled:     boolean;
  vibrationEnabled: boolean;
  snoozeMinutes:    number;   // default 5
}

// ─── AI CONFIG ───────────────────────────────────────────────────────────────

export interface AIConfig {
  dailyBriefingEnabled:      boolean;
  conflictSuggestionsEnabled: boolean;
  meetingPrepEnabled:         boolean;
  naturalLanguageEnabled:     boolean;
}

// ─── ALARM STATE (runtime, not persisted) ────────────────────────────────────

export type AlarmLevel = 'gentle' | 'urgent' | 'persistent';

export interface ActiveAlarm {
  meetingId:   string;
  meetingTitle: string;
  level:       AlarmLevel;
  startUtc:    string;
  videoLink:   VideoLink | null;
  snoozedUntil: number | null;   // unix ms
}

// ─── MEETING (canonical normalized event) ────────────────────────────────────

export interface Meeting {
  id:             string;
  googleEventId:  string;
  accountId:      string;
  startUtc:       string;
  endUtc:         string;
  isAllDay:       boolean;
  timezone:       string;
  title:          string;
  description:    string | null;
  location:       string | null;
  attendees:      Attendee[];
  organizer:      Attendee | null;
  videoLink:      VideoLink | null;
  allVideoLinks:  VideoLink[];
  isConflict:     boolean;
  conflictWith:   string[];
  hasNoBuffer:    boolean;
  isBackToBack:   boolean;
  bufferGapMins:  number | null;
  colorIndex:     0 | 1 | 2 | 3 | 4 | 5 | 6;
  calendarName:   string;
  recurringEventId: string | null;
  status:         'confirmed' | 'tentative' | 'cancelled';
  selfRsvp:       'accepted' | 'declined' | 'tentative' | 'needsAction' | null;
  htmlLink:       string;
  workspaceId:    string | null;   // which workspace this belongs to
  raw?:           GoogleCalendarEvent;
}

export interface Attendee {
  email:          string;
  displayName:    string | null;
  responseStatus: 'accepted' | 'declined' | 'tentative' | 'needsAction';
  self:           boolean;
  organizer:      boolean;
}

export interface VideoLink {
  provider: 'google_meet' | 'zoom' | 'teams' | 'webex' | 'unknown';
  url:      string;
  label:    string;
}

// ─── CONNECTED ACCOUNT ───────────────────────────────────────────────────────

export type AccountColorIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface ConnectedAccount {
  id:           string;
  email:        string;
  displayName:  string;
  photoUrl:     string | null;
  colorIndex:   AccountColorIndex;
  status:       AccountStatus;
  errorCode:    AccountErrorCode | null;
  errorMessage: string | null;
  lastSyncedAt: string | null;
  addedAt:      string;
}

export type AccountStatus    = 'active' | 'refreshing' | 'error' | 'disconnected';
export type AccountErrorCode = 'token_expired' | 'fetch_failed' | 'scope_changed' | 'rate_limited';

// ─── CALENDAR QUERY ──────────────────────────────────────────────────────────

export interface CalendarQueryResult {
  meetings:        Meeting[];
  accountStatuses: AccountFetchResult[];
  fetchedAt:       string;
  date:            string;
  timezone:        string;
}

export interface AccountFetchResult {
  accountId: string;
  status:    'fulfilled' | 'rejected';
  count:     number;
  error:     AccountErrorCode | null;
}

// ─── OAUTH ───────────────────────────────────────────────────────────────────

export interface OAuthToken {
  accessToken:  string;
  refreshToken: string;
  expiresAt:    number;
  scope:        string;
  tokenType:    'Bearer';
}

export interface PKCEState {
  codeVerifier: string;
  state:        string;
  redirectUri:  string;
  accountId:    string | null;
}

// ─── GOOGLE CALENDAR API (raw) ───────────────────────────────────────────────

export interface GoogleCalendarEvent {
  id:          string;
  summary:     string | null;
  description: string | null;
  location:    string | null;
  status:      string;
  htmlLink:    string;
  created:     string;
  updated:     string;
  start:       GoogleEventDateTime;
  end:         GoogleEventDateTime;
  attendees?:  GoogleAttendee[];
  organizer?:  GoogleAttendee;
  recurrence?: string[];
  recurringEventId?: string;
  conferenceData?: {
    entryPoints?: Array<{
      entryPointType: string;
      uri:   string;
      label?: string;
    }>;
  };
}

export interface GoogleEventDateTime {
  dateTime?: string;
  date?:     string;
  timeZone?: string;
}

export interface GoogleAttendee {
  email:          string;
  displayName?:   string;
  responseStatus: string;
  self?:          boolean;
  organizer?:     boolean;
}

export interface GoogleCalendarListItem {
  id:              string;
  summary:         string;
  backgroundColor: string;
  primary?:        boolean;
  accessRole:      string;
}

// ─── UI STORE ────────────────────────────────────────────────────────────────

export interface UIStore {
  selectedEventId:   string | null;
  privacyMode:       boolean;
  sidebarOpen:       boolean;
  contextPanelOpen:  boolean;
  activeAccountIds:  string[] | 'all';
  viewDate:          string;
  selectEvent:       (id: string | null) => void;
  togglePrivacy:     () => void;
  openSidebar:       () => void;
  closeSidebar:      () => void;
  openContextPanel:  () => void;
  closeContextPanel: () => void;
  setActiveAccounts: (ids: string[] | 'all') => void;
  setViewDate:       (date: string) => void;
}

export interface AuthStore {
  accounts:        ConnectedAccount[];
  addAccount:      (account: ConnectedAccount) => void;
  removeAccount:   (accountId: string) => void;
  updateStatus:    (accountId: string, status: AccountStatus, error?: AccountErrorCode) => void;
  reorderAccounts: (ordered: string[]) => void;
}