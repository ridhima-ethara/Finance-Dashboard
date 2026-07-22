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
    buffer: 10,
    recoverableFromClient: isTpmVisible,
    recoveredAmount: 0,
    approvedBudget: 0,
    estimatedBudget: 0,
    actualSpend: 0,
    remaining: 0,
    variance: 0,
    utilization: 0,
    burnRate: 0,
    forecast: 0,
    infrastructureCost: 0,
    aiModelCost: 0,
    employeeCost: 0,
    purchaseCost: 0,
    reimbursements: 0,
    dinnerExpenses: 0,
    miscExpenses: 0,
    topupsTotal: 0,
    changeRequestsTotal: 0,
    health: "healthy",
    topModel: "",
    phases: projectPhases,
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
];

export const CSV_DEMO_PROJECTS = CSV_MAPPING.map(buildCsvProject);
