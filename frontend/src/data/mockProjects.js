// Projects data + portfolio aggregates
import { TEAM } from "./mockUsers";

const mkExpense = (i, project, category, vendor, amount, extra = false) => ({
  id: `e-${project}-${i}`,
  projectId: project,
  date: new Date(2026, 5, ((i * 3) % 28) + 1).toISOString(),
  category,
  vendor,
  employee: TEAM[i % TEAM.length].name,
  amount,
  status: i % 5 === 0 ? "pending" : "approved",
  financeStatus: i % 4 === 0 ? "processing" : "reimbursed",
  extra,
  billUrl: "#",
  remarks: extra ? "Overage — needs top-up review" : "Within plan",
});

const mkAudit = (project) => [
  { id: `a-${project}-1`, ts: "2026-06-01T09:12:00Z", actor: "Aanya Sharma", action: "Budget request submitted", detail: "Initial budget of $48k requested for Q2 sprint" },
  { id: `a-${project}-2`, ts: "2026-06-02T13:44:00Z", actor: "Vikram Kumar", action: "CTO reviewed", detail: "Recommended reducing inference cost estimate by 8%" },
  { id: `a-${project}-3`, ts: "2026-06-03T17:20:00Z", actor: "Nikhil Rao", action: "COO approved", detail: "Approved at $48k. Locked for execution." },
  { id: `a-${project}-4`, ts: "2026-06-18T11:02:00Z", actor: "System", action: "Alert triggered", detail: "Utilization crossed 80% threshold" },
];

const mkComments = (project) => [
  { id: `c-${project}-1`, author: "Aanya Sharma", ts: "2026-06-10T10:04:00Z", body: "Infra usage looks stable — Opus fallback engaged twice this week." },
  { id: `c-${project}-2`, author: "Vikram Kumar", ts: "2026-06-14T15:22:00Z", body: "Please move heavy classification runs to Gemini 2.5 Pro for the next sprint." },
];

const mkBudgetHistory = (project, base) => [
  { id: `bh-${project}-1`, version: "v1.0", date: "2026-06-03", amount: base, action: "Initial approval", approver: "Nikhil Rao" },
  { id: `bh-${project}-2`, version: "v1.1", date: "2026-06-19", amount: base + 4000, action: "Top-up +$4k", approver: "Vikram Kumar" },
];

const mkTopups = (project) => [
  { id: `t-${project}-1`, date: "2026-06-18", amount: 4000, reason: "Additional GPU hours for eval sweep", requester: "Aanya Sharma", approver: "Vikram Kumar", status: "approved" },
  { id: `t-${project}-2`, date: "2026-06-24", amount: 2500, reason: "Extended Claude context window testing", requester: "Aanya Sharma", approver: "Pending", status: "pending" },
];

const mkPhases = (approved, actual) => [
  { id: "p1", name: "Phase 1", dates: "Jun 1 – 8", estimated: Math.round(approved * 0.22), actual: Math.round(actual * 0.22), health: "healthy" },
  { id: "p2", name: "Phase 2", dates: "Jun 9 – 16", estimated: Math.round(approved * 0.28), actual: Math.round(actual * 0.32), health: "over" },
  { id: "p3", name: "Phase 3", dates: "Jun 17 – 24", estimated: Math.round(approved * 0.28), actual: Math.round(actual * 0.26), health: "watch" },
  { id: "p4", name: "Phase 4", dates: "Jun 25 – 30", estimated: Math.round(approved * 0.22), actual: Math.round(actual * 0.20), health: "healthy" },
];

const buildProject = (id, name, client, pl, approved, estimated, actual, status, extras = {}) => {
  const remaining = approved - actual;
  const variance = estimated - actual;
  const utilization = Math.round((actual / approved) * 100);
  const burnRate = Math.round((actual / 30 / 1000) * 10) / 10;
  const forecast = Math.round(actual + (actual / 30) * 8);
  const health = utilization >= 100 ? "over" : utilization >= 85 ? "watch" : "healthy";
  const expenses = [
    mkExpense(1, id, "Infrastructure", "AWS EC2", Math.round(actual * 0.18)),
    mkExpense(2, id, "Infrastructure", "AWS S3", Math.round(actual * 0.03)),
    mkExpense(3, id, "AI Models", "OpenAI · GPT-4o", Math.round(actual * 0.14)),
    mkExpense(4, id, "AI Models", "Anthropic · Opus 4.7", Math.round(actual * 0.22)),
    mkExpense(5, id, "AI Models", "Google · Gemini 2.5 Pro", Math.round(actual * 0.11)),
    mkExpense(6, id, "Licenses", "Cursor Pro", 240),
    mkExpense(7, id, "Licenses", "Claude Max", 800),
    mkExpense(8, id, "Employee", "Payroll allocation", Math.round(actual * 0.14)),
    mkExpense(9, id, "Reimbursements", "Aanya Sharma · Travel", 420, true),
    mkExpense(10, id, "Dinner", "Team dinner · Bengaluru", 320),
    mkExpense(11, id, "Hardware", "Dell workstation", 2400),
    mkExpense(12, id, "Miscellaneous", "Domain + assets", 180, true),
  ];
  return {
    id,
    name,
    client,
    pl,
    tpm: extras.tpm || pl,
    rnd: extras.rnd || null,
    docs: extras.docs || [],
    status,
    type: extras.type || "R&D",
    buffer: extras.buffer ?? 10,
    recoverableFromClient: extras.recoverable ?? false,
    recoveredAmount: extras.recovered ?? 0,
    approvedBudget: approved,
    estimatedBudget: estimated,
    actualSpend: actual,
    remaining,
    variance,
    utilization,
    burnRate,
    forecast,
    infrastructureCost: Math.round(actual * 0.24),
    aiModelCost: Math.round(actual * 0.47),
    employeeCost: Math.round(actual * 0.14),
    purchaseCost: Math.round(actual * 0.06),
    reimbursements: Math.round(actual * 0.04),
    dinnerExpenses: Math.round(actual * 0.02),
    miscExpenses: Math.round(actual * 0.03),
    topupsTotal: 4000,
    health,
    topModel: id === "atlas" ? "Opus 4.8" : id === "kaiju" ? "Opus 4.8" : id === "sourcing" ? "Kimi" : id === "nimbus" ? "1P-Eval" : id === "vesper" ? "Opus" : id === "orion" ? "Gemini" : "Opus 4.8",
    phases: mkPhases(approved, actual),
    expenses,
    budgetHistory: mkBudgetHistory(id, approved - 4000),
    topupHistory: mkTopups(id),
    auditLog: mkAudit(id),
    comments: mkComments(id),
  };
};

