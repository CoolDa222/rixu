import notifier from "node-notifier";

const MODULE_LABELS = {
  learning: "学习计划",
  fitness: "健身计划",
  diet: "饮食计划",
  gaming: "游戏娱乐",
};

export function dateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function timeKey(date = new Date()) {
  return `${String(date.getHours()).padStart(2, "0")}:${String(
    date.getMinutes(),
  ).padStart(2, "0")}`;
}

export function occursOnDate(plan, date = new Date()) {
  const day = dateKey(date);
  if (plan.repeatEnabled) {
    return (
      plan.repeatWeekdays?.includes(date.getDay()) &&
      plan.date <= day
    );
  }
  return plan.date === day;
}

export function reminderKey(plan, date = new Date()) {
  return `${plan.id}:${dateKey(date)}:${plan.startTime}`;
}

export function showSystemNotification({ title, message, test = false }) {
  return new Promise((resolve, reject) => {
    notifier.notify(
      {
        title,
        message,
        sound: true,
        wait: false,
        appID: "日序",
        timeout: 10,
      },
      (error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve({ ok: true, test });
      },
    );
  });
}

export function createReminderService(store) {
  let timer = null;
  let running = false;
  let lastCheckAt = null;

  async function check(now = new Date()) {
    if (running) {
      return;
    }

    running = true;
    try {
      const state = store.getState();
      lastCheckAt = now.toISOString();
      if (!state.settings.notificationsEnabled) {
        return;
      }

      const currentTime = timeKey(now);
      const today = dateKey(now);
      const candidates = state.plans.filter(
        (plan) =>
          plan.reminderEnabled &&
          plan.startTime === currentTime &&
          occursOnDate(plan, now),
      );

      if (candidates.length === 0) {
        return;
      }

      const sentKeys = new Set(
        state.notificationLog.map((entry) => entry.key),
      );
      const unsent = candidates.filter(
        (plan) => !sentKeys.has(reminderKey(plan, now)),
      );

      for (const plan of unsent) {
        const label = MODULE_LABELS[plan.module] || "今日计划";
        const detail = plan.notes
          ? `${plan.startTime} · ${plan.notes.slice(0, 90)}`
          : `${plan.startTime} · ${label}`;
        await showSystemNotification({
          title: plan.title,
          message: detail,
        });

        await store.update((draft) => {
          draft.notificationLog.push({
            key: reminderKey(plan, now),
            planId: plan.id,
            sentAt: now.toISOString(),
            date: today,
          });
          const cutoff = now.getTime() - 30 * 24 * 60 * 60 * 1000;
          draft.notificationLog = draft.notificationLog.filter(
            (entry) => new Date(entry.sentAt).getTime() >= cutoff,
          );
        });
      }
    } catch (error) {
      console.error("[reminder]", error);
    } finally {
      running = false;
    }
  }

  return {
    start() {
      if (timer) {
        return;
      }
      check();
      timer = setInterval(() => check(), 10_000);
      timer.unref();
    },
    stop() {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    },
    check,
    status() {
      return {
        running: Boolean(timer),
        lastCheckAt,
        intervalMs: 10_000,
      };
    },
  };
}
