// TPM-specific mock data: AI Cost, Phase Tasks, Change Requests, Returned Budgets, Reports
import { PROJECTS } from "./mockProjects";

// AI COST DATA — today, monthly by provider, token usage, per-project attribution
export const AI_COST_TODAY = {
  total: 4820,
  budget: 6000,
  yesterday: 5140,
  wowChange: -6.2, // week over week
  tokensInput: 42_150_000,
  tokensOutput: 8_320_000,
  avgLatencyMs: 1420,
  requests: 12_480,
};

export const AI_COST_MONTHLY = {
  total: 92_450,
  budget: 140_000,
  forecast: 118_900,
  projected: 128_400,
  daysElapsed: 24,
  daysRemaining: 6,
};

export const AI_COST_BY_PROVIDER = [
  { provider: "Anthropic", models: ["Opus 4.8", "Sonnet"], today: 2140, month: 42_800, tokens: 18_200_000, requests: 4820, share: 46, color: "#E619B8" },
  { provider: "OpenAI", models: ["GPT-4o", "GPT-4o mini"], today: 1180, month: 22_400, tokens: 15_400_000, requests: 3612, share: 24, color: "#10B981" },
  { provider: "Google", models: ["Gemini 2.5 Pro"], today: 890, month: 18_200, tokens: 9_800_000, requests: 2140, share: 20, color: "#3B82F6" },
  { provider: "Moonshot", models: ["Kimi"], today: 340, month: 5_450, tokens: 4_120_000, requests: 1180, share: 6, color: "#F97316" },
  { provider: "xAI", models: ["Grok-2"], today: 270, month: 3_600, tokens: 2_950_000, requests: 728, share: 4, color: "#94A3B8" },
];

export const AI_COST_BY_MODEL = [
  { model: "Opus 4.8", provider: "Anthropic", today: 1980, month: 38_200, tokensIn: 12_400_000, tokensOut: 3_100_000, avgCostPer1kIn: 15, avgCostPer1kOut: 75, requests: 3812 },
  { model: "GPT-4o", provider: "OpenAI", today: 1180, month: 22_400, tokensIn: 12_100_000, tokensOut: 2_800_000, avgCostPer1kIn: 5, avgCostPer1kOut: 15, requests: 3612 },
  { model: "Gemini 2.5 Pro", provider: "Google", today: 890, month: 18_200, tokensIn: 8_400_000, tokensOut: 1_400_000, avgCostPer1kIn: 3.5, avgCostPer1kOut: 10.5, requests: 2140 },
  { model: "Sonnet", provider: "Anthropic", today: 160, month: 4_600, tokensIn: 5_800_000, tokensOut: 1_220_000, avgCostPer1kIn: 3, avgCostPer1kOut: 15, requests: 1008 },
  { model: "Kimi", provider: "Moonshot", today: 340, month: 5_450, tokensIn: 4_120_000, tokensOut: 892_000, avgCostPer1kIn: 1.2, avgCostPer1kOut: 3.6, requests: 1180 },
  { model: "Grok-2", provider: "xAI", today: 270, month: 3_600, tokensIn: 2_950_000, tokensOut: 640_000, avgCostPer1kIn: 5, avgCostPer1kOut: 15, requests: 728 },
];

// AI Cost trend by day (last 30 days)
const seedAiCostTrend = () => {
  const rows = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(2026, 5, 30 - i);
    const seed = (d.getDate() * 3) % 8;
    const base = 3800 + seed * 220;
    rows.push({
      date: d.toISOString().slice(0, 10),
      Anthropic: Math.round(base * 0.46),
      OpenAI: Math.round(base * 0.24),
      Google: Math.round(base * 0.20),
      Moonshot: Math.round(base * 0.06),
      xAI: Math.round(base * 0.04),
      total: base,
    });
  }
  return rows;
};
export const AI_COST_TREND = seedAiCostTrend();

// AI Cost attribution per project
export const AI_COST_BY_PROJECT = PROJECTS.slice(0, 6).map((p) => ({
  id: p.id,
  name: p.name,
  today: Math.round(p.aiModelCost * 0.045),
  month: p.aiModelCost,
  topModel: p.topModel,
  tokens: Math.round(p.aiModelCost * 480),
  share: Math.round((p.aiModelCost / PROJECTS.reduce((s, x) => s + x.aiModelCost, 0)) * 100),
}));

