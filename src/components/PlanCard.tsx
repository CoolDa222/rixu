import { Bell, Clock3, Pencil, Timer } from "lucide-react";
import { MODULE_META } from "../constants";
import { formatDuration } from "../lib/date";
import { planSecondaryText } from "../lib/plan";
import type { Plan } from "../types";

interface PlanCardProps {
  plan: Plan;
  onEdit: (plan: Plan) => void;
  compact?: boolean;
  showModule?: boolean;
  showTime?: boolean;
  flat?: boolean;
}

export function PlanCard({
  plan,
  onEdit,
  compact = false,
  showModule = true,
  showTime = true,
  flat = false,
}: PlanCardProps) {
  const meta = MODULE_META[plan.module];
  const Icon = meta.icon;

  return (
    <button
      type="button"
      className={`plan-card tone-${meta.tone} ${
        compact ? "is-compact" : ""
      } ${flat ? "is-flat" : ""}`}
      onClick={() => onEdit(plan)}
      title={`编辑：${plan.title}`}
    >
      <span className="plan-accent" />
      {showTime && (
        <span className="plan-time">
          <strong>{plan.startTime}</strong>
          <small>{formatDuration(plan.durationMinutes)}</small>
        </span>
      )}
      <span className="plan-main">
        <span className="plan-title-line">
          <span className="plan-module-icon">
            <Icon size={15} />
          </span>
          <strong>{plan.title}</strong>
          {showModule && <em>{meta.shortLabel}</em>}
        </span>
        <span className="plan-secondary">{planSecondaryText(plan)}</span>
        {!compact && plan.notes && (
          <span className="plan-notes">{plan.notes}</span>
        )}
      </span>
      <span className="plan-signals" aria-label="计划信息">
        {plan.reminderEnabled ? (
          <span title="已开启系统提醒">
            <Bell size={14} />
          </span>
        ) : (
          <span title="未开启提醒">
            <Bell size={14} className="is-muted" />
          </span>
        )}
        <span title={`计划时长：${formatDuration(plan.durationMinutes)}`}>
          <Timer size={14} />
        </span>
        <span className="plan-edit-hint" title="编辑计划">
          <Pencil size={14} />
        </span>
      </span>
    </button>
  );
}

export function MiniPlan({
  plan,
  onEdit,
}: {
  plan: Plan;
  onEdit: (plan: Plan) => void;
}) {
  const meta = MODULE_META[plan.module];
  return (
    <button
      type="button"
      className={`mini-plan tone-${meta.tone}`}
      onClick={() => onEdit(plan)}
      title={`编辑：${plan.title}`}
    >
      <span>
        <Clock3 size={12} />
        {plan.startTime}
      </span>
      <strong>{plan.title}</strong>
      {planSecondaryText(plan) && <small>{planSecondaryText(plan)}</small>}
    </button>
  );
}
