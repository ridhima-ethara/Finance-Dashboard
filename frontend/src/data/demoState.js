// Seed state for the platform.
// Sample/demo records were removed earlier; the only pre-seeded content below is the
// real "Zoro" (RetailBench RL Environment) project mapped from its kickoff email thread,
// including its members, kickoff mail, subscriptions, and the two CFO-approved
// additional (subscription) requests. Everything else starts empty and is populated
// from real user activity persisted in localStorage. Export names/shapes are preserved.

const buildKickoffMail = ({ subject, goal, sentBy, sentByRole, sentAt, recipients, requirements }) => ({
  sentAt,
  subject,
  sentBy,
  sentByRole,
  recipients,
  goal,
  requirements,
  attachmentCount: requirements.length,
});

const buildProject = ({
  id,
  name,
  client,
  createdBy,
  createdByRole,
  goal,
  pl,
  tpm,
  rnd,
  plMembers,
  qlMembers,
  rndMembers,
  teamMembers,
  docsList,
  startDate,
  estimatedEndDate,
  status,
  type,
  workflowStage,
  readyForTpmBudget,
  approvedBudget,
  estimatedBudget,
  actualSpend,
  burnRate,
  health,
  topModel,
  phases,
  budgetItems,
  promotedToProductionAt = null,
  recoveredAmount = 0,
  recoverableFromClient = false,
  topupsTotal = 0,
  changeRequestsTotal = 0,
  buffer = 10,
}) => {
  const remaining = approvedBudget - actualSpend;
  return {
    id,
    name,
    clientProjectName: client,
    client,
    createdBy,
    createdByRole,
    goal,
    pl,
    tpm,
    rnd,
    rndMembers,
    plMembers,
    qlMembers,
    docUrl: "",
    docs: docsList,
    teamMembers,
    kickoffMail: buildKickoffMail({
      subject: `${name} kickoff`,
      goal,
      sentBy: createdBy,
      sentByRole: createdByRole,
      sentAt: `${startDate}T09:00:00.000Z`,
      recipients: teamMembers,
      requirements: docsList.map((doc) => ({
        id: doc.id,
        name: doc.name,
        kind: doc.kind,
        url: doc.url || "",
      })),
    }),
    startDate,
    estimatedEndDate,
    status,
    type,
    workflowStage,
    readyForTpmBudget,
    pendingBudgetSubmission: null,
    buffer,
    recoverableFromClient,
    recoveredAmount,
    approvedBudget,
    estimatedBudget,
    actualSpend,
    remaining,
    variance: remaining,
    utilization: approvedBudget > 0 ? Math.round((actualSpend / approvedBudget) * 100) : 0,
    burnRate,
    forecast: estimatedBudget,
    infrastructureCost: budgetItems.infra.reduce((sum, row) => sum + Number(row.estCost || 0), 0),
    aiModelCost: budgetItems.models.reduce((sum, row) => sum + Number(row.estCost || 0), 0),
    employeeCost: budgetItems.misc.reduce((sum, row) => sum + Number(row.estCost || 0), 0),
    purchaseCost: 0,
    reimbursements: 0,
    dinnerExpenses: 0,
    miscExpenses: 0,
    topupsTotal,
    changeRequestsTotal,
    health,
    topModel,
    phases,
    budgetItems,
    expenses: [],
    budgetHistory: [],
    topupHistory: [],
    budgetTrackHistory: [],
    auditLog: [
      {
        id: `audit-${id}-created`,
        ts: `${startDate}T09:00:00.000Z`,
        actor: `${createdBy} · ${createdByRole}`,
        action: "Project created",
        detail: `${client} · ${goal}`,
      },
    ],
    lastBudgetSubmission: {
      budgetType: type === "Production" ? "Production" : "RnD",
      sampleIteration: 1,
      sourceDeliveryId: null,
    },
    promotedToProductionAt,
    itProvisioningStatus: type === "Production" ? "active" : null,
  };
};

