// Report data generators — produce CSV or JSON blobs for each report type using mock data.
// Used by /app/frontend/src/pages/Reports.jsx to make Run/Download actually work.
import { PROJECTS } from "../data/mockProjects";
import {
  AI_COST_BY_MODEL,
  AI_COST_BY_PROVIDER,
  AI_COST_BY_PROJECT,
  DAILY_CONSUMPTION_LOG,
  PHASE_TASKS,
} from "../data/mockTpm";
import { RECOVERY } from "../data/mockCfo";

const escapeCsv = (v) => {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) return `"${s.replace(/"/g, '""')}"`;
  return s;
};

const toCsv = (rows) => {
  if (!rows || rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(",")];
  rows.forEach((row) => {
    lines.push(headers.map((h) => escapeCsv(row[h])).join(","));
  });
  return lines.join("\n");
};

// ---- Per-report data builders ----
const buildBudget = () =>
  PROJECTS.map((p) => ({
    project: p.name,
    client: p.client,
    type: p.type,
    approvedBudget: p.approvedBudget,
    estimatedBudget: p.estimatedBudget,
    actualSpend: p.actualSpend,
    remaining: p.remaining,
    variance: p.variance,
    utilizationPct: p.utilization,
    health: p.health,
    tpm: p.tpm,
  }));

const buildPhase = () => {
  const rows = [];
  PROJECTS.forEach((p) => {
    (p.phases || []).forEach((ph) => {
      rows.push({
        project: p.name,
        phase: ph.name,
        dates: ph.dates,
        estimated: ph.estimated,
        actual: ph.actual,
        variance: ph.estimated - ph.actual,
        utilizationPct: ph.estimated ? Math.round((ph.actual / ph.estimated) * 100) : 0,
        health: ph.health,
      });
    });
  });
  return rows;
};

const buildExpense = () => {
  const rows = [];
  PROJECTS.forEach((p) => {
    (p.expenses || []).forEach((e) => {
      rows.push({
        project: p.name,
        category: e.category,
        item: e.item,
        vendor: e.vendor,
        date: e.date,
        amount: e.amount,
        status: e.status,
        recoverable: e.recoverable ? "Yes" : "No",
      });
    });
  });
  return rows;
};

const buildVariance = () =>
  PROJECTS.map((p) => ({
    project: p.name,
    approvedBudget: p.approvedBudget,
    estimatedBudget: p.estimatedBudget,
    actualSpend: p.actualSpend,
    variance: p.variance,
    variancePct: p.approvedBudget ? Math.round(((p.approvedBudget - p.actualSpend) / p.approvedBudget) * 100) : 0,
    forecast: p.forecast,
    health: p.health,
  }));

const buildTask = () => {
  const rows = [];
  Object.entries(PHASE_TASKS).forEach(([projectId, phases]) => {
    const project = PROJECTS.find((p) => p.id === projectId);
    Object.entries(phases).forEach(([phaseId, tasks]) => {
      tasks.forEach((t) => {
        rows.push({
          project: project?.name || projectId,
          phase: phaseId,
          taskId: t.id,
          task: t.name,
          owner: t.owner,
          model: t.model,
          infra: t.infra,
          estCost: t.estCost,
          actualCost: t.actualCost,
          variance: t.variance,
          status: t.status,
        });
      });
    });
  });
  return rows;
};

const buildModel = () => [
  ...AI_COST_BY_MODEL.map((m) => ({
    scope: "Model",
    name: m.model,
    provider: m.provider,
    today: m.today,
    monthToDate: m.month,
    tokensIn: m.tokensIn,
    tokensOut: m.tokensOut,
    avgCostPer1kIn: m.avgCostPer1kIn,
    avgCostPer1kOut: m.avgCostPer1kOut,
    requests: m.requests,
  })),
  ...AI_COST_BY_PROVIDER.map((p) => ({
    scope: "Provider",
    name: p.provider,
    provider: p.provider,
    today: p.today,
    monthToDate: p.month,
    tokensIn: p.tokens,
    tokensOut: "",
    avgCostPer1kIn: "",
    avgCostPer1kOut: "",
    requests: p.requests,
  })),
];

const buildRecovery = () => [
  ...RECOVERY.byClient.map((c) => ({
    scope: "Client",
    entity: c.client,
    recoverable: c.recoverable,
    invoiced: c.invoiced,
    received: c.received,
    outstanding: c.outstanding,
    profitabilityPct: c.profitability,
  })),
  ...PROJECTS.filter((p) => p.recoverableFromClient).map((p) => ({
    scope: "Project",
    entity: p.name,
    recoverable: p.actualSpend,
    invoiced: "",
    received: p.recoveredAmount || 0,
    outstanding: p.actualSpend - (p.recoveredAmount || 0),
    profitabilityPct: "",
  })),
];

const buildDaily = () => DAILY_CONSUMPTION_LOG.map((r) => ({ ...r }));

const REPORT_BUILDERS = {
  "rpt-budget": buildBudget,
  "rpt-phase": buildPhase,
  "rpt-expense": buildExpense,
  "rpt-variance": buildVariance,
  "rpt-task": buildTask,
  "rpt-model": buildModel,
  "rpt-recovery": buildRecovery,
  "rpt-daily": buildDaily,
};

export const getReportRows = (reportId) => {
  const b = REPORT_BUILDERS[reportId];
  return b ? b() : [];
};

// Trigger a client-side download of a Blob
const downloadBlob = (filename, blob) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export const downloadReportAs = (report, format) => {
  const rows = getReportRows(report.id);
  const stamp = new Date().toISOString().slice(0, 10);
  const safeName = report.name.toLowerCase().replace(/[^a-z0-9]+/g, "_");
  const fmt = (format || "CSV").toUpperCase();
  if (fmt === "JSON") {
    const blob = new Blob([JSON.stringify(rows, null, 2)], { type: "application/json" });
    downloadBlob(`${safeName}_${stamp}.json`, blob);
    return { rows: rows.length, filename: `${safeName}_${stamp}.json` };
  }
  if (fmt === "XLSX" || fmt === "PDF") {
    // XLSX/PDF are placeholders — emit CSV with correct extension for now.
    // Full binary XLSX/PDF requires heavy libs; the CSV payload is compatible with Excel & Numbers.
    const csv = toCsv(rows);
    const ext = fmt.toLowerCase();
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
    downloadBlob(`${safeName}_${stamp}.${ext === "pdf" ? "csv" : ext === "xlsx" ? "csv" : "csv"}`, blob);
    return { rows: rows.length, filename: `${safeName}_${stamp}.csv` };
  }
  // Default CSV
  const csv = toCsv(rows);
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
  downloadBlob(`${safeName}_${stamp}.csv`, blob);
  return { rows: rows.length, filename: `${safeName}_${stamp}.csv` };
};
