import { useState } from "react";
import {
  Bell,
  BellOff,
  BookOpen,
  CalendarDays,
  Dumbbell,
  Gamepad2,
  Plus,
  Trash2,
  Utensils,
} from "lucide-react";
import { MEAL_META, MODULE_META, WEEKDAYS } from "../constants";
import { dateKey, formatDuration } from "../lib/date";
import {
  autoTitle,
  createEmptyDetails,
} from "../lib/plan";
import type {
  DietDetails,
  FitnessDetails,
  GamingDetails,
  LearningDetails,
  MealType,
  ModuleKey,
  Plan,
  PlanDetails,
  PlanDraft,
  PlanPreset,
} from "../types";
import { Modal } from "./Modal";
import { SegmentedControl } from "./SegmentedControl";
import { Toggle } from "./Toggle";

const MODULE_ICONS = {
  learning: BookOpen,
  fitness: Dumbbell,
  diet: Utensils,
  gaming: Gamepad2,
};

interface PlanFormProps {
  initial?: Plan | null;
  initialModule?: ModuleKey;
  preset?: PlanPreset;
  saving: boolean;
  onClose: () => void;
  onSave: (draft: PlanDraft) => void;
  onDelete?: (plan: Plan) => void;
}

export function PlanForm({
  initial,
  initialModule = "learning",
  preset,
  saving,
  onClose,
  onSave,
  onDelete,
}: PlanFormProps) {
  const [module, setModule] = useState<ModuleKey>(
    initial?.module || initialModule,
  );
  const [title, setTitle] = useState(initial?.title || "");
  const [date, setDate] = useState(
    preset?.date || initial?.date || dateKey(),
  );
  const [repeatEnabled, setRepeatEnabled] = useState(
    initial?.repeatEnabled || false,
  );
  const [repeatWeekdays, setRepeatWeekdays] = useState<number[]>(
    initial?.repeatEnabled
      ? initial.repeatWeekdays
      : [new Date().getDay()],
  );
  const [startTime, setStartTime] = useState(
    preset?.startTime || initial?.startTime || "09:00",
  );
  const [durationMinutes, setDurationMinutes] = useState(
    initial?.durationMinutes || 60,
  );
  const [reminderEnabled, setReminderEnabled] = useState(
    initial?.reminderEnabled ?? true,
  );
  const [notes, setNotes] = useState(initial?.notes || "");
  const [details, setDetails] = useState<PlanDetails>(
    initial?.details ||
      createEmptyDetails(module, preset?.mealType || "lunch"),
  );
  const [error, setError] = useState("");
  const isEditing = Boolean(initial);
  const meta = MODULE_META[module];

  function switchModule(next: ModuleKey) {
    if (isEditing || next === module) {
      return;
    }
    setModule(next);
    setDetails(createEmptyDetails(next, preset?.mealType || "lunch"));
    setError("");
  }

  function toggleWeekday(day: number) {
    setRepeatWeekdays((current) =>
      current.includes(day)
        ? current.filter((item) => item !== day)
        : [...current, day],
    );
  }

  function updateExercise(
    id: string,
    field: "name" | "sets" | "reps" | "duration",
    value: string,
  ) {
    const current = details as FitnessDetails;
    setDetails({
      ...current,
      exercises: current.exercises.map((exercise) =>
        exercise.id === id ? { ...exercise, [field]: value } : exercise,
      ),
    });
  }

  function addExercise() {
    const current = details as FitnessDetails;
    setDetails({
      ...current,
      exercises: [
        ...current.exercises,
        {
          id: crypto.randomUUID(),
          name: "",
          sets: "3",
          reps: "10",
          duration: "",
        },
      ],
    });
  }

  function removeExercise(id: string) {
    const current = details as FitnessDetails;
    setDetails({
      ...current,
      exercises: current.exercises.filter((exercise) => exercise.id !== id),
    });
  }

  function submit() {
    const resolvedTitle = title.trim() || autoTitle(module, details);
    if (!resolvedTitle.trim()) {
      setError("请填写计划标题或模块内容。");
      return;
    }
    if (repeatEnabled && repeatWeekdays.length === 0) {
      setError("按周重复时至少选择一个星期。");
      return;
    }

    const draft: PlanDraft = {
      module,
      title: resolvedTitle.trim(),
      date,
      repeatEnabled,
      repeatWeekdays: repeatEnabled ? repeatWeekdays : [],
      startTime,
      durationMinutes: Number(durationMinutes) || 0,
      reminderEnabled,
      notes: notes.trim(),
      details,
    };
    onSave(draft);
  }

  return (
    <Modal
      title={isEditing ? `编辑${meta.label}` : `新建${meta.label}`}
      eyebrow={isEditing ? "调整计划" : "添加安排"}
      onClose={onClose}
      footer={
        <div className="modal-footer-split">
          <div>
            {isEditing && initial && onDelete && (
              <button
                type="button"
                className="button button-danger-ghost"
                onClick={() => onDelete(initial)}
              >
                <Trash2 size={16} />
                删除计划
              </button>
            )}
          </div>
          <div className="modal-footer-actions">
            <button
              type="button"
              className="button button-secondary"
              onClick={onClose}
            >
              取消
            </button>
            <button
              type="button"
              className="button button-primary"
              disabled={saving}
              onClick={submit}
            >
              {saving ? "保存中..." : isEditing ? "保存修改" : "创建计划"}
            </button>
          </div>
        </div>
      }
    >
      <div className="plan-form">
        {!isEditing && (
          <div className="module-picker" aria-label="选择模块">
            {(Object.keys(MODULE_META) as ModuleKey[]).map((key) => {
              const item = MODULE_META[key];
              const Icon = MODULE_ICONS[key];
              return (
                <button
                  type="button"
                  key={key}
                  className={`module-choice tone-${item.tone} ${
                    module === key ? "is-active" : ""
                  }`}
                  onClick={() => switchModule(key)}
                >
                  <Icon size={18} />
                  <span>{item.shortLabel}</span>
                </button>
              );
            })}
          </div>
        )}

        <div className="form-grid two-columns">
          <label className="field field-span-2">
            <span>计划标题</span>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder={
                module === "learning"
                  ? "例如：复习 TypeScript 类型系统"
                  : module === "fitness"
                    ? "例如：上肢力量训练"
                    : module === "diet"
                      ? "例如：鸡胸肉配时蔬"
                      : "例如：通关《空洞骑士》第一章"
              }
              autoFocus
            />
          </label>
        </div>

        <ModuleFields
          module={module}
          details={details}
          setDetails={setDetails}
          updateExercise={updateExercise}
          addExercise={addExercise}
          removeExercise={removeExercise}
        />

        <div className="form-section">
          <div className="form-section-heading">
            <div>
              <h3>时间安排</h3>
              <p>单次计划只出现一次；按周重复会持续进入对应星期的安排。</p>
            </div>
            <CalendarDays size={19} />
          </div>

          <SegmentedControl
            label="重复方式"
            value={repeatEnabled ? "weekly" : "once"}
            options={[
              { value: "once", label: "单次计划" },
              { value: "weekly", label: "按周重复" },
            ]}
            onChange={(value) => setRepeatEnabled(value === "weekly")}
          />

          <div className="form-grid two-columns form-spacing">
            <label className="field">
              <span>{repeatEnabled ? "开始日期" : "计划日期"}</span>
              <input
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
              />
            </label>
            <label className="field">
              <span>开始时间</span>
              <input
                type="time"
                value={startTime}
                onChange={(event) => setStartTime(event.target.value)}
              />
            </label>
          </div>

          {repeatEnabled && (
            <div className="weekday-selector">
              <span className="field-label">重复星期</span>
              <div className="weekday-options">
                {WEEKDAYS.map((day) => (
                  <button
                    type="button"
                    key={day.value}
                    className={
                      repeatWeekdays.includes(day.value) ? "is-active" : ""
                    }
                    onClick={() => toggleWeekday(day.value)}
                  >
                    {day.short}
                  </button>
                ))}
              </div>
            </div>
          )}

          <label className="field form-spacing">
            <span>预计时长</span>
            <div className="duration-input">
              <input
                type="number"
                min="0"
                max="1440"
                step="15"
                value={durationMinutes}
                onChange={(event) =>
                  setDurationMinutes(Number(event.target.value))
                }
              />
              <small>{formatDuration(durationMinutes)}</small>
            </div>
          </label>
        </div>

        <div className="form-section">
          <div className="form-section-heading">
            <div>
              <h3>提醒与备注</h3>
              <p>系统会在开始时间准时提醒；浏览器关闭时由本地后台发送。</p>
            </div>
            {reminderEnabled ? <Bell size={19} /> : <BellOff size={19} />}
          </div>

          <div className="setting-inline">
            <div>
              <strong>系统通知</strong>
              <p>{reminderEnabled ? "到点发送系统通知" : "不发送提醒"}</p>
            </div>
            <Toggle
              checked={reminderEnabled}
              onChange={setReminderEnabled}
              label="系统通知"
            />
          </div>

          <label className="field form-spacing">
            <span>备注</span>
            <textarea
              rows={3}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="可以写需要准备的材料、重点或提醒自己的话"
            />
          </label>
        </div>

        {error && <p className="form-error">{error}</p>}
      </div>
    </Modal>
  );
}

