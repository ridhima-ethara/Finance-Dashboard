// Finance-related mock data: monthly spend, categories, models, infra, subs, approvals, reimbursements
import { PROJECTS } from "./mockProjects";

export const MONTHLY_SPEND = [
  { month: "Jan", budget: 120000, estimated: 118000, actual: 112000 },
  { month: "Feb", budget: 130000, estimated: 128000, actual: 126000 },
  { month: "Mar", budget: 140000, estimated: 138000, actual: 134000 },
  { month: "Apr", budget: 150000, estimated: 148000, actual: 152000 },
  { month: "May", budget: 160000, estimated: 158000, actual: 161000 },
  { month: "Jun", budget: 197000, estimated: 148200, actual: 119800 },
];

export const CATEGORY_BREAKDOWN = [
  { name: "AI Models", value: 47, color: "#7C3AED" },
  { name: "Infrastructure", value: 24, color: "#3B82F6" },
  { name: "Employee", value: 14, color: "#10B981" },
  { name: "Purchase", value: 6, color: "#F59E0B" },
  { name: "Reimbursements", value: 4, color: "#EC4899" },
  { name: "Misc", value: 3, color: "#94A3B8" },
  { name: "Dinner", value: 2, color: "#F97316" },
];

export const MODELS_USAGE = [
  { name: "Opus 4.7", vendor: "Anthropic", budget: 20000, estimated: 17000, actual: 14400 },
  { name: "Gemini 2.5 Pro", vendor: "Google", budget: 15000, estimated: 13000, actual: 11200 },
  { name: "GPT-4o", vendor: "OpenAI", budget: 12000, estimated: 10800, actual: 9800 },
  { name: "Sonnet", vendor: "Anthropic", budget: 8000, estimated: 6900, actual: 6100 },
  { name: "Kimi", vendor: "Moonshot", budget: 4000, estimated: 3600, actual: 2400 },
];

export const INFRA_BY_PROJECT = PROJECTS.slice(0, 6).map((p) => ({
  name: p.name.split(" ")[0],
  EC2: Math.round(p.infrastructureCost * 0.62),
  S3: Math.round(p.infrastructureCost * 0.09),
  RDS: Math.round(p.infrastructureCost * 0.18),
  SES: Math.round(p.infrastructureCost * 0.11),
}));

export const SUBSCRIPTIONS = [
  { id: "s1", name: "Claude Max", price: 200, cadence: "/mo", seats: 8, initials: "CM", color: "#7C3AED", users: ["Aanya Sharma", "Maria Lopez", "Arjun Mehta", "Rahul Verma", "Priya Kapoor", "Sara Chen", "Vikram Kumar", "Nikhil Rao"] },
  { id: "s2", name: "Cursor Pro", price: 60, cadence: "/mo", seats: 6, initials: "CU", color: "#3B82F6", users: ["Aanya Sharma", "Maria Lopez", "Sara Chen", "Rahul Verma", "Arjun Mehta", "Vikram Kumar"] },
  { id: "s3", name: "GitHub Copilot", price: 95, cadence: "/mo", seats: 9, initials: "GH", color: "#0F172A", users: ["Aanya Sharma", "Maria Lopez", "Arjun Mehta", "Rahul Verma", "Priya Kapoor", "Sara Chen", "Vikram Kumar", "Nikhil Rao", "Aanya Sharma"] },
  { id: "s4", name: "ChatGPT", price: 120, cadence: "/mo", seats: 5, initials: "CG", color: "#10B981", users: ["Aanya Sharma", "Rahul Verma", "Sara Chen", "Priya Kapoor", "Arjun Mehta"] },
];