const buildBreakdownSection = (entries, extra = {}) => ({
  amount: entries.reduce((sum, entry) => sum + Number(entry.amount || 0), 0),
  optionLabel: entries.map((entry) => entry.optionLabel).join(" | "),
  note: entries.map((entry) => entry.note).join(" | "),
  entries,
  ...extra,
});

// --- Zoro (RetailBench RL Environment) — mapped from the kickoff email thread ---
const ZORO_GOAL =
  "Enterprise AI agents fail not because they lack knowledge, but because they cannot sustain coherent decisions across long-horizon, multi-constraint environments. Zoro puts this to the test: an LLM agent manages a real supermarket — pricing, inventory, supplier orders, and cash flow — over 180 simulated days of actual Dominick's transaction data. Zoro builds a task library, evaluation harness, and trajectory dataset on top of RetailBench to turn failure modes into a scalable, high-signal training corpus.";

const ZORO_TEAM = [
  { id: "u5", name: "R&D Lead", role: "R&D", email: "rd@ethara.ai", status: "Online" },
  { id: "emp-0268", name: "Dhawal Bathre", role: "R&D", email: "dhawal.bathre@ethara.ai", status: "Online" },
  { id: "emp-0493", name: "Mumukshu Panchal", role: "R&D", email: "mumukshu.panchal@ethara.ai", status: "Kickoff sent" },
  { id: "emp-0772", name: "Shubham Chaturvedi", role: "R&D", email: "shubham.chaturvedi@ethara.ai", status: "Kickoff sent" },
  { id: "emp-0016", name: "Abhay Haldia", role: "Engineer", email: "abhay.haldiya@ethara.ai", status: "Kickoff sent" },
  { id: "emp-0424", name: "Kshitij Sharma", role: "Engineer", email: "kshitij.sharma@ethara.ai", status: "Kickoff sent" },
];

const ZORO_DOCS = [
  { id: "doc-zoro-paper", name: "RetailBench paper (arXiv 2603.16453)", kind: "link", url: "https://arxiv.org/pdf/2603.16453" },
  {
    id: "doc-zoro-budget",
    name: "Zoro Budget sheet",
    kind: "link",
    url: "https://docs.google.com/spreadsheets/d/1p5hzVzV7egwv9FiyPoIHdNL7TszHxKarTCUVDiRB6Kg/edit",
  },
];

// Subscription asks approved by CFO (Shubham Garg). Codex ask was INR 59,700 (3 × INR 19,900);
// converted to ~USD $715 at ~₹83.5/$ for the USD-denominated platform (original INR kept in labels).
const ZORO_CLAUDE_SUB_COST = 600;
const ZORO_CODEX_SUB_COST = 715;
const ZORO_APPROVED_BUDGET = ZORO_CLAUDE_SUB_COST + ZORO_CODEX_SUB_COST;

const zoroProject = (() => {
  const base = buildProject({
    id: "zoro",
    name: "Zoro",
    client: "RetailBench RL Environment",
    createdBy: "Dhawal Bathre",
    createdByRole: "R&D",
    goal: ZORO_GOAL,
    pl: "",
    tpm: "",
    rnd: "Dhawal Bathre",
    plMembers: [],
    qlMembers: [],
    rndMembers: ["Dhawal Bathre", "Mumukshu Panchal", "Shubham Chaturvedi", "R&D Lead", "R&D Lead 1"],
    teamMembers: ZORO_TEAM,
    docsList: ZORO_DOCS,
    startDate: "2026-07-09",
    estimatedEndDate: "2026-07-31",
    status: "Sampling active",
    type: "R&D",
    workflowStage: "sample-active",
    readyForTpmBudget: false,
    approvedBudget: 0,
    estimatedBudget: ZORO_APPROVED_BUDGET,
    actualSpend: 0,
    burnRate: 0,
    health: "healthy",
    topModel: "Claude Opus 4.8",
    phases: [
      {
        id: "zoro-sampling",
        name: "Sampling",
        dates: "2026-07-09 → 2026-07-31",
        start: "2026-07-09",
        end: "2026-07-31",
        estimated: ZORO_APPROVED_BUDGET,
        actual: 0,
        totalTasks: 500,
        tasks: 500,
        trajectoriesPerTask: 3,
        health: "healthy",
      },
    ],
    // Subscriptions were approved as CFO change requests (see DEMO_CHANGE_REQUESTS);
    // the approved amounts drive the project's budget via the change-request aggregation,
    // so budgetItems stays empty here to avoid double-counting.
    budgetItems: { models: [], infra: [], subs: [], misc: [] },
    topupsTotal: 0,
    changeRequestsTotal: 0,
  });
  return {
    ...base,
    auditLog: [
      ...base.auditLog,
      {
        id: "audit-zoro-cr-claude",
        ts: "2026-07-13T17:01:00.000Z",
        actor: "Shubham Garg · CFO",
        action: "CFO approved additional request",
        detail: "Claude Code Max 20x (3 subscriptions) · $600",
      },
      {
        id: "audit-zoro-cr-codex",
        ts: "2026-07-20T11:51:00.000Z",
        actor: "Shubham Garg · CFO",
        action: "CFO approved additional request",
        detail: "GPT Codex Pro 20x (3 accounts) · INR 59,700 (~$715)",
      },
    ],
  };
})();

