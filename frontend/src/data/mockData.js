// Barrel re-exports for backward compatibility.
// New code should import directly from the modular files.
export { CURRENT_USER, USERS, ROLES, TEAM, CLIENTS } from "./mockUsers";
export { PROJECTS, PORTFOLIO } from "./mockProjects";
export {
  MONTHLY_SPEND,
  CATEGORY_BREAKDOWN,
  MODELS_USAGE,
  INFRA_BY_PROJECT,
  SUBSCRIPTIONS,
  NOTIFICATIONS,
  APPROVALS,
  REIMBURSEMENTS,
  AI_INSIGHTS,
} from "./mockFinance";
export {
  MODEL_KEYS,
  MODEL_KEYS_MASKED,
  LINE_CATEGORIES,
  THRESHOLDS,
  DAILY_ACTIVITY,
  MODEL_TRAJECTORY,
} from "./mockAi";
export {
  AI_COST_TODAY,
  AI_COST_MONTHLY,
  AI_COST_BY_PROVIDER,
  AI_COST_BY_MODEL,
  AI_COST_TREND,
  AI_COST_BY_PROJECT,
  PHASE_TASKS,
  getPhaseTasks,
  CHANGE_REQUESTS,
  BUDGET_REVIEWS,
  CTO_AUDIT,
  DAILY_CONSUMPTION_LOG,
  REPORTS_CATALOG,
} from "./mockTpm";
