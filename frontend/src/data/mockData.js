// Ethara.AI enterprise budget dashboard mock data
export const CURRENT_USER = {
  id: "u1",
  name: "Vikram Kumar",
  title: "CTO / Project Lead",
  role: "CTO",
  avatarUrl: "https://images.pexels.com/photos/36645466/pexels-photo-36645466.jpeg",
};

// Auth users - one per role. Password is 'demo123' for all in demo mode.
export const USERS = [
  { id: "u1", name: "Vikram Kumar", role: "CTO", title: "Chief Technology Officer", email: "cto@ethara.ai", password: "demo123", avatarUrl: "https://images.pexels.com/photos/36645466/pexels-photo-36645466.jpeg" },
  { id: "u2", name: "Priya Kapoor", role: "CFO", title: "Chief Financial Officer", email: "cfo@ethara.ai", password: "demo123", avatarUrl: "" },
  { id: "u3", name: "Arjun Mehta", role: "TPM", title: "Technical Program Manager", email: "tpm@ethara.ai", password: "demo123", avatarUrl: "" },
  { id: "u4", name: "Aanya Sharma", role: "PL", title: "Project Lead", email: "pl@ethara.ai", password: "demo123", avatarUrl: "" },
];

export const ROLES = ["CTO", "CFO", "TPM", "PL"];

export const TEAM = [
  { id: "u1", name: "Vikram Kumar", role: "CTO", email: "vikram@ethara.ai" },
  { id: "u2", name: "Aanya Sharma", role: "Project Lead", email: "aanya@ethara.ai" },
  { id: "u3", name: "Maria Lopez", role: "Project Lead", email: "maria@ethara.ai" },
  { id: "u4", name: "Arjun Mehta", role: "Project Lead", email: "arjun@ethara.ai" },
  { id: "u5", name: "Rahul Verma", role: "Engineer", email: "rahul@ethara.ai" },
  { id: "u6", name: "Priya Kapoor", role: "Finance", email: "priya@ethara.ai" },
  { id: "u7", name: "Nikhil Rao", role: "COO", email: "nikhil@ethara.ai" },
  { id: "u8", name: "Sara Chen", role: "Engineer", email: "sara@ethara.ai" },
];

export const CLIENTS = ["Acme AI", "Northwind Data", "Helix Bio", "Ironclad", "Meridian", "Voltek"];

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
  { id: "p1", name: "Phase 1 · Discovery", dates: "Jun 1 – 8", estimated: Math.round(approved * 0.22), actual: Math.round(actual * 0.22), health: "healthy" },
  { id: "p2", name: "Phase 2 · Model tuning", dates: "Jun 9 – 16", estimated: Math.round(approved * 0.28), actual: Math.round(actual * 0.32), health: "over" },
  { id: "p3", name: "Phase 3 · Integration", dates: "Jun 17 – 24", estimated: Math.round(approved * 0.28), actual: Math.round(actual * 0.26), health: "watch" },
  { id: "p4", name: "Phase 4 · Rollout", dates: "Jun 25 – 30", estimated: Math.round(approved * 0.22), actual: Math.round(actual * 0.20), health: "healthy" },
];

const buildProject = (id, name, client, pl, approved, estimated, actual, status, extras = {}) => {
  const remaining = approved - actual;
  const variance = estimated - actual; // positive = under estimate
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
  buildProject("crowley-gen", "Crowley Generation", "Acme AI", "Aanya Sharma", 48000, 44000, 41000, "Execution", { type: "R&D", buffer: 12, recoverable: true, recovered: 8000, tpm: "Vikram Kumar" }),
  buildProject("talos", "Talos", "Northwind Data", "Maria Lopez", 46000, 38000, 31000, "Execution", { type: "Operations", buffer: 8, tpm: "Arjun Mehta" }),
  buildProject("sourcing", "Crowley Sourcing", "Acme AI", "Aanya Sharma", 26000, 24000, 26400, "Execution", { type: "R&D", buffer: 10, recoverable: true, recovered: 4200, tpm: "Aanya Sharma" }),
  buildProject("kaiju", "Kaiju Eval", "Helix Bio", "Arjun Mehta", 30000, 18000, 16000, "Execution", { type: "R&D", buffer: 15, tpm: "Arjun Mehta" }),
  buildProject("atlas", "Atlas Ingest", "Ironclad", "Arjun Mehta", 11000, 12000, 12100, "Execution", { type: "Operations", buffer: 5, tpm: "Arjun Mehta" }),
  buildProject("nimbus", "Nimbus QC", "Meridian", "Maria Lopez", 14000, 9000, 7000, "Execution", { type: "Operations", buffer: 8, tpm: "Maria Lopez" }),
  buildProject("orion", "Orion Stub", "Voltek", "Vikram Kumar", 9000, 7000, 2200, "Discovery", { type: "R&D", buffer: 20, recoverable: true, recovered: 0, tpm: "Arjun Mehta" }),
  buildProject("vesper", "Vesper Docker", "Ironclad", "Aanya Sharma", 13000, 5400, 15600, "Execution", { type: "Operations", buffer: 10, tpm: "Aanya Sharma" }),
];

