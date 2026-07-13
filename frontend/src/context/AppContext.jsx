import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { USERS, ROLES, PROJECTS } from "../data/mockData";
import { BUDGET_REVIEWS, CHANGE_REQUESTS } from "../data/mockTpm";
import { TEAM } from "../data/mockUsers";
import { BEDROCK_MODELS } from "../data/mockCatalog";
import { MODEL_KEYS } from "../data/mockAi";
import { BUFFER } from "../data/mockCfo";
import { formatBudgetTypeLabel, normalizeBudgetType } from "../lib/projectMetrics";

const AppContext = createContext(null);
const SESSION_KEY = "ethara.session.v1";
const BUFFERS_KEY = "ethara.buffers.v1";
const RECOVERY_KEY = "ethara.recovery.v1";
const CUSTOM_PROJECTS_KEY = "ethara.customProjects.v1";
const TASK_LOGS_KEY = "ethara.taskLogs.v1";
const TOPUP_REQ_KEY = "ethara.topupRequests.v1";
const BUDGETS_KEY = "ethara.budgets.v1";
const BATCH_DELIVERIES_KEY = "ethara.batchDeliveries.v1";
const BUDGET_REVIEWS_KEY = "ethara.budgetReviews.v1";
const CHANGE_REQUESTS_KEY = "ethara.changeRequests.v1";
const TEAM_REMOVALS_KEY = "ethara.teamRemovals.v1";
const MODEL_KEYS_KEY = "ethara.modelKeys.v1";
const IT_PROVISIONING_KEY = "ethara.itProvisioning.v1";
const BUFFER_POOL_KEY = "ethara.bufferPool.v1";
const IT_MONTHLY_ACTUALS_KEY = "ethara.itMonthlyActuals.v1";

const readJSON = (key, fallback) => {
  try {
    return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
  } catch {
    return fallback;
  }
};

const maskKey = (full) => `${full.slice(0, 7)}${"•".repeat(18)}${full.slice(-4)}`;
const providerPrefix = {
  Anthropic: "ant",
  Amazon: "amz",
  Meta: "met",
  Mistral: "mis",
  Cohere: "coh",
  AI21: "ai21",
  "Stability AI": "stb",
  OpenAI: "oai",
  Google: "gog",
  xAI: "xai",
};

const buildSyntheticKey = ({ provider, env, seed }) => {
  const prefix = providerPrefix[provider] || "mdl";
  const mode = env === "production" ? "live" : "test";
  const safeSeed = String(seed || "demo").replace(/[^a-z0-9]/gi, "").slice(0, 14) || Math.random().toString(36).slice(2, 10);
  return `sk-${prefix}-${mode}-${safeSeed}${Math.random().toString(36).slice(2, 8)}`;
};

const normalizeMemberRecord = (member, fallbackRole = "Member", fallbackStatus = "Pending kickoff") => ({
  id: member.id,
  name: member.name,
  role: member.role || fallbackRole,
  email: member.email || `${member.name.toLowerCase().replace(/\s+/g, ".")}@ethara.ai`,
  status: member.status || fallbackStatus,
  tasksDone: Number(member.tasksDone || 0),
});

const buildTeamMember = ({ projectId, name, role, fallbackStatus = "Pending kickoff", index = 0 }) => {
  const member = TEAM.find((entry) => entry.name === name);
  return normalizeMemberRecord({
    id: member?.id || `${projectId}-tm-${index + 1}`,
    name,
    role: role || member?.role || "R&D",
    email: member?.email || `${name.toLowerCase().replace(/\s+/g, ".")}@ethara.ai`,
    status: role === "TPM" ? "Online" : fallbackStatus,
  }, role || member?.role || "R&D", fallbackStatus);
};

const mergeTeamMembers = (existing = [], incoming = []) => {
  const merged = new Map();
  [...existing, ...incoming].forEach((member, index) => {
    const key = member.id || member.email || member.name || `member-${index}`;
    if (!merged.has(key)) merged.set(key, normalizeMemberRecord(member));
  });
  return Array.from(merged.values());
};

const summarizeRequestedLines = (items = {}, fallbackProject) => {
  const modelLines = (items.models || []).map((line, index) => {
    const meta = line.meta || BEDROCK_MODELS.find((model) => model.id === line.modelId);
    return {
      id: line.id || `mdl-${index + 1}`,
      modelId: line.modelId || meta?.id || "",
      label: meta?.name || line.modelName || "Model access",
      provider: meta?.provider || line.provider || fallbackProject?.topModel || "Anthropic",
      amount: Number(line.estCost || line.amount || 0),
    };
  });

  if (!modelLines.length && fallbackProject?.topModel) {
    modelLines.push({
      id: `${fallbackProject.id}-default-model`,
      modelId: "",
      label: fallbackProject.topModel,
      provider: "Anthropic",
      amount: 0,
    });
  }

  return {
    models: modelLines,
    infra: (items.infra || []).map((line, index) => ({
      id: line.id || `inf-${index + 1}`,
      label: line.meta?.code || line.instance || line.optionLabel || "EC2 instance",
      amount: Number(line.estCost || line.amount || 0),
    })),
    subs: (items.subs || []).map((line, index) => ({
      id: line.id || `sub-${index + 1}`,
      label: line.subscription || line.optionLabel || "Subscription",
      amount: Number(line.estCost || line.amount || 0),
    })),
  };
};

const normalizeChangeRequestStatus = (request) => {
  if (request?.status) return request.status;
  if (request?.stage === "Approved") return "approved";
  if (request?.stage === "Rejected") return "rejected";
  return "pending";
};

const normalizeChangeRequest = (request) => ({
  ...request,
  status: normalizeChangeRequestStatus(request),
  history: Array.isArray(request?.history) && request.history.length
    ? request.history
    : [{
        at: request?.createdAt || new Date().toISOString(),
        actor: `${request?.requester || "TPM"} · TPM`,
        action: "Submitted change request",
        detail: `${request?.type || "Change request"} · $${Number(request?.amount || 0).toLocaleString()}`,
      }],
});

// Seed a couple of demo top-up requests so CTO/CFO have items to act on
const seedTopupRequests = () => {
  const now = Date.now();
  return [
    {
      id: "tur-seed-1",
      projectId: "crowley-gen",
      projectName: "Crowley Generation",
      phaseId: "p2",
      phaseName: "Phase 2",
      amount: 5000,
      reason: "Opus 4.8 inference volumes 18% above plan for Phase 2 — extra sweep required before rollout.",
      urgency: "High",
      requester: "Arjun Mehta",
      requesterRole: "TPM",
      requestedAt: new Date(now - 1000 * 60 * 60 * 26).toISOString(),
      status: "pending-cto", // pending-cto -> pending-cfo -> approved|partial|rejected
      ctoDecision: null,
      cfoDecision: null,
      history: [
        { at: new Date(now - 1000 * 60 * 60 * 26).toISOString(), actor: "Arjun Mehta · TPM", action: "Submitted top-up request", detail: "Phase 2 · $5,000" },
      ],
    },
    {
      id: "tur-seed-2",
      projectId: "atlas",
      projectName: "Atlas Ingest",
      phaseId: "p3",
      phaseName: "Phase 3",
      amount: 3500,
      reason: "EC2 spike from Ironclad ingest workload up 34% week-over-week; extend sprint by 3 days.",
      urgency: "Normal",
      requester: "Arjun Mehta",
      requesterRole: "TPM",
      requestedAt: new Date(now - 1000 * 60 * 60 * 50).toISOString(),
      status: "pending-cfo",
      ctoDecision: { amount: 3000, comment: "Trimmed by $500 — reuse existing bench allocation.", at: new Date(now - 1000 * 60 * 60 * 40).toISOString() },
      cfoDecision: null,
      history: [
        { at: new Date(now - 1000 * 60 * 60 * 50).toISOString(), actor: "Arjun Mehta · TPM", action: "Submitted top-up request", detail: "Phase 3 · $3,500" },
        { at: new Date(now - 1000 * 60 * 60 * 40).toISOString(), actor: "Vikram Kumar · CTO", action: "CTO partial approval", detail: "Approved $3,000 · forwarded to CFO" },
      ],
    },
  ];
};