export const NOTIFICATIONS = [
  { id: "n1", type: "danger", title: "Vesper Docker exceeded budget", detail: "Actual $10.6k vs approved $13k · 82% used, forecast overrun.", ts: "2026-06-24T10:14:00Z", read: false },
  { id: "n2", type: "warning", title: "Crowley Sourcing utilization at 86%", detail: "Consider pre-approving a top-up before end of sprint.", ts: "2026-06-24T09:02:00Z", read: false },
  { id: "n3", type: "info", title: "Top-up request pending", detail: "Aanya Sharma requested +$2.5k for Claude context testing.", ts: "2026-06-23T18:22:00Z", read: false },
  { id: "n4", type: "warning", title: "Infrastructure spike detected", detail: "Atlas Ingest EC2 cost up 34% week-over-week.", ts: "2026-06-23T14:41:00Z", read: true },
  { id: "n5", type: "info", title: "Reimbursement approval pending", detail: "3 dinner bills awaiting Finance review.", ts: "2026-06-22T11:18:00Z", read: true },
  { id: "n6", type: "success", title: "Talos on-track", detail: "67% utilization, forecast $2k under budget.", ts: "2026-06-21T09:30:00Z", read: true },
];

export const APPROVALS = [
  { id: "ap1", project: "Crowley Sourcing", requester: "Aanya Sharma", type: "Top-up", amount: 2500, stage: "CTO Review", ts: "2026-06-23T18:22:00Z" },
  { id: "ap2", project: "Vesper Docker", requester: "Aanya Sharma", type: "Top-up", amount: 5000, stage: "COO Approval", ts: "2026-06-23T09:11:00Z" },
  { id: "ap3", project: "Orion Stub", requester: "Vikram Kumar", type: "Budget Request", amount: 12000, stage: "COO Approval", ts: "2026-06-22T15:44:00Z" },
  { id: "ap4", project: "Atlas Ingest", requester: "Arjun Mehta", type: "Budget Modification", amount: 3500, stage: "CTO Review", ts: "2026-06-22T11:03:00Z" },
];

export const REIMBURSEMENTS = [
  { id: "r1", employee: "Aanya Sharma", project: "Crowley Generation", type: "Travel", amount: 420, date: "2026-06-14", approval: "approved", finance: "reimbursed", extra: false, remarks: "Client kickoff · Bengaluru" },
  { id: "r2", employee: "Maria Lopez", project: "Talos", type: "Dinner", amount: 320, date: "2026-06-16", approval: "approved", finance: "processing", extra: false, remarks: "Team offsite dinner" },
  { id: "r3", employee: "Arjun Mehta", project: "Kaiju Eval", type: "Travel", amount: 890, date: "2026-06-18", approval: "pending", finance: "—", extra: true, remarks: "Overage — client site visit" },
  { id: "r4", employee: "Rahul Verma", project: "Crowley Sourcing", type: "Dinner", amount: 240, date: "2026-06-19", approval: "approved", finance: "reimbursed", extra: false, remarks: "Sprint retro dinner" },
  { id: "r5", employee: "Sara Chen", project: "Atlas Ingest", type: "Travel", amount: 1120, date: "2026-06-20", approval: "pending", finance: "—", extra: true, remarks: "Emergency vendor meeting" },
  { id: "r6", employee: "Priya Kapoor", project: "Nimbus QC", type: "Dinner", amount: 180, date: "2026-06-21", approval: "approved", finance: "reimbursed", extra: false, remarks: "QA milestone" },
];

export const AI_INSIGHTS = [
  { id: "ai1", title: "Vesper Docker forecast overrun", body: "Actual burn ($10.6k) already exceeds estimate. At current pace, project will finish 22% over approved budget. Recommend moving eval workloads from Opus 4.8 to Gemini 2.5 Pro (~34% cheaper for the current task mix).", tag: "Overrun risk", tone: "danger" },
  { id: "ai2", title: "Consolidate Cursor Pro seats", body: "Only 4 of 6 Cursor Pro seats have been active this month. Reclaiming 2 seats saves $120/mo across the portfolio.", tag: "Cost optimization", tone: "info" },
  { id: "ai3", title: "Crowley Generation Phase 2 variance", body: "Phase 2 ran $1.1k over estimate (Opus 4.8 inference volumes up 18%). Consider pre-caching frequent prompt prefixes to cut cost by ~9% next sprint.", tag: "Variance explanation", tone: "warning" },
  { id: "ai4", title: "Talos will finish under budget", body: "Trailing 7-day burn is $0.9k/day vs plan of $1.4k/day. High-confidence forecast: $34k final actual vs $46k approved.", tag: "Forecast", tone: "success" },
];
