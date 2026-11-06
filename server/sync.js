import { randomUUID } from "node:crypto";
import { normalizePlan } from "./store.js";

function timestamp(value) {
  const parsed = Date.parse(value || "");
  return Number.isFinite(parsed) ? parsed : 0;
}

function newer(a, b) {
  return timestamp(a?.updatedAt) >= timestamp(b?.updatedAt) ? a : b;
}

function planFingerprint(plan) {
  return JSON.stringify({
    module: plan.module,
    title: plan.title,
    date: plan.date,
    repeatEnabled: plan.repeatEnabled,
    repeatWeekdays: plan.repeatWeekdays,
    startTime: plan.startTime,
    durationMinutes: plan.durationMinutes,
    reminderEnabled: plan.reminderEnabled,
    notes: plan.notes,
    details: plan.details,
  });
}

function latestTombstones(entries = []) {
  const map = new Map();
  for (const entry of entries) {
    const previous = map.get(entry.id);
    if (!previous || timestamp(entry.updatedAt) > timestamp(previous.updatedAt)) {
      map.set(entry.id, entry);
    }
  }
  return map;
}

export function mergeSyncState({
  current,
  incoming,
  lastSyncAt,
  now = new Date().toISOString(),
}) {
  const lastSync = timestamp(lastSyncAt);
  const currentPlans = new Map(current.plans.map((plan) => [plan.id, plan]));
  const incomingPlans = new Map(incoming.plans.map((plan) => [plan.id, plan]));
  const currentTombs = latestTombstones(current.deletedPlans);
  const incomingTombs = latestTombstones(incoming.deletedPlans);
  const allIds = new Set([
    ...currentPlans.keys(),
    ...incomingPlans.keys(),
    ...currentTombs.keys(),
    ...incomingTombs.keys(),
  ]);
  const selected = new Map();
  const tombstones = new Map();
  const conflicts = [];

  for (const id of allIds) {
    const currentPlan = currentPlans.get(id);
    const incomingPlan = incomingPlans.get(id);
    let chosen = null;

    if (currentPlan && incomingPlan) {
      const currentChanged = timestamp(currentPlan.updatedAt) > lastSync;
      const incomingChanged = timestamp(incomingPlan.updatedAt) > lastSync;
      const different =
        planFingerprint(currentPlan) !== planFingerprint(incomingPlan);

      if (currentChanged && incomingChanged && different) {
        chosen = currentPlan;
        const copy = normalizePlan(
          {
            ...incomingPlan,
            id: randomUUID(),
            title: `${incomingPlan.title.slice(0, 140)}（手机冲突副本）`,
          },
          {},
        );
        copy.updatedAt = now;
        conflicts.push({
          planId: id,
          currentTitle: currentPlan.title,
          incomingTitle: incomingPlan.title,
          copyId: copy.id,
        });
        selected.set(copy.id, copy);
      } else {
        chosen = newer(currentPlan, incomingPlan);
      }
    } else {
      chosen = currentPlan || incomingPlan || null;
    }

    if (chosen) {
      selected.set(id, chosen);
    }
  }

  for (const id of allIds) {
    const currentTomb = currentTombs.get(id);
    const incomingTomb = incomingTombs.get(id);
    const tomb =
      currentTomb && incomingTomb
        ? newer(currentTomb, incomingTomb)
        : currentTomb || incomingTomb;

    const plan = selected.get(id);
    if (tomb && (!plan || timestamp(tomb.updatedAt) > timestamp(plan.updatedAt))) {
      selected.delete(id);
      tombstones.set(id, tomb);
    } else if (tomb && plan) {
      // A newer plan resurrects a previously deleted record.
      tombstones.delete(id);
    }
  }

  let quickMemo = current.quickMemo || "";
  let quickMemoUpdatedAt =
    current.quickMemoUpdatedAt || current.updatedAt || now;
  const currentMemoChanged = timestamp(current.quickMemoUpdatedAt) > lastSync;
  const incomingMemoChanged =
    timestamp(incoming.quickMemoUpdatedAt) > lastSync;

  if (
    currentMemoChanged &&
    incomingMemoChanged &&
    current.quickMemo.trim() &&
    incoming.quickMemo.trim() &&
    current.quickMemo !== incoming.quickMemo
  ) {
    conflicts.push({
      type: "quickMemo",
      currentTitle: "电脑快速备忘",
      incomingTitle: "手机快速备忘",
    });
    quickMemo = [
      current.quickMemo,
      "",
      "--- 手机离线修改 ---",
      incoming.quickMemo,
    ]
      .filter((part) => part !== "")
      .join("\n");
    quickMemoUpdatedAt = now;
  } else if (
    !current.quickMemo.trim() ||
    timestamp(incoming.quickMemoUpdatedAt) >
      timestamp(current.quickMemoUpdatedAt)
  ) {
    quickMemo = incoming.quickMemo;
    quickMemoUpdatedAt = incoming.quickMemoUpdatedAt;
  }

  const tombstoneCutoff = Date.now() - 180 * 24 * 60 * 60 * 1000;
  const deletedPlans = [...tombstones.values()].filter(
    (entry) => timestamp(entry.updatedAt) >= tombstoneCutoff,
  );

  return {
    state: {
      ...current,
      plans: [...selected.values()].sort((a, b) =>
        a.startTime.localeCompare(b.startTime),
      ),
      deletedPlans,
      quickMemo,
      quickMemoUpdatedAt,
      lastSyncAt: now,
      updatedAt: now,
    },
    conflicts,
    syncedAt: now,
  };
}
