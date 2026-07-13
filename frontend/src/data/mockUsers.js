// Users, roles, clients, and team data
export const CURRENT_USER = {
  id: "u1",
  name: "CTO Admin",
  title: "Technology Admin",
  role: "CTO",
  avatarUrl: "",
};

// Default role accounts for local workspace access.
export const USERS = [
  { id: "u1", name: "CTO Admin", role: "CTO", title: "Chief Technology Officer", email: "cto@ethara.ai", password: "ethara123", avatarUrl: "" },
  { id: "u2", name: "CFO Admin", role: "CFO", title: "Chief Financial Officer", email: "cfo@ethara.ai", password: "ethara123", avatarUrl: "" },
  { id: "u3", name: "TPM Lead", role: "TPM", title: "Technical Program Manager", email: "tpm@ethara.ai", password: "ethara123", avatarUrl: "" },
  { id: "u4", name: "Project Lead", role: "PL", title: "Project Lead", email: "pl@ethara.ai", password: "ethara123", avatarUrl: "" },
  { id: "u5", name: "R&D Lead 1", role: "R&D", title: "R&D Lead", email: "rd@ethara.ai", password: "ethara123", avatarUrl: "" },
  { id: "u6", name: "IT Admin", role: "IT", title: "IT Access Administrator", email: "it@ethara.ai", password: "ethara123", avatarUrl: "" },
];

export const ROLES = ["CTO", "CFO", "TPM", "R&D", "PL", "IT"];

export const TEAM = [
  { id: "u1", name: "CTO Admin", role: "CTO", email: "cto@ethara.ai" },
  { id: "u2", name: "TPM Lead", role: "Project Lead", email: "tpm.lead@ethara.ai" },
  { id: "u3", name: "Project Lead 1", role: "Project Lead", email: "project.lead.1@ethara.ai" },
  { id: "u4", name: "Project Lead 2", role: "Project Lead", email: "project.lead.2@ethara.ai" },
  { id: "u5", name: "Engineer 1", role: "Engineer", email: "engineer.1@ethara.ai" },
  { id: "u6", name: "Finance Lead", role: "Finance", email: "finance@ethara.ai" },
  { id: "u7", name: "Operations Lead", role: "COO", email: "operations@ethara.ai" },
  { id: "u8", name: "Engineer 2", role: "Engineer", email: "engineer.2@ethara.ai" },
  { id: "u9", name: "R&D Lead 1", role: "R&D", email: "rnd.1@ethara.ai" },
  { id: "u10", name: "R&D Lead 2", role: "R&D", email: "rnd.2@ethara.ai" },
  { id: "u11", name: "Quality Lead 1", role: "Quality Lead", email: "quality.1@ethara.ai" },
  { id: "u12", name: "Quality Lead 2", role: "Quality Lead", email: "quality.2@ethara.ai" },
  { id: "u13", name: "IT Admin", role: "IT", email: "it@ethara.ai" },
];

export const CLIENTS = [];