export const PROJECTS = [
  buildProject("crowley-gen", "Crowley Generation", "Acme AI", "Aanya Sharma", 48000, 44000, 41000, "Execution", { type: "R&D", buffer: 12, recoverable: true, recovered: 8000, tpm: "Vikram Kumar", rnd: "Neha Kapoor", docs: [{ id: "d1", name: "Scope doc (Drive)", url: "https://drive.google.com/crowley-scope", kind: "link" }] }),
  buildProject("talos", "Talos", "Northwind Data", "Maria Lopez", 46000, 38000, 31000, "Execution", { type: "Production", buffer: 8, tpm: "Arjun Mehta" }),
  buildProject("sourcing", "Crowley Sourcing", "Acme AI", "Aanya Sharma", 26000, 24000, 26400, "Execution", { type: "R&D", buffer: 10, recoverable: true, recovered: 4200, tpm: "Aanya Sharma" }),
  buildProject("kaiju", "Kaiju Eval", "Helix Bio", "Arjun Mehta", 30000, 18000, 16000, "Execution", { type: "R&D", buffer: 15, tpm: "Arjun Mehta", rnd: "Neha Kapoor" }),
  buildProject("atlas", "Atlas Ingest", "Ironclad", "Arjun Mehta", 11000, 12000, 12100, "Execution", { type: "Production", buffer: 5, tpm: "Arjun Mehta" }),
  buildProject("nimbus", "Nimbus QC", "Meridian", "Maria Lopez", 14000, 9000, 7000, "Execution", { type: "Production", buffer: 8, tpm: "Maria Lopez" }),
  buildProject("orion", "Orion Stub", "Voltek", "Vikram Kumar", 9000, 7000, 2200, "Discovery", { type: "R&D", buffer: 20, recoverable: true, recovered: 0, tpm: "Arjun Mehta", rnd: "Neha Kapoor" }),
  buildProject("vesper", "Vesper Docker", "Ironclad", "Aanya Sharma", 13000, 5400, 15600, "Execution", { type: "Production", buffer: 10, tpm: "Aanya Sharma" }),
];

export const PORTFOLIO = (() => {
  const approved = PROJECTS.reduce((s, p) => s + p.approvedBudget, 0);
  const estimated = PROJECTS.reduce((s, p) => s + p.estimatedBudget, 0);
  const actual = PROJECTS.reduce((s, p) => s + p.actualSpend, 0);
  const infra = PROJECTS.reduce((s, p) => s + p.infrastructureCost, 0);
  const ai = PROJECTS.reduce((s, p) => s + p.aiModelCost, 0);
  const employee = PROJECTS.reduce((s, p) => s + p.employeeCost, 0);
  const overCount = PROJECTS.filter((p) => p.utilization >= 100).length;
  const remaining = approved - actual;
  const burnRate = PROJECTS.reduce((s, p) => s + p.burnRate, 0);
  const burnRateUsd = burnRate * 1000;
  const cashRunwayDays = burnRateUsd > 0 ? Math.round(remaining / burnRateUsd) : null;
  const cpi = estimated / actual;
  const spi = 0.94;
  const eac = actual + (approved - actual) / cpi;
  const aiCostRatio = Math.round((ai / actual) * 100);
  const forecastVariance = approved - eac;
  const estimationAccuracy = Math.max(0, Math.min(100, Math.round(100 - (Math.abs(estimated - actual) / estimated) * 100)));
  return {
    approvedBudget: approved,
    estimatedBudget: estimated,
    actualSpend: actual,
    remaining,
    utilization: Math.round((actual / approved) * 100),
    variance: estimated - actual,
    forecastVariance,
    cpi: Math.round(cpi * 100) / 100,
    spi,
    eac: Math.round(eac),
    burnRate: Math.round(burnRateUsd),
    cashRunwayDays,
    aiCostRatio,
    infrastructureSpend: infra,
    aiModelSpend: ai,
    employeeSpend: employee,
    accuracy: estimationAccuracy,
    healthScore: 58,
    projectsOverBudget: overCount,
    activeProjects: PROJECTS.length,
    pendingApprovals: 4,
    pendingTopups: 3,
    pendingApprovalValue: 23000,
    amountAtRisk: 41800,
    approvedRisk: 46000,
    flagged: overCount,
    total: PROJECTS.length,
  };
})();
