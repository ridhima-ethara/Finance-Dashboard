import { createContext, useContext, useMemo, useState } from "react";
import { CURRENT_USER, ROLES } from "../data/mockData";

const AppContext = createContext(null);

export const AppProvider = ({ children }) => {
  const [role, setRole] = useState(CURRENT_USER.role);
  const [aiOpen, setAiOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

  const value = useMemo(
    () => ({ role, setRole, roles: ROLES, user: CURRENT_USER, aiOpen, setAiOpen, notifOpen, setNotifOpen }),
    [role, aiOpen, notifOpen]
  );
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useApp = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside AppProvider");
  return ctx;
};
