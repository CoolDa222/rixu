import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  LocalStore,
  createInitialState,
  normalizePlan,
  normalizeState,
} from "../server/store.js";
import {
  occursOnDate,
  reminderKey,
  timeKey,
} from "../server/reminders.js";

test("normalizes a weekly learning plan", () => {
  const plan = normalizePlan({
    module: "learning",
    title: " React 深入 ",
    date: "2026-11-06",
    repeatEnabled: true,
    repeatWeekdays: [1, 3, 3, 8],
    startTime: "19:30",
    durationMinutes: 90,
    reminderEnabled: true,
    details: {
      course: "前端进阶",
      content: "状态管理",
    },
  });

  assert.equal(plan.title, "React 深入");
  assert.deepEqual(plan.repeatWeekdays, [1, 3]);
  assert.equal(plan.details.course, "前端进阶");
  assert.equal(plan.details.content, "状态管理");
});

test("matches only the selected weekday after the start date", () => {
  const plan = normalizePlan({
    module: "fitness",
    title: "力量训练",
    date: "2026-11-02",
    repeatEnabled: true,
    repeatWeekdays: [1],
    startTime: "18:00",
    details: { focus: "上肢" },
  });

  assert.equal(occursOnDate(plan, new Date(2026, 10, 2)), true);
  assert.equal(occursOnDate(plan, new Date(2026, 10, 9)), true);
  assert.equal(occursOnDate(plan, new Date(2026, 10, 10)), false);
  assert.equal(occursOnDate(plan, new Date(2026, 9, 26)), false);
});

test("builds stable reminder keys", () => {
  const plan = { id: "plan-1", startTime: "08:15" };
  const date = new Date(2026, 10, 6, 8, 15);
  assert.equal(timeKey(date), "08:15");
  assert.equal(reminderKey(plan, date), "plan-1:2026-11-06:08:15");
});

test("persists state to disk and reloads it", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "worklife-test-"));
  const file = path.join(directory, "data.json");
  const store = new LocalStore(file);
  await store.load();
  await store.update((draft) => {
    draft.quickMemo = "记住这件事";
    draft.plans.push(
      normalizePlan({
        module: "gaming",
        title: "通关第一章",
        date: "2026-11-06",
        startTime: "21:00",
        reminderEnabled: true,
        details: { game: "示例游戏" },
      }),
    );
  });

  const reloaded = new LocalStore(file);
  await reloaded.load();
  assert.equal(reloaded.getState().quickMemo, "记住这件事");
  assert.equal(reloaded.getState().plans[0].title, "通关第一章");
});

test("normalizes imported backups and drops invalid modules", () => {
  const state = normalizeState({
    plans: [
      {
        module: "learning",
        title: "有效计划",
        date: "2026-11-06",
        startTime: "10:00",
      },
      {
        module: "invalid",
        title: "无效计划",
      },
    ],
    quickMemo: "本地备忘",
  });

  assert.equal(state.plans.length, 1);
  assert.equal(state.quickMemo, "本地备忘");
  assert.deepEqual(
    state.settings,
    createInitialState().settings,
  );
  assert.equal(typeof state.syncToken, "string");
  assert.match(state.quickMemoUpdatedAt, /^\d{4}-\d{2}-\d{2}T/);
});
