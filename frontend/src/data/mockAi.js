// Catalog-style config can remain static; transactional AI usage data starts empty.

export const MODEL_KEYS = [];
export const MODEL_KEYS_MASKED = [];

export const LINE_CATEGORIES = [
  { id: "model", label: "AI Model", unit: "tokens (M)", defaultRate: 8 },
  { id: "infra", label: "Infrastructure", unit: "hours", defaultRate: 12 },
  { id: "subscription", label: "Subscription", unit: "seats x mo", defaultRate: 60 },
  { id: "hardware", label: "Hardware", unit: "units", defaultRate: 1200 },
  { id: "employee", label: "Employee", unit: "person-days", defaultRate: 400 },
  { id: "other", label: "Other", unit: "line", defaultRate: 0 },
];

export const THRESHOLDS = [50, 75, 90, 100];
export const DAILY_ACTIVITY = [];
export const MODEL_TRAJECTORY = [];
