// Empty transactional TPM / CTO dataset. Live workflow records are created in AppContext.

export const AI_COST_TODAY = {
  total: 0,
  budget: 0,
  yesterday: 0,
  wowChange: 0,
  tokensInput: 0,
  tokensOutput: 0,
  avgLatencyMs: 0,
  requests: 0,
};

export const AI_COST_MONTHLY = {
  total: 0,
  budget: 0,
  forecast: 0,
  projected: 0,
  daysElapsed: 0,
  daysRemaining: 0,
};

export const AI_COST_BY_PROVIDER = [];
export const AI_COST_BY_MODEL = [];
export const AI_COST_TREND = [];
export const AI_COST_BY_PROJECT = [];
export const PHASE_TASKS = {};
export const getPhaseTasks = () => [];
export const CHANGE_REQUESTS = [];
export const BUDGET_REVIEWS = [];
export const CTO_AUDIT = [];
export const DAILY_CONSUMPTION_LOG = [];
export const REPORTS_CATALOG = [];