export const AppProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });
  const [aiOpen, setAiOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [scope, setScope] = useState("all");

  const [buffers, setBuffers] = useState(() => readJSON(BUFFERS_KEY, {}));
  const [bufferPool, setBufferPool] = useState(() => readJSON(BUFFER_POOL_KEY, {
    total: BUFFER.total,
    available: BUFFER.available,
    policyPct: BUFFER.policyPct,
    history: BUFFER.history,
    alerts: BUFFER.alerts,
    projectConsumed: Object.fromEntries(BUFFER.perProject.map((entry) => [entry.id, entry.consumed])),
  }));
  const [recoveries, setRecoveries] = useState(() => readJSON(RECOVERY_KEY, {}));
  const [customProjects, setCustomProjects] = useState(() => readJSON(CUSTOM_PROJECTS_KEY, []));
  const [taskLogs, setTaskLogs] = useState(() => readJSON(TASK_LOGS_KEY, {}));
  const [topupRequests, setTopupRequests] = useState(() => {
    const stored = readJSON(TOPUP_REQ_KEY, null);
    return stored && Array.isArray(stored) ? stored : seedTopupRequests();
  });
  const [budgets, setBudgets] = useState(() => readJSON(BUDGETS_KEY, []));
  const [batchDeliveries, setBatchDeliveries] = useState(() => readJSON(BATCH_DELIVERIES_KEY, []));
  const [budgetReviews, setBudgetReviews] = useState(() => readJSON(BUDGET_REVIEWS_KEY, []));
  const [changeRequests, setChangeRequests] = useState(() => {
    const stored = readJSON(CHANGE_REQUESTS_KEY, null);
    const source = stored && Array.isArray(stored) ? stored : CHANGE_REQUESTS;
    return source.map(normalizeChangeRequest);
  });
  const [teamRemovals, setTeamRemovals] = useState(() => readJSON(TEAM_REMOVALS_KEY, {}));
  const [modelKeyRecords, setModelKeyRecords] = useState(() =>
    readJSON(MODEL_KEYS_KEY, MODEL_KEYS.map((entry) => ({
      ...entry,
      maskedKey: entry.maskedKey || maskKey(entry.fullKey),
      members: entry.members || [],
    })))
  );
  const [itProvisioningRequests, setItProvisioningRequests] = useState(() => readJSON(IT_PROVISIONING_KEY, []));
  const [itMonthlyActuals, setItMonthlyActuals] = useState(() => readJSON(IT_MONTHLY_ACTUALS_KEY, {}));

  useEffect(() => {
    if (user) localStorage.setItem(SESSION_KEY, JSON.stringify(user));
    else localStorage.removeItem(SESSION_KEY);
  }, [user]);
  useEffect(() => localStorage.setItem(BUFFERS_KEY, JSON.stringify(buffers)), [buffers]);
  useEffect(() => localStorage.setItem(BUFFER_POOL_KEY, JSON.stringify(bufferPool)), [bufferPool]);
  useEffect(() => localStorage.setItem(RECOVERY_KEY, JSON.stringify(recoveries)), [recoveries]);
  useEffect(() => localStorage.setItem(CUSTOM_PROJECTS_KEY, JSON.stringify(customProjects)), [customProjects]);
  useEffect(() => localStorage.setItem(TASK_LOGS_KEY, JSON.stringify(taskLogs)), [taskLogs]);
  useEffect(() => localStorage.setItem(TOPUP_REQ_KEY, JSON.stringify(topupRequests)), [topupRequests]);
  useEffect(() => localStorage.setItem(BUDGETS_KEY, JSON.stringify(budgets)), [budgets]);
  useEffect(() => localStorage.setItem(BATCH_DELIVERIES_KEY, JSON.stringify(batchDeliveries)), [batchDeliveries]);
  useEffect(() => localStorage.setItem(BUDGET_REVIEWS_KEY, JSON.stringify(budgetReviews)), [budgetReviews]);
  useEffect(() => localStorage.setItem(CHANGE_REQUESTS_KEY, JSON.stringify(changeRequests)), [changeRequests]);
  useEffect(() => localStorage.setItem(TEAM_REMOVALS_KEY, JSON.stringify(teamRemovals)), [teamRemovals]);
  useEffect(() => localStorage.setItem(MODEL_KEYS_KEY, JSON.stringify(modelKeyRecords)), [modelKeyRecords]);
  useEffect(() => localStorage.setItem(IT_PROVISIONING_KEY, JSON.stringify(itProvisioningRequests)), [itProvisioningRequests]);
  useEffect(() => localStorage.setItem(IT_MONTHLY_ACTUALS_KEY, JSON.stringify(itMonthlyActuals)), [itMonthlyActuals]);

  const login = ({ email, password, role }) => {
    if (role) {
      const u = USERS.find((x) => x.role === role);
      if (u) {
        const safe = { id: u.id, name: u.name, role: u.role, title: u.title, email: u.email, avatarUrl: u.avatarUrl };
        setUser(safe);
        return { ok: true, user: safe };
      }
      return { ok: false, message: "Role not found" };
    }
    const u = USERS.find((x) => x.email.toLowerCase() === email.toLowerCase() && x.password === password);
    if (!u) return { ok: false, message: "Invalid email or password" };
    const safe = { id: u.id, name: u.name, role: u.role, title: u.title, email: u.email, avatarUrl: u.avatarUrl };
    setUser(safe);
    return { ok: true, user: safe };
  };
  const logout = () => setUser(null);

  // Merge overrides + apply approved top-ups / change requests into project budgets
  const projects = useMemo(() => {
    const baseIds = new Set(PROJECTS.map((project) => project.id));
    const overrides = new Map(customProjects.map((project) => [project.id, project]));
    const merged = [
      ...PROJECTS.map((project) => ({ ...project, ...(overrides.get(project.id) || {}) })),
      ...customProjects.filter((project) => !baseIds.has(project.id)),
    ].map((p) => ({
      ...p,
      buffer: buffers[p.id] ?? p.buffer,
      recoveredAmount: recoveries[p.id] ?? p.recoveredAmount,
    }));
    // Sum finalized top-ups per project (only approved / partial with cfoDecision)
    const finalizedByProject = {};
    topupRequests.forEach((r) => {
      if ((r.status === "approved" || r.status === "partial") && r.cfoDecision?.amount) {
        finalizedByProject[r.projectId] = (finalizedByProject[r.projectId] || 0) + r.cfoDecision.amount;
      }
    });
    const finalizedChangesByProject = {};
    changeRequests.forEach((request) => {
      const finalAmount = Number(
        request.finalDecision?.amount
        ?? request.cfoDecision?.amount
        ?? request.ctoDecision?.amount
        ?? request.amount
        ?? 0
      );
      if ((request.stage === "Approved" || request.status === "approved" || request.status === "partial") && finalAmount) {
        finalizedChangesByProject[request.projectId] = (finalizedChangesByProject[request.projectId] || 0) + finalAmount;
      }
    });
    const recoveryByProject = {};
    const recoveryWindows = {};
    batchDeliveries
      .filter((delivery) => delivery.stage !== "rnd-review")
      .forEach((delivery) => {
        const actual = Number(delivery.actualRecovered || 0);
        const proposed = Number(delivery.proposedAmount || 0);
        recoveryByProject[delivery.projectId] = (recoveryByProject[delivery.projectId] || 0) + actual;
        if (!proposed) return;
        const current = recoveryWindows[delivery.projectId] || { proposed: 0, actual: 0 };
        recoveryWindows[delivery.projectId] = {
          proposed: current.proposed + proposed,
          actual: current.actual + actual,
        };
      });
    return merged.map((p) => {
      const topupBonus = finalizedByProject[p.id] || 0;
      const changeBonus = finalizedChangesByProject[p.id] || 0;
      const approvedBudget = p.approvedBudget + topupBonus + changeBonus;
      const recoveredAmount = recoveries[p.id] ?? recoveryByProject[p.id] ?? p.recoveredAmount;
      let nextHealth = p.health;
      const recoveryWindow = recoveryWindows[p.id];
      if (recoveryWindow?.proposed > 0) {
        const recoveryRatio = recoveryWindow.actual / recoveryWindow.proposed;
        if (recoveryRatio < 0.6) nextHealth = "over";
        else if (recoveryRatio < 0.9 && nextHealth === "healthy") nextHealth = "watch";
      }
      return {
        ...p,
        approvedBudget,
        recoveredAmount,
        health: nextHealth,
        topupsTotal: (p.topupsTotal || 0) + topupBonus,
        changeRequestsTotal: (p.changeRequestsTotal || 0) + changeBonus,
        remaining: approvedBudget - p.actualSpend,
        utilization: approvedBudget > 0 ? Math.round((p.actualSpend / approvedBudget) * 100) : 0,
      };
    });
  }, [buffers, recoveries, customProjects, topupRequests, changeRequests, batchDeliveries]);

  const visibleProjects = useMemo(() => {
    if (!user) return [];
    let list = projects;
    if (user.role === "TPM") list = list.filter((p) => p.tpm === user.name);
    else if (user.role === "PL") list = list.filter((p) => p.pl === user.name);
    else if (user.role === "R&D") list = list.filter((p) => (p.rndMembers || []).includes(user.name) || p.rnd === user.name || p.tpm === user.name);
    if (scope === "R&D") list = list.filter((p) => p.type === "R&D");
    else if (scope === "Production") list = list.filter((p) => p.type === "Production");
    return list;
  }, [projects, user, scope]);

  const setBuffer = (projectId, pct) => setBuffers((b) => ({ ...b, [projectId]: Number(pct) }));
  const setRecovery = (projectId, amount) => setRecoveries((r) => ({ ...r, [projectId]: Number(amount) }));
  const applyBufferAction = ({ projectId, pct, action }) => {
    const numericPct = Number(pct || 0);
    const at = new Date().toISOString();
    const project = projects.find((entry) => entry.id === projectId);

    if (!numericPct || Number.isNaN(numericPct)) return null;

    if (action === "increase-pool" || action === "reduce-pool") {
      const poolAmount = Math.round(((bufferPool.total || 0) * numericPct) / 100);
      setBufferPool((current) => ({
        ...current,
        total: action === "increase-pool" ? current.total + poolAmount : Math.max(poolAmount, current.total - poolAmount),
        available: action === "increase-pool"
          ? current.available + poolAmount
          : Math.max(0, current.available - poolAmount),
        history: [
          {
            id: `bh-${Date.now().toString(36)}`,
            date: at,
            project: "Pool",
            action: action === "increase-pool" ? "Pool increased" : "Pool reduced",
            amount: poolAmount,
            by: user?.name || "CFO",
            reason: `${numericPct}% action`,
          },
          ...(current.history || []),
        ],
      }));
      return poolAmount;
    }

    if (!project) return null;

    const projectAmount = Math.round((project.approvedBudget * numericPct) / 100);
    const currentPct = Number(buffers[projectId] ?? project.buffer ?? 0);
    const nextPct = action === "allocate-project"
      ? currentPct + numericPct
      : Math.max(0, currentPct - numericPct);

    setBuffers((current) => ({ ...current, [projectId]: nextPct }));
    setBufferPool((current) => ({
      ...current,
      available: action === "allocate-project"
        ? Math.max(0, current.available - projectAmount)
        : current.available + projectAmount,
      history: [
        {
          id: `bh-${Date.now().toString(36)}`,
          date: at,
          project: project.name,
          action: action === "allocate-project" ? "Allocated" : "Released",
          amount: projectAmount,
          by: user?.name || "CFO",
          reason: `${numericPct}% of approved budget`,
        },
        ...(current.history || []),
      ],
    }));

    return { projectAmount, nextPct };
  };
  const removeProjectTeamMember = (projectId, memberId) =>
    setTeamRemovals((prev) => ({
      ...prev,
      [projectId]: Array.from(new Set([...(prev[projectId] || []), memberId])),
    }));
  const upsertProjectOverride = (projectId, updater) =>
    setCustomProjects((current) => {
      const existing = current.find((project) => project.id === projectId);
      const base = existing || projects.find((project) => project.id === projectId);
      if (!base) return current;
      const updated = { ...updater(base), __custom: true };
      return [updated, ...current.filter((project) => project.id !== projectId)];
    });

  const addProjectTeamMembers = (projectId, members = [], source = "Budget Builder") => {
    if (!members.length) return;
    upsertProjectOverride(projectId, (project) => {
      const incoming = members.map((member, index) => buildTeamMember({
        projectId,
        name: member.name,
        role: member.role,
        fallbackStatus: "Added later",
        index: (project.teamMembers || []).length + index,
      }));
      const teamMembers = mergeTeamMembers(project.teamMembers || [], incoming);
      const rndMembers = Array.from(new Set([
        ...(project.rndMembers || []),
        ...incoming.filter((member) => member.role === "R&D").map((member) => member.name),
      ]));
      const plMembers = Array.from(new Set([
        ...(project.plMembers || []),
        ...incoming.filter((member) => member.role === "PL / QL" || member.role === "Project Lead").map((member) => member.name),
      ]));
      const qlMembers = Array.from(new Set([
        ...(project.qlMembers || []),
        ...incoming.filter((member) => member.role === "QL" || member.role === "Quality Lead").map((member) => member.name),
      ]));
      const auditEntry = {
        id: `a-${projectId}-${Date.now().toString(36)}`,
        ts: new Date().toISOString(),
        actor: `${user?.name || "System"} · ${user?.role || "System"}`,
        action: "Project members updated",
        detail: `${source} added ${incoming.map((member) => `${member.name} (${member.role})`).join(", ")}`,
      };
      const kickoffRecipients = mergeTeamMembers(project.kickoffMail?.recipients || [], incoming);
      return {
        ...project,
        teamMembers,
        rndMembers,
        plMembers,
        qlMembers,
        kickoffMail: project.kickoffMail
          ? { ...project.kickoffMail, recipients: kickoffRecipients }
          : project.kickoffMail,
        auditLog: [auditEntry, ...(project.auditLog || [])],
      };
    });
  };

  const addProject = (payload) => {
    const id = `p-${Date.now().toString(36)}`;
    const rndMembers = payload.rndMembers || [];
    const plMembers = payload.plMembers || [];
    const qlMembers = payload.qlMembers || [];
    const allMembers = [
      payload.tpm ? { name: payload.tpm, role: "TPM", status: "Online" } : null,
      ...plMembers.map((name) => ({ name, role: "PL / QL" })),
      ...qlMembers.map((name) => ({ name, role: "QL" })),
      ...rndMembers.map((name) => ({ name, role: "R&D" })),
    ].filter(Boolean);
    const teamMembers = mergeTeamMembers(
      [],
      allMembers.map((member, index) => buildTeamMember({
        projectId: id,
        name: member.name,
        role: member.role,
        fallbackStatus: member.status || "Pending kickoff",
        index,
      }))
    );
    const docs = [
      ...(payload.docUrl
        ? [{
            id: `${id}-doc-link`,
            name: "Project brief link",
            url: payload.docUrl,
            kind: "link",
          }]
        : []),
      ...((payload.attachments || []).map((attachment, index) => ({
        id: attachment.id || `${id}-doc-${index + 1}`,
        name: attachment.name,
        size: attachment.size || 0,
        type: attachment.type || "application/octet-stream",
        kind: "file",
      }))),
    ];
    const kickoffAt = new Date().toISOString();
    const kickoffMail = {
      sentAt: kickoffAt,
      subject: `${payload.internalName} kickoff`,
      sentBy: payload.createdBy || "CTO",
      sentByRole: payload.createdByRole || "CTO",
      recipients: teamMembers.map((member) => ({
        id: member.id,
        name: member.name,
        role: member.role,
        email: member.email,
      })),
      attachmentCount: docs.length,
    };
    const proj = {
      id,
      name: payload.internalName,
      clientProjectName: payload.clientProjectName,
      client: payload.clientProjectName || "New Engagement",
      pl: plMembers[0] || payload.tpm,
      tpm: payload.tpm,
      rnd: rndMembers[0] || null,
      rndMembers,
      plMembers,
      qlMembers,
      docUrl: payload.docUrl || "",
      docs,
      teamMembers,
      kickoffMail,
      startDate: payload.startDate,
      estimatedEndDate: "",
      status: "Discovery",
      type: "R&D",
      buffer: 10,
      recoverableFromClient: false,
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
      health: "healthy",
      topModel: "—",
      phases: [],
      expenses: [],
      budgetHistory: [],
      topupHistory: [],
      auditLog: [
        {
          id: `a-${id}-1`,
          ts: kickoffAt,
          actor: payload.createdBy || "CTO",
          action: "Project created",
          detail: `Assigned TPM: ${payload.tpm}${plMembers.length ? ` · PL/QL: ${plMembers.join(", ")}` : ""}${qlMembers.length ? ` · QL: ${qlMembers.join(", ")}` : ""}${rndMembers.length ? ` · R&D: ${rndMembers.join(", ")}` : ""}. Start ${payload.startDate}${docs.length ? ` · ${docs.length} attachment${docs.length === 1 ? "" : "s"}` : ""}`,
        },
        {
          id: `a-${id}-2`,
          ts: kickoffAt,
          actor: `${payload.createdBy || "CTO"} · ${payload.createdByRole || "CTO"}`,
          action: "Kickoff mail sent",
          detail: `${teamMembers.length} recipient${teamMembers.length === 1 ? "" : "s"} · ${teamMembers.map((member) => member.email).join(", ")}`,
        },
      ],
      comments: [],
      __custom: true,
    };
    setCustomProjects((arr) => [proj, ...arr]);
    return proj;
  };

  // ---- Phase Task Logs (TPM) ----
  const TASK_EDIT_WINDOW_MS = 24 * 60 * 60 * 1000; // 24h
  const taskKey = (pid, phId) => `${pid}::${phId}`;

  const isTaskEditable = (log) => Date.now() - new Date(log.createdAt).getTime() < TASK_EDIT_WINDOW_MS;

  const logPhaseTask = ({
    projectId,
    phaseId,
    name,
    assignee,
    hours,
    cost,
    tasksDone,
    trajectories,
    date,
    notes,
    evidence,
    approvalStatus,
    modelId,
    modelName,
    inputTokens,
    outputTokens,
    modelUsage,
  }) => {
    const id = `tl-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const entry = {
      id,
      projectId,
      phaseId,
      name,
      assignee,
      hours: Number(hours) || 0,
      cost: Number(cost) || 0,
      tasksDone: Number(tasksDone) || 0,
      trajectories: Number(trajectories) || 0,
      approvalStatus: approvalStatus || "logged",
      date,
      notes: notes || "",
      evidence: evidence || "",
      modelId: modelId || "",
      modelName: modelName || "",
      inputTokens: Number(inputTokens || 0),
      outputTokens: Number(outputTokens || 0),
      modelUsage: Array.isArray(modelUsage) ? modelUsage.map((usage) => ({
        modelId: usage.modelId || "",
        modelName: usage.modelName || "",
        tasksDone: Number(usage.tasksDone || 0),
        cost: Number(usage.cost || 0),
        inputTokens: Number(usage.inputTokens || 0),
        outputTokens: Number(usage.outputTokens || 0),
      })) : [],
      createdAt: new Date().toISOString(),
      createdBy: user?.name || "TPM",
    };
    setTaskLogs((prev) => {
      const key = taskKey(projectId, phaseId);
      const list = prev[key] || [];
      return { ...prev, [key]: [entry, ...list] };
    });
    return entry;
  };

  const updatePhaseTask = (projectId, phaseId, logId, patch) => {
    setTaskLogs((prev) => {
      const key = taskKey(projectId, phaseId);
      const list = prev[key] || [];
      return {
        ...prev,
        [key]: list.map((t) => {
          if (t.id !== logId) return t;
          if (!isTaskEditable(t)) return t;
          return {
            ...t,
            ...patch,
            hours: Number(patch.hours ?? t.hours),
            cost: Number(patch.cost ?? t.cost),
            tasksDone: Number(patch.tasksDone ?? t.tasksDone ?? 0),
            trajectories: Number(patch.trajectories ?? t.trajectories ?? 0),
            approvalStatus: patch.approvalStatus ?? t.approvalStatus ?? "logged",
            modelId: patch.modelId ?? t.modelId ?? "",
            modelName: patch.modelName ?? t.modelName ?? "",
            inputTokens: Number(patch.inputTokens ?? t.inputTokens ?? 0),
            outputTokens: Number(patch.outputTokens ?? t.outputTokens ?? 0),
            modelUsage: Array.isArray(patch.modelUsage)
              ? patch.modelUsage.map((usage) => ({
                  modelId: usage.modelId || "",
                  modelName: usage.modelName || "",
                  tasksDone: Number(usage.tasksDone || 0),
                  cost: Number(usage.cost || 0),
                  inputTokens: Number(usage.inputTokens || 0),
                  outputTokens: Number(usage.outputTokens || 0),
                }))
              : t.modelUsage ?? [],
          };
        }),
      };
    });
  };

  const deletePhaseTask = (projectId, phaseId, logId) => {
    setTaskLogs((prev) => {
      const key = taskKey(projectId, phaseId);
      const list = prev[key] || [];
      return {
        ...prev,
        [key]: list.filter((t) => !(t.id === logId && isTaskEditable(t))),
      };
    });
  };

  const getPhaseLogs = (projectId, phaseId) => taskLogs[taskKey(projectId, phaseId)] || [];

  const setPhaseLogApprovalStatus = (projectId, phaseId, approvalStatus) => {
    setTaskLogs((prev) => {
      const key = taskKey(projectId, phaseId);
      const list = prev[key] || [];
      if (!list.length) return prev;
      return {
        ...prev,
        [key]: list.map((log) => ({ ...log, approvalStatus })),
      };
    });
  };

  // ---- Top-up Requests (2-stage: CTO → CFO) ----
  const createTopupRequest = ({ projectId, phaseId, phaseName, amount, reason, urgency, breakdown, sampleIteration }) => {
    const proj = projects.find((p) => p.id === projectId);
    const id = `tur-${Date.now().toString(36)}`;
    const entry = {
      id,
      projectId,
      projectName: proj?.name || projectId,
      phaseId,
      phaseName: phaseName || phaseId,
      amount: Number(amount),
      reason,
      urgency: urgency || "Normal",
      requester: user?.name || "TPM",
      requesterRole: user?.role || "TPM",
      requestedAt: new Date().toISOString(),
      sampleIteration: Number(sampleIteration || 0) || null,
      status: "pending-cto",
      ctoDecision: null,
      cfoDecision: null,
      breakdown: breakdown || null,
      history: [
        { at: new Date().toISOString(), actor: `${user?.name || "TPM"} · ${user?.role || "TPM"}`, action: "Submitted top-up request", detail: `${phaseName || phaseId} · $${Number(amount).toLocaleString()}` },
      ],
    };
    setTopupRequests((arr) => [entry, ...arr]);
    return entry;
  };

  const ctoDecideTopup = (id, { amount, comment, decision }) => {
    // decision: 'approve' (forward at requested), 'partial' (forward at partial), 'reject'
    setTopupRequests((arr) =>
      arr.map((r) => {
        if (r.id !== id) return r;
        const at = new Date().toISOString();
        if (decision === "reject") {
          return {
            ...r,
            status: "rejected",
            ctoDecision: { amount: 0, comment, at, decision: "reject" },
            history: [...r.history, { at, actor: `${user?.name || "CTO"} · CTO`, action: "CTO rejected", detail: comment }],
          };
        }
        const finalAmt = Number(amount) || r.amount;
        return {
          ...r,
          status: "pending-cfo",
          ctoDecision: { amount: finalAmt, comment, at, decision: decision === "partial" ? "partial" : "approve" },
          history: [
            ...r.history,
            { at, actor: `${user?.name || "CTO"} · CTO`, action: decision === "partial" ? "CTO partial approval" : "CTO approved", detail: `Forwarded to CFO at $${finalAmt.toLocaleString()}${comment ? ` — ${comment}` : ""}` },
          ],
        };
      })
    );
  };

  const cfoDecideTopup = (id, { amount, comment, decision }) => {
    setTopupRequests((arr) =>
      arr.map((r) => {
        if (r.id !== id) return r;
        const at = new Date().toISOString();
        if (decision === "reject") {
          return {
            ...r,
            status: "rejected",
            cfoDecision: { amount: 0, comment, at, decision: "reject" },
            history: [...r.history, { at, actor: `${user?.name || "CFO"} · CFO`, action: "CFO rejected", detail: comment }],
          };
        }
        const requested = r.ctoDecision?.amount ?? r.amount;
        const finalAmt = Number(amount) || requested;
        const isPartial = decision === "partial" || finalAmt < requested;
        return {
          ...r,
          status: isPartial ? "partial" : "approved",
          cfoDecision: { amount: finalAmt, comment, at, decision: isPartial ? "partial" : "approve" },
          history: [
            ...r.history,
            {
              at,
              actor: `${user?.name || "CFO"} · CFO`,
              action: isPartial ? "CFO partial approval" : "CFO approved",
              detail: `Final: $${finalAmt.toLocaleString()} · added to project baseline${comment ? ` — ${comment}` : ""}`,
            },
          ],
        };
      })
    );
  };

  // ---- Budget submissions (from TPM/R&D Budget Builder) ----
  const submitBudget = (payload) => {
    // payload: { projectId, projectName, budgetType, priority, totalTasks, delivery, phases, items, totals, resubmitOfReviewId? }
    const id = `bud-${Date.now().toString(36)}`;
    const normalizedBudgetType = normalizeBudgetType(payload.budgetType);
    const entry = {
      id,
      ...payload,
      budgetType: normalizedBudgetType,
      submittedBy: user?.name || "TPM",
      submittedRole: user?.role || "TPM",
      submittedAt: new Date().toISOString(),
      status: "submitted",
    };
    setBudgets((arr) => [entry, ...arr]);
    // If this is a resubmission of a returned review, mark it as resubmitted (clears from TPM's returned queue).
    if (payload.resubmitOfReviewId) {
      const now = new Date().toISOString();
      setBudgetReviews((arr) => arr.map((r) => (
        r.id === payload.resubmitOfReviewId
          ? {
              ...r,
              status: "resubmitted",
              history: [...(r.history || []), { at: now, actor: `${user?.name || "TPM"} · ${user?.role || "TPM"}`, action: "Resubmitted with edits", detail: `New total ${payload.totals?.total || 0}` }],
            }
          : r
      )));
    }
    upsertProjectOverride(payload.projectId, (project) => {
      const newPhases = (payload.phases || []).map((ph, idx) => ({
        id: ph.id || `p${idx + 1}`,
        name: ph.name || `Phase ${idx + 1}`,
        dates: `${ph.start || ""} → ${ph.end || ""}`,
        estimated: Number(ph.budget || 0),
        actual: 0,
        health: "healthy",
        totalTasks: Number(ph.tasks || 0),
        trajectoriesPerTask: Number(ph.trajectories || 0),
      }));
      const approved = (payload.phases || []).reduce((s, ph) => s + Number(ph.budget || 0), 0) || payload.totals?.total || 0;
      const additionalMembers = (payload.additionalMembers || []).map((member, index) => buildTeamMember({
        projectId: payload.projectId,
        name: member.name,
        role: member.role,
        fallbackStatus: "Added via budget",
        index: (project.teamMembers || []).length + index,
      }));
      const teamMembers = mergeTeamMembers(project.teamMembers || [], additionalMembers);
      const rndMembers = Array.from(new Set([
        ...(project.rndMembers || []),
        ...additionalMembers.filter((member) => member.role === "R&D").map((member) => member.name),
      ]));
      const plMembers = Array.from(new Set([
        ...(project.plMembers || []),
        ...additionalMembers.filter((member) => member.role === "PL / QL" || member.role === "Project Lead").map((member) => member.name),
      ]));
      const qlMembers = Array.from(new Set([
        ...(project.qlMembers || []),
        ...additionalMembers.filter((member) => member.role === "QL" || member.role === "Quality Lead").map((member) => member.name),
      ]));
      const historyEntry = {
        id,
        projectId: payload.projectId,
        budgetType: normalizedBudgetType,
        total: approved,
        totals: payload.totals,
        totalTasks: Number(payload.totalTasks || 0),
        totalTrajectories: Number(payload.totalTrajectories || 0),
        submittedAt: entry.submittedAt,
        submittedBy: entry.submittedBy,
        status: "submitted",
        items: payload.items,
        phases: payload.phases,
        sourceDeliveryId: payload.sourceDeliveryId || null,
        sampleIteration: payload.sampleIteration || 1,
      };
      const auditEntries = [];
      if (additionalMembers.length) {
        auditEntries.push({
          id: `a-${payload.projectId}-${Date.now().toString(36)}-members`,
          ts: new Date().toISOString(),
          actor: `${user?.name || "TPM"} · ${user?.role || "TPM"}`,
          action: "Members added during budget build",
          detail: additionalMembers.map((member) => `${member.name} (${member.role})`).join(", "),
        });
      }
      auditEntries.push({
        id: `a-${payload.projectId}-${Date.now().toString(36)}-budget`,
        ts: new Date().toISOString(),
        actor: `${user?.name || "TPM"} · ${user?.role || "TPM"}`,
        action: `${formatBudgetTypeLabel(normalizedBudgetType)} budget submitted`,
        detail: `$${approved.toLocaleString()} · ${Number(payload.totalTasks || 0).toLocaleString()} tasks · ${Number(payload.totalTrajectories || 0).toLocaleString()} trajectories`,
      });
      return {
        ...project,
        approvedBudget: approved,
        estimatedBudget: approved,
        remaining: approved,
        phases: newPhases.length ? newPhases : project.phases,
        budgetItems: payload.items,
        teamMembers,
        rndMembers,
        plMembers,
        qlMembers,
        deliveryMode: payload.delivery?.mode,
        totalTasks: Number(payload.totalTasks || project.totalTasks || 0),
        kickoffMail: project.kickoffMail
          ? { ...project.kickoffMail, recipients: mergeTeamMembers(project.kickoffMail.recipients || [], additionalMembers) }
          : project.kickoffMail,
        budgetTrackHistory: [
          historyEntry,
          ...((project.budgetTrackHistory || []).filter((item) => item.id !== id)),
        ],
        lastBudgetSubmission: {
          budgetType: normalizedBudgetType,
          sampleIteration: payload.sampleIteration || 1,
          sourceDeliveryId: payload.sourceDeliveryId || null,
          submittedAt: new Date().toISOString(),
        },
        auditLog: [...auditEntries, ...(project.auditLog || [])],
      };
    });
    return entry;
  };

  // ---- Batch deliveries (TPM "Deliver batch" per phase) ----
  const deliverBatch = ({ projectId, phaseId, phaseName, proposedAmount, clientComment, clientRepresentative, ...details }) => {
    const proj = projects.find((p) => p.id === projectId);
    const id = `bd-${Date.now().toString(36)}`;
    const stage = details.rnd ? "rnd-review" : "cfo-recovery";
    const rndDecision = details.rnd?.decision || null;
    const isRecoverable = details.isRecoverable !== false;
    const status =
      stage === "rnd-review"
        ? rndDecision === "accept"
          ? "sample-approved"
          : rndDecision === "reject"
            ? "sample-rejected"
            : "changes-requested"
        : isRecoverable ? "pending-cfo" : "non-recoverable";
    const deliveredAt = new Date().toISOString();
    const entry = {
      id,
      projectId,
      projectName: proj?.name || projectId,
      client: proj?.client || "—",
      phaseId,
      phaseName: phaseName || phaseId,
      proposedAmount: Number(proposedAmount || 0),
      clientComment: clientComment || "",
      clientRepresentative: clientRepresentative || "",
      deliveredBy: user?.name || "TPM",
      deliveredAt,
      stage,
      isRecoverable,
      sampleIteration: Number(details.sampleIteration || 1),
      status,
      actualRecovered: stage === "cfo-recovery" && !isRecoverable ? 0 : null,
      cfoNote: stage === "cfo-recovery" && !isRecoverable ? "Marked non-recoverable by TPM" : "",
      cfoAt: stage === "cfo-recovery" && !isRecoverable ? deliveredAt : null,
      cfoBy: stage === "cfo-recovery" && !isRecoverable ? user?.name || "TPM" : null,
      history: [
        stage === "rnd-review"
          ? {
              at: deliveredAt,
              actor: `${user?.name || "R&D"} · ${user?.role || "R&D"}`,
              action:
                rndDecision === "accept"
                  ? "Accepted sample delivery"
                  : rndDecision === "reject"
                    ? "Rejected sample delivery"
                    : "Requested changes on sample delivery",
              detail: `${phaseName || phaseId} · ${Number(proposedAmount).toLocaleString()}`,
            }
          : {
              at: deliveredAt,
              actor: `${user?.name || "TPM"} · ${user?.role || "TPM"}`,
              action: isRecoverable ? "Delivered batch to CFO" : "Delivered non-recoverable batch",
              detail: `${phaseName || phaseId} · ${Number(proposedAmount || 0).toLocaleString()}`,
            },
      ],
      ...details,
    };
    setBatchDeliveries((arr) => [entry, ...arr]);
    setPhaseLogApprovalStatus(
      projectId,
      phaseId,
      stage === "rnd-review"
        ? rndDecision === "accept"
          ? "approved"
          : rndDecision === "reject"
            ? "rejected"
            : "changes-requested"
        : isRecoverable ? "pending-cfo" : "approved"
    );
    if (stage === "rnd-review" && rndDecision === "accept") {
      upsertProjectOverride(projectId, (project) => ({
        ...project,
        type: "Production",
        promotedToProductionAt: deliveredAt,
      }));
    }
    return entry;
  };

  const recordActualRecovery = (id, { actualRecovered, cfoNote }) => {
    const target = batchDeliveries.find((delivery) => delivery.id === id);
    const amount = Number(actualRecovered);
    setBatchDeliveries((arr) => arr.map((d) => (
      d.id === id
        ? {
            ...d,
            actualRecovered: amount,
            cfoNote: cfoNote || "",
            cfoAt: new Date().toISOString(),
            cfoBy: user?.name || "CFO",
            status: amount >= d.proposedAmount ? "recovered" : "partial-recovered",
          }
        : d
    )));
    if (target) {
      setPhaseLogApprovalStatus(
        target.projectId,
        target.phaseId,
        amount === 0 ? "rejected" : amount >= target.proposedAmount ? "approved" : "partial"
      );
      const nextDeliveries = batchDeliveries.map((delivery) => (
        delivery.id === id ? { ...delivery, actualRecovered: amount } : delivery
      ));
      const recoveredTotal = nextDeliveries
        .filter((delivery) => delivery.projectId === target.projectId && delivery.stage !== "rnd-review")
        .reduce((sum, delivery) => sum + Number(delivery.actualRecovered || 0), 0);
      setRecoveries((current) => ({ ...current, [target.projectId]: recoveredTotal }));
    }
  };

  // ---- Budget Reviews (CTO edits original TPM ask, forwards to CFO for final decision) ----
  const ctoModifyBudgetReview = ({ reviewId, projectId, projectName, tpm, requestedBudget, modifiedPhases, ctoComment }) => {
    const total = (modifiedPhases || []).reduce((s, ph) => s + Number(ph.infra || 0) + Number(ph.model || 0) + Number(ph.subs || 0), 0);
    const now = new Date().toISOString();
    setBudgetReviews((arr) => {
      const existingIdx = arr.findIndex((r) => r.id === reviewId);
      const base = {
        id: reviewId,
        projectId,
        projectName,
        tpm,
        requestedBudget,
        modifiedPhases,
        modifiedTotal: total,
        ctoComment,
        ctoBy: user?.name || "CTO",
        ctoAt: now,
        status: "forwarded-cfo",
        cfoDecision: null,
        history: [
          { at: now, actor: `${user?.name || "CTO"} · CTO`, action: "Modified & forwarded to CFO", detail: `Total ${total} · ${modifiedPhases.length} phases` },
        ],
      };
      if (existingIdx >= 0) {
        const prev = arr[existingIdx];
        return arr.map((r, i) => (i === existingIdx ? { ...base, history: [...(prev.history || []), base.history[0]] } : r));
      }
      return [base, ...arr];
    });
    return total;
  };

  const ctoRejectBudgetReview = ({ reviewId, projectId, projectName, tpm, requestedBudget, ctoComment }) => {
    const now = new Date().toISOString();
    setBudgetReviews((arr) => {
      const idx = arr.findIndex((r) => r.id === reviewId);
      const entry = {
        id: reviewId,
        projectId,
        projectName,
        tpm,
        requestedBudget,
        modifiedPhases: [],
        modifiedTotal: 0,
        ctoComment,
        ctoBy: user?.name || "CTO",
        ctoAt: now,
        status: "rejected-by-cto",
        cfoDecision: null,
        history: [{ at: now, actor: `${user?.name || "CTO"} · CTO`, action: "CTO rejected", detail: ctoComment || "" }],
      };
      if (idx >= 0) return arr.map((r, i) => (i === idx ? { ...entry, history: [...(arr[idx].history || []), entry.history[0]] } : r));
      return [entry, ...arr];
    });
  };

  // Return budget to TPM/R&D with comments — TPM sees it as an editable, resubmittable draft.
  const ctoReturnBudgetReview = ({ reviewId, projectId, projectName, tpm, requestedBudget, ctoComment, returnTo }) => {
    const now = new Date().toISOString();
    setBudgetReviews((arr) => {
      const idx = arr.findIndex((r) => r.id === reviewId);
      const entry = {
        id: reviewId,
        projectId,
        projectName,
        tpm,
        returnedTo: returnTo || "TPM",
        requestedBudget,
        modifiedPhases: [],
        modifiedTotal: 0,
        ctoComment,
        ctoBy: user?.name || "CTO",
        ctoAt: now,
        status: "returned-to-tpm",
        cfoDecision: null,
        history: [{ at: now, actor: `${user?.name || "CTO"} · CTO`, action: `Returned to ${returnTo || "TPM"} with comments`, detail: ctoComment || "" }],
      };
      if (idx >= 0) return arr.map((r, i) => (i === idx ? { ...entry, history: [...(arr[idx].history || []), entry.history[0]] } : r));
      return [entry, ...arr];
    });
  };

  const cfoDecideBudgetReview = (reviewId, { decision, amount, comment, reviewSeed }) => {
    const at = new Date().toISOString();
    const baseReview = budgetReviews.find((review) => review.id === reviewId)
      || reviewSeed
      || BUDGET_REVIEWS.find((review) => review.id === reviewId);

    if (!baseReview) return null;

    const approvedAmount = Number(
      amount
      || baseReview.modifiedTotal
      || baseReview.recommendedBudget
      || baseReview.requestedBudget
      || 0
    );
    const statusMap = { approve: "approved", partial: "partial", reject: "rejected", return: "returned" };
    const actionLabel = {
      approve: "CFO approved",
      partial: "CFO partial approval",
      reject: "CFO rejected",
      return: "CFO returned for changes",
    }[decision];
    const nextReview = {
      ...baseReview,
      status: statusMap[decision] || "returned",
      cfoDecision: {
        decision,
        amount: approvedAmount,
        comment: comment || "",
        at,
        by: user?.name || "CFO",
      },
      history: [
        ...(baseReview.history || []),
        { at, actor: `${user?.name || "CFO"} · CFO`, action: actionLabel, detail: comment || "" },
      ],
    };

    setBudgetReviews((arr) => {
      const exists = arr.some((review) => review.id === reviewId);
      if (!exists) return [nextReview, ...arr];
      return arr.map((review) => (review.id === reviewId ? nextReview : review));
    });

    if (decision === "approve" || decision === "partial") {
      const project = projects.find((entry) => entry.id === baseReview.projectId);
      const members = mergeTeamMembers(project?.teamMembers || [], project?.kickoffMail?.recipients || []);
      const requestedLines = summarizeRequestedLines(project?.budgetItems || baseReview.items || {}, project);
      const itEntry = {
        id: `it-${reviewId}`,
        sourceReviewId: reviewId,
        sourceType: "budget-review",
        projectId: baseReview.projectId,
        projectName: baseReview.projectName,
        approvedAmount,
        status: "pending-it",
        approvedAt: at,
        approvedBy: user?.name || "CFO",
        approvedRole: user?.role || "CFO",
        budgetType: normalizeBudgetType(project?.lastBudgetSubmission?.budgetType || baseReview.type || "Production"),
        requestedModels: requestedLines.models,
        requestedInfra: requestedLines.infra,
        requestedSubs: requestedLines.subs,
        members,
        note: comment || "",
      };
      setItProvisioningRequests((arr) => [itEntry, ...arr.filter((request) => request.id !== itEntry.id)]);
      upsertProjectOverride(baseReview.projectId, (projectEntry) => ({
        ...projectEntry,
        itProvisioningStatus: "pending-it",
        auditLog: [
          {
            id: `a-${baseReview.projectId}-${Date.now().toString(36)}-it`,
            ts: at,
            actor: `${user?.name || "CFO"} · CFO`,
            action: "Budget approved and routed to IT",
            detail: `${formatBudgetTypeLabel(itEntry.budgetType)} · ${approvedAmount.toLocaleString()} · ${members.length} member${members.length === 1 ? "" : "s"} queued for access`,
          },
          ...(projectEntry.auditLog || []),
        ],
      }));
    }

    return nextReview;
  };

  const ctoDecideChangeRequest = (id, { decision, amount, comment }) => {
    const at = new Date().toISOString();
    setChangeRequests((requests) => requests.map((request) => {
      if (request.id !== id) return request;

      if (decision === "reject") {
        return {
          ...request,
          stage: "Rejected",
          status: "rejected",
          ctoDecision: { decision, amount: 0, comment: comment || "", at, by: user?.name || "CTO" },
          history: [
            ...(request.history || []),
            { at, actor: `${user?.name || "CTO"} · CTO`, action: "CTO rejected", detail: comment || "Rejected" },
          ],
        };
      }

      if (decision === "approve") {
        const finalAmount = Number(amount || request.amount || 0);
        return {
          ...request,
          stage: "Approved",
          status: "approved",
          ctoDecision: { decision, amount: finalAmount, comment: comment || "", at, by: user?.name || "CTO" },
          finalDecision: { actor: "CTO", amount: finalAmount, at, comment: comment || "" },
          history: [
            ...(request.history || []),
            { at, actor: `${user?.name || "CTO"} · CTO`, action: "CTO approved", detail: `Approved at $${finalAmount.toLocaleString()}` },
          ],
        };
      }

      const forwardedAmount = Number(amount || request.amount || 0);
      return {
        ...request,
        stage: "CFO Review",
        status: "pending",
        ctoDecision: { decision: "forward", amount: forwardedAmount, comment: comment || "", at, by: user?.name || "CTO" },
        history: [
          ...(request.history || []),
          { at, actor: `${user?.name || "CTO"} · CTO`, action: "Forwarded to CFO", detail: `Forwarded at $${forwardedAmount.toLocaleString()}${comment ? ` · ${comment}` : ""}` },
        ],
      };
    }));
  };

  const cfoDecideChangeRequest = (id, { decision, amount, comment }) => {
    const at = new Date().toISOString();
    const currentRequest = changeRequests.find((entry) => entry.id === id);
    if (!currentRequest) return null;

    const finalAmount = Number(amount || currentRequest.ctoDecision?.amount || currentRequest.amount || 0);
    const nextStatus = decision === "reject"
      ? "rejected"
      : decision === "partial"
        ? "partial"
        : decision === "return"
          ? "returned"
          : "approved";
    const nextStage = decision === "return"
      ? "CTO Review"
      : nextStatus === "approved" || nextStatus === "partial"
        ? "Approved"
        : "Rejected";
    const nextRequest = {
      ...currentRequest,
      stage: nextStage,
      status: nextStatus,
      cfoDecision: {
        decision,
        amount: decision === "reject" ? 0 : finalAmount,
        comment: comment || "",
        at,
        by: user?.name || "CFO",
      },
      finalDecision: decision === "reject" ? null : { actor: "CFO", amount: finalAmount, at, comment: comment || "" },
      history: [
        ...(currentRequest.history || []),
        {
          at,
          actor: `${user?.name || "CFO"} · CFO`,
          action:
            decision === "partial"
              ? "CFO partial approval"
              : decision === "return"
                ? "Returned to CTO"
                : decision === "reject"
                  ? "CFO rejected"
                  : "CFO approved",
          detail: decision === "reject" ? (comment || "Rejected") : `$${finalAmount.toLocaleString()}${comment ? ` · ${comment}` : ""}`,
        },
      ],
    };

    setChangeRequests((requests) => requests.map((entry) => (
      entry.id === id ? nextRequest : entry
    )));

    if (decision === "approve" || decision === "partial") {
      const project = projects.find((entry) => entry.id === currentRequest.projectId);
      const members = mergeTeamMembers(project?.teamMembers || [], project?.kickoffMail?.recipients || []);
      const requestedModels = currentRequest.breakdown?.models?.amount ? [{
        id: `${currentRequest.id}-model`,
        label: currentRequest.breakdown.models.optionLabel || "Model change",
        provider: "Anthropic",
        amount: Number(currentRequest.breakdown.models.amount || 0),
      }] : [];
      const requestedInfra = currentRequest.breakdown?.infra?.amount ? [{
        id: `${currentRequest.id}-infra`,
        label: currentRequest.breakdown.infra.optionLabel || "Infrastructure change",
        amount: Number(currentRequest.breakdown.infra.amount || 0),
      }] : [];
      const requestedSubs = currentRequest.breakdown?.subs?.amount ? [{
        id: `${currentRequest.id}-subs`,
        label: currentRequest.breakdown.subs.optionLabel || "Subscription change",
        amount: Number(currentRequest.breakdown.subs.amount || 0),
      }] : [];
      const itEntry = {
        id: `it-cr-${currentRequest.id}`,
        sourceReviewId: currentRequest.id,
        sourceType: "change-request",
        projectId: currentRequest.projectId,
        projectName: currentRequest.projectName,
        approvedAmount: finalAmount,
        status: "pending-it",
        approvedAt: at,
        approvedBy: user?.name || "CFO",
        approvedRole: user?.role || "CFO",
        budgetType: normalizeBudgetType(project?.lastBudgetSubmission?.budgetType || project?.type || "Production"),
        requestedModels,
        requestedInfra,
        requestedSubs,
        members,
        note: comment || "",
      };
      setItProvisioningRequests((entries) => [itEntry, ...entries.filter((entry) => entry.id !== itEntry.id)]);
      upsertProjectOverride(currentRequest.projectId, (projectEntry) => ({
        ...projectEntry,
        itProvisioningStatus: "pending-it",
        auditLog: [
          {
            id: `a-${currentRequest.projectId}-${Date.now().toString(36)}-cr`,
            ts: at,
            actor: `${user?.name || "CFO"} · CFO`,
            action: "Change request approved and routed to IT",
            detail: `${currentRequest.type} · $${finalAmount.toLocaleString()}${comment ? ` · ${comment}` : ""}`,
          },
          ...(projectEntry.auditLog || []),
        ],
      }));
    }

    return nextRequest;
  };

  const saveItMonthlyActual = (projectId, payload) => {
    const updatedAt = new Date().toISOString();
    setItMonthlyActuals((entries) => ({
      ...entries,
      [projectId]: {
        ...(entries[projectId] || {}),
        ...payload,
        updatedAt,
        updatedBy: user?.name || "IT",
      },
    }));
    return updatedAt;
  };

  const provisionModelKeys = (requestId, { lines = [], note = "" }) => {
    const request = itProvisioningRequests.find((entry) => entry.id === requestId);
    if (!request) return null;
    const at = new Date().toISOString();
    const project = projects.find((entry) => entry.id === request.projectId);

    const createdKeys = lines
      .filter((line) => line.fullKey && String(line.fullKey).trim())
      .map((line, index) => {
        const teamMembers = request.members.filter((member) => (line.memberIds || []).includes(member.id));
        const fullKey = String(line.fullKey).trim();
        return {
          id: `k-${request.projectId}-${Date.now().toString(36)}-${index + 1}`,
          project: request.projectId,
          projectName: request.projectName,
          provider: line.provider || "Anthropic",
          model: line.label,
          type: request.budgetType === "Production" ? "Production" : "R&D",
          env: line.env || "testing",
          fullKey,
          maskedKey: maskKey(fullKey),
          tags: [request.budgetType.toLowerCase(), line.env || "testing", "it-provisioned"],
          lastUsed: at,
          usage: 0,
          createdBy: user?.name || "IT",
          createdAt: at,
          status: "active",
          members: teamMembers.map((member) => ({
            id: member.id,
            name: member.name,
            role: member.role,
            email: member.email,
          })),
          sourceReviewId: request.sourceReviewId,
        };
      });

    setModelKeyRecords((arr) => [...createdKeys, ...arr]);
    setItProvisioningRequests((arr) => arr.map((entry) => (
      entry.id === requestId
        ? {
            ...entry,
            status: "completed",
            provisionedAt: at,
            provisionedBy: user?.name || "IT",
            note,
            lines: lines.map((line) => ({
              ...line,
              maskedKey: line.fullKey ? maskKey(String(line.fullKey).trim()) : "",
            })),
          }
        : entry
    )));
    if (project) {
      upsertProjectOverride(project.id, (projectEntry) => ({
        ...projectEntry,
        itProvisioningStatus: "completed",
        auditLog: [
          {
            id: `a-${project.id}-${Date.now().toString(36)}-keys`,
            ts: at,
            actor: `${user?.name || "IT"} · ${user?.role || "IT"}`,
            action: "Model keys provisioned",
            detail: `${createdKeys.length} key${createdKeys.length === 1 ? "" : "s"} provisioned${note ? ` · ${note}` : ""}`,
          },
          ...(projectEntry.auditLog || []),
        ],
      }));
    }
    return createdKeys;
  };

  const bufferOverview = useMemo(() => {
    const perProject = projects.map((project) => {
      const allocated = Math.round(Number(project.approvedBudget || 0) * (Number(project.buffer || 0) / 100));
      const seedConsumed = Number(BUFFER.perProject.find((entry) => entry.id === project.id)?.consumed || 0);
      const consumed = Math.min(allocated, Number(bufferPool.projectConsumed?.[project.id] || seedConsumed));
      return {
        id: project.id,
        name: project.name,
        approved: project.approvedBudget,
        allocated,
        consumed,
        status: consumed >= allocated && allocated > 0 ? "critical" : consumed >= allocated * 0.7 ? "using" : "reserved",
      };
    });
    return {
      total: Number(bufferPool.total || 0),
      available: Number(bufferPool.available || 0),
      consumed: Math.max(0, Number(bufferPool.total || 0) - Number(bufferPool.available || 0)),
      policyPct: Number(bufferPool.policyPct || BUFFER.policyPct || 0),
      history: bufferPool.history || [],
      alerts: bufferPool.alerts || [],
      perProject,
    };
  }, [bufferPool, projects]);

  const role = user?.role || null;
  const value = {
    user,
    role,
    isAuth: !!user,
    login,
    logout,
    roles: ROLES,
    aiOpen,
    setAiOpen,
    notifOpen,
    setNotifOpen,
    scope,
    setScope,
    projects,
    visibleProjects,
    bufferOverview,
    teamRemovals,
    removeProjectTeamMember,
    addProjectTeamMembers,
    setBuffer,
    applyBufferAction,
    setRecovery,
    addProject,
    // task logs
    taskLogs,
    getPhaseLogs,
    logPhaseTask,
    updatePhaseTask,
    deletePhaseTask,
    isTaskEditable,
    TASK_EDIT_WINDOW_MS,
    // top-ups
    topupRequests,
    createTopupRequest,
    ctoDecideTopup,
    cfoDecideTopup,
    // budgets & batch deliveries
    budgets,
    submitBudget,
    batchDeliveries,
    deliverBatch,
    recordActualRecovery,
    // CTO budget review modifications
    budgetReviews,
    changeRequests,
    ctoModifyBudgetReview,
    ctoRejectBudgetReview,
    ctoReturnBudgetReview,
    cfoDecideBudgetReview,
    ctoDecideChangeRequest,
    cfoDecideChangeRequest,
    modelKeyRecords,
    itProvisioningRequests,
    provisionModelKeys,
    itMonthlyActuals,
    saveItMonthlyActual,
  };
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useApp = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside AppProvider");
  return ctx;
};
