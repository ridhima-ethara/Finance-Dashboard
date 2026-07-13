// Empty transactional CFO dataset. Live values are maintained in AppContext.

export const BUFFER = {
  total: 0,
  available: 0,
  consumed: 0,
  utilizationPct: 0,
  policyPct: 0,
  perProject: [],
  history: [],
  alerts: [],
};

export const RECOVERY = {
  total: 0,
  recovered: 0,
  outstanding: 0,
  netCost: 0,
  byClient: [],
  trend: [],
};

export const CASH_FLOW = [];
export const DEPT_SPEND = [];
export const APPROVAL_TREND = [];
