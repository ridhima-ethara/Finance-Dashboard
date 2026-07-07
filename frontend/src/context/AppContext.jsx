import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { USERS, ROLES } from "../data/mockData";

const AppContext = createContext(null);
const SESSION_KEY = "ethara.session.v1";

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

  useEffect(() => {
    if (user) localStorage.setItem(SESSION_KEY, JSON.stringify(user));
    else localStorage.removeItem(SESSION_KEY);
  }, [user]);

  const login = ({ email, password, role }) => {
    // Quick-login by role
    if (role) {
      const u = USERS.find((x) => x.role === role);
      if (u) {
        const safe = { id: u.id, name: u.name, role: u.role, title: u.title, email: u.email, avatarUrl: u.avatarUrl };
        setUser(safe);
        return { ok: true, user: safe };
      }
      return { ok: false, message: "Role not found" };
    }
    // Email/password login
    const u = USERS.find((x) => x.email.toLowerCase() === email.toLowerCase() && x.password === password);
    if (!u) return { ok: false, message: "Invalid email or password" };
    const safe = { id: u.id, name: u.name, role: u.role, title: u.title, email: u.email, avatarUrl: u.avatarUrl };
    setUser(safe);
    return { ok: true, user: safe };
  };

  const logout = () => setUser(null);

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
    }),
    [user, role, aiOpen, notifOpen, scope]
  );
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useApp = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside AppProvider");
  return ctx;
};