// --- Tron (RL Environment Creation) — mapped from the kickoff email thread ---
const TRON_GOAL =
  "High-value enterprise AI adoption is bottlenecked because standard benchmarks focus on isolated, predictable scripts rather than live environments. Tron's RL Environment focuses on raw LLM capabilities through direct tool execution across multiple enterprise domains like ITSM, CSM, Email, Calendar, and HR.";

const TRON_TEAM = [
  { id: "u5", name: "R&D Lead", role: "R&D", email: "rd@ethara.ai", status: "Online" },
  { id: "emp-0547", name: "Piyush Chandra", role: "R&D", email: "piyush.chandra@ethara.ai", status: "Online" },
  { id: "emp-0897", name: "Viksit Kumar Chauhan", role: "R&D", email: "viksit.chauhan@ethara.ai", status: "Kickoff sent" },
  { id: "emp-0080", name: "Akash Kumar", role: "R&D", email: "akash.kumar@ethara.ai", status: "Kickoff sent" },
  { id: "emp-0425", name: "Kshitiz Mehta", role: "R&D", email: "kshitiz.mehta@ethara.ai", status: "Kickoff sent" },
  { id: "emp-0776", name: "Shubhi Khandelwal", role: "Engineer", email: "shubhi.khandelwal@ethara.ai", status: "Kickoff sent" },
];

const TRON_DOCS = [
  { id: "doc-tron-paper", name: "RL environment paper (arXiv 2603.13594)", kind: "link", url: "https://arxiv.org/pdf/2603.13594" },
  {
    id: "doc-tron-budget",
    name: "Tron Budget sheet",
    kind: "link",
    url: "https://docs.google.com/spreadsheets/d/1_InQU3V66n5KACpSblmOY3bJCnFBGHxWgT-73PaliZY/edit",
  },
];

// Claude Code Max 20x asks approved by CFO (Shubham Garg): $200 (1 sub, 9 Jul) + $400 (2 subs, 14 Jul) = $600.
const TRON_APPROVED_BUDGET = 600;

