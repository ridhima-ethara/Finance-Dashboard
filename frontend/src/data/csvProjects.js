// Ethara Internal↔External project mapping (May 2026 snapshot)
// Derived from the client-supplied App Sheet. Each entry preserves the
// canonical client project name, Ethara-side codename, R&D vs Production tag,
// team type (Technical / Generalist), target volume, delivered phases, and
// member roster. The client project name is only exposed to CFO role via the
// existing maskClientName() logic in AppContext.

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

const slugify = (str = "") =>
  String(str)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-+|-+$)/g, "");

// Deterministic 4-digit hash for stable member ids (avoids collisions on reload).
const stableId = (s = "") => {
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) | 0;
  return String(Math.abs(h) % 10000).padStart(4, "0");
};

const memberFromName = (name, role = "Engineer") => ({
  id: `csv-${stableId(name)}`,
  name,
  role,
  email: `${slugify(name).replace(/-/g, ".")}@ethara.ai`,
  status: "Kickoff sent",
});

// The R&D quick-login user is "R&D Lead 1"; TPM quick-login user is "TPM Lead".
// Include them in rndMembers / tpm respectively so the demo projects show up on
// their dashboards without further wiring.
const RND_LEAD = "R&D Lead 1";
const TPM_LEAD = "TPM Lead";

const buildPhases = (internal, phasesInput = [], projectStart, projectEnd) => {
  if (!phasesInput.length && projectStart) {
    return [
      {
        id: `${internal}-phase-1`,
        name: "Delivery",
        dates: `${projectStart} → ${projectEnd}`,
        start: projectStart,
        end: projectEnd,
        totalTasks: 0,
        tasks: 0,
        trajectoriesPerTask: 1,
        estimated: 0,
        actual: 0,
        health: "healthy",
      },
    ];
  }
  return phasesInput.map((p, idx) => {
    const start = idx === 0 ? projectStart : phasesInput[idx - 1].delivery_date || projectStart;
    const end = p.delivery_date || projectEnd;
    return {
      id: `${internal}-phase-${idx + 1}`,
      name: p.name || `Phase ${idx + 1}`,
      dates: `${start} → ${end}`,
      start,
      end,
      totalTasks: Number(p.target_count || 0),
      tasks: Number(p.target_count || 0),
      trajectoriesPerTask: 1,
      estimated: 0,
      actual: 0,
      health: "healthy",
    };
  });
};

// The May snapshot ran across roughly 2026-05-15 → 2026-07-20.
const DEFAULT_START = "2026-05-15";
const DEFAULT_END = "2026-07-20";

