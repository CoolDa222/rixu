import assert from "node:assert/strict";
import test from "node:test";
import { createInitialState, normalizePlan, normalizeState } from "../server/store.js";
import { mergeSyncState } from "../server/sync.js";

function plan(id, title, updatedAt) {
  return {
    ...normalizePlan({
      id,
      module: "learning",
      title,
      date: "2026-11-06",
      startTime: "09:00",
      reminderEnabled: true,
      details: { course: "测试", content: title },
    }),
    updatedAt,
  };
}

test("merges independent plans from computer and phone", () => {
  const current = normalizeState({
    ...createInitialState(),
    plans: [plan("desktop-1", "电脑计划", "2026-11-06T09:00:00.000Z")],
  });
  const incoming = normalizeState({
    plans: [plan("phone-1", "手机计划", "2026-11-06T10:00:00.000Z")],
  });

  const result = mergeSyncState({
    current,
    incoming,
    lastSyncAt: "2026-11-06T08:00:00.000Z",
    now: "2026-11-06T11:00:00.000Z",
  });

  assert.equal(result.state.plans.length, 2);
  assert.equal(result.conflicts.length, 0);
});

test("creates a conflict copy when both sides changed the same plan", () => {
  const current = normalizeState({
    ...createInitialState(),
    plans: [plan("same", "电脑修改", "2026-11-06T10:00:00.000Z")],
  });
  const incoming = normalizeState({
    plans: [plan("same", "手机修改", "2026-11-06T10:30:00.000Z")],
  });

  const result = mergeSyncState({
    current,
    incoming,
    lastSyncAt: "2026-11-06T09:00:00.000Z",
    now: "2026-11-06T11:00:00.000Z",
  });

  assert.equal(result.state.plans.length, 2);
  assert.equal(result.conflicts.length, 1);
  assert.ok(
    result.state.plans.some((item) => item.title === "电脑修改"),
  );
  assert.ok(
    result.state.plans.some((item) => item.title.includes("手机冲突副本")),
  );
});

test("a newer tombstone removes the deleted plan", () => {
  const current = normalizeState({
    ...createInitialState(),
    deletedPlans: [
      { id: "delete-me", updatedAt: "2026-11-06T10:00:00.000Z" },
    ],
  });
  const incoming = normalizeState({
    plans: [plan("delete-me", "旧手机副本", "2026-11-06T09:00:00.000Z")],
  });

  const result = mergeSyncState({
    current,
    incoming,
    lastSyncAt: "2026-11-06T08:00:00.000Z",
    now: "2026-11-06T11:00:00.000Z",
  });

  assert.equal(result.state.plans.length, 0);
  assert.equal(result.state.deletedPlans.length, 1);
});

test("keeps both quick memos when they conflict", () => {
  const current = normalizeState({
    ...createInitialState(),
    quickMemo: "电脑备忘",
    quickMemoUpdatedAt: "2026-11-06T10:00:00.000Z",
  });
  const incoming = normalizeState({
    quickMemo: "手机备忘",
    quickMemoUpdatedAt: "2026-11-06T10:10:00.000Z",
  });

  const result = mergeSyncState({
    current,
    incoming,
    lastSyncAt: "2026-11-06T09:00:00.000Z",
    now: "2026-11-06T11:00:00.000Z",
  });

  assert.match(result.state.quickMemo, /电脑备忘/);
  assert.match(result.state.quickMemo, /手机备忘/);
  assert.equal(result.conflicts.length, 1);
});

test("does not report a conflict when one side has an empty memo", () => {
  const current = normalizeState(createInitialState());
  const incoming = normalizeState({
    quickMemo: "手机首次同步备忘",
    quickMemoUpdatedAt: "2026-11-06T10:10:00.000Z",
  });

  const result = mergeSyncState({
    current,
    incoming,
    lastSyncAt: "",
    now: "2026-11-06T11:00:00.000Z",
  });

  assert.equal(result.state.quickMemo, "手机首次同步备忘");
  assert.equal(result.conflicts.length, 0);
});