// PHASE TASKS — for Phase Workspace screens
export const PHASE_TASKS = {
  "crowley-gen": {
    p1: [
      { id: "t-cg-p1-1", name: "Kickoff & scope alignment", owner: "Aanya Sharma", model: "—", infra: "—", estCost: 800, actualCost: 720, status: "done", variance: 80 },
      { id: "t-cg-p1-2", name: "Data audit — training corpus", owner: "Rahul Verma", model: "GPT-4o", infra: "AWS S3", estCost: 1400, actualCost: 1520, status: "done", variance: -120 },
      { id: "t-cg-p1-3", name: "Baseline eval harness", owner: "Sara Chen", model: "Opus 4.8", infra: "AWS EC2", estCost: 2200, actualCost: 2080, status: "done", variance: 120 },
    ],
    p2: [
      { id: "t-cg-p2-1", name: "Opus fine-tune sweep A", owner: "Sara Chen", model: "Opus 4.8", infra: "AWS EC2 · g5.4xl", estCost: 4200, actualCost: 4980, status: "done", variance: -780 },
      { id: "t-cg-p2-2", name: "Prompt caching pipeline", owner: "Rahul Verma", model: "Opus 4.8", infra: "AWS EC2 · g5.2xl", estCost: 2800, actualCost: 2620, status: "in-progress", variance: 180 },
      { id: "t-cg-p2-3", name: "Cross-model A/B testing", owner: "Aanya Sharma", model: "Gemini 2.5 Pro", infra: "GCP · TPU v5e", estCost: 3200, actualCost: 3410, status: "in-progress", variance: -210 },
    ],
    p3: [
      { id: "t-cg-p3-1", name: "API integration with app tier", owner: "Sara Chen", model: "GPT-4o", infra: "AWS EC2", estCost: 3400, actualCost: 3120, status: "in-progress", variance: 280 },
      { id: "t-cg-p3-2", name: "Prod deploy · staged rollout", owner: "Rahul Verma", model: "Opus 4.8", infra: "AWS EC2", estCost: 2600, actualCost: 0, status: "planned", variance: 2600 },
      { id: "t-cg-p3-3", name: "Latency & cost guardrails", owner: "Aanya Sharma", model: "—", infra: "AWS CloudWatch", estCost: 1200, actualCost: 0, status: "planned", variance: 1200 },
    ],
    p4: [
      { id: "t-cg-p4-1", name: "Client acceptance testing", owner: "Aanya Sharma", model: "Opus 4.8", infra: "AWS EC2", estCost: 3200, actualCost: 0, status: "planned", variance: 3200 },
      { id: "t-cg-p4-2", name: "Handover documentation", owner: "Sara Chen", model: "—", infra: "—", estCost: 800, actualCost: 0, status: "planned", variance: 800 },
    ],
  },
};

// Helper: get tasks for a given project & phase, with fallback synthetic set
export const getPhaseTasks = (projectId, phaseId) => {
  const bucket = PHASE_TASKS[projectId];
  if (bucket && bucket[phaseId]) return bucket[phaseId];
  // synthetic fallback
  return [
    { id: `t-${projectId}-${phaseId}-1`, name: "Discovery & scoping", owner: "Aanya Sharma", model: "GPT-4o", infra: "AWS EC2", estCost: 1400, actualCost: 1320, status: "done", variance: 80 },
    { id: `t-${projectId}-${phaseId}-2`, name: "Model tuning · main sweep", owner: "Rahul Verma", model: "Opus 4.8", infra: "AWS EC2 · g5.2xl", estCost: 3200, actualCost: 3480, status: "in-progress", variance: -280 },
    { id: `t-${projectId}-${phaseId}-3`, name: "Integration & QA", owner: "Sara Chen", model: "Gemini 2.5 Pro", infra: "GCP TPU", estCost: 2400, actualCost: 0, status: "planned", variance: 2400 },
  ];
};