// -----------------------------------------------------------------------------
// Actuals (from App Sheet · Ethara Actuals CSV)
// -----------------------------------------------------------------------------
// Approved = TPM-raised amount that CTO+CFO approved.
// Consumed = IT-reported actual usage.
// Delta positive => under budget (savings). Delta negative => over budget.
// Phase rows are ordered as they appear in the sheet so we can align them with
// each project's existing phase list.
const ACTUALS_BY_INTERNAL = {
  talos: {
    approvedBudget: 46640.13,
    actualSpend: 32988.97,
    delta: 13651.16,
    phaseActuals: [
      { label: "Phase 1", approved: 46590.13, consumed: 32972.40 },
      { label: "Phase 1 (Rework)", approved: 50.00, consumed: 16.57 },
    ],
  },
  skoll: {
    approvedBudget: 416.00,
    actualSpend: 723.94,
    delta: -307.94,
    phaseActuals: [{ label: "Phase 1", approved: 416.00, consumed: 723.94 }],
  },
  kensei: {
    approvedBudget: 31923.08,
    actualSpend: 6503.41,
    delta: 25419.67,
    phaseActuals: [
      { label: "Phase 1", approved: 28000.00, consumed: 6143.92 },
      { label: "Phase 1 (Development)", approved: 1000.00, consumed: 227.13 },
      { label: "Phase 1 (Production)", approved: 2923.08, consumed: 132.36 },
    ],
  },
  vegeta: {
    approvedBudget: 200.00, actualSpend: 163.89, delta: 36.11,
    phaseActuals: [{ label: "Phase 1", approved: 200.00, consumed: 163.89 }],
  },
  fenrir: {
    approvedBudget: 0, actualSpend: 0, delta: 0,
    phaseActuals: [{ label: "Fiverr", approved: 0, consumed: 0 }],
  },
  goku: {
    approvedBudget: 300.00, actualSpend: 8.86, delta: 291.14,
    phaseActuals: [{ label: "Phase 2", approved: 300.00, consumed: 8.86 }],
  },
  freya: {
    approvedBudget: 0, actualSpend: 0, delta: 0,
    phaseActuals: [{ label: "Phase 1", approved: 0, consumed: 0 }],
  },
  raiden: {
    approvedBudget: 1300.00, actualSpend: 499.43, delta: 800.57,
    phaseActuals: [
      { label: "Phase 1", approved: 300.00, consumed: 152.36 },
      { label: "Phase 1 (Development)", approved: 1000.00, consumed: 347.07 },
    ],
  },
  kaiju: {
    approvedBudget: 1500.00, actualSpend: 1122.05, delta: 377.95,
    phaseActuals: [
      { label: "Phase 1", approved: 500.00, consumed: 209.67 },
      { label: "Phase 1 (Development)", approved: 1000.00, consumed: 912.38 },
    ],
  },
  aurora: {
    approvedBudget: 1050.00, actualSpend: 1536.19, delta: -486.19,
    phaseActuals: [
      { label: "Phase 1", approved: 50.00, consumed: 47.13 },
      { label: "Phase 1 (Development)", approved: 1000.00, consumed: 1489.06 },
    ],
  },
  // Jaeger maps to the "Jaeger-SWE" project seed.
  "jaeger-swe": {
    approvedBudget: 878582.33,
    actualSpend: 626677.46,
    delta: 251904.87,
    phaseActuals: [
      { label: "Phase 1 (96)", approved: 6778.00, consumed: 4216.65 },
      { label: "Phase 2 (10004)", approved: 457434.27, consumed: 325390.65 },
      { label: "Phase 3 (10000)", approved: 414370.06, consumed: 297070.16 },
    ],
  },
  "arc-agents": {
    approvedBudget: 0, actualSpend: 0, delta: 0,
    phaseActuals: [{ label: "Interactive Puzzle Environment Data Collection", approved: 0, consumed: 0 }],
  },
  caesar: {
    approvedBudget: 300.00, actualSpend: 288.82, delta: 11.18,
    phaseActuals: [{ label: "Phase 1", approved: 300.00, consumed: 288.82 }],
  },
  // ---- Projects that appear only in the Actuals CSV (no mapping row) ----
  valkyrie: {
    approvedBudget: 745.00, actualSpend: 1023.82, delta: -278.82,
    phaseActuals: [{ label: "Phase 1", approved: 745.00, consumed: 1023.82 }],
  },
  kraken: {
    approvedBudget: 55.51, actualSpend: 8.76, delta: 46.75,
    phaseActuals: [{ label: "Phase 1", approved: 55.51, consumed: 8.76 }],
  },
  crowley: {
    approvedBudget: 29093.58, actualSpend: 31000.00, delta: -1906.42,
    phaseActuals: [{ label: "Phase 1 (Sourcing)", approved: 29093.58, consumed: 31000.00 }],
  },
  "crawley-bedrock": {
    approvedBudget: 0, actualSpend: 516.00, delta: -516.00,
    phaseActuals: [{ label: "Phase 1", approved: 0, consumed: 516.00 }],
  },
  agon: {
    approvedBudget: 19.50, actualSpend: 13.81, delta: 5.69,
    phaseActuals: [{ label: "Phase 1 (Development)", approved: 19.50, consumed: 13.81 }],
  },
};

const applyActualsToPhases = (basePhases, phaseActuals = []) => {
  // Zip actuals row-by-row into the project's phase list. Any extra actuals rows
  // that don't have a matching phase become synthesized phases so nothing gets lost.
  const out = basePhases.map((phase, i) => {
    const a = phaseActuals[i];
    if (!a) return phase;
    const delta = a.approved - a.consumed;
    return {
      ...phase,
      name: a.label || phase.name,
      estimated: a.approved,
      actual: a.consumed,
      variance: delta,
      health: delta >= 0 ? "healthy" : "over",
    };
  });
  // Append any actuals rows beyond basePhases as extra phases.
  phaseActuals.slice(basePhases.length).forEach((a, idx) => {
    const delta = a.approved - a.consumed;
    out.push({
      id: `${basePhases[0]?.id?.split("-phase-")[0] || "phase"}-actuals-${idx + 1}`,
      name: a.label,
      dates: `${DEFAULT_START} → ${DEFAULT_END}`,
      start: DEFAULT_START,
      end: DEFAULT_END,
      totalTasks: 0,
      tasks: 0,
      trajectoriesPerTask: 1,
      estimated: a.approved,
      actual: a.consumed,
      variance: delta,
      health: delta >= 0 ? "healthy" : "over",
    });
  });
  return out;
};