const tronProject = (() => {
  const base = buildProject({
    id: "tron",
    name: "Tron",
    client: "RL Environment Creation",
    createdBy: "Piyush Chandra",
    createdByRole: "R&D",
    goal: TRON_GOAL,
    pl: "",
    tpm: "",
    rnd: "Piyush Chandra",
    plMembers: [],
    qlMembers: [],
    rndMembers: ["Piyush Chandra", "Viksit Kumar Chauhan", "Akash Kumar", "Kshitiz Mehta", "R&D Lead", "R&D Lead 1"],
    teamMembers: TRON_TEAM,
    docsList: TRON_DOCS,
    startDate: "2026-07-09",
    estimatedEndDate: "2026-07-31",
    status: "Sampling active",
    type: "R&D",
    workflowStage: "sample-active",
    readyForTpmBudget: false,
    approvedBudget: 0,
    estimatedBudget: TRON_APPROVED_BUDGET,
    actualSpend: 0,
    burnRate: 0,
    health: "healthy",
    topModel: "Claude Opus 4.8",
    phases: [
      {
        id: "tron-sampling",
        name: "Sampling",
        dates: "2026-07-09 → 2026-07-31",
        start: "2026-07-09",
        end: "2026-07-31",
        estimated: TRON_APPROVED_BUDGET,
        actual: 0,
        totalTasks: 500,
        tasks: 500,
        trajectoriesPerTask: 3,
        health: "healthy",
      },
    ],
    // Subscriptions approved via CFO change requests (see DEMO_CHANGE_REQUESTS) drive the budget.
    budgetItems: { models: [], infra: [], subs: [], misc: [] },
    topupsTotal: 0,
    changeRequestsTotal: 0,
  });
  return {
    ...base,
    auditLog: [
      ...base.auditLog,
      {
        id: "audit-tron-cr-1",
        ts: "2026-07-09T16:16:00.000Z",
        actor: "Shubham Garg · CFO",
        action: "CFO approved additional request",
        detail: "Claude Code Max 20x (1 subscription) · $200",
      },
      {
        id: "audit-tron-cr-2",
        ts: "2026-07-14T16:00:00.000Z",
        actor: "Shubham Garg · CFO",
        action: "CFO approved additional request",
        detail: "Claude Code Max 20x (2 subscriptions) · $400",
      },
    ],
  };
})();

export const DEMO_PROJECTS = [zoroProject, tronProject];

export const DEMO_PORTFOLIO = {
  approvedBudget: 0,
  estimatedBudget: 0,
  actualSpend: 0,
  remaining: 0,
  utilization: 0,
  variance: 0,
  forecastVariance: 0,
  cpi: 0,
  spi: 0,
  eac: 0,
  burnRate: 0,
  cashRunwayDays: 0,
  aiCostRatio: 0,
  infrastructureSpend: 0,
  aiModelSpend: 0,
  employeeSpend: 0,
  accuracy: 0,
  healthScore: 0,
  projectsOverBudget: 0,
  activeProjects: 0,
  pendingApprovals: 0,
  pendingTopups: 0,
  pendingApprovalValue: 0,
  amountAtRisk: 0,
  approvedRisk: 0,
  flagged: 0,
  total: 0,
};

export const DEMO_MONTHLY_SPEND = [];

export const DEMO_CATEGORY_BREAKDOWN = [];

export const DEMO_MODELS_USAGE = [];

export const DEMO_INFRA_BY_PROJECT = [];

export const DEMO_SUBSCRIPTIONS = [];

export const DEMO_NOTIFICATIONS = [];

export const DEMO_APPROVALS = [];

export const DEMO_AI_INSIGHTS = [];

export const DEMO_TOPUP_REQUESTS = [];

