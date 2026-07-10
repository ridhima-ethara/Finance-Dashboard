import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { USERS, ROLES, PROJECTS } from "../data/mockData";
import { TEAM } from "../data/mockUsers";

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
const TEAM_REMOVALS_KEY = "ethara.teamRemovals.v1";

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
  const [budgets, setBudgets] = useState(() => readJSON(BUDGETS_KEY, []));
  const [batchDeliveries, setBatchDeliveries] = useState(() => readJSON(BATCH_DELIVERIES_KEY, []));
  const [budgetReviews, setBudgetReviews] = useState(() => readJSON(BUDGET_REVIEWS_KEY, []));
  const [teamRemovals, setTeamRemovals] = useState(() => readJSON(TEAM_REMOVALS_KEY, {}));

  useEffect(() => {
    if (user) localStorage.setItem(SESSION_KEY, JSON.stringify(user));
    else localStorage.removeItem(SESSION_KEY);
  }, [user]);
  useEffect(() => localStorage.setItem(BUFFERS_KEY, JSON.stringify(buffers)), [buffers]);
  useEffect(() => localStorage.setItem(RECOVERY_KEY, JSON.stringify(recoveries)), [recoveries]);
  useEffect(() => localStorage.setItem(CUSTOM_PROJECTS_KEY, JSON.stringify(customProjects)), [customProjects]);
  useEffect(() => localStorage.setItem(TASK_LOGS_KEY, JSON.stringify(taskLogs)), [taskLogs]);
  useEffect(() => localStorage.setItem(TOPUP_REQ_KEY, JSON.stringify(topupRequests)), [topupRequests]);
  useEffect(() => localStorage.setItem(BUDGETS_KEY, JSON.stringify(budgets)), [budgets]);
  useEffect(() => localStorage.setItem(BATCH_DELIVERIES_KEY, JSON.stringify(batchDeliveries)), [batchDeliveries]);
  useEffect(() => localStorage.setItem(BUDGET_REVIEWS_KEY, JSON.stringify(budgetReviews)), [budgetReviews]);
  useEffect(() => localStorage.setItem(TEAM_REMOVALS_KEY, JSON.stringify(teamRemovals)), [teamRemovals]);

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
    else if (user.role === "R&D") list = list.filter((p) => (p.rndMembers || []).includes(user.name) || p.rnd === user.name || p.tpm === user.name);
    if (scope === "R&D") list = list.filter((p) => p.type === "R&D");
    else if (scope === "Production") list = list.filter((p) => p.type === "Production");
    return list;
  }, [projects, user, scope]);

  const setBuffer = (projectId, pct) => setBuffers((b) => ({ ...b, [projectId]: Number(pct) }));
  const setRecovery = (projectId, amount) => setRecoveries((r) => ({ ...r, [projectId]: Number(amount) }));
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

  const addProject = (payload) => {
    const id = `p-${Date.now().toString(36)}`;
    const rndMembers = payload.rndMembers || [];
    const allTeamNames = Array.from(new Set([payload.tpm, ...rndMembers].filter(Boolean)));
    const teamMembers = allTeamNames.map((name, index) => {
      const member = TEAM.find((entry) => entry.name === name);
      return {
        id: member?.id || `${id}-tm-${index + 1}`,
        name,
        role: name === payload.tpm ? "TPM" : member?.role || "R&D",
        email: member?.email || `${name.toLowerCase().replace(/\s+/g, ".")}@ethara.ai`,
        status: name === payload.tpm ? "Online" : "Pending kickoff",
        tasksDone: 0,
      };
    });
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
      pl: payload.tpm,
      tpm: payload.tpm,
      rnd: rndMembers[0] || null,
      rndMembers,
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
          detail: `Assigned TPM: ${payload.tpm}${rndMembers.length ? ` · R&D: ${rndMembers.join(", ")}` : ""}. Start ${payload.startDate}${docs.length ? ` · ${docs.length} attachment${docs.length === 1 ? "" : "s"}` : ""}`,
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

  const logPhaseTask = ({ projectId, phaseId, name, assignee, hours, cost, tasksDone, trajectories, date, notes, evidence, approvalStatus }) => {
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
  const createTopupRequest = ({ projectId, phaseId, phaseName, amount, reason, urgency, breakdown }) => {
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
      breakdown: breakdown || null,
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

  // ---- Budget submissions (from TPM/R&D Budget Builder) ----
  const submitBudget = (payload) => {
    // payload: { projectId, projectName, budgetType, priority, totalTasks, delivery, phases, items, totals, resubmitOfReviewId? }
    const id = `bud-${Date.now().toString(36)}`;
    const entry = {
      id,
      ...payload,
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
      return {
        ...project,
        approvedBudget: approved,
        estimatedBudget: approved,
        remaining: approved,
        phases: newPhases.length ? newPhases : project.phases,
        budgetItems: payload.items,
        deliveryMode: payload.delivery?.mode,
        totalTasks: payload.totalTasks,
        lastBudgetSubmission: {
          budgetType: payload.budgetType,
          sampleIteration: payload.sampleIteration || 1,
          sourceDeliveryId: payload.sourceDeliveryId || null,
          submittedAt: new Date().toISOString(),
        },
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
    const status =
      stage === "rnd-review"
        ? rndDecision === "accept"
          ? "sample-approved"
          : rndDecision === "reject"
            ? "sample-rejected"
            : "changes-requested"
        : "pending-cfo";
    const deliveredAt = new Date().toISOString();
    const entry = {
      id,
      projectId,
      projectName: proj?.name || projectId,
      client: proj?.client || "—",
      phaseId,
      phaseName: phaseName || phaseId,
      proposedAmount: Number(proposedAmount),
      clientComment: clientComment || "",
      clientRepresentative: clientRepresentative || "",
      deliveredBy: user?.name || "TPM",
      deliveredAt,
      stage,
      sampleIteration: Number(details.sampleIteration || 1),
      status,
      actualRecovered: null,
      cfoNote: "",
      cfoAt: null,
      cfoBy: null,
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
              action: "Delivered batch to CFO",
              detail: `${phaseName || phaseId} · ${Number(proposedAmount).toLocaleString()}`,
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
        : "pending-cfo"
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

  const cfoDecideBudgetReview = (reviewId, { decision, amount, comment }) => {
    // decision: 'approve' | 'partial' | 'reject' | 'return'
    setBudgetReviews((arr) => arr.map((r) => {
      if (r.id !== reviewId) return r;
      const at = new Date().toISOString();
      const statusMap = { approve: "approved", partial: "partial", reject: "rejected", return: "returned" };
      const actionLabel = {
        approve: "CFO approved",
        partial: "CFO partial approval",
        reject: "CFO rejected",
        return: "CFO returned for changes",
      }[decision];
      return {
        ...r,
        status: statusMap[decision] || "returned",
        cfoDecision: { decision, amount: Number(amount || 0), comment: comment || "", at, by: user?.name || "CFO" },
        history: [...(r.history || []), { at, actor: `${user?.name || "CFO"} · CFO`, action: actionLabel, detail: comment || "" }],
      };
    }));
  };

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
    teamRemovals,
    removeProjectTeamMember,
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
    // budgets & batch deliveries
    budgets,
    submitBudget,
    batchDeliveries,
    deliverBatch,
    recordActualRecovery,
    // CTO budget review modifications
    budgetReviews,
    ctoModifyBudgetReview,
    ctoRejectBudgetReview,
    ctoReturnBudgetReview,
    cfoDecideBudgetReview,
  };
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useApp = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside AppProvider");
  return ctx;
};