const projectHealthFromDelta = (approved, delta) => {
  if (!approved) return delta < 0 ? "over" : "healthy";
  const utilPct = ((approved - delta) / approved) * 100;
  if (delta < 0) return "over";
  if (utilPct >= 90) return "watch";
  return "healthy";
};

const buildCsvProject = ({
  internal,
  client,
  phaseTag, // "R&D" | "Production" | "Delivered" | null (OTS)
  teamType, // "Technical" | "Generalist" | null
  targetVolume,
  phases = [],
  members = [],
  startDate = DEFAULT_START,
  estimatedEndDate = DEFAULT_END,
}) => {
  const isRnD = phaseTag === "R&D";
  const isDelivered = phaseTag === "Delivered";
  const isProduction = phaseTag === "Production";
  const isTpmVisible = isProduction || isDelivered;
  const type = isRnD ? "R&D" : isProduction ? "Production" : isDelivered ? "Delivered" : "Discovery";
  const status = isRnD
    ? "R&D active"
    : isProduction
      ? "In production"
      : isDelivered
        ? "Delivered"
        : "Scoping";

  const memberRecords = members.map((n) => memberFromName(n, isRnD ? "R&D" : "Engineer"));
  const rndMembers = isRnD ? [RND_LEAD, ...members] : [];
  const tpm = isTpmVisible ? TPM_LEAD : "";
  const teamMembers = [];
  if (isRnD) {
    teamMembers.push({ id: "u5", name: RND_LEAD, role: "R&D", email: "rd@ethara.ai", status: "Online" });
  }
  if (isTpmVisible) {
    teamMembers.push({ id: "u3", name: TPM_LEAD, role: "TPM", email: "tpm@ethara.ai", status: "Online" });
  }
  memberRecords.forEach((m) => teamMembers.push(m));

  const projectPhases = buildPhases(internal, phases, startDate, estimatedEndDate);
  const deliveredTasks = isDelivered
    ? projectPhases.reduce((sum, p) => sum + Number(p.tasks || 0), 0)
    : 0;
  const targetTasks = Number(targetVolume || projectPhases.reduce((s, p) => s + p.tasks, 0) || 0);

  const id = slugify(internal);
  const actuals = ACTUALS_BY_INTERNAL[id];
  const enrichedPhases = actuals ? applyActualsToPhases(projectPhases, actuals.phaseActuals) : projectPhases;
  const approvedBudget = actuals?.approvedBudget || 0;
  const actualSpend = actuals?.actualSpend || 0;
  const remaining = approvedBudget - actualSpend;
  const variance = actuals?.delta ?? remaining;
  const utilization = approvedBudget > 0 ? Number(((actualSpend / approvedBudget) * 100).toFixed(1)) : 0;
  const projHealth = actuals ? projectHealthFromDelta(approvedBudget, variance) : "healthy";

  return {
    id,
    name: internal,
    clientProjectName: client,
    client,
    createdBy: isRnD ? RND_LEAD : TPM_LEAD,
    createdByRole: isRnD ? "R&D" : "TPM",
    goal: `${client} — ${teamType || "Technical"} delivery pool`,
    pl: "",
    tpm,
    rnd: isRnD ? RND_LEAD : "",
    rndMembers,
    plMembers: [],
    qlMembers: [],
    docUrl: "",
    docs: [],
    teamMembers,
    kickoffMail: null,
    startDate,
    estimatedEndDate,
    status,
    type,
    workflowStage: isRnD ? "sample-active" : isProduction ? "production-active" : "delivered",
    readyForTpmBudget: false,
    pendingBudgetSubmission: null,
    buffer: 0,
    recoverableFromClient: isTpmVisible,
    recoveredAmount: 0,
    approvedBudget,
    estimatedBudget: approvedBudget,
    actualSpend,
    remaining,
    variance,
    utilization,
    burnRate: 0,
    forecast: actualSpend,
    infrastructureCost: 0,
    aiModelCost: actualSpend,
    employeeCost: 0,
    purchaseCost: 0,
    reimbursements: 0,
    dinnerExpenses: 0,
    miscExpenses: 0,
    topupsTotal: 0,
    changeRequestsTotal: 0,
    health: projHealth,
    topModel: "",
    phases: enrichedPhases,
    budgetItems: { models: [], infra: [], subs: [], misc: [] },
    expenses: [],
    budgetHistory: [],
    topupHistory: [],
    budgetTrackHistory: [],
    auditLog: [
      {
        id: `audit-${id}-seeded`,
        ts: `${startDate}T09:00:00.000Z`,
        actor: "System · Client mapping",
        action: "Project seeded from May mapping sheet",
        detail: `${client} · ${type} · ${teamType || "Technical"}`,
      },
    ],
    lastBudgetSubmission: {
      budgetType: isRnD ? "RnD" : "Production",
      sampleIteration: 1,
      sourceDeliveryId: null,
    },
    promotedToProductionAt: isProduction ? `${startDate}T09:00:00.000Z` : null,
    itProvisioningStatus: isTpmVisible ? "active" : null,
    // extra metadata used by dashboards
    teamType: teamType || "Technical",
    targetVolume: targetTasks,
    deliveredTasks,
    phaseTag,
  };
};