// Each project's first CFO-approved subscription ask is seeded as the approved base R&D
// budget (shown as a budget-track card in the R&D budget tab). Later asks are additional
// requests (DEMO_CHANGE_REQUESTS) that stack on top, so the total budget grows.
export const DEMO_BUDGETS = [
  {
    id: "budget-zoro-rnd",
    projectId: "zoro",
    budgetType: "RnD",
    status: "approved",
    submittedAt: "2026-07-13T09:34:00.000Z",
    submittedBy: "Dhawal Bathre",
    submittedRole: "R&D",
    requesterRole: "R&D",
    teamType: "R&D",
    totalTasks: 500,
    totalTrajectories: 1500,
    totals: { total: ZORO_CLAUDE_SUB_COST, models: 0, infra: 0, subs: ZORO_CLAUDE_SUB_COST, general: 0 },
    phases: [
      { id: "zoro-sampling", name: "Sampling", start: "2026-07-09", end: "2026-07-31", budget: ZORO_CLAUDE_SUB_COST, tasks: 500, trajectories: 3 },
    ],
    items: {
      models: [],
      infra: [],
      subs: [
        { id: "budget-zoro-sub-claude", optionId: "claude-code-max-20x", subscription: "Claude Code Max 20x", optionLabel: "Claude Code Max 20x · 3 subscriptions", seats: 3, amount: ZORO_CLAUDE_SUB_COST, estCost: ZORO_CLAUDE_SUB_COST, billingUnit: "per month" },
      ],
      misc: [],
    },
    ctoDecision: { decision: "approve", amount: ZORO_CLAUDE_SUB_COST, comment: "", at: "2026-07-13T15:00:00.000Z", by: "CTO Admin" },
    cfoDecision: { decision: "approve", amount: ZORO_CLAUDE_SUB_COST, comment: "Approved", at: "2026-07-13T17:01:00.000Z", by: "Shubham Garg" },
  },
  {
    id: "budget-tron-rnd",
    projectId: "tron",
    budgetType: "RnD",
    status: "approved",
    submittedAt: "2026-07-09T12:29:00.000Z",
    submittedBy: "Piyush Chandra",
    submittedRole: "R&D",
    requesterRole: "R&D",
    teamType: "R&D",
    totalTasks: 500,
    totalTrajectories: 1500,
    totals: { total: 200, models: 0, infra: 0, subs: 200, general: 0 },
    phases: [
      { id: "tron-sampling", name: "Sampling", start: "2026-07-09", end: "2026-07-31", budget: 200, tasks: 500, trajectories: 3 },
    ],
    items: {
      models: [],
      infra: [],
      subs: [
        { id: "budget-tron-sub-claude", optionId: "claude-code-max-20x", subscription: "Claude Code Max 20x", optionLabel: "Claude Code Max 20x · 1 subscription", seats: 1, amount: 200, estCost: 200, billingUnit: "per month" },
      ],
      misc: [],
    },
    ctoDecision: { decision: "approve", amount: 200, comment: "", at: "2026-07-09T15:30:00.000Z", by: "CTO Admin" },
    cfoDecision: { decision: "approve", amount: 200, comment: "Approved", at: "2026-07-09T16:16:00.000Z", by: "Shubham Garg" },
  },
];

export const DEMO_BATCH_DELIVERIES = [];

export const DEMO_BUDGET_REVIEWS = [];