// Portfolio aggregates — computed from projects, with finance-first KPIs
export const PORTFOLIO = (() => {
  const approved = PROJECTS.reduce((s, p) => s + p.approvedBudget, 0);
  const estimated = PROJECTS.reduce((s, p) => s + p.estimatedBudget, 0);
  const actual = PROJECTS.reduce((s, p) => s + p.actualSpend, 0);
  const infra = PROJECTS.reduce((s, p) => s + p.infrastructureCost, 0);
  const ai = PROJECTS.reduce((s, p) => s + p.aiModelCost, 0);
  const employee = PROJECTS.reduce((s, p) => s + p.employeeCost, 0);
  const overCount = PROJECTS.filter((p) => p.utilization >= 100).length;
  const remaining = approved - actual;
  const burnRate = PROJECTS.reduce((s, p) => s + p.burnRate, 0); // $k / day
  const burnRateUsd = burnRate * 1000; // actual $/day
  const cashRunwayDays = burnRateUsd > 0 ? Math.round(remaining / burnRateUsd) : null;
  // Earned Value approximation: use estimated as EV, actual as AC
  const cpi = estimated / actual; // >1 = cost efficient
  const spi = 0.94; // schedule performance (mocked; would need planned value)
  const eac = actual + (approved - actual) / cpi; // Estimate At Completion
  const aiCostRatio = Math.round((ai / actual) * 100);
  const forecastVariance = approved - eac; // + = under, - = over
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
    amountAtRisk: 41800, // sum of over-budget projects' overrun (Sourcing 400 + Atlas 1100 + Vesper 2600 + Crowley Gen soft risk + others)
    approvedRisk: 46000,
    flagged: overCount,
    total: PROJECTS.length,
  };
})();

export const MONTHLY_SPEND = [
  { month: "Jan", budget: 120000, estimated: 118000, actual: 112000 },
  { month: "Feb", budget: 130000, estimated: 128000, actual: 126000 },
  { month: "Mar", budget: 140000, estimated: 138000, actual: 134000 },
  { month: "Apr", budget: 150000, estimated: 148000, actual: 152000 },
  { month: "May", budget: 160000, estimated: 158000, actual: 161000 },
  { month: "Jun", budget: 197000, estimated: 148200, actual: 119800 },
];

export const CATEGORY_BREAKDOWN = [
  { name: "AI Models", value: 47, color: "#7C3AED" },
  { name: "Infrastructure", value: 24, color: "#3B82F6" },
  { name: "Employee", value: 14, color: "#10B981" },
  { name: "Purchase", value: 6, color: "#F59E0B" },
  { name: "Reimbursements", value: 4, color: "#EC4899" },
  { name: "Misc", value: 3, color: "#94A3B8" },
  { name: "Dinner", value: 2, color: "#F97316" },
];

export const MODELS_USAGE = [
  { name: "Opus 4.7", vendor: "Anthropic", budget: 20000, estimated: 17000, actual: 14400 },
  { name: "Gemini 2.5 Pro", vendor: "Google", budget: 15000, estimated: 13000, actual: 11200 },
  { name: "GPT-4o", vendor: "OpenAI", budget: 12000, estimated: 10800, actual: 9800 },
  { name: "Sonnet", vendor: "Anthropic", budget: 8000, estimated: 6900, actual: 6100 },
  { name: "Kimi", vendor: "Moonshot", budget: 4000, estimated: 3600, actual: 2400 },
];