interface ModuleFieldsProps {
  module: ModuleKey;
  details: PlanDetails;
  setDetails: (details: PlanDetails) => void;
  updateExercise: (
    id: string,
    field: "name" | "sets" | "reps" | "duration",
    value: string,
  ) => void;
  addExercise: () => void;
  removeExercise: (id: string) => void;
}

function ModuleFields({
  module,
  details,
  setDetails,
  updateExercise,
  addExercise,
  removeExercise,
}: ModuleFieldsProps) {
  if (module === "learning") {
    const value = details as LearningDetails;
    return (
      <div className="form-section module-detail-section">
        <div className="form-section-heading">
          <div>
            <h3>学习内容</h3>
            <p>课程用于归类，具体内容会显示在课程表和首页摘要里。</p>
          </div>
          <BookOpen size={19} />
        </div>
        <div className="form-grid two-columns">
          <label className="field">
            <span>课程或领域</span>
            <input
              value={value.course}
              onChange={(event) =>
                setDetails({ ...value, course: event.target.value })
              }
              placeholder="例如：前端开发"
            />
          </label>
          <label className="field">
            <span>本次学习内容</span>
            <input
              value={value.content}
              onChange={(event) =>
                setDetails({ ...value, content: event.target.value })
              }
              placeholder="例如：状态管理"
            />
          </label>
        </div>
      </div>
    );
  }

  if (module === "fitness") {
    const value = details as FitnessDetails;
    return (
      <div className="form-section module-detail-section">
        <div className="form-section-heading">
          <div>
            <h3>训练安排</h3>
            <p>记录计划中的动作与数量，这一版不记录实际完成情况。</p>
          </div>
          <Dumbbell size={19} />
        </div>
        <label className="field">
          <span>训练主题</span>
          <input
            value={value.focus}
            onChange={(event) =>
              setDetails({ ...value, focus: event.target.value })
            }
            placeholder="例如：胸肩三头 / 下肢 / 有氧"
          />
        </label>

        <div className="exercise-list">
          <div className="exercise-header">
            <span>动作名称</span>
            <span>组数</span>
            <span>次数</span>
            <span>时长</span>
            <span />
          </div>
          {value.exercises.map((exercise) => (
            <div className="exercise-row" key={exercise.id}>
              <input
                value={exercise.name}
                onChange={(event) =>
                  updateExercise(exercise.id, "name", event.target.value)
                }
                placeholder="卧推"
                aria-label="动作名称"
              />
              <input
                value={exercise.sets}
                onChange={(event) =>
                  updateExercise(exercise.id, "sets", event.target.value)
                }
                placeholder="3"
                aria-label="组数"
              />
              <input
                value={exercise.reps}
                onChange={(event) =>
                  updateExercise(exercise.id, "reps", event.target.value)
                }
                placeholder="10"
                aria-label="次数"
              />
              <input
                value={exercise.duration}
                onChange={(event) =>
                  updateExercise(exercise.id, "duration", event.target.value)
                }
                placeholder="30 秒"
                aria-label="时长"
              />
              <button
                type="button"
                className="icon-button icon-button-small"
                title="删除动作"
                aria-label="删除动作"
                onClick={() => removeExercise(exercise.id)}
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
          <button
            type="button"
            className="button button-quiet button-small exercise-add"
            onClick={addExercise}
          >
            <Plus size={15} />
            添加动作
          </button>
        </div>
      </div>
    );
  }

  if (module === "diet") {
    const value = details as DietDetails;
    return (
      <div className="form-section module-detail-section">
        <div className="form-section-heading">
          <div>
            <h3>餐次与菜单</h3>
            <p>菜单会出现在按星期排列的饮食计划表中。</p>
          </div>
          <Utensils size={19} />
        </div>
        <SegmentedControl
          label="餐次"
          value={value.mealType}
          options={(Object.keys(MEAL_META) as MealType[]).map((key) => ({
            value: key,
            label: MEAL_META[key].label,
          }))}
          onChange={(mealType) => setDetails({ ...value, mealType })}
        />
        <div className="form-grid two-columns form-spacing">
          <label className="field">
            <span>菜单</span>
            <input
              value={value.menu}
              onChange={(event) =>
                setDetails({ ...value, menu: event.target.value })
              }
              placeholder="例如：鸡肉、米饭、时蔬"
            />
          </label>
          <label className="field">
            <span>份量</span>
            <input
              value={value.portion}
              onChange={(event) =>
                setDetails({ ...value, portion: event.target.value })
              }
              placeholder="例如：一大份 / 300 克"
            />
          </label>
        </div>
      </div>
    );
  }

  const value = details as GamingDetails;
  return (
    <div className="form-section module-detail-section">
      <div className="form-section-heading">
        <div>
          <h3>娱乐内容</h3>
          <p>把放松当成计划的一部分，但不统计实际游玩时长。</p>
        </div>
        <Gamepad2 size={19} />
      </div>
      <div className="form-grid two-columns">
        <label className="field">
          <span>游戏或活动</span>
          <input
            value={value.game}
            onChange={(event) =>
              setDetails({ ...value, game: event.target.value })
            }
            placeholder="例如：《空洞骑士》"
          />
        </label>
        <label className="field">
          <span>本次目标</span>
          <input
            value={value.objective}
            onChange={(event) =>
              setDetails({ ...value, objective: event.target.value })
            }
            placeholder="例如：探索新区域"
          />
        </label>
      </div>
    </div>
  );
}