// CHANGE REQUESTS — for CTO Review
export const CHANGE_REQUESTS = [
  { id: "cr1", projectId: "crowley-gen", projectName: "Crowley Generation", type: "Budget increase", amount: 6000, currentBudget: 48000, requestedBudget: 54000, requester: "Aanya Sharma", urgency: "High", stage: "CTO Review", createdAt: "2026-06-22T11:03:00Z", reason: "Opus 4.8 inference volumes 18% above plan for Phase 2. Extra sweep needed before rollout.", affectedPhase: "Phase 2 · Model tuning", timelineDelta: "+5 days" },
  { id: "cr2", projectId: "atlas", projectName: "Atlas Ingest", type: "Timeline extension", amount: 3500, currentBudget: 11000, requestedBudget: 14500, requester: "Arjun Mehta", urgency: "Normal", stage: "CTO Review", createdAt: "2026-06-21T09:44:00Z", reason: "EC2 spike from Ironclad ingest workload up 34% week-over-week; extend sprint by 3 days.", affectedPhase: "Phase 3 · Integration", timelineDelta: "+3 days" },
  { id: "cr3", projectId: "vesper", projectName: "Vesper Docker", type: "Budget increase", amount: 5000, currentBudget: 13000, requestedBudget: 18000, requester: "Aanya Sharma", urgency: "High", stage: "COO Approval", createdAt: "2026-06-20T15:11:00Z", reason: "Already 20% over budget. Client contract locked in; needs immediate top-up.", affectedPhase: "Phase 2 · Model tuning", timelineDelta: "0 days" },
];

// RETURNED BUDGETS — CTO sent back for edits with inline comments
export const RETURNED_BUDGETS = [
  {
    id: "rb1",
    projectId: "atlas",
    projectName: "Atlas Ingest",
    version: "v1.2",
    originalVersion: "v1.1",
    submittedBy: "Arjun Mehta",
    submittedAt: "2026-06-22T09:00:00Z",
    reviewedBy: "Vikram Kumar",
    reviewedAt: "2026-06-23T14:30:00Z",
    status: "returned",
    ctoNote: "The GPU line is inflated. Try Gemini 2.5 Pro for classification — 34% cheaper for this task mix. Also consider reserved instances instead of on-demand for the ingest workload.",
    diff: [
      { line: "AI Model · Opus 4.8", from: 6800, to: 6800, changed: false, note: "Reduce or move to Gemini 2.5 Pro", flagged: true },
      { line: "Infrastructure · AWS EC2 (on-demand)", from: 3200, to: 3200, changed: false, note: "Switch to reserved instances", flagged: true },
      { line: "Infrastructure · AWS S3", from: 200, to: 200, changed: false, note: "OK", flagged: false },
      { line: "Subscriptions · Claude Max", from: 400, to: 400, changed: false, note: "OK", flagged: false },
      { line: "Miscellaneous · Travel", from: 800, to: 800, changed: false, note: "OK", flagged: false },
    ],
    total: 11400,
  },
];

// REPORTS CATALOG — used by Reports module
export const REPORTS_CATALOG = [
  { id: "rpt-budget", name: "Budget report", description: "Approved vs Actual vs Remaining across all projects", type: "Budget", frequency: "Monthly", format: "PDF · CSV", lastRun: "2026-06-24T00:00:00Z", records: 8 },
  { id: "rpt-phase", name: "Phase report", description: "Phase-wise progress, budget consumption, and health status", type: "Phase", frequency: "Weekly", format: "PDF · CSV", lastRun: "2026-06-23T00:00:00Z", records: 32 },
  { id: "rpt-expense", name: "Expense report", description: "Line-item expenses categorized by model, infra, subscriptions, misc", type: "Expense", frequency: "Weekly", format: "CSV · XLSX", lastRun: "2026-06-24T00:00:00Z", records: 214 },
  { id: "rpt-variance", name: "Variance report", description: "Estimated vs actual variance with % deviation per project & phase", type: "Variance", frequency: "Weekly", format: "PDF", lastRun: "2026-06-23T00:00:00Z", records: 32 },
  { id: "rpt-task", name: "Task report", description: "Task-level ownership, model attribution, and cost breakdown", type: "Task", frequency: "On-demand", format: "CSV", lastRun: "2026-06-22T00:00:00Z", records: 148 },
  { id: "rpt-model", name: "Model usage report", description: "Token usage, cost per model, and provider distribution", type: "Model", frequency: "Weekly", format: "CSV · JSON", lastRun: "2026-06-24T00:00:00Z", records: 6 },
  { id: "rpt-recovery", name: "Client recovery report", description: "Recoverable amounts, invoiced, received, and outstanding per client", type: "Recovery", frequency: "Monthly", format: "PDF · XLSX", lastRun: "2026-06-20T00:00:00Z", records: 6 },
  { id: "rpt-daily", name: "Daily consumption report", description: "Day-over-day spend, top expenses, top models, active projects", type: "Daily", frequency: "Daily", format: "CSV", lastRun: "2026-06-24T00:00:00Z", records: 30 },
];
