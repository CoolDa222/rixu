import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

const MODULES = new Set(["learning", "fitness", "diet", "gaming"]);
const MEAL_TYPES = new Set(["breakfast", "lunch", "dinner", "snack"]);
const WEEKDAYS = new Set([0, 1, 2, 3, 4, 5, 6]);

export function getDataDir() {
  if (process.env.WORKLIFE_DATA_DIR) {
    return path.resolve(process.env.WORKLIFE_DATA_DIR);
  }

  const localAppData =
    process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local");
  return path.join(localAppData, "WorkLifeManager");
}

export function getDataFile() {
  return path.join(getDataDir(), "data.json");
}

function createSyncToken() {
  return randomUUID().replaceAll("-", "").slice(0, 8).toUpperCase();
}

export function createInitialState() {
  const now = new Date().toISOString();
  return {
    version: 1,
    plans: [],
    deletedPlans: [],
    quickMemo: "",
    quickMemoUpdatedAt: now,
    settings: {
      notificationsEnabled: true,
      autoStart: false,
    },
    notificationLog: [],
    syncToken: createSyncToken(),
    lastSyncAt: "",
    updatedAt: now,
  };
}

function cleanText(value, max = 1000) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function cleanTime(value) {
  if (typeof value !== "string" || !/^\d{2}:\d{2}$/.test(value)) {
    return "09:00";
  }
  const [hours, minutes] = value.split(":").map(Number);
  if (hours > 23 || minutes > 59) {
    return "09:00";
  }
  return value;
}

function cleanDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date().toISOString().slice(0, 10);
  }
  return value;
}

function cleanExercises(exercises) {
  if (!Array.isArray(exercises)) {
    return [];
  }

  return exercises
    .slice(0, 30)
    .map((exercise) => ({
      id: cleanText(exercise?.id, 80) || randomUUID(),
      name: cleanText(exercise?.name, 120),
      sets: cleanText(exercise?.sets, 20),
      reps: cleanText(exercise?.reps, 20),
      duration: cleanText(exercise?.duration, 40),
    }))
    .filter((exercise) => exercise.name);
}

function normalizeDetails(module, details = {}) {
  if (module === "learning") {
    return {
      course: cleanText(details.course, 160),
      content: cleanText(details.content, 500),
    };
  }

  if (module === "fitness") {
    return {
      focus: cleanText(details.focus, 120),
      exercises: cleanExercises(details.exercises),
    };
  }

  if (module === "diet") {
    return {
      mealType: MEAL_TYPES.has(details.mealType)
        ? details.mealType
        : "lunch",
      menu: cleanText(details.menu, 500),
      portion: cleanText(details.portion, 160),
    };
  }

  return {
    game: cleanText(details.game, 160),
    objective: cleanText(details.objective, 500),
  };
}

export function normalizePlan(input, previous = {}) {
  const module = MODULES.has(input.module)
    ? input.module
    : previous.module || "learning";
  const repeatEnabled = Boolean(input.repeatEnabled);
  const repeatWeekdays = repeatEnabled
    ? [...new Set((input.repeatWeekdays || []).map(Number))]
        .filter((day) => WEEKDAYS.has(day))
        .sort((a, b) => a - b)
    : [];

  if (repeatEnabled && repeatWeekdays.length === 0) {
    repeatWeekdays.push(new Date().getDay());
  }

  const now = new Date().toISOString();
  const title = cleanText(input.title, 160);

  return {
    id: previous.id || cleanText(input.id, 80) || randomUUID(),
    module,
    title: title || "未命名计划",
    date: cleanDate(input.date || previous.date),
    repeatEnabled,
    repeatWeekdays,
    startTime: cleanTime(input.startTime || previous.startTime),
    durationMinutes: Math.min(
      24 * 60,
      Math.max(0, Number(input.durationMinutes) || 0),
    ),
    reminderEnabled:
      input.reminderEnabled === undefined
        ? Boolean(previous.reminderEnabled)
        : Boolean(input.reminderEnabled),
    notes: cleanText(input.notes, 1000),
    details: normalizeDetails(module, input.details),
    createdAt: previous.createdAt || now,
    updatedAt:
      typeof input.updatedAt === "string" && input.updatedAt
        ? input.updatedAt
        : now,
  };
}

