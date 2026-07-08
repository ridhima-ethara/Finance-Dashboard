import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { USERS, ROLES, PROJECTS } from "../data/mockData";

const AppContext = createContext(null);
const SESSION_KEY = "ethara.session.v1";
const BUFFERS_KEY = "ethara.buffers.v1";
const RECOVERY_KEY = "ethara.recovery.v1";
const CUSTOM_PROJECTS_KEY = "ethara.customProjects.v1";
const TASK_LOGS_KEY = "ethara.taskLogs.v1";
const TOPUP_REQ_KEY = "ethara.topupRequests.v1";

const readJSON = (key, fallback) => {
  try {
    return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
  } catch {
    return fallback;
  }
};

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
  const [recoveries, setRecoveries] = useState(() => readJSON(RECOVERY_KEY, {}));
  const [customProjects, setCustomProjects] = useState(() => readJSON(CUSTOM_PROJECTS_KEY, []));
  const [taskLogs, setTaskLogs] = useState(() => readJSON(TASK_LOGS_KEY, {}));
  const [topupRequests, setTopupRequests] = useState(() => {
    const stored = readJSON(TOPUP_REQ_KEY, null);
    return stored && Array.isArray(stored) ? stored : seedTopupRequests();
  });

  useEffect(() => {
    if (user) localStorage.setItem(SESSION_KEY, JSON.stringify(user));
    else localStorage.removeItem(SESSION_KEY);
  }, [user]);
  useEffect(() => localStorage.setItem(BUFFERS_KEY, JSON.stringify(buffers)), [buffers]);
  useEffect(() => localStorage.setItem(RECOVERY_KEY, JSON.stringify(recoveries)), [recoveries]);
  useEffect(() => localStorage.setItem(CUSTOM_PROJECTS_KEY, JSON.stringify(customProjects)), [customProjects]);
  useEffect(() => localStorage.setItem(TASK_LOGS_KEY, JSON.stringify(taskLogs)), [taskLogs]);
  useEffect(() => localStorage.setItem(TOPUP_REQ_KEY, JSON.stringify(topupRequests)), [topupRequests]);

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

  // Merge overrides + apply approved top-ups (partial or full) into project budgets
  const projects = useMemo(() => {
    const merged = [...PROJECTS, ...customProjects].map((p) => ({
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
    return merged.map((p) => {
      const bonus = finalizedByProject[p.id] || 0;
      if (!bonus) return p;
      return {
        ...p,
        approvedBudget: p.approvedBudget + bonus,
        topupsTotal: (p.topupsTotal || 0) + bonus,
        remaining: p.approvedBudget + bonus - p.actualSpend,
        utilization: Math.round((p.actualSpend / (p.approvedBudget + bonus)) * 100),
      };
    });
  }, [buffers, recoveries, customProjects, topupRequests]);

  const visibleProjects = useMemo(() => {
    if (!user) return [];
    let list = projects;
    if (user.role === "TPM") list = list.filter((p) => p.tpm === user.name);
    else if (user.role === "PL") list = list.filter((p) => p.pl === user.name);
    if (scope === "R&D") list = list.filter((p) => p.type === "R&D");
    else if (scope === "Production") list = list.filter((p) => p.type === "Production");
    return list;
  }, [projects, user, scope]);

  const setBuffer = (projectId, pct) => setBuffers((b) => ({ ...b, [projectId]: Number(pct) }));
  const setRecovery = (projectId, amount) => setRecoveries((r) => ({ ...r, [projectId]: Number(amount) }));

  const addProject = (payload) => {
    const id = `p-${Date.now().toString(36)}`;
    const proj = {
      id,
      name: payload.internalName,
      clientProjectName: payload.clientProjectName,
      client: payload.client || "New Client",
      pl: payload.tpm,
      tpm: payload.tpm,
      startDate: payload.startDate,
      estimatedEndDate: payload.estimatedEndDate,
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
          ts: new Date().toISOString(),
          actor: payload.createdBy || "CTO",
          action: "Project created",
          detail: `Assigned TPM: ${payload.tpm}. Start: ${payload.startDate} · Est. end: ${payload.estimatedEndDate}`,
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

  const logPhaseTask = ({ projectId, phaseId, name, assignee, hours, cost, date, notes, evidence }) => {
    const id = `tl-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const entry = {
      id,
      projectId,
      phaseId,
      name,
      assignee,
      hours: Number(hours) || 0,
      cost: Number(cost) || 0,
      date,
      notes: notes || "",
      evidence: evidence || "",
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
          return { ...t, ...patch, hours: Number(patch.hours ?? t.hours), cost: Number(patch.cost ?? t.cost) };
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

  // ---- Top-up Requests (2-stage: CTO → CFO) ----
  const createTopupRequest = ({ projectId, phaseId, phaseName, amount, reason, urgency }) => {
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
      status: "pending-cto",
      ctoDecision: null,
      cfoDecision: null,
      history: [
        { at: new Date().toISOString(), actor: `${user?.name || "TPM"} · TPM`, action: "Submitted top-up request", detail: `${phaseName || phaseId} · $${Number(amount).toLocaleString()}` },
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

  const role = user?.role || null;
  const value = useMemo(
    () => ({
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
      setBuffer,
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
    }),
    [user, role, aiOpen, notifOpen, scope, projects, visibleProjects, taskLogs, topupRequests]
  );
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useApp = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside AppProvider");
  return ctx;
};