export const INFRA_BY_PROJECT = PROJECTS.slice(0, 6).map((p) => ({
  name: p.name.split(" ")[0],
  EC2: Math.round(p.infrastructureCost * 0.62),
  S3: Math.round(p.infrastructureCost * 0.09),
  RDS: Math.round(p.infrastructureCost * 0.18),
  SES: Math.round(p.infrastructureCost * 0.11),
}));

export const SUBSCRIPTIONS = [
  { id: "s1", name: "Claude Max", price: 200, cadence: "/mo", seats: 8, initials: "CM", color: "#7C3AED", users: ["Aanya Sharma", "Maria Lopez", "Arjun Mehta", "Rahul Verma", "Priya Kapoor", "Sara Chen", "Vikram Kumar", "Nikhil Rao"] },
  { id: "s2", name: "Cursor Pro", price: 60, cadence: "/mo", seats: 6, initials: "CU", color: "#3B82F6", users: ["Aanya Sharma", "Maria Lopez", "Sara Chen", "Rahul Verma", "Arjun Mehta", "Vikram Kumar"] },
  { id: "s3", name: "GitHub Copilot", price: 95, cadence: "/mo", seats: 9, initials: "GH", color: "#0F172A", users: ["Aanya Sharma", "Maria Lopez", "Arjun Mehta", "Rahul Verma", "Priya Kapoor", "Sara Chen", "Vikram Kumar", "Nikhil Rao", "Aanya Sharma"] },
  { id: "s4", name: "ChatGPT", price: 120, cadence: "/mo", seats: 5, initials: "CG", color: "#10B981", users: ["Aanya Sharma", "Rahul Verma", "Sara Chen", "Priya Kapoor", "Arjun Mehta"] },
];

export const NOTIFICATIONS = [
  { id: "n1", type: "danger", title: "Vesper Docker exceeded budget", detail: "Actual $10.6k vs approved $13k · 82% used, forecast overrun.", ts: "2026-06-24T10:14:00Z", read: false },
  { id: "n2", type: "warning", title: "Crowley Sourcing utilization at 86%", detail: "Consider pre-approving a top-up before end of sprint.", ts: "2026-06-24T09:02:00Z", read: false },
  { id: "n3", type: "info", title: "Top-up request pending", detail: "Aanya Sharma requested +$2.5k for Claude context testing.", ts: "2026-06-23T18:22:00Z", read: false },
  { id: "n4", type: "warning", title: "Infrastructure spike detected", detail: "Atlas Ingest EC2 cost up 34% week-over-week.", ts: "2026-06-23T14:41:00Z", read: true },
  { id: "n5", type: "info", title: "Reimbursement approval pending", detail: "3 dinner bills awaiting Finance review.", ts: "2026-06-22T11:18:00Z", read: true },
  { id: "n6", type: "success", title: "Talos on-track", detail: "67% utilization, forecast $2k under budget.", ts: "2026-06-21T09:30:00Z", read: true },
];

export const APPROVALS = [
  { id: "ap1", project: "Crowley Sourcing", requester: "Aanya Sharma", type: "Top-up", amount: 2500, stage: "CTO Review", ts: "2026-06-23T18:22:00Z" },
  { id: "ap2", project: "Vesper Docker", requester: "Aanya Sharma", type: "Top-up", amount: 5000, stage: "COO Approval", ts: "2026-06-23T09:11:00Z" },
  { id: "ap3", project: "Orion Stub", requester: "Vikram Kumar", type: "Budget Request", amount: 12000, stage: "COO Approval", ts: "2026-06-22T15:44:00Z" },
  { id: "ap4", project: "Atlas Ingest", requester: "Arjun Mehta", type: "Budget Modification", amount: 3500, stage: "CTO Review", ts: "2026-06-22T11:03:00Z" },
];

