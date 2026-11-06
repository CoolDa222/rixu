import type {
  AppState,
  AppStatus,
  ModuleKey,
  Plan,
  PlanPreset,
} from "../types";

export interface PageProps {
  state: AppState;
  status: AppStatus | null;
  onCreate: (module: ModuleKey, preset?: PlanPreset) => void;
  onEdit: (plan: Plan) => void;
}
