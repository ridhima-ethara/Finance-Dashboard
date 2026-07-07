import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { USERS, ROLES, PROJECTS } from "../data/mockData";

const AppContext = createContext(null);
const SESSION_KEY = "ethara.session.v1";
const BUFFERS_KEY = "ethara.buffers.v1";
const RECOVERY_KEY = "ethara.recovery.v1";

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

  useEffect(() => {
    if (user) localStorage.setItem(SESSION_KEY, JSON.stringify(user));
    else localStorage.removeItem(SESSION_KEY);
  }, [user]);
  useEffect(() => localStorage.setItem(BUFFERS_KEY, JSON.stringify(buffers)), [buffers]);
  useEffect(() => localStorage.setItem(RECOVERY_KEY, JSON.stringify(recoveries)), [recoveries]);

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

  // Merge overrides into projects
  const projects = useMemo(
    () =>
      PROJECTS.map((p) => ({
        ...p,
        buffer: buffers[p.id] ?? p.buffer,
        recoveredAmount: recoveries[p.id] ?? p.recoveredAmount,
      })),
    [buffers, recoveries]
  );

  // Role-based visibility filter
  const visibleProjects = useMemo(() => {
    if (!user) return [];
    if (user.role === "TPM") return projects.filter((p) => p.tpm === user.name);
    if (user.role === "PL") return projects.filter((p) => p.pl === user.name);
    return projects; // CTO / CFO see all
  }, [projects, user]);

  const setBuffer = (projectId, pct) => setBuffers((b) => ({ ...b, [projectId]: Number(pct) }));
  const setRecovery = (projectId, amount) => setRecoveries((r) => ({ ...r, [projectId]: Number(amount) }));

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
