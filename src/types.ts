export type ModuleKey = "learning" | "fitness" | "diet" | "gaming";
export type PageKey =
  | "home"
  | "today"
  | "calendar"
  | "learning"
  | "fitness"
  | "diet"
  | "gaming"
  | "feedback"
  | "settings";
export type MealType = "breakfast" | "lunch" | "dinner" | "snack";

export interface Exercise {
  id: string;
  name: string;
  sets: string;
  reps: string;
  duration: string;
}

export interface LearningDetails {
  course: string;
  content: string;
}

export interface FitnessDetails {
  focus: string;
  exercises: Exercise[];
}

export interface DietDetails {
  mealType: MealType;
  menu: string;
  portion: string;
}

export interface GamingDetails {
  game: string;
  objective: string;
}

export type PlanDetails =
  | LearningDetails
  | FitnessDetails
  | DietDetails
  | GamingDetails;

export interface Plan {
  id: string;
  module: ModuleKey;
  title: string;
  date: string;
  repeatEnabled: boolean;
  repeatWeekdays: number[];
  startTime: string;
  durationMinutes: number;
  reminderEnabled: boolean;
  notes: string;
  details: PlanDetails;
  createdAt: string;
  updatedAt: string;
}

export interface AppSettings {
  notificationsEnabled: boolean;
  autoStart: boolean;
}

export interface NotificationLogEntry {
  key: string;
  planId: string;
  sentAt: string;
  date: string;
}

export interface PlanTombstone {
  id: string;
  updatedAt: string;
}

export interface AppState {
  version: number;
  plans: Plan[];
  deletedPlans: PlanTombstone[];
  quickMemo: string;
  quickMemoUpdatedAt: string;
  settings: AppSettings;
  notificationLog: NotificationLogEntry[];
  syncToken: string;
  lastSyncAt: string;
  updatedAt: string;
}

export interface AppStatus {
  ok: boolean;
  app: string;
  startedAt: string;
  uptimeSeconds: number;
  port: number;
  platform: string;
  dataFile: string;
  autoStart: boolean;
  autoStartSupported: boolean;
  mobile: boolean;
  reminders: {
    running: boolean;
    lastCheckAt: string | null;
    intervalMs: number;
  };
  sync: {
    serverUrl: string;
    token: string;
    lastSyncAt: string;
    lanAddresses: string[];
  };
}

export interface PlanDraft {
  module: ModuleKey;
  title: string;
  date: string;
  repeatEnabled: boolean;
  repeatWeekdays: number[];
  startTime: string;
  durationMinutes: number;
  reminderEnabled: boolean;
  notes: string;
  details: PlanDetails;
}

export interface PlanPreset {
  date?: string;
  mealType?: MealType;
  startTime?: string;
}

export interface SyncResult {
  ok: boolean;
  state: AppState;
  status: AppStatus;
  syncedAt: string;
  conflictCount: number;
}

export interface AuthUser {
  id: string;
  email: string;
}

export type FeedbackCategory = "feature" | "bug" | "design" | "other";
export type FeedbackStatus = "new" | "read" | "resolved";

export interface FeedbackItem {
  id: string;
  user_id: string | null;
  email: string | null;
  category: FeedbackCategory;
  content: string;
  contact: string;
  page_path: string;
  status: FeedbackStatus;
  created_at: string;
  updated_at: string;
}
