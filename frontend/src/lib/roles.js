// Role helpers. R&D team shares the TPM view/permissions but keeps its own identity.
export const isTpmView = (role) => role === "TPM" || role === "R&D";
export const isCfoView = (role) => role === "CFO";
export const isCtoView = (role) => role === "CTO";

// Display-only nomenclature. Internal role keys ("CTO"/"CFO"/"TPM"/"R&D"/...) are unchanged so
// backend data and permission logic are unaffected — only the label shown to users changes.
export const ROLE_DISPLAY_NAMES = {
  CTO: "L2",
  CFO: "L3",
  TPM: "Projects",
  "R&D": "RL Environment",
  PL: "PL",
  IT: "IT",
  COO: "Leadership",
};
export const roleDisplayName = (role) => ROLE_DISPLAY_NAMES[role] || role || "";
