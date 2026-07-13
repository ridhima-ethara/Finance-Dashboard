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
import { buildLoggedDailyRows } from "./projectMetrics";

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

const getProjects = (appData) => appData?.projects || PROJECTS;
const getTaskLogs = (appData) => appData?.taskLogs || {};
const getBatchDeliveries = (appData) => appData?.batchDeliveries || [];
const getItMonthlyActuals = (appData) => appData?.itMonthlyActuals || {};
const getModelKeyRecords = (appData) => appData?.modelKeyRecords || [];

// ---- Per-report data builders ----
const buildBudget = (appData) =>
  getProjects(appData).map((p) => ({
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
    recoveredAmount: p.recoveredAmount || 0,
    bufferPct: p.buffer || 0,
    changeRequestsTotal: p.changeRequestsTotal || 0,
    modelActual: Number(getItMonthlyActuals(appData)[p.id]?.modelActual || 0),
    infraActual: Number(getItMonthlyActuals(appData)[p.id]?.infraActual || 0),
    subsActual: Number(getItMonthlyActuals(appData)[p.id]?.subsActual || 0),
  }));

const buildPhase = (appData) => {
  const rows = [];
  const taskLogs = getTaskLogs(appData);
  getProjects(appData).forEach((p) => {
    (p.phases || []).forEach((ph) => {
      const logs = taskLogs[`${p.id}::${ph.id}`] || [];
      const loggedTasks = logs.reduce((sum, log) => sum + Number(log.tasksDone || 0), 0);
      const loggedTrajectories = logs.reduce((sum, log) => sum + Number(log.trajectories || 0), 0);
      const actualPerTask = loggedTasks > 0 ? Number(ph.actual || 0) / loggedTasks : 0;
      rows.push({
        project: p.name,
        phase: ph.name,
        dates: ph.dates,
        estimated: ph.estimated,
        actual: ph.actual,
        variance: ph.estimated - ph.actual,
        utilizationPct: ph.estimated ? Math.round((ph.actual / ph.estimated) * 100) : 0,
        health: ph.health,
        targetTasks: Number(ph.totalTasks || ph.tasks || 0),
        loggedTasks,
        loggedTrajectories,
        actualPerTask: actualPerTask ? Math.round(actualPerTask * 100) / 100 : 0,
      });
    });
  });
  return rows;
};

const buildExpense = (appData) => {
  const rows = [];
  getProjects(appData).forEach((p) => {
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

const buildVariance = (appData) =>
  getProjects(appData).map((p) => ({
    project: p.name,
    approvedBudget: p.approvedBudget,
    estimatedBudget: p.estimatedBudget,
    actualSpend: p.actualSpend,
    variance: p.variance,
    variancePct: p.approvedBudget ? Math.round(((p.approvedBudget - p.actualSpend) / p.approvedBudget) * 100) : 0,
    forecast: p.forecast,
    health: p.health,
  }));

const buildTask = (appData) => {
  const taskLogs = getTaskLogs(appData);
  const projects = getProjects(appData);
  const rows = [];
  const liveKeys = Object.keys(taskLogs || {});
  if (liveKeys.length) {
    liveKeys.forEach((key) => {
      const [projectId, phaseId] = key.split("::");
      const project = projects.find((entry) => entry.id === projectId);
      (taskLogs[key] || []).forEach((log) => {
        rows.push({
          project: project?.name || projectId,
          phase: phaseId,
          taskId: log.id,
          task: log.name,
          owner: log.assignee || log.createdBy,
          model: Array.isArray(log.modelUsage) && log.modelUsage.length ? log.modelUsage.map((usage) => usage.modelName).join(", ") : (log.modelName || "—"),
          infra: project?.client || "—",
          estCost: Number(log.cost || 0),
          actualCost: Number(log.cost || 0),
          variance: 0,
          status: log.approvalStatus || "logged",
          tasksDone: Number(log.tasksDone || 0),
          trajectories: Number(log.trajectories || 0),
          inputTokens: Number(log.inputTokens || 0),
          outputTokens: Number(log.outputTokens || 0),
        });
      });
    });
    return rows;
  }
  Object.entries(PHASE_TASKS).forEach(([projectId, phases]) => {
    const project = projects.find((p) => p.id === projectId);
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

const buildModel = (appData) => {
  const keyCounts = getModelKeyRecords(appData).reduce((acc, entry) => {
    const key = entry.model;
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  return [
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
    activeKeys: keyCounts[m.model] || 0,
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
    activeKeys: "",
  })),
  ];
};

const buildRecovery = (appData) => [
  ...RECOVERY.byClient.map((c) => ({
    scope: "Client",
    entity: c.client,
    recoverable: c.recoverable,
    invoiced: c.invoiced,
    received: c.received,
    outstanding: c.outstanding,
    profitabilityPct: c.profitability,
  })),
  ...getProjects(appData).filter((p) => p.recoverableFromClient).map((p) => ({
    scope: "Project",
    entity: p.name,
    recoverable: p.actualSpend,
    invoiced: "",
    received: p.recoveredAmount || 0,
    outstanding: p.actualSpend - (p.recoveredAmount || 0),
    profitabilityPct: "",
  })),
  ...getBatchDeliveries(appData).filter((delivery) => delivery.stage !== "rnd-review").map((delivery) => ({
    scope: "Batch",
    entity: `${delivery.projectName} · ${delivery.phaseName}`,
    recoverable: delivery.proposedAmount,
    invoiced: "",
    received: delivery.actualRecovered || 0,
    outstanding: Math.max(0, Number(delivery.proposedAmount || 0) - Number(delivery.actualRecovered || 0)),
    profitabilityPct: "",
  })),
];

const buildDaily = (appData) => {
  const logs = getTaskLogs(appData);
  if (Object.keys(logs || {}).length) {
    return buildLoggedDailyRows(getProjects(appData), logs).map((row) => ({ ...row }));
  }
  return DAILY_CONSUMPTION_LOG.map((row) => ({ ...row }));
};

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

export const getReportRows = (reportId, appData) => {
  const b = REPORT_BUILDERS[reportId];
  return b ? b(appData) : [];
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

export const downloadReportAs = (report, format, appData) => {
  const rows = getReportRows(report.id, appData);
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