export const DEMO_CHANGE_REQUESTS = [
  {
    id: "cr-zoro-codex-pro",
    projectId: "zoro",
    projectName: "Zoro",
    type: "Budget change",
    amount: ZORO_CODEX_SUB_COST,
    currentBudget: ZORO_CLAUDE_SUB_COST,
    requestedBudget: ZORO_APPROVED_BUDGET,
    requester: "Dhawal Bathre",
    requesterRole: "R&D",
    urgency: "Normal",
    stage: "Approved",
    status: "approved",
    createdAt: "2026-07-20T09:00:00.000Z",
    reason:
      "Three (3) GPT Codex Pro 20x accounts to support baselining for GPT-5.6. High-volume, long-running software engineering and evaluation tasks — distributes workload across the team and avoids session limits.",
    expectedTasks: "500",
    timelineDelta: "",
    affectedPhase: "Sampling",
    breakdown: {
      models: buildBreakdownSection([]),
      infra: buildBreakdownSection([]),
      subs: buildBreakdownSection(
        [
          {
            id: "cr-zoro-sub-codex",
            optionId: "gpt-codex-pro-20x",
            optionLabel: "GPT Codex Pro 20x · 3 accounts · INR 59,700 (~$715)",
            note: "Baselining GPT-5.6 · distribute load, avoid session limits",
            amount: ZORO_CODEX_SUB_COST,
            billingUnit: "per month",
          },
        ],
        { billingUnit: "per month" }
      ),
    },
    ctoDecision: { decision: "approve", amount: ZORO_CODEX_SUB_COST, comment: "", at: "2026-07-20T10:30:00.000Z", by: "CTO Admin" },
    cfoDecision: { decision: "approve", amount: ZORO_CODEX_SUB_COST, comment: "Approved", at: "2026-07-20T11:51:00.000Z", by: "Shubham Garg" },
    history: [
      { at: "2026-07-20T09:00:00.000Z", actor: "Dhawal Bathre · R&D", action: "Submitted additional request", detail: "GPT Codex Pro 20x (3 accounts) · INR 59,700 (~$715)" },
      { at: "2026-07-20T10:30:00.000Z", actor: "CTO Admin · CTO", action: "CTO approved", detail: "Forwarded to CFO at ~$715" },
      { at: "2026-07-20T11:51:00.000Z", actor: "Shubham Garg · CFO", action: "CFO approved", detail: "Approved at ~$715" },
    ],
  },
  {
    id: "cr-tron-claude-2",
    projectId: "tron",
    projectName: "Tron",
    type: "Budget change",
    amount: 400,
    currentBudget: 200,
    requestedBudget: 600,
    requester: "Piyush Chandra",
    requesterRole: "R&D",
    urgency: "Normal",
    stage: "Approved",
    status: "approved",
    createdAt: "2026-07-14T11:17:00.000Z",
    reason:
      "Two (2) additional Claude Code Max 20x subscriptions (Opus 4.8) solely for trajectory generation to baseline the tasks we create — maintains dataset quality and difficulty and avoids exhausting the session limit during simultaneous development.",
    expectedTasks: "500",
    timelineDelta: "",
    affectedPhase: "Sampling",
    breakdown: {
      models: buildBreakdownSection([]),
      infra: buildBreakdownSection([]),
      subs: buildBreakdownSection(
        [
          {
            id: "cr-tron-sub-2",
            optionId: "claude-code-max-20x",
            optionLabel: "Claude Code Max 20x · 2 subscriptions",
            note: "Trajectory generation · Opus 4.8 baselining",
            amount: 400,
            billingUnit: "per month",
          },
        ],
        { billingUnit: "per month" }
      ),
    },
    ctoDecision: { decision: "approve", amount: 400, comment: "", at: "2026-07-14T14:00:00.000Z", by: "CTO Admin" },
    cfoDecision: { decision: "approve", amount: 400, comment: "Approved", at: "2026-07-14T16:00:00.000Z", by: "Shubham Garg" },
    history: [
      { at: "2026-07-14T11:17:00.000Z", actor: "Piyush Chandra · R&D", action: "Submitted additional request", detail: "Claude Code Max 20x (2 subs) · $400" },
      { at: "2026-07-14T14:00:00.000Z", actor: "CTO Admin · CTO", action: "CTO approved", detail: "Forwarded to CFO at $400" },
      { at: "2026-07-14T16:00:00.000Z", actor: "Shubham Garg · CFO", action: "CFO approved", detail: "Approved at $400" },
    ],
  },
];

export const DEMO_PHASE_TASKS = {};

export const DEMO_TASK_LOGS = {};

export const DEMO_BUFFERS = {};

export const DEMO_BUFFER_POOL = {
  total: 0,
  available: 0,
  policyPct: 0,
  history: [],
  alerts: [],
  projectConsumed: {},
};

export const DEMO_IT_MONTHLY_ACTUALS = {};

export const DEMO_REPORTS_CATALOG = [];

export const DEMO_AI_COST_TODAY = {
  total: 0,
  budget: 0,
  yesterday: 0,
  wowChange: 0,
  tokensInput: 0,
  tokensOutput: 0,
  avgLatencyMs: 0,
  requests: 0,
};

export const DEMO_AI_COST_MONTHLY = {
  total: 0,
  budget: 0,
  forecast: 0,
  projected: 0,
  daysElapsed: 0,
  daysRemaining: 0,
};

export const DEMO_AI_COST_BY_PROVIDER = [];

export const DEMO_AI_COST_BY_MODEL = [];

export const DEMO_AI_COST_TREND = [];

export const DEMO_AI_COST_BY_PROJECT = [];

export const DEMO_MODEL_KEYS = [];

export const DEMO_IT_PROVISIONING = [];

export const DEMO_TEAM_REMOVALS = {};
