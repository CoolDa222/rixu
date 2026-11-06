import { MEAL_META, MODULE_META } from "../constants";
import type {
  DietDetails,
  FitnessDetails,
  GamingDetails,
  LearningDetails,
  MealType,
  ModuleKey,
  Plan,
  PlanDetails,
} from "../types";
import { dateKey, weekdayLabel } from "./date";

export function createEmptyDetails(
  module: ModuleKey,
  mealType: MealType = "lunch",
): PlanDetails {
  if (module === "learning") {
    return { course: "", content: "" } satisfies LearningDetails;
  }
  if (module === "fitness") {
    return {
      focus: "",
      exercises: [
        { id: crypto.randomUUID(), name: "", sets: "3", reps: "10", duration: "" },
      ],
    } satisfies FitnessDetails;
  }
  if (module === "diet") {
    return {
      mealType,
      menu: "",
      portion: "",
    } satisfies DietDetails;
  }
  return { game: "", objective: "" } satisfies GamingDetails;
}

export function planSecondaryText(plan: Plan) {
  if (plan.module === "learning") {
    const details = plan.details as LearningDetails;
    return details.course || details.content || MODULE_META[plan.module].description;
  }
  if (plan.module === "fitness") {
    const details = plan.details as FitnessDetails;
    const count = details.exercises?.length || 0;
    return details.focus
      ? `${details.focus}${count ? ` · ${count} 个动作` : ""}`
      : MODULE_META[plan.module].description;
  }
  if (plan.module === "diet") {
    const details = plan.details as DietDetails;
    return `${MEAL_META[details.mealType]?.label || "餐次"}${
      details.portion ? ` · ${details.portion}` : ""
    }`;
  }
  const details = plan.details as GamingDetails;
  return details.game || details.objective || MODULE_META[plan.module].description;
}

export function describeRecurrence(plan: Plan) {
  if (!plan.repeatEnabled) {
    return plan.date === dateKey() ? "今天" : plan.date;
  }
  return plan.repeatWeekdays
    .map((day) => weekdayLabel(day))
    .join("、");
}

export function autoTitle(module: ModuleKey, details: PlanDetails) {
  if (module === "learning") {
    const value = details as LearningDetails;
    return value.content || value.course;
  }
  if (module === "fitness") {
    return (details as FitnessDetails).focus;
  }
  if (module === "diet") {
    return (details as DietDetails).menu;
  }
  return (details as GamingDetails).game || (details as GamingDetails).objective;
}

export function sortPlans(plans: Plan[]) {
  return [...plans].sort((a, b) => {
    const time = a.startTime.localeCompare(b.startTime);
    if (time !== 0) return time;
    return a.title.localeCompare(b.title, "zh-CN");
  });
}