export const REIMBURSEMENTS = [
  { id: "r1", employee: "Aanya Sharma", project: "Crowley Generation", type: "Travel", amount: 420, date: "2026-06-14", approval: "approved", finance: "reimbursed", extra: false, remarks: "Client kickoff · Bengaluru" },
  { id: "r2", employee: "Maria Lopez", project: "Talos", type: "Dinner", amount: 320, date: "2026-06-16", approval: "approved", finance: "processing", extra: false, remarks: "Team offsite dinner" },
  { id: "r3", employee: "Arjun Mehta", project: "Kaiju Eval", type: "Travel", amount: 890, date: "2026-06-18", approval: "pending", finance: "—", extra: true, remarks: "Overage — client site visit" },
  { id: "r4", employee: "Rahul Verma", project: "Crowley Sourcing", type: "Dinner", amount: 240, date: "2026-06-19", approval: "approved", finance: "reimbursed", extra: false, remarks: "Sprint retro dinner" },
  { id: "r5", employee: "Sara Chen", project: "Atlas Ingest", type: "Travel", amount: 1120, date: "2026-06-20", approval: "pending", finance: "—", extra: true, remarks: "Emergency vendor meeting" },
  { id: "r6", employee: "Priya Kapoor", project: "Nimbus QC", type: "Dinner", amount: 180, date: "2026-06-21", approval: "approved", finance: "reimbursed", extra: false, remarks: "QA milestone" },
];

export const AI_INSIGHTS = [
  { id: "ai1", title: "Vesper Docker forecast overrun", body: "Actual burn ($10.6k) already exceeds estimate. At current pace, project will finish 22% over approved budget. Recommend moving eval workloads from Opus 4.8 to Gemini 2.5 Pro (~34% cheaper for the current task mix).", tag: "Overrun risk", tone: "danger" },
  { id: "ai2", title: "Consolidate Cursor Pro seats", body: "Only 4 of 6 Cursor Pro seats have been active this month. Reclaiming 2 seats saves $120/mo across the portfolio.", tag: "Cost optimization", tone: "info" },
  { id: "ai3", title: "Crowley Generation Phase 2 variance", body: "Phase 2 ran $1.1k over estimate (Opus 4.8 inference volumes up 18%). Consider pre-caching frequent prompt prefixes to cut cost by ~9% next sprint.", tag: "Variance explanation", tone: "warning" },
  { id: "ai4", title: "Talos will finish under budget", body: "Trailing 7-day burn is $0.9k/day vs plan of $1.4k/day. High-confidence forecast: $34k final actual vs $46k approved.", tag: "Forecast", tone: "success" },
];

// Model keys governance (P0.4)
const maskKey = (full) => `${full.slice(0, 7)}${"•".repeat(18)}${full.slice(-4)}`;
export const MODEL_KEYS = [
  { id: "k1", project: "crowley-gen", projectName: "Crowley Generation", provider: "Anthropic", model: "Opus 4.8", type: "R&D", env: "production", fullKey: "sk-ant-live-A21F94Xa8ec4nabc4", tags: ["prod", "inference", "eval"], lastUsed: "2026-06-24T09:12:00Z", usage: 4231, createdBy: "Vikram Kumar", createdAt: "2026-06-01T10:00:00Z", status: "active" },
  { id: "k2", project: "crowley-gen", projectName: "Crowley Generation", provider: "Anthropic", model: "Opus 4.8", type: "R&D", env: "testing", fullKey: "sk-ant-test-B92G01Xf5be2tdef9", tags: ["test", "dev"], lastUsed: "2026-06-23T14:30:00Z", usage: 812, createdBy: "Aanya Sharma", createdAt: "2026-06-01T10:15:00Z", status: "active" },
  { id: "k3", project: "talos", projectName: "Talos", provider: "Google", model: "Gemini 2.5 Pro", type: "Operations", env: "production", fullKey: "AIza-live-C13H82Ye7dc5oghi3", tags: ["prod", "classify"], lastUsed: "2026-06-24T11:44:00Z", usage: 2984, createdBy: "Maria Lopez", createdAt: "2026-05-28T09:00:00Z", status: "active" },
  { id: "k4", project: "sourcing", projectName: "Crowley Sourcing", provider: "OpenAI", model: "GPT-4o", type: "R&D", env: "production", fullKey: "sk-oai-live-D74J12Zk3fa8pjkl7", tags: ["prod", "retrieval"], lastUsed: "2026-06-24T07:05:00Z", usage: 5421, createdBy: "Aanya Sharma", createdAt: "2026-06-05T13:20:00Z", status: "active" },
  { id: "k5", project: "kaiju", projectName: "Kaiju Eval", provider: "Anthropic", model: "Opus 4.8", type: "R&D", env: "production", fullKey: "sk-ant-live-E48K23Am6gc9qmno2", tags: ["prod", "eval"], lastUsed: "2026-06-22T18:11:00Z", usage: 1673, createdBy: "Arjun Mehta", createdAt: "2026-06-10T11:10:00Z", status: "active" },
  { id: "k6", project: "atlas", projectName: "Atlas Ingest", provider: "OpenAI", model: "GPT-4o", type: "Operations", env: "production", fullKey: "sk-oai-live-F31L45Bp9hd3rpqr8", tags: ["prod", "ingest"], lastUsed: "2026-06-24T05:33:00Z", usage: 8102, createdBy: "Arjun Mehta", createdAt: "2026-06-01T08:00:00Z", status: "active" },
  { id: "k7", project: "atlas", projectName: "Atlas Ingest", provider: "OpenAI", model: "GPT-4o", type: "Operations", env: "testing", fullKey: "sk-oai-test-G62M56Cq0je4stuv9", tags: ["test"], lastUsed: "2026-06-19T10:00:00Z", usage: 240, createdBy: "Arjun Mehta", createdAt: "2026-06-01T08:15:00Z", status: "active" },
  { id: "k8", project: "vesper", projectName: "Vesper Docker", provider: "Anthropic", model: "Opus 4.8", type: "Operations", env: "production", fullKey: "sk-ant-live-H73N67Dr1kf5tuwx0", tags: ["prod"], lastUsed: "2026-06-15T09:00:00Z", usage: 3812, createdBy: "Aanya Sharma", createdAt: "2026-05-20T14:00:00Z", status: "revoked" },
  { id: "k9", project: "nimbus", projectName: "Nimbus QC", provider: "xAI", model: "Grok-2", type: "Operations", env: "production", fullKey: "xai-live-I84O78Es2lg6uvxy1", tags: ["prod", "qc"], lastUsed: "2026-06-23T22:14:00Z", usage: 942, createdBy: "Maria Lopez", createdAt: "2026-06-12T12:00:00Z", status: "active" },
];
export const MODEL_KEYS_MASKED = MODEL_KEYS.map((k) => ({ ...k, maskedKey: maskKey(k.fullKey) }));

