// CFO-specific mock data: contingency buffer, client recovery, cash flow
import { PROJECTS } from "./mockProjects";

// CONTINGENCY BUFFER — hidden from other roles, CFO-only
export const BUFFER = {
  total: 45000, // total pool
  available: 28500,
  consumed: 16500,
  utilizationPct: Math.round((16500 / 45000) * 100),
  policyPct: 8, // % of approved budget reserved as buffer
  perProject: PROJECTS.map((p) => ({
    id: p.id,
    name: p.name,
    approved: p.approvedBudget,
    allocated: Math.round(p.approvedBudget * 0.06),
    consumed: p.utilization >= 100 ? Math.round(p.approvedBudget * 0.04) : p.utilization >= 90 ? Math.round(p.approvedBudget * 0.02) : 0,
    status: p.utilization >= 100 ? "critical" : p.utilization >= 90 ? "using" : "reserved",
  })),
  history: [
    { id: "bh1", date: "2026-06-05", project: "Crowley Generation", action: "Allocated", amount: 2800, by: "Priya Kapoor", reason: "Phase 2 GPU sweep overrun" },
    { id: "bh2", date: "2026-06-09", project: "Vesper Docker", action: "Allocated", amount: 5000, by: "Priya Kapoor", reason: "Client contract locked; over-budget cover" },
    { id: "bh3", date: "2026-06-14", project: "Atlas Ingest", action: "Allocated", amount: 3200, by: "Priya Kapoor", reason: "EC2 spike" },
    { id: "bh4", date: "2026-06-18", project: "Crowley Sourcing", action: "Allocated", amount: 4500, by: "Priya Kapoor", reason: "Extended Claude context testing" },
    { id: "bh5", date: "2026-06-22", project: "Kaiju Eval", action: "Released", amount: 1000, by: "Priya Kapoor", reason: "Phase 1 came in under estimate" },
  ],
  alerts: [
    { id: "ba1", severity: "critical", message: "Vesper Docker consumed 100% of allocated buffer", project: "Vesper Docker" },
    { id: "ba2", severity: "warning", message: "Atlas Ingest at 72% of allocated buffer", project: "Atlas Ingest" },
  ],
};

// CLIENT RECOVERY — recoverable billable spend
export const RECOVERY = {
  total: PROJECTS.filter((p) => p.recoverableFromClient).reduce((s, p) => s + p.actualSpend, 0),
  recovered: PROJECTS.filter((p) => p.recoverableFromClient).reduce((s, p) => s + (p.recoveredAmount || 0), 0),
  outstanding:
    PROJECTS.filter((p) => p.recoverableFromClient).reduce((s, p) => s + p.actualSpend, 0) -
    PROJECTS.filter((p) => p.recoverableFromClient).reduce((s, p) => s + (p.recoveredAmount || 0), 0),
  netCost: PROJECTS.reduce((s, p) => s + p.actualSpend, 0) - PROJECTS.filter((p) => p.recoverableFromClient).reduce((s, p) => s + (p.recoveredAmount || 0), 0),
  byClient: [
    { client: "Acme AI", recoverable: 67400, invoiced: 42000, received: 12200, outstanding: 55200, profitability: 22 },
    { client: "Ironclad", recoverable: 27700, invoiced: 18000, received: 0, outstanding: 27700, profitability: -8 },
    { client: "Voltek", recoverable: 2200, invoiced: 0, received: 0, outstanding: 2200, profitability: 76 },
  ],
  trend: [
    { month: "Jan", recovered: 8000, outstanding: 22000 },
    { month: "Feb", recovered: 12500, outstanding: 24000 },
    { month: "Mar", recovered: 18400, outstanding: 21500 },
    { month: "Apr", recovered: 22800, outstanding: 28000 },
    { month: "May", recovered: 27600, outstanding: 32000 },
    { month: "Jun", recovered: 12200, outstanding: 85100 },
  ],
};

// CASH FLOW forecast (next 6 months, rough)
export const CASH_FLOW = [
  { month: "Jul", inflow: 62000, outflow: 78000, net: -16000, cumulative: -16000 },
  { month: "Aug", inflow: 84000, outflow: 82000, net: 2000, cumulative: -14000 },
  { month: "Sep", inflow: 95000, outflow: 88000, net: 7000, cumulative: -7000 },
  { month: "Oct", inflow: 102000, outflow: 90000, net: 12000, cumulative: 5000 },
  { month: "Nov", inflow: 108000, outflow: 92000, net: 16000, cumulative: 21000 },
  { month: "Dec", inflow: 118000, outflow: 96000, net: 22000, cumulative: 43000 },
];

// DEPARTMENT SPEND (for CFO monitoring)
export const DEPT_SPEND = [
  { dept: "R&D", spend: PROJECTS.filter((p) => p.type === "R&D").reduce((s, p) => s + p.actualSpend, 0), budget: PROJECTS.filter((p) => p.type === "R&D").reduce((s, p) => s + p.approvedBudget, 0) },
  { dept: "Production", spend: PROJECTS.filter((p) => p.type === "Production").reduce((s, p) => s + p.actualSpend, 0), budget: PROJECTS.filter((p) => p.type === "Production").reduce((s, p) => s + p.approvedBudget, 0) },
];

// BUDGET APPROVAL TREND (monthly, for CFO trend chart)
export const APPROVAL_TREND = [
  { month: "Jan", approved: 12, rejected: 2, partial: 3, requested: 17 },
  { month: "Feb", approved: 14, rejected: 1, partial: 5, requested: 20 },
  { month: "Mar", approved: 17, rejected: 3, partial: 4, requested: 24 },
  { month: "Apr", approved: 15, rejected: 2, partial: 6, requested: 23 },
  { month: "May", approved: 19, rejected: 4, partial: 5, requested: 28 },
  { month: "Jun", approved: 22, rejected: 3, partial: 8, requested: 33 },
];
