// Role helpers. R&D team shares the TPM view/permissions but keeps its own identity.
export const isTpmView = (role) => role === "TPM" || role === "R&D";
export const isCfoView = (role) => role === "CFO";
export const isCtoView = (role) => role === "CTO";