// Budget line categories (P0.1 · line-wise Budget Request)
export const LINE_CATEGORIES = [
  { id: "model", label: "AI Model", unit: "tokens (M)", defaultRate: 8 },
  { id: "infra", label: "Infrastructure", unit: "hours", defaultRate: 12 },
  { id: "subscription", label: "Subscription", unit: "seats × mo", defaultRate: 60 },
  { id: "hardware", label: "Hardware", unit: "units", defaultRate: 1200 },
  { id: "employee", label: "Employee", unit: "person-days", defaultRate: 400 },
  { id: "other", label: "Other", unit: "line", defaultRate: 0 },
];

// Alert thresholds (P2)
export const THRESHOLDS = [50, 75, 90, 100];

// Daily activity for last 30 days (P1.3 · daily tracking)
const seedDaily = () => {
  const days = [];
  const today = new Date(2026, 5, 30);
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const seed = (d.getDate() * 7 + d.getMonth() * 3) % 11;
    const base = 2500 + seed * 400;
    const est = base + ((seed % 3) - 1) * 300;
    days.push({
      date: d.toISOString().slice(0, 10),
      dow: d.getDay(),
      spend: base,
      estimate: est,
      approvals: seed % 4,
      expenses: 8 + (seed % 6),
      byCategory: {
        model: Math.round(base * 0.45),
        infra: Math.round(base * 0.24),
        employee: Math.round(base * 0.16),
        other: Math.round(base * 0.15),
      },
    });
  }
  return days;
};
export const DAILY_ACTIVITY = seedDaily();

// Per-model 30-day trajectory (P2)
const seedModelTraj = () => {
  const models = ["Opus 4.7", "Gemini 2.5 Pro", "GPT-4o", "Sonnet", "Kimi"];
  const rows = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(2026, 5, 30 - i);
    const day = d.toISOString().slice(0, 10);
    const point = { date: day };
    models.forEach((m, idx) => {
      const seed = (d.getDate() * (idx + 2)) % 9;
      point[m] = Math.round(200 + seed * 45 + idx * 40);
    });
    rows.push(point);
  }
  return rows;
};
export const MODEL_TRAJECTORY = seedModelTraj();