// -----------------------------------------------------------------------------
// Raw mapping from the App Sheet
// -----------------------------------------------------------------------------

const CSV_MAPPING = [
  // ---------- R&D pool ----------
  {
    internal: "Skoll",
    client: "Openclaw SFT - MultiAgent",
    phaseTag: "R&D",
    teamType: "Technical",
    members: [
      "Arth Pathak",
      "Vaishnavi Nighojkar",
      "Navya Arora",
      "Swarnim Jain",
      "Ram Lalit Chaudhary",
      "Shreeyank Doliya",
      "Khushi Tomar",
      "Kausrubh Dalvi",
      "Yuvraj Singh Chandrawat",
    ],
  },
  {
    internal: "Goku",
    client: "Multimodal Agentic Eval",
    phaseTag: "R&D",
    teamType: "Technical",
    members: ["Vaishnavi Nighojkar"],
  },
  {
    internal: "Cipher",
    client: "OpenClaw RL Data Collection",
    phaseTag: "R&D",
    teamType: "Technical",
    members: [],
  },
  {
    internal: "Caesar",
    client: "Claude trajectories in harbor format",
    phaseTag: "R&D",
    teamType: "Technical",
    members: [],
  },
  {
    internal: "Lycan",
    client: "Tutorial to Task Sourcing (Game Dev, 3D modelling, etc.)",
    phaseTag: "R&D",
    teamType: "Technical",
    members: ["Piyush Singh Tomar", "Khushi Tyagi"],
  },
  {
    internal: "Talos-Safety",
    client: "Openclaw SFT - Safety",
    phaseTag: "R&D",
    teamType: "Technical",
    members: [],
  },

  // ---------- Production (TPM) pool ----------
  {
    internal: "Kensei",
    client: "Openclaw RL - Multimodal",
    phaseTag: "Production",
    teamType: "Technical",
    targetVolume: 1000,
    phases: [
      { name: "Production", target_count: 45, delivery_date: "2026-05-26" },
      { name: "Production", target_count: 52, delivery_date: "2026-06-09" },
      { name: "Production", target_count: 113, delivery_date: "2026-06-19" },
      { name: "Production", target_count: 300, delivery_date: "2026-06-29" },
      { name: "Production", target_count: 225, delivery_date: "2026-07-04" },
      { name: "Production", target_count: 75, delivery_date: "2026-07-06" },
      { name: "Production", target_count: 300, delivery_date: "2026-07-13" },
      { name: "Production", target_count: 300, delivery_date: "2026-07-20" },
    ],
    members: [
      "Navya Arora",
      "Prafful Gupta",
      "Ayan Choudhary",
      "Sanskriti Singh Baghel",
      "Archana Shahji",
      "Aniket Soni",
      "Gautam Dubey",
      "Vidit Sharma",
      "Dinshi Jain",
      "Ronak Sharma",
      "Aditi Sharma",
      "Supriya Verma",
      "Japjeet Grewal",
      "Nitish Tiwari",
    ],
  },
  {
    internal: "Fenrir",
    client: "Fiverr",
    phaseTag: "Production",
    teamType: "Technical",
    targetVolume: 2000,
    phases: [
      { name: "Production", target_count: 222, delivery_date: "2026-06-03" },
      { name: "Production", target_count: 407, delivery_date: "2026-06-16" },
      { name: "Production", target_count: 171, delivery_date: "2026-06-29" },
      { name: "Production", target_count: 119, delivery_date: "2026-07-08" },
      { name: "Production", target_count: 161, delivery_date: "2026-07-17" },
    ],
    members: ["Prafful Gupta", "Tejas Shah", "Animesh Giri Goswami", "Vyom Sahu"],
  },
  {
    internal: "Raiden",
    client: "RL-Environment",
    phaseTag: "Production",
    teamType: "Technical",
    targetVolume: 1,
    members: ["Krishna Bairagi", "Aniket Soni", "Sagar Agrahari"],
  },
  {
    internal: "Kaiju",
    client: "RL-Environment",
    phaseTag: "Production",
    teamType: "Technical",
    targetVolume: 500,
    members: ["Vaibhav Singh", "Madhur Parwal", "Prakhar Singh"],
  },
  {
    internal: "Aurora",
    client: "RL-Environment",
    phaseTag: "Production",
    teamType: "Technical",
    targetVolume: 500,
    members: ["Shraiy Khaddar", "Sagarika Nayak", "Ankit Porwal"],
  },
  {
    internal: "Talos",
    client: "OpenClaw SFT Main",
    phaseTag: "Production",
    teamType: "Technical",
    targetVolume: 5000,
    phases: [
      { name: "Production", target_count: 1000, delivery_date: "2026-05-21" },
    ],
    members: [],
  },
  {
    internal: "Leviathan",
    client: "vs-1776882927-webdev-l3-highend",
    phaseTag: "Production",
    teamType: "Technical",
    targetVolume: 4400,
    phases: [{ name: "Production", target_count: 999 }],
    members: [],
  },
  {
    internal: "Gohan",
    client: "vs-1776882924-webdev-l2-interactive",
    phaseTag: "Production",
    teamType: "Technical",
    targetVolume: 2200,
    phases: [{ name: "Production", target_count: 311 }],
    members: [],
  },
  {
    internal: "Vegeta",
    client: "vs-1776882926-webdev-l3-fullstack",
    phaseTag: "Production",
    teamType: "Technical",
    targetVolume: 2200,
    phases: [{ name: "Production", target_count: 32 }],
    members: [],
  },
  {
    internal: "Freya",
    client: "RL-Training",
    phaseTag: "Production",
    teamType: "Technical",
    targetVolume: 50,
    members: [],
  },
  {
    internal: "Lynceus",
    client: "Annot Critic Q7R",
    phaseTag: "Production",
    teamType: "Generalist",
    members: ["Piyush Singh Tomar", "Vatsal Jain"],
  },

  // ---------- Delivered ----------
  {
    internal: "Jaeger-SWE",
    client: "SWE Tasks (Long Horizon, Hard SWE, Real Coder)",
    phaseTag: "Delivered",
    teamType: "Technical",
    targetVolume: 5000,
    phases: [{ name: "Delivered", target_count: 5000 }],
    members: ["Prafful Gupta", "Archana Shaji", "Gautam Dubey", "Aniket Soni"],
  },
  {
    internal: "Arc-Agents",
    client: "Interactive Puzzle Environment Data Collection",
    phaseTag: "Delivered",
    teamType: "Technical",
    targetVolume: 129,
    phases: [{ name: "Delivered", target_count: 129 }],
    members: ["Arth Pathak", "Abhishek Mishra", "Supriya Verma"],
  },

  // ---------- Actuals-only projects (present in the Actuals CSV, not in the May mapping) ----------
  { internal: "Valkyrie", client: "Model bench / OTS", phaseTag: "Production", teamType: "Technical", members: [] },
  { internal: "Kraken", client: "Model bench / OTS", phaseTag: "Production", teamType: "Technical", members: [] },
  { internal: "Crowley", client: "Task sourcing pipeline", phaseTag: "Production", teamType: "Technical", members: [] },
  { internal: "Crawley-Bedrock", client: "Bedrock provisioning", phaseTag: "Production", teamType: "Technical", members: [] },
  { internal: "Agon", client: "Internal tooling · Development", phaseTag: "Production", teamType: "Technical", members: [] },
];

export const CSV_DEMO_PROJECTS = CSV_MAPPING.map(buildCsvProject);
