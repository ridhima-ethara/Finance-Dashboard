import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { USERS, ROLES, PROJECTS } from "../data/mockData";

const AppContext = createContext(null);
const SESSION_KEY = "ethara.session.v1";
const BUFFERS_KEY = "ethara.buffers.v1";
const RECOVERY_KEY = "ethara.recovery.v1";
const CUSTOM_PROJECTS_KEY = "ethara.customProjects.v1";

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
  const [scope, setScope] = useState("all"); // "all" | "R&D" | "Operations"

  // Buffer overrides (Admin/CTO/CFO can edit) — keyed by project id
  const [buffers, setBuffers] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(BUFFERS_KEY) || "{}");
    } catch {
      return {};
    }
  });
  // Recovery overrides (Finance can enter) — keyed by project id
  const [recoveries, setRecoveries] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(RECOVERY_KEY) || "{}");
    } catch {
      return {};
    }
  });
  // CTO-created projects — persisted in localStorage
  const [customProjects, setCustomProjects] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(CUSTOM_PROJECTS_KEY) || "[]");
    } catch {
      return [];
    }
  });

  useEffect(() => {
    if (user) localStorage.setItem(SESSION_KEY, JSON.stringify(user));
    else localStorage.removeItem(SESSION_KEY);
  }, [user]);
  useEffect(() => localStorage.setItem(BUFFERS_KEY, JSON.stringify(buffers)), [buffers]);
  useEffect(() => localStorage.setItem(RECOVERY_KEY, JSON.stringify(recoveries)), [recoveries]);
  useEffect(() => localStorage.setItem(CUSTOM_PROJECTS_KEY, JSON.stringify(customProjects)), [customProjects]);

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

  // Merge overrides into projects — include custom (CTO-created) projects
  const projects = useMemo(
    () =>
      [...PROJECTS, ...customProjects].map((p) => ({
        ...p,
        buffer: buffers[p.id] ?? p.buffer,
        recoveredAmount: recoveries[p.id] ?? p.recoveredAmount,
      })),
    [buffers, recoveries, customProjects]
  );

  // Role + scope-based visibility filter
  const visibleProjects = useMemo(() => {
    if (!user) return [];
    let list = projects;
    if (user.role === "TPM") list = list.filter((p) => p.tpm === user.name);
    else if (user.role === "PL") list = list.filter((p) => p.pl === user.name);
    // scope filter applies to all roles
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
      pl: payload.tpm, // default owner
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
    }),
    [user, role, aiOpen, notifOpen, scope, projects, visibleProjects]
  );
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useApp = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside AppProvider");
  return ctx;
};
