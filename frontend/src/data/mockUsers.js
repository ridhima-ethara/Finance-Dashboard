// Users, roles, clients, and team data
export const CURRENT_USER = {
  id: "u1",
  name: "Vikram Kumar",
  title: "CTO / Project Lead",
  role: "CTO",
  avatarUrl: "https://images.pexels.com/photos/36645466/pexels-photo-36645466.jpeg",
};

// Auth users - one per role. Password is 'demo123' for all in demo mode.
export const USERS = [
  { id: "u1", name: "Vikram Kumar", role: "CTO", title: "Chief Technology Officer", email: "cto@ethara.ai", password: "demo123", avatarUrl: "https://images.pexels.com/photos/36645466/pexels-photo-36645466.jpeg" },
  { id: "u2", name: "Priya Kapoor", role: "CFO", title: "Chief Financial Officer", email: "cfo@ethara.ai", password: "demo123", avatarUrl: "" },
  { id: "u3", name: "Arjun Mehta", role: "TPM", title: "Technical Program Manager", email: "tpm@ethara.ai", password: "demo123", avatarUrl: "" },
  { id: "u4", name: "Aanya Sharma", role: "PL", title: "Project Lead", email: "pl@ethara.ai", password: "demo123", avatarUrl: "" },
  { id: "u5", name: "Neha Kapoor", role: "R&D", title: "R&D Lead", email: "rd@ethara.ai", password: "demo123", avatarUrl: "" },
];

export const ROLES = ["CTO", "CFO", "TPM", "R&D", "PL"];

export const TEAM = [
  { id: "u1", name: "Vikram Kumar", role: "CTO", email: "vikram@ethara.ai" },
  { id: "u2", name: "Aanya Sharma", role: "Project Lead", email: "aanya@ethara.ai" },
  { id: "u3", name: "Maria Lopez", role: "Project Lead", email: "maria@ethara.ai" },
  { id: "u4", name: "Arjun Mehta", role: "Project Lead", email: "arjun@ethara.ai" },
  { id: "u5", name: "Rahul Verma", role: "Engineer", email: "rahul@ethara.ai" },
  { id: "u6", name: "Priya Kapoor", role: "Finance", email: "priya@ethara.ai" },
  { id: "u7", name: "Nikhil Rao", role: "COO", email: "nikhil@ethara.ai" },
  { id: "u8", name: "Sara Chen", role: "Engineer", email: "sara@ethara.ai" },
  { id: "u9", name: "Neha Kapoor", role: "R&D", email: "neha@ethara.ai" },
  { id: "u10", name: "Dev Patel", role: "R&D", email: "dev@ethara.ai" },
];

export const CLIENTS = ["Acme AI", "Northwind Data", "Helix Bio", "Ironclad", "Meridian", "Voltek"];