export function normalizeState(input) {
  const initial = createInitialState();
  const source = input && typeof input === "object" ? input : {};
  const plans = Array.isArray(source.plans)
    ? source.plans
        .filter((plan) => MODULES.has(plan?.module))
        .map((plan) => normalizePlan(plan, plan))
    : [];

  return {
    ...initial,
    plans,
    deletedPlans: Array.isArray(source.deletedPlans)
      ? source.deletedPlans
          .filter(
            (entry) =>
              typeof entry?.id === "string" &&
              typeof entry?.updatedAt === "string",
          )
          .slice(-5000)
      : [],
    quickMemo:
      typeof source.quickMemo === "string"
        ? source.quickMemo.slice(0, 5000)
        : "",
    quickMemoUpdatedAt:
      typeof source.quickMemoUpdatedAt === "string"
        ? source.quickMemoUpdatedAt
        : source.updatedAt || initial.quickMemoUpdatedAt,
    settings: {
      notificationsEnabled:
        source.settings?.notificationsEnabled === undefined
          ? true
          : Boolean(source.settings.notificationsEnabled),
      autoStart: Boolean(source.settings?.autoStart),
    },
    notificationLog: Array.isArray(source.notificationLog)
      ? source.notificationLog
          .filter((entry) => typeof entry?.key === "string")
          .slice(-2000)
      : [],
    syncToken:
      typeof source.syncToken === "string" && source.syncToken.length >= 6
        ? source.syncToken
        : createSyncToken(),
    lastSyncAt:
      typeof source.lastSyncAt === "string" ? source.lastSyncAt : "",
    updatedAt: source.updatedAt || initial.updatedAt,
  };
}

export class LocalStore {
  constructor(filePath = getDataFile()) {
    this.filePath = filePath;
    this.state = createInitialState();
    this.writeQueue = Promise.resolve();
    this.loaded = false;
  }

  async load() {
    if (this.loaded) {
      return this.state;
    }

    await fs.mkdir(path.dirname(this.filePath), { recursive: true });

    try {
      const raw = await fs.readFile(this.filePath, "utf8");
      this.state = normalizeState(JSON.parse(raw));
    } catch (error) {
      if (error.code !== "ENOENT") {
        const backup = `${this.filePath}.broken-${Date.now()}`;
        await fs.rename(this.filePath, backup).catch(() => {});
      }
      this.state = createInitialState();
      await this.persist();
    }

    this.loaded = true;
    return this.state;
  }

  getState() {
    return structuredClone(this.state);
  }

  async update(mutator) {
    await this.load();
    mutator(this.state);
    this.state.updatedAt = new Date().toISOString();
    await this.persist();
    return this.getState();
  }

  async replace(nextState) {
    await this.load();
    this.state = normalizeState(nextState);
    this.state.updatedAt = new Date().toISOString();
    await this.persist();
    return this.getState();
  }

  async persist() {
    const snapshot = JSON.stringify(this.state, null, 2);
    const tempFile = `${this.filePath}.${process.pid}.tmp`;

    this.writeQueue = this.writeQueue
      .catch(() => {
        // Recover the queue after a transient disk error.
      })
      .then(async () => {
        try {
          await fs.writeFile(tempFile, snapshot, "utf8");
          try {
            await fs.rename(tempFile, this.filePath);
          } catch (error) {
            // Some managed Windows folders disallow same-directory rename.
            // Copying still keeps the source intact until the write succeeds.
            if (error.code !== "EXDEV" && error.code !== "EPERM") {
              throw error;
            }
            await fs.copyFile(tempFile, this.filePath);
            await fs.unlink(tempFile);
          }
        } catch (error) {
          await fs.unlink(tempFile).catch(() => {});
          throw error;
        }
      });

    return this.writeQueue;
  }
}

export const moduleKeys = [...MODULES];
export const mealTypes = [...MEAL_TYPES];
