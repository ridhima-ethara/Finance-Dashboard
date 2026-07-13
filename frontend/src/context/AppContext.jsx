import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { USERS, ROLES, PROJECTS } from "../data/mockData";
import { TEAM } from "../data/mockUsers";
import { BEDROCK_MODELS } from "../data/mockCatalog";
import { BUFFER } from "../data/mockCfo";
import { formatBudgetTypeLabel, normalizeBudgetType, summarizeItProjectActuals } from "../lib/projectMetrics";

const AppContext = createContext(null);
const SESSION_KEY = "ethara.session.v1";
const BUFFERS_KEY = "ethara.buffers.v2";
const RECOVERY_KEY = "ethara.recovery.v2";
const CUSTOM_PROJECTS_KEY = "ethara.customProjects.v2";
const TASK_LOGS_KEY = "ethara.taskLogs.v2";
const TOPUP_REQ_KEY = "ethara.topupRequests.v2";
const BUDGETS_KEY = "ethara.budgets.v2";
const BATCH_DELIVERIES_KEY = "ethara.batchDeliveries.v2";
const BUDGET_REVIEWS_KEY = "ethara.budgetReviews.v2";
const CHANGE_REQUESTS_KEY = "ethara.changeRequests.v2";
const TEAM_REMOVALS_KEY = "ethara.teamRemovals.v2";
const MODEL_KEYS_KEY = "ethara.modelKeys.v2";
const IT_PROVISIONING_KEY = "ethara.itProvisioning.v2";
const BUFFER_POOL_KEY = "ethara.bufferPool.v2";
const IT_MONTHLY_ACTUALS_KEY = "ethara.itMonthlyActuals.v2";

const readJSON = (key, fallback) => {
  try {
    return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
  } catch {
    return fallback;
  }
};

const maskKey = (full) => `${full.slice(0, 7)}${"•".repeat(18)}${full.slice(-4)}`;
const providerPrefix = {
  Anthropic: "ant",
  Amazon: "amz",
  Meta: "met",
  Mistral: "mis",
  Cohere: "coh",
  AI21: "ai21",
  "Stability AI": "stb",
  OpenAI: "oai",
  Google: "gog",
  xAI: "xai",
};

const buildSyntheticKey = ({ provider, env, seed }) => {
  const prefix = providerPrefix[provider] || "mdl";
  const mode = env === "production" ? "live" : "test";
  const safeSeed = String(seed || "demo").replace(/[^a-z0-9]/gi, "").slice(0, 14) || Math.random().toString(36).slice(2, 10);
  return `sk-${prefix}-${mode}-${safeSeed}${Math.random().toString(36).slice(2, 8)}`;
};

const normalizeMemberRecord = (member, fallbackRole = "Member", fallbackStatus = "Pending kickoff") => ({
  id: member.id,
  name: member.name,
  role: member.role || fallbackRole,
  email: member.email || `${member.name.toLowerCase().replace(/\s+/g, ".")}@ethara.ai`,
  status: member.status || fallbackStatus,
  tasksDone: Number(member.tasksDone || 0),
});

const buildTeamMember = ({ projectId, name, role, fallbackStatus = "Pending kickoff", index = 0 }) => {
  const member = TEAM.find((entry) => entry.name === name);
  return normalizeMemberRecord({
    id: member?.id || `${projectId}-tm-${index + 1}`,
    name,
    role: role || member?.role || "R&D",
    email: member?.email || `${name.toLowerCase().replace(/\s+/g, ".")}@ethara.ai`,
    status: role === "TPM" ? "Online" : fallbackStatus,
  }, role || member?.role || "R&D", fallbackStatus);
};

const mergeTeamMembers = (existing = [], incoming = []) => {
  const merged = new Map();
  [...existing, ...incoming].forEach((member, index) => {
    const key = member.id || member.email || member.name || `member-${index}`;
    if (!merged.has(key)) merged.set(key, normalizeMemberRecord(member));
  });
  return Array.from(merged.values());
};

const summarizeRequestedLines = (items = {}, fallbackProject) => {
  const modelLines = (items.models || []).map((line, index) => {
    const meta = line.meta || BEDROCK_MODELS.find((model) => model.id === line.modelId);
    return {
      id: line.id || `mdl-${index + 1}`,
      modelId: line.modelId || meta?.id || "",
      label: meta?.name || line.modelName || "Model access",
      provider: meta?.provider || line.provider || fallbackProject?.topModel || "Anthropic",
      amount: Number(line.estCost || line.amount || 0),
      usageTag: line.usageTag || "",
    };
  });

  if (!modelLines.length && fallbackProject?.topModel) {
    modelLines.push({
      id: `${fallbackProject.id}-default-model`,
      modelId: "",
      label: fallbackProject.topModel,
      provider: "Anthropic",
      amount: 0,
    });
  }

  return {
    models: modelLines,
    infra: (items.infra || []).map((line, index) => ({
      id: line.id || `inf-${index + 1}`,
      label: line.meta?.code || line.instance || line.optionLabel || "EC2 instance",
      amount: Number(line.estCost || line.amount || 0),
    })),
    subs: (items.subs || []).map((line, index) => ({
      id: line.id || `sub-${index + 1}`,
      label: line.subscription || line.optionLabel || "Subscription",
      amount: Number(line.estCost || line.amount || 0),
    })),
  };
};

const normalizeTaskSheetRow = (row = {}, index = 0, status = "success") => {
  const modelMeta = BEDROCK_MODELS.find((model) => model.id === row.modelId || model.name === row.modelName);
  const inputTokens = Number(row.inputTokens || 0);
  const outputTokens = Number(row.outputTokens || 0);
  return {
    id: row.id || `${status}-${index + 1}`,
    status,
    modelId: row.modelId || modelMeta?.id || "",
    modelName: row.modelName || modelMeta?.name || "",
    task: row.task || row.name || "",
    stage: row.stage || "",
    inputTokens,
    inputTokensM: Number(row.inputTokensM || 0) || (inputTokens / 1000000),
    outputTokens,
    outputTokensM: Number(row.outputTokensM || 0) || (outputTokens / 1000000),
    llmCalls: Number(row.llmCalls || 0),
    cost: Number(row.cost || 0),
  };
};

const normalizeTaskSheetRows = (rows = [], status = "success") =>
  (Array.isArray(rows) ? rows : [])
    .map((row, index) => normalizeTaskSheetRow(row, index, status))
    .filter((row) => (
      row.modelId
      || row.modelName
      || row.task
      || row.stage
      || row.cost
      || row.llmCalls
      || row.inputTokens
      || row.outputTokens
    ));

const aggregateTaskRowsToModelUsage = ({ successfulRows = [], failedRows = [], fallbackUsage = [], fallbackModel = {} }) => {
  const rows = [...successfulRows, ...failedRows];
  if (rows.length) {
    const grouped = rows.reduce((acc, row) => {
      const key = row.modelId || row.modelName || "unmapped";
      acc[key] = acc[key] || {
        modelId: row.modelId || "",
        modelName: row.modelName || "Unspecified model",
        tasksDone: 0,
        cost: 0,
        inputTokens: 0,
        outputTokens: 0,
      };
      acc[key].tasksDone += 1;
      acc[key].cost += Number(row.cost || 0);
      acc[key].inputTokens += Number(row.inputTokens || 0);
      acc[key].outputTokens += Number(row.outputTokens || 0);
      return acc;
    }, {});
    return Object.values(grouped);
  }

  if (Array.isArray(fallbackUsage) && fallbackUsage.length) {
    return fallbackUsage.map((usage) => ({
      modelId: usage.modelId || "",
      modelName: usage.modelName || "",
      tasksDone: Number(usage.tasksDone || 0),
      cost: Number(usage.cost || 0),
      inputTokens: Number(usage.inputTokens || 0),
      outputTokens: Number(usage.outputTokens || 0),
    }));
  }

  if (fallbackModel.modelId || fallbackModel.modelName || fallbackModel.cost) {
    return [{
      modelId: fallbackModel.modelId || "",
      modelName: fallbackModel.modelName || "",
      tasksDone: Number(fallbackModel.tasksDone || 0),
      cost: Number(fallbackModel.cost || 0),
      inputTokens: Number(fallbackModel.inputTokens || 0),
      outputTokens: Number(fallbackModel.outputTokens || 0),
    }];
  }

  return [];
};

const normalizeChangeRequestStatus = (request) => {
  if (request?.status) return request.status;
  if (request?.stage === "Approved") return "approved";
  if (request?.stage === "Rejected") return "rejected";
  return "pending";
};

const normalizeChangeRequest = (request) => ({
  ...request,
  status: normalizeChangeRequestStatus(request),
  history: Array.isArray(request?.history) && request.history.length
    ? request.history
    : [{
        at: request?.createdAt || new Date().toISOString(),
        actor: `${request?.requester || "TPM"} · TPM`,
        action: "Submitted change request",
        detail: `${request?.type || "Change request"} · $${Number(request?.amount || 0).toLocaleString()}`,
      }],
});

const mapPriorityToUrgency = (priority = "") => {
  const value = String(priority).trim().toLowerCase();
  if (value === "critical" || value === "high") return "High";
  if (value === "low") return "Low";
  return "Normal";
};

const cloneLines = (lines = []) => lines.map((line) => ({
  ...line,
  meta: line?.meta ? { ...line.meta } : line?.meta,
  members: Array.isArray(line?.members) ? [...line.members] : line?.members,
}));

const cloneBudgetItems = (items = {}) => ({
  models: cloneLines(items.models || []),
  infra: cloneLines(items.infra || []),
  subs: cloneLines(items.subs || []),
});

const sumBudgetLines = (lines = []) =>
  (Array.isArray(lines) ? lines : []).reduce((sum, line) => sum + Number(line?.estCost || line?.amount || 0), 0);

const sumBudgetItems = (items = {}) =>
  sumBudgetLines(items.models) + sumBudgetLines(items.infra) + sumBudgetLines(items.subs);

const clonePhases = (phases = []) => phases.map((phase) => ({ ...phase }));

const getPendingWorkflowMeta = (budgetType = "") => {
  const normalized = normalizeBudgetType(budgetType);
  if (normalized === "Testing") {
    return { stage: "testing-budget-pending", status: "Testing budget pending approval" };
  }
  if (normalized === "RnD") {
    return { stage: "rnd-budget-pending", status: "R&D budget pending approval" };
  }
  if (normalized === "Rework") {
    return { stage: "rework-budget-pending", status: "Rework budget pending approval" };
  }
  if (normalized === "Production") {
    return { stage: "production-budget-pending", status: "Production budget pending approval" };
  }
  return { stage: "budget-pending", status: "Budget pending approval" };
};

const getApprovedWorkflowMeta = (budgetType = "") => {
  const normalized = normalizeBudgetType(budgetType);
  if (normalized === "Testing") {
    return { stage: "testing-active", status: "Testing budget approved", type: "R&D", readyForTpmBudget: false };
  }
  if (normalized === "RnD") {
    return { stage: "sample-active", status: "R&D budget approved", type: "R&D", readyForTpmBudget: false };
  }
  if (normalized === "Rework") {
    return { stage: "sample-active", status: "Rework budget approved", type: "R&D", readyForTpmBudget: false };
  }
  if (normalized === "Production") {
    return { stage: "production-active", status: "Approved", type: "Production", readyForTpmBudget: false };
  }
  return { stage: "budget-approved", status: "Approved", type: "R&D", readyForTpmBudget: false };
};

const snapshotProjectBudget = (project) => ({
  approvedBudget: Number(project?.approvedBudget || 0),
  estimatedBudget: Number(project?.estimatedBudget || project?.approvedBudget || 0),
  remaining: Number(project?.remaining || 0),
  totalTasks: Number(project?.totalTasks || 0),
  phases: clonePhases(project?.phases || []),
  budgetItems: cloneBudgetItems(project?.budgetItems || {}),
  lastBudgetSubmission: project?.lastBudgetSubmission ? { ...project.lastBudgetSubmission } : null,
  status: project?.status || "Discovery",
  type: project?.type || "R&D",
  workflowStage: project?.workflowStage || null,
  readyForTpmBudget: Boolean(project?.readyForTpmBudget),
  pendingBudgetSubmission: project?.pendingBudgetSubmission ? { ...project.pendingBudgetSubmission } : null,
  promotedToProductionAt: project?.promotedToProductionAt || null,
  itProvisioningStatus: project?.itProvisioningStatus || null,
});

const buildTimelineLabel = (phases = []) => {
  const starts = phases.map((phase) => phase.start).filter(Boolean).sort();
  const ends = phases.map((phase) => phase.end).filter(Boolean).sort();
  if (!starts.length && !ends.length) return "Not scheduled";
  return `${starts[0] || ends[0] || "—"} – ${ends[ends.length - 1] || starts[0] || "—"}`;
};

const buildRequestedPhases = (phases = []) => phases.map((phase) => ({
  id: phase.id || "",
  name: phase.name || "",
  start: phase.start || "",
  end: phase.end || "",
  budget: Number(phase.budget || phase.estimated || 0),
  tasks: Number(phase.tasks || phase.totalTasks || 0),
  trajectories: Number(phase.trajectories || phase.trajectoriesPerTask || 0),
}));

const toPhaseBudgetSource = (review, project) => {
  if (Array.isArray(review?.modifiedPhases) && review.modifiedPhases.length) {
    return review.modifiedPhases.map((phase) => ({
      id: phase.id || "",
      name: phase.name || "",
      budget: Number(phase.total || 0) || Number(phase.infra || 0) + Number(phase.model || 0) + Number(phase.subs || 0),
      start: phase.start || "",
      end: phase.end || "",
      tasks: Number(phase.tasks || phase.totalTasks || 0),
      trajectories: Number(phase.trajectories || phase.trajectoriesPerTask || 0),
    }));
  }
  if (Array.isArray(review?.requestedPhases) && review.requestedPhases.length) {
    return buildRequestedPhases(review.requestedPhases);
  }
  return buildRequestedPhases(project?.phases || []);
};

const scalePhasesToAmount = (phaseSource = [], fallbackPhases = [], approvedAmount = 0) => {
  const source = phaseSource.length ? phaseSource : buildRequestedPhases(fallbackPhases);
  if (!source.length) return [];
  const total = source.reduce((sum, phase) => sum + Number(phase.budget || 0), 0);
  let running = 0;
  return source.map((phase, index) => {
    const baseBudget = Number(phase.budget || 0);
    const scaled =
      index === source.length - 1
        ? Math.max(0, Math.round((approvedAmount - running) * 100) / 100)
        : total > 0
          ? Math.max(0, Math.round(((baseBudget / total) * approvedAmount) * 100) / 100)
          : Math.max(0, Math.round((approvedAmount / source.length) * 100) / 100);
    running += scaled;
    const fallback = fallbackPhases.find((candidate) => candidate.id === phase.id || candidate.name === phase.name) || {};
    return {
      ...fallback,
      id: phase.id || fallback.id || `p${index + 1}`,
      name: phase.name || fallback.name || `Phase ${index + 1}`,
      dates: phase.start || phase.end ? `${phase.start || ""} → ${phase.end || ""}` : (fallback.dates || ""),
      estimated: scaled,
      totalTasks: Number(phase.tasks || fallback.totalTasks || fallback.tasks || 0),
      trajectoriesPerTask: Number(phase.trajectories || fallback.trajectoriesPerTask || fallback.trajectories || 0),
    };
  });
};

const scaleBudgetItemsToAmount = (items = {}, approvedAmount = 0) => {
  const total = sumBudgetItems(items);
  if (total <= 0 || approvedAmount <= 0) return cloneBudgetItems(items);
  const allLines = [
    ...cloneLines(items.models || []).map((line) => ({ bucket: "models", line })),
    ...cloneLines(items.infra || []).map((line) => ({ bucket: "infra", line })),
    ...cloneLines(items.subs || []).map((line) => ({ bucket: "subs", line })),
  ];
  let running = 0;
  const scaledBuckets = { models: [], infra: [], subs: [] };
  allLines.forEach(({ bucket, line }, index) => {
    const sourceValue = Number(line?.estCost || line?.amount || 0);
    const scaled =
      index === allLines.length - 1
        ? Math.max(0, Math.round((approvedAmount - running) * 100) / 100)
        : Math.max(0, Math.round(((sourceValue / total) * approvedAmount) * 100) / 100);
    running += scaled;
    scaledBuckets[bucket].push({
      ...line,
      estCost: scaled,
      amount: scaled,
    });
  });
  return scaledBuckets;
};

const buildBudgetReviewRecord = ({
  reviewId,
  payload,
  project,
  entry,
  baselineSnapshot,
  previousHistory = [],
  actorName,
  actorRole,
}) => {
  const normalizedBudgetType = normalizeBudgetType(payload.budgetType);
  const requestedPhases = buildRequestedPhases(payload.phases || []);
  const reviewTotal = Number(payload.totals?.total || 0);
  const reviewAction = payload.resubmitOfReviewId ? "Resubmitted budget request" : "Submitted budget request";
  return {
    id: reviewId,
    projectId: payload.projectId,
    projectName: payload.projectName || project?.name || payload.projectId,
    client: project?.client || project?.clientProjectName || "—",
    tpm: actorName || project?.tpm || "TPM",
    submittedAt: entry.submittedAt,
    urgency: mapPriorityToUrgency(payload.priority),
    stage: "CTO Review",
    status: "pending-cto",
    type: `${formatBudgetTypeLabel(normalizedBudgetType)} budget`,
    requestedBudget: reviewTotal,
    currentBudget: Number(baselineSnapshot?.approvedBudget || 0),
    recommendedBudget: reviewTotal,
    bufferPct: Number(project?.buffer || 0),
    recoveryType: project?.recoverableFromClient ? "Client-billable" : "Internal",
    timeline: buildTimelineLabel(requestedPhases),
    tasks: Number(payload.totalTasks || 0),
    phases: requestedPhases.length,
    linesFlagged: 0,
    variance: reviewTotal - Number(baselineSnapshot?.approvedBudget || 0),
    aiCost: Number(payload.totals?.models || 0),
    infraCost: Number(payload.totals?.infra || 0),
    subsCost: Number(payload.totals?.subs || 0),
    miscCost: 0,
    justification: `${formatBudgetTypeLabel(normalizedBudgetType)} budget submitted by ${actorName || "team"} · ${Number(payload.totalTasks || 0).toLocaleString()} tasks${Number(payload.totalTrajectories || 0) ? ` · ${Number(payload.totalTrajectories || 0).toLocaleString()} trajectories` : ""}`,
    items: cloneBudgetItems(payload.items || {}),
    requestedPhases,
    baselineSnapshot,
    budgetType: normalizedBudgetType,
    sampleIteration: Number(payload.sampleIteration || 1),
    sourceDeliveryId: payload.sourceDeliveryId || null,
    sourceBudgetId: entry.id,
    requesterRole: actorRole || project?.type || "TPM",
    history: [
      ...previousHistory,
      {
        at: entry.submittedAt,
        actor: `${actorName || "TPM"} · ${actorRole || "TPM"}`,
        action: reviewAction,
        detail: `${formatBudgetTypeLabel(normalizedBudgetType)} · $${reviewTotal.toLocaleString()}`,
      },
    ],
  };
};

const buildProjectBudgetStateFromReview = ({ projectEntry, review, approvedAmount }) => {
  const baselineSnapshot = review?.baselineSnapshot || snapshotProjectBudget(projectEntry);
  const phaseSource = toPhaseBudgetSource(review, projectEntry);
  const scaledPhases = scalePhasesToAmount(phaseSource, baselineSnapshot.phases || projectEntry.phases || [], approvedAmount);
  const scaledItems = scaleBudgetItemsToAmount(review?.items || projectEntry.budgetItems || {}, approvedAmount);
  const workflowMeta = getApprovedWorkflowMeta(review?.budgetType || projectEntry.lastBudgetSubmission?.budgetType || projectEntry.type || "Production");
  return {
    approvedBudget: approvedAmount,
    estimatedBudget: approvedAmount,
    remaining: approvedAmount - Number(projectEntry.actualSpend || 0),
    utilization: approvedAmount > 0 ? Math.round((Number(projectEntry.actualSpend || 0) / approvedAmount) * 100) : 0,
    phases: scaledPhases.length ? scaledPhases : clonePhases(baselineSnapshot.phases || []),
    budgetItems: scaledItems,
    totalTasks: Number(review?.tasks || baselineSnapshot.totalTasks || projectEntry.totalTasks || 0),
    lastBudgetSubmission: {
      ...(projectEntry.lastBudgetSubmission || {}),
      budgetType: review?.budgetType || projectEntry.lastBudgetSubmission?.budgetType || "Budget",
      sampleIteration: Number(review?.sampleIteration || projectEntry.lastBudgetSubmission?.sampleIteration || 1),
      sourceDeliveryId: review?.sourceDeliveryId || projectEntry.lastBudgetSubmission?.sourceDeliveryId || null,
    },
    status: workflowMeta.status,
    type: workflowMeta.type,
    workflowStage: workflowMeta.stage,
    readyForTpmBudget: workflowMeta.readyForTpmBudget,
    pendingBudgetSubmission: null,
    promotedToProductionAt: workflowMeta.type === "Production"
      ? (review?.cfoDecision?.at || review?.submittedAt || new Date().toISOString())
      : projectEntry.promotedToProductionAt || null,
  };
};

const buildProjectBaselineFromSnapshot = (projectEntry, snapshot = null) => {
  if (!snapshot) return projectEntry;
  return {
    ...projectEntry,
    approvedBudget: Number(snapshot.approvedBudget || 0),
    estimatedBudget: Number(snapshot.estimatedBudget || snapshot.approvedBudget || 0),
    remaining: Number(snapshot.remaining || 0),
    utilization: Number(snapshot.approvedBudget || 0) > 0
      ? Math.round((Number(projectEntry.actualSpend || 0) / Number(snapshot.approvedBudget || 0)) * 100)
      : 0,
    phases: clonePhases(snapshot.phases || []),
    budgetItems: cloneBudgetItems(snapshot.budgetItems || {}),
    totalTasks: Number(snapshot.totalTasks || projectEntry.totalTasks || 0),
    lastBudgetSubmission: snapshot.lastBudgetSubmission ? { ...snapshot.lastBudgetSubmission } : projectEntry.lastBudgetSubmission,
    status: snapshot.status || projectEntry.status,
    type: snapshot.type || projectEntry.type,
    workflowStage: snapshot.workflowStage || null,
    readyForTpmBudget: Boolean(snapshot.readyForTpmBudget),
    pendingBudgetSubmission: snapshot.pendingBudgetSubmission ? { ...snapshot.pendingBudgetSubmission } : null,
    promotedToProductionAt: snapshot.promotedToProductionAt || null,
    itProvisioningStatus: snapshot.itProvisioningStatus || null,
  };
};

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
  const [scope, setScope] = useState("all");

  const [buffers, setBuffers] = useState(() => readJSON(BUFFERS_KEY, {}));
  const [bufferPool, setBufferPool] = useState(() => readJSON(BUFFER_POOL_KEY, {
    total: BUFFER.total,
    available: BUFFER.available,
    policyPct: BUFFER.policyPct,
    history: BUFFER.history,
    alerts: BUFFER.alerts,
    projectConsumed: Object.fromEntries(BUFFER.perProject.map((entry) => [entry.id, entry.consumed])),
  }));
  const [recoveries, setRecoveries] = useState(() => readJSON(RECOVERY_KEY, {}));
  const [customProjects, setCustomProjects] = useState(() => readJSON(CUSTOM_PROJECTS_KEY, []));
  const [taskLogs, setTaskLogs] = useState(() => readJSON(TASK_LOGS_KEY, {}));
  const [topupRequests, setTopupRequests] = useState(() => readJSON(TOPUP_REQ_KEY, []));
  const [budgets, setBudgets] = useState(() => readJSON(BUDGETS_KEY, []));
  const [batchDeliveries, setBatchDeliveries] = useState(() => readJSON(BATCH_DELIVERIES_KEY, []));
  const [budgetReviews, setBudgetReviews] = useState(() => readJSON(BUDGET_REVIEWS_KEY, []));
  const [changeRequests, setChangeRequests] = useState(() => readJSON(CHANGE_REQUESTS_KEY, []).map(normalizeChangeRequest));
  const [teamRemovals, setTeamRemovals] = useState(() => readJSON(TEAM_REMOVALS_KEY, {}));
  const [modelKeyRecords, setModelKeyRecords] = useState(() => readJSON(MODEL_KEYS_KEY, []));
  const [itProvisioningRequests, setItProvisioningRequests] = useState(() => readJSON(IT_PROVISIONING_KEY, []));
  const [itMonthlyActuals, setItMonthlyActuals] = useState(() => readJSON(IT_MONTHLY_ACTUALS_KEY, {}));

  useEffect(() => {
    if (user) localStorage.setItem(SESSION_KEY, JSON.stringify(user));
    else localStorage.removeItem(SESSION_KEY);
  }, [user]);
  useEffect(() => localStorage.setItem(BUFFERS_KEY, JSON.stringify(buffers)), [buffers]);
  useEffect(() => localStorage.setItem(BUFFER_POOL_KEY, JSON.stringify(bufferPool)), [bufferPool]);
  useEffect(() => localStorage.setItem(RECOVERY_KEY, JSON.stringify(recoveries)), [recoveries]);
  useEffect(() => localStorage.setItem(CUSTOM_PROJECTS_KEY, JSON.stringify(customProjects)), [customProjects]);
  useEffect(() => localStorage.setItem(TASK_LOGS_KEY, JSON.stringify(taskLogs)), [taskLogs]);
  useEffect(() => localStorage.setItem(TOPUP_REQ_KEY, JSON.stringify(topupRequests)), [topupRequests]);
  useEffect(() => localStorage.setItem(BUDGETS_KEY, JSON.stringify(budgets)), [budgets]);
  useEffect(() => localStorage.setItem(BATCH_DELIVERIES_KEY, JSON.stringify(batchDeliveries)), [batchDeliveries]);
  useEffect(() => localStorage.setItem(BUDGET_REVIEWS_KEY, JSON.stringify(budgetReviews)), [budgetReviews]);
  useEffect(() => localStorage.setItem(CHANGE_REQUESTS_KEY, JSON.stringify(changeRequests)), [changeRequests]);
  useEffect(() => localStorage.setItem(TEAM_REMOVALS_KEY, JSON.stringify(teamRemovals)), [teamRemovals]);
  useEffect(() => localStorage.setItem(MODEL_KEYS_KEY, JSON.stringify(modelKeyRecords)), [modelKeyRecords]);
  useEffect(() => localStorage.setItem(IT_PROVISIONING_KEY, JSON.stringify(itProvisioningRequests)), [itProvisioningRequests]);
  useEffect(() => localStorage.setItem(IT_MONTHLY_ACTUALS_KEY, JSON.stringify(itMonthlyActuals)), [itMonthlyActuals]);

  const login = ({ email, password, role }) => {
    if (role) {
      const u = USERS.find((x) => x.role === role);
      if (u) {
        const safe = { id: u.id, name: u.name, role: u.role, title: u.title, email: u.email, avatarUrl: u.avatarUrl };
        setUser(safe);
        return { ok: true, user: safe };
      }
      return { ok: false, message: "Role not found" };
    }
    const u = USERS.find((x) => x.email.toLowerCase() === email.toLowerCase() && x.password === password);
    if (!u) return { ok: false, message: "Invalid email or password" };
    const safe = { id: u.id, name: u.name, role: u.role, title: u.title, email: u.email, avatarUrl: u.avatarUrl };
    setUser(safe);
    return { ok: true, user: safe };
  };
  const logout = () => setUser(null);

  // Merge overrides + apply approved top-ups / change requests into project budgets
  const projects = useMemo(() => {
    const baseIds = new Set(PROJECTS.map((project) => project.id));
    const overrides = new Map(customProjects.map((project) => [project.id, project]));
    const merged = [
      ...PROJECTS.map((project) => ({ ...project, ...(overrides.get(project.id) || {}) })),
      ...customProjects.filter((project) => !baseIds.has(project.id)),
    ].map((p) => ({
      ...p,
      buffer: buffers[p.id] ?? p.buffer,
      recoveredAmount: recoveries[p.id] ?? p.recoveredAmount,
    }));
    // Sum finalized top-ups per project (only approved / partial with cfoDecision)
    const finalizedByProject = {};
    topupRequests.forEach((r) => {
      if ((r.status === "approved" || r.status === "partial") && r.cfoDecision?.amount) {
        finalizedByProject[r.projectId] = (finalizedByProject[r.projectId] || 0) + r.cfoDecision.amount;
      }
    });
    const finalizedChangesByProject = {};
    changeRequests.forEach((request) => {
      const finalAmount = Number(
        request.finalDecision?.amount
        ?? request.cfoDecision?.amount
        ?? request.ctoDecision?.amount
        ?? request.amount
        ?? 0
      );
      if ((request.stage === "Approved" || request.status === "approved" || request.status === "partial") && finalAmount) {
        finalizedChangesByProject[request.projectId] = (finalizedChangesByProject[request.projectId] || 0) + finalAmount;
      }
    });
    const recoveryByProject = {};
    const recoveryWindows = {};
    batchDeliveries
      .filter((delivery) => delivery.stage !== "rnd-review")
      .forEach((delivery) => {
        const actual = Number(delivery.actualRecovered || 0);
        const proposed = Number(delivery.proposedAmount || 0);
        recoveryByProject[delivery.projectId] = (recoveryByProject[delivery.projectId] || 0) + actual;
        if (!proposed) return;
        const current = recoveryWindows[delivery.projectId] || { proposed: 0, actual: 0 };
        recoveryWindows[delivery.projectId] = {
          proposed: current.proposed + proposed,
          actual: current.actual + actual,
        };
      });
    return merged.map((p) => {
      const topupBonus = finalizedByProject[p.id] || 0;
      const changeBonus = finalizedChangesByProject[p.id] || 0;
      const approvedBudget = p.approvedBudget + topupBonus + changeBonus;
      const recoveredAmount = recoveries[p.id] ?? recoveryByProject[p.id] ?? p.recoveredAmount;
      const itActuals = summarizeItProjectActuals(itMonthlyActuals[p.id] || {});
      const hasItActuals = itActuals.totalActual > 0 || itActuals.dailyActuals.length > 0 || itActuals.modelUsage.length > 0 || itActuals.monthEndActual > 0;
      const cfoActualSpend = hasItActuals
        ? (itActuals.monthEndActual > 0 ? itActuals.monthEndActual : itActuals.totalActual)
        : Number(p.actualSpend || 0);
      const cfoRemaining = approvedBudget - cfoActualSpend;
      const cfoUtilization = approvedBudget > 0 ? Math.round((cfoActualSpend / approvedBudget) * 100) : 0;
      const cfoVariance = approvedBudget - cfoActualSpend;
      const cfoBurnRate = itActuals.runRate > 0 ? itActuals.runRate : Number(p.burnRate || 0) * 1000;
      let nextHealth = p.health;
      const recoveryWindow = recoveryWindows[p.id];
      if (recoveryWindow?.proposed > 0) {
        const recoveryRatio = recoveryWindow.actual / recoveryWindow.proposed;
        if (recoveryRatio < 0.6) nextHealth = "over";
        else if (recoveryRatio < 0.9 && nextHealth === "healthy") nextHealth = "watch";
      }
      return {
        ...p,
        approvedBudget,
        recoveredAmount,
        health: nextHealth,
        topupsTotal: (p.topupsTotal || 0) + topupBonus,
        changeRequestsTotal: (p.changeRequestsTotal || 0) + changeBonus,
        remaining: approvedBudget - p.actualSpend,
        utilization: approvedBudget > 0 ? Math.round((p.actualSpend / approvedBudget) * 100) : 0,
        itActuals,
        cfoActualSpend,
        cfoRemaining,
        cfoUtilization,
        cfoVariance,
        cfoBurnRate,
        cfoTopModel: itActuals.modelUsage[0]?.modelName || p.topModel || "—",
      };
    });
  }, [buffers, recoveries, customProjects, topupRequests, changeRequests, batchDeliveries, itMonthlyActuals]);

  const visibleProjects = useMemo(() => {
    if (!user) return [];
    let list = projects;
    if (user.role === "TPM") {
      list = list.filter((p) =>
        p.tpm === user.name
        || p.createdBy === user.name
        || (p.teamMembers || []).some((member) => member.name === user.name && member.role === "TPM")
      );
    } else if (user.role === "PL") {
      list = list.filter((p) =>
        p.pl === user.name
        || (p.plMembers || []).includes(user.name)
        || (p.qlMembers || []).includes(user.name)
        || (p.teamMembers || []).some((member) => member.name === user.name && (member.role === "PL / QL" || member.role === "Project Lead" || member.role === "QL" || member.role === "Quality Lead"))
      );
    } else if (user.role === "R&D") {
      list = list.filter((p) =>
        p.createdBy === user.name
        || (p.rndMembers || []).includes(user.name)
        || p.rnd === user.name
        || (p.teamMembers || []).some((member) => member.name === user.name)
      );
    }
    if (scope === "R&D") list = list.filter((p) => p.type === "R&D");
    else if (scope === "Production") list = list.filter((p) => p.type === "Production");
    return list;
  }, [projects, user, scope]);

  const setBuffer = (projectId, pct) => setBuffers((b) => ({ ...b, [projectId]: Number(pct) }));
  const setRecovery = (projectId, amount) => setRecoveries((r) => ({ ...r, [projectId]: Number(amount) }));
  const applyBufferAction = ({ projectId, pct, action }) => {
    const numericPct = Number(pct || 0);
    const at = new Date().toISOString();
    const project = projects.find((entry) => entry.id === projectId);

    if (!numericPct || Number.isNaN(numericPct)) return null;

    if (action === "increase-pool" || action === "reduce-pool") {
      const poolAmount = Math.round(((bufferPool.total || 0) * numericPct) / 100);
      setBufferPool((current) => ({
        ...current,
        total: action === "increase-pool" ? current.total + poolAmount : Math.max(poolAmount, current.total - poolAmount),
        available: action === "increase-pool"
          ? current.available + poolAmount
          : Math.max(0, current.available - poolAmount),
        history: [
          {
            id: `bh-${Date.now().toString(36)}`,
            date: at,
            project: "Pool",
            action: action === "increase-pool" ? "Pool increased" : "Pool reduced",
            amount: poolAmount,
            by: user?.name || "CFO",
            reason: `${numericPct}% action`,
          },
          ...(current.history || []),
        ],
      }));
      return poolAmount;
    }

    if (!project) return null;

    const projectAmount = Math.round((project.approvedBudget * numericPct) / 100);
    const currentPct = Number(buffers[projectId] ?? project.buffer ?? 0);
    const nextPct = action === "allocate-project"
      ? currentPct + numericPct
      : Math.max(0, currentPct - numericPct);

    setBuffers((current) => ({ ...current, [projectId]: nextPct }));
    setBufferPool((current) => ({
      ...current,
      available: action === "allocate-project"
        ? Math.max(0, current.available - projectAmount)
        : current.available + projectAmount,
      history: [
        {
          id: `bh-${Date.now().toString(36)}`,
          date: at,
          project: project.name,
          action: action === "allocate-project" ? "Allocated" : "Released",
          amount: projectAmount,
          by: user?.name || "CFO",
          reason: `${numericPct}% of approved budget`,
        },
        ...(current.history || []),
      ],
    }));

    return { projectAmount, nextPct };
  };
  const removeProjectTeamMember = (projectId, memberId) =>
    setTeamRemovals((prev) => ({
      ...prev,
      [projectId]: Array.from(new Set([...(prev[projectId] || []), memberId])),
    }));
  const upsertProjectOverride = (projectId, updater) =>
    setCustomProjects((current) => {
      const existing = current.find((project) => project.id === projectId);
      const base = existing || projects.find((project) => project.id === projectId);
      if (!base) return current;
      const updated = { ...updater(base), __custom: true };
      return [updated, ...current.filter((project) => project.id !== projectId)];
    });

  const addProjectTeamMembers = (projectId, members = [], source = "Budget Builder") => {
    if (!members.length) return;
    upsertProjectOverride(projectId, (project) => {
      const incoming = members.map((member, index) => buildTeamMember({
        projectId,
        name: member.name,
        role: member.role,
        fallbackStatus: "Added later",
        index: (project.teamMembers || []).length + index,
      }));
      const teamMembers = mergeTeamMembers(project.teamMembers || [], incoming);
      const rndMembers = Array.from(new Set([
        ...(project.rndMembers || []),
        ...incoming.filter((member) => member.role === "R&D").map((member) => member.name),
      ]));
      const plMembers = Array.from(new Set([
        ...(project.plMembers || []),
        ...incoming.filter((member) => member.role === "PL / QL" || member.role === "Project Lead").map((member) => member.name),
      ]));
      const qlMembers = Array.from(new Set([
        ...(project.qlMembers || []),
        ...incoming.filter((member) => member.role === "QL" || member.role === "Quality Lead").map((member) => member.name),
      ]));
      const auditEntry = {
        id: `a-${projectId}-${Date.now().toString(36)}`,
        ts: new Date().toISOString(),
        actor: `${user?.name || "System"} · ${user?.role || "System"}`,
        action: "Project members updated",
        detail: `${source} added ${incoming.map((member) => `${member.name} (${member.role})`).join(", ")}`,
      };
      const kickoffRecipients = mergeTeamMembers(project.kickoffMail?.recipients || [], incoming);
      return {
        ...project,
        teamMembers,
        rndMembers,
        plMembers,
        qlMembers,
        kickoffMail: project.kickoffMail
          ? { ...project.kickoffMail, recipients: kickoffRecipients }
          : project.kickoffMail,
        auditLog: [auditEntry, ...(project.auditLog || [])],
      };
    });
  };

  const addProject = (payload) => {
    const id = `p-${Date.now().toString(36)}`;
    const isTpmCreatedProject = String(payload.createdByRole || "").trim().toUpperCase() === "TPM";
    const rndMembers = payload.rndMembers || [];
    const plMembers = payload.plMembers || [];
    const qlMembers = payload.qlMembers || [];
    const allMembers = [
      payload.tpm ? { name: payload.tpm, role: "TPM", status: "Online" } : null,
      ...plMembers.map((name) => ({ name, role: "PL / QL" })),
      ...qlMembers.map((name) => ({ name, role: "QL" })),
      ...rndMembers.map((name) => ({ name, role: "R&D" })),
    ].filter(Boolean);
    const teamMembers = mergeTeamMembers(
      [],
      allMembers.map((member, index) => buildTeamMember({
        projectId: id,
        name: member.name,
        role: member.role,
        fallbackStatus: member.status || "Pending kickoff",
        index,
      }))
    );
    const docs = [
      ...(payload.docUrl
        ? [{
            id: `${id}-doc-link`,
            name: "Project brief link",
            url: payload.docUrl,
            kind: "link",
          }]
        : []),
      ...((payload.attachments || []).map((attachment, index) => ({
        id: attachment.id || `${id}-doc-${index + 1}`,
        name: attachment.name,
        size: attachment.size || 0,
        type: attachment.type || "application/octet-stream",
        kind: "file",
      }))),
    ];
    const kickoffAt = new Date().toISOString();
    const kickoffMail = {
      sentAt: kickoffAt,
      subject: `${payload.internalName} kickoff`,
      sentBy: payload.createdBy || "CTO",
      sentByRole: payload.createdByRole || "CTO",
      recipients: teamMembers.map((member) => ({
        id: member.id,
        name: member.name,
        role: member.role,
        email: member.email,
      })),
      attachmentCount: docs.length,
    };
    const initialWorkflow = isTpmCreatedProject
      ? {
          status: "Ready for production budget",
          type: "Production",
          workflowStage: "tpm-budget-ready",
          readyForTpmBudget: true,
        }
      : {
          status: "Awaiting testing budget",
          type: "R&D",
          workflowStage: "awaiting-testing-budget",
          readyForTpmBudget: false,
        };
    const proj = {
      id,
      name: payload.internalName,
      clientProjectName: payload.clientProjectName,
      client: payload.clientProjectName || "New Engagement",
      createdBy: payload.createdBy || "CTO",
      createdByRole: payload.createdByRole || "CTO",
      pl: plMembers[0] || payload.tpm,
      tpm: payload.tpm,
      rnd: rndMembers[0] || null,
      rndMembers,
      plMembers,
      qlMembers,
      docUrl: payload.docUrl || "",
      docs,
      teamMembers,
      kickoffMail,
      startDate: payload.startDate,
      estimatedEndDate: "",
      status: initialWorkflow.status,
      type: initialWorkflow.type,
      workflowStage: initialWorkflow.workflowStage,
      readyForTpmBudget: initialWorkflow.readyForTpmBudget,
      pendingBudgetSubmission: null,
      buffer: 10,
      recoverableFromClient: false,
      recoveredAmount: 0,
      approvedBudget: 0,
      estimatedBudget: 0,
      actualSpend: 0,
      remaining: 0,
      variance: 0,
      utilization: 0,
      burnRate: 0,
      forecast: 0,
      infrastructureCost: 0,
      aiModelCost: 0,
      employeeCost: 0,
      purchaseCost: 0,
      reimbursements: 0,
      dinnerExpenses: 0,
      miscExpenses: 0,
      topupsTotal: 0,
      health: "healthy",
      topModel: "—",
      phases: [],
      budgetItems: { models: [], infra: [], subs: [] },
      expenses: [],
      budgetHistory: [],
      topupHistory: [],
      budgetTrackHistory: [],
      auditLog: [
        {
          id: `a-${id}-1`,
          ts: kickoffAt,
          actor: payload.createdBy || "CTO",
          action: "Project created",
          detail: `Assigned TPM: ${payload.tpm}${plMembers.length ? ` · PL/QL: ${plMembers.join(", ")}` : ""}${qlMembers.length ? ` · QL: ${qlMembers.join(", ")}` : ""}${rndMembers.length ? ` · R&D: ${rndMembers.join(", ")}` : ""}. Start ${payload.startDate}${docs.length ? ` · ${docs.length} attachment${docs.length === 1 ? "" : "s"}` : ""}`,
        },
        {
          id: `a-${id}-2`,
          ts: kickoffAt,
          actor: `${payload.createdBy || "CTO"} · ${payload.createdByRole || "CTO"}`,
          action: "Kickoff mail sent",
          detail: `${teamMembers.length} recipient${teamMembers.length === 1 ? "" : "s"} · ${teamMembers.map((member) => member.email).join(", ")}`,
        },
      ],
      comments: [],
      __custom: true,
    };
    setCustomProjects((arr) => [proj, ...arr]);
    return proj;
  };

  // Demo helper — seed a fully-assembled project already at "Ready for TPM production budget".
  // Skips the R&D testing → RnD budget → deliver-accept loop for stakeholder demos.
  const seedDemoProject = () => {
    const stamp = new Date();
    const seq = customProjects.filter((p) => p.__demoSeed).length + 1;
    const startDate = stamp.toISOString().slice(0, 10);
    const payload = {
      clientProjectName: `Demo Client Engagement ${seq}`,
      internalName: `Demo Project ${seq}`,
      tpm: "TPM Lead",
      rndMembers: ["R&D Lead 1"],
      plMembers: ["Project Lead 1"],
      qlMembers: ["Quality Lead 1"],
      docUrl: "",
      docs: [],
      attachments: [],
      startDate,
      priority: "medium",
      createdBy: user?.name || "CTO Admin",
      createdByRole: user?.role || "CTO",
    };
    const proj = addProject(payload);
    const at = stamp.toISOString();
    setCustomProjects((arr) => arr.map((p) => (p.id !== proj.id ? p : {
      ...p,
      __demoSeed: true,
      type: "R&D",
      status: "Ready for TPM production budget",
      workflowStage: "tpm-budget-ready",
      readyForTpmBudget: true,
      auditLog: [
        ...(p.auditLog || []),
        { id: `a-${p.id}-seed-1`, ts: at, actor: "System · Demo Seed", action: "Testing budget approved", detail: "Simulated — R&D testing budget auto-approved via demo seed" },
        { id: `a-${p.id}-seed-2`, ts: at, actor: "System · Demo Seed", action: "R&D sample budget approved", detail: "Simulated — RnD budget auto-approved via demo seed" },
        { id: `a-${p.id}-seed-3`, ts: at, actor: "System · Demo Seed", action: "R&D delivery accepted", detail: "Simulated — R&D marked delivery as Accept; project promoted to production-ready" },
      ],
    })));
    return proj;
  };

  // ---- Phase Task Logs (TPM) ----
  const TASK_EDIT_WINDOW_MS = 24 * 60 * 60 * 1000; // 24h
  const taskKey = (pid, phId) => `${pid}::${phId}`;

  const isTaskEditable = (log) => Date.now() - new Date(log.createdAt).getTime() < TASK_EDIT_WINDOW_MS;

  const logPhaseTask = ({
    projectId,
    phaseId,
    name,
    assignee,
    hours,
    cost,
    tasksDone,
    trajectories,
    date,
    notes,
    evidence,
    approvalStatus,
    modelId,
    modelName,
    inputTokens,
    outputTokens,
    modelUsage,
    successfulTasks,
    failedTasks,
    successTrajectories,
    failedTrajectories,
    successfulRows,
    failedRows,
  }) => {
    const id = `tl-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const normalizedSuccessfulRows = normalizeTaskSheetRows(successfulRows, "success");
    const normalizedFailedRows = normalizeTaskSheetRows(failedRows, "failed");
    const normalizedModelUsage = aggregateTaskRowsToModelUsage({
      successfulRows: normalizedSuccessfulRows,
      failedRows: normalizedFailedRows,
      fallbackUsage: modelUsage,
      fallbackModel: {
        modelId,
        modelName,
        cost,
        tasksDone,
        inputTokens,
        outputTokens,
      },
    });
    const totalCost = normalizedModelUsage.length
      ? normalizedModelUsage.reduce((sum, usage) => sum + Number(usage.cost || 0), 0)
      : Number(cost) || 0;
    const totalInputTokens = normalizedModelUsage.length
      ? normalizedModelUsage.reduce((sum, usage) => sum + Number(usage.inputTokens || 0), 0)
      : Number(inputTokens || 0);
    const totalOutputTokens = normalizedModelUsage.length
      ? normalizedModelUsage.reduce((sum, usage) => sum + Number(usage.outputTokens || 0), 0)
      : Number(outputTokens || 0);
    const entry = {
      id,
      projectId,
      phaseId,
      name,
      assignee,
      hours: Number(hours) || 0,
      cost: totalCost,
      tasksDone: Number(successfulTasks ?? tasksDone) || 0,
      successfulTasks: Number(successfulTasks ?? tasksDone) || 0,
      failedTasks: Number(failedTasks || 0),
      trajectories: Number(successTrajectories ?? trajectories) || 0,
      successTrajectories: Number(successTrajectories ?? trajectories) || 0,
      failedTrajectories: Number(failedTrajectories || 0),
      approvalStatus: approvalStatus || "logged",
      date,
      notes: notes || "",
      evidence: evidence || "",
      modelId: modelId || "",
      modelName: modelName || "",
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
      successfulRows: normalizedSuccessfulRows,
      failedRows: normalizedFailedRows,
      modelUsage: normalizedModelUsage,
      createdAt: new Date().toISOString(),
      createdBy: user?.name || "TPM",
    };
    setTaskLogs((prev) => {
      const key = taskKey(projectId, phaseId);
      const list = prev[key] || [];
      return { ...prev, [key]: [entry, ...list] };
    });
    return entry;
  };

  const updatePhaseTask = (projectId, phaseId, logId, patch) => {
    setTaskLogs((prev) => {
      const key = taskKey(projectId, phaseId);
      const list = prev[key] || [];
      return {
        ...prev,
        [key]: list.map((t) => {
          if (t.id !== logId) return t;
          if (!isTaskEditable(t)) return t;
          const normalizedSuccessfulRows = Array.isArray(patch.successfulRows)
            ? normalizeTaskSheetRows(patch.successfulRows, "success")
            : (t.successfulRows || []);
          const normalizedFailedRows = Array.isArray(patch.failedRows)
            ? normalizeTaskSheetRows(patch.failedRows, "failed")
            : (t.failedRows || []);
          const normalizedModelUsage = aggregateTaskRowsToModelUsage({
            successfulRows: normalizedSuccessfulRows,
            failedRows: normalizedFailedRows,
            fallbackUsage: Array.isArray(patch.modelUsage) ? patch.modelUsage : t.modelUsage,
            fallbackModel: {
              modelId: patch.modelId ?? t.modelId,
              modelName: patch.modelName ?? t.modelName,
              cost: patch.cost ?? t.cost,
              tasksDone: patch.tasksDone ?? t.tasksDone,
              inputTokens: patch.inputTokens ?? t.inputTokens,
              outputTokens: patch.outputTokens ?? t.outputTokens,
            },
          });
          const totalCost = normalizedModelUsage.length
            ? normalizedModelUsage.reduce((sum, usage) => sum + Number(usage.cost || 0), 0)
            : Number(patch.cost ?? t.cost ?? 0);
          const totalInputTokens = normalizedModelUsage.length
            ? normalizedModelUsage.reduce((sum, usage) => sum + Number(usage.inputTokens || 0), 0)
            : Number(patch.inputTokens ?? t.inputTokens ?? 0);
          const totalOutputTokens = normalizedModelUsage.length
            ? normalizedModelUsage.reduce((sum, usage) => sum + Number(usage.outputTokens || 0), 0)
            : Number(patch.outputTokens ?? t.outputTokens ?? 0);
          return {
            ...t,
            ...patch,
            hours: Number(patch.hours ?? t.hours),
            cost: totalCost,
            tasksDone: Number(patch.successfulTasks ?? patch.tasksDone ?? t.successfulTasks ?? t.tasksDone ?? 0),
            successfulTasks: Number(patch.successfulTasks ?? patch.tasksDone ?? t.successfulTasks ?? t.tasksDone ?? 0),
            failedTasks: Number(patch.failedTasks ?? t.failedTasks ?? 0),
            trajectories: Number(patch.successTrajectories ?? patch.trajectories ?? t.successTrajectories ?? t.trajectories ?? 0),
            successTrajectories: Number(patch.successTrajectories ?? patch.trajectories ?? t.successTrajectories ?? t.trajectories ?? 0),
            failedTrajectories: Number(patch.failedTrajectories ?? t.failedTrajectories ?? 0),
            approvalStatus: patch.approvalStatus ?? t.approvalStatus ?? "logged",
            modelId: patch.modelId ?? t.modelId ?? "",
            modelName: patch.modelName ?? t.modelName ?? "",
            inputTokens: totalInputTokens,
            outputTokens: totalOutputTokens,
            successfulRows: normalizedSuccessfulRows,
            failedRows: normalizedFailedRows,
            modelUsage: normalizedModelUsage,
          };
        }),
      };
    });
  };

  const deletePhaseTask = (projectId, phaseId, logId) => {
    setTaskLogs((prev) => {
      const key = taskKey(projectId, phaseId);
      const list = prev[key] || [];
      return {
        ...prev,
        [key]: list.filter((t) => !(t.id === logId && isTaskEditable(t))),
      };
    });
  };

  const getPhaseLogs = (projectId, phaseId) => taskLogs[taskKey(projectId, phaseId)] || [];

  const setPhaseLogApprovalStatus = (projectId, phaseId, approvalStatus) => {
    setTaskLogs((prev) => {
      const key = taskKey(projectId, phaseId);
      const list = prev[key] || [];
      if (!list.length) return prev;
      return {
        ...prev,
        [key]: list.map((log) => ({ ...log, approvalStatus })),
      };
    });
  };

  // ---- Top-up Requests (2-stage: CTO → CFO) ----
  const createTopupRequest = ({
    projectId,
    phaseId,
    phaseName,
    amount,
    baseAmount,
    bufferPct,
    bufferAmount,
    reason,
    urgency,
    breakdown,
    sampleIteration,
  }) => {
    const proj = projects.find((p) => p.id === projectId);
    const id = `tur-${Date.now().toString(36)}`;
    const totalAmount = Number(amount || 0);
    const requestedBaseAmount = Number(baseAmount || breakdown?.total || totalAmount || 0);
    const requestedBufferPct = Number(bufferPct || 0);
    const requestedBufferAmount = Number(bufferAmount || 0);
    const entry = {
      id,
      projectId,
      projectName: proj?.name || projectId,
      phaseId,
      phaseName: phaseName || phaseId,
      amount: totalAmount,
      baseAmount: requestedBaseAmount,
      bufferPct: requestedBufferPct,
      bufferAmount: requestedBufferAmount,
      reason,
      urgency: urgency || "Normal",
      requester: user?.name || "TPM",
      requesterRole: user?.role || "TPM",
      requestedAt: new Date().toISOString(),
      sampleIteration: Number(sampleIteration || 0) || null,
      status: "pending-cto",
      ctoDecision: null,
      cfoDecision: null,
      breakdown: breakdown || null,
      history: [
        {
          at: new Date().toISOString(),
          actor: `${user?.name || "TPM"} · ${user?.role || "TPM"}`,
          action: "Submitted top-up request",
          detail: `${phaseName || phaseId} · $${totalAmount.toLocaleString()}${requestedBufferPct > 0 ? ` · ${requestedBufferPct}% buffer` : ""}`,
        },
      ],
    };
    setTopupRequests((arr) => [entry, ...arr]);
    return entry;
  };

  const ctoDecideTopup = (id, { amount, comment, decision }) => {
    // decision: 'approve' (forward at requested), 'partial' (forward at partial), 'reject'
    setTopupRequests((arr) =>
      arr.map((r) => {
        if (r.id !== id) return r;
        const at = new Date().toISOString();
        if (decision === "reject") {
          return {
            ...r,
            status: "rejected",
            ctoDecision: { amount: 0, comment, at, decision: "reject" },
            history: [...r.history, { at, actor: `${user?.name || "CTO"} · CTO`, action: "CTO rejected", detail: comment }],
          };
        }
        const finalAmt = Number(amount) || r.amount;
        return {
          ...r,
          status: "pending-cfo",
          ctoDecision: { amount: finalAmt, comment, at, decision: decision === "partial" ? "partial" : "approve" },
          history: [
            ...r.history,
            { at, actor: `${user?.name || "CTO"} · CTO`, action: decision === "partial" ? "CTO partial approval" : "CTO approved", detail: `Forwarded to CFO at $${finalAmt.toLocaleString()}${comment ? ` — ${comment}` : ""}` },
          ],
        };
      })
    );
  };

  const cfoDecideTopup = (id, { amount, comment, decision }) => {
    setTopupRequests((arr) =>
      arr.map((r) => {
        if (r.id !== id) return r;
        const at = new Date().toISOString();
        if (decision === "reject") {
          return {
            ...r,
            status: "rejected",
            cfoDecision: { amount: 0, comment, at, decision: "reject" },
            history: [...r.history, { at, actor: `${user?.name || "CFO"} · CFO`, action: "CFO rejected", detail: comment }],
          };
        }
        const requested = r.ctoDecision?.amount ?? r.amount;
        const finalAmt = Number(amount) || requested;
        const isPartial = decision === "partial" || finalAmt < requested;
        return {
          ...r,
          status: isPartial ? "partial" : "approved",
          cfoDecision: { amount: finalAmt, comment, at, decision: isPartial ? "partial" : "approve" },
          history: [
            ...r.history,
            {
              at,
              actor: `${user?.name || "CFO"} · CFO`,
              action: isPartial ? "CFO partial approval" : "CFO approved",
              detail: `Final: $${finalAmt.toLocaleString()} · added to project baseline${comment ? ` — ${comment}` : ""}`,
            },
          ],
        };
      })
    );
  };

  // ---- Budget submissions (from TPM/R&D Budget Builder) ----
  const submitBudget = (payload) => {
    // payload: { projectId, projectName, budgetType, priority, totalTasks, delivery, phases, items, totals, resubmitOfReviewId? }
    const id = `bud-${Date.now().toString(36)}`;
    const submittedAt = new Date().toISOString();
    const normalizedBudgetType = normalizeBudgetType(payload.budgetType);
    const currentProject = projects.find((project) => project.id === payload.projectId);
    const existingReview = payload.resubmitOfReviewId
      ? budgetReviews.find((review) => review.id === payload.resubmitOfReviewId)
      : null;
    const baselineSnapshot = existingReview?.baselineSnapshot || snapshotProjectBudget(currentProject);
    const reviewId = payload.resubmitOfReviewId || `br-${Date.now().toString(36)}`;
    const entry = {
      id,
      ...payload,
      budgetType: normalizedBudgetType,
      submittedBy: user?.name || "TPM",
      submittedRole: user?.role || "TPM",
      submittedAt,
      status: "pending-cto",
    };
    setBudgets((arr) => [entry, ...arr]);
    upsertProjectOverride(payload.projectId, (project) => {
      const pendingMeta = getPendingWorkflowMeta(normalizedBudgetType);
      const requestedTotal = (payload.phases || []).reduce((sum, phase) => sum + Number(phase.budget || 0), 0) || payload.totals?.total || 0;
      const additionalMembers = (payload.additionalMembers || []).map((member, index) => buildTeamMember({
        projectId: payload.projectId,
        name: member.name,
        role: member.role,
        fallbackStatus: "Added via budget",
        index: (project.teamMembers || []).length + index,
      }));
      const teamMembers = mergeTeamMembers(project.teamMembers || [], additionalMembers);
      const rndMembers = Array.from(new Set([
        ...(project.rndMembers || []),
        ...additionalMembers.filter((member) => member.role === "R&D").map((member) => member.name),
      ]));
      const plMembers = Array.from(new Set([
        ...(project.plMembers || []),
        ...additionalMembers.filter((member) => member.role === "PL / QL" || member.role === "Project Lead").map((member) => member.name),
      ]));
      const qlMembers = Array.from(new Set([
        ...(project.qlMembers || []),
        ...additionalMembers.filter((member) => member.role === "QL" || member.role === "Quality Lead").map((member) => member.name),
      ]));
      const historyEntry = {
        id,
        projectId: payload.projectId,
        budgetType: normalizedBudgetType,
        total: requestedTotal,
        totals: payload.totals,
        totalTasks: Number(payload.totalTasks || 0),
        totalTrajectories: Number(payload.totalTrajectories || 0),
        submittedAt: entry.submittedAt,
        submittedBy: entry.submittedBy,
        status: "pending-cto",
        items: cloneBudgetItems(payload.items || {}),
        phases: clonePhases(payload.phases || []),
        sourceDeliveryId: payload.sourceDeliveryId || null,
        sampleIteration: payload.sampleIteration || 1,
        reviewId,
      };
      const auditEntries = [];
      if (additionalMembers.length) {
        auditEntries.push({
          id: `a-${payload.projectId}-${Date.now().toString(36)}-members`,
          ts: new Date().toISOString(),
          actor: `${user?.name || "TPM"} · ${user?.role || "TPM"}`,
          action: "Members added during budget build",
          detail: additionalMembers.map((member) => `${member.name} (${member.role})`).join(", "),
        });
      }
      auditEntries.push({
        id: `a-${payload.projectId}-${Date.now().toString(36)}-budget`,
        ts: new Date().toISOString(),
        actor: `${user?.name || "TPM"} · ${user?.role || "TPM"}`,
        action: `${formatBudgetTypeLabel(normalizedBudgetType)} budget submitted`,
        detail: `$${requestedTotal.toLocaleString()} · pending CTO review · ${Number(payload.totalTasks || 0).toLocaleString()} tasks${Number(payload.totalTrajectories || 0) ? ` · ${Number(payload.totalTrajectories || 0).toLocaleString()} trajectories` : ""}`,
      });
      return {
        ...project,
        teamMembers,
        rndMembers,
        plMembers,
        qlMembers,
        status: pendingMeta.status,
        workflowStage: pendingMeta.stage,
        readyForTpmBudget: false,
        pendingBudgetSubmission: {
          reviewId,
          budgetType: normalizedBudgetType,
          submittedAt,
          submittedBy: user?.name || "TPM",
          submittedRole: user?.role || "TPM",
          sampleIteration: Number(payload.sampleIteration || 1),
          sourceDeliveryId: payload.sourceDeliveryId || null,
          total: Number(payload.totals?.total || 0),
          stage: "pending-cto",
        },
        kickoffMail: project.kickoffMail
          ? { ...project.kickoffMail, recipients: mergeTeamMembers(project.kickoffMail.recipients || [], additionalMembers) }
          : project.kickoffMail,
        budgetTrackHistory: [
          historyEntry,
          ...((project.budgetTrackHistory || []).filter((item) => item.id !== id)),
        ],
        auditLog: [...auditEntries, ...(project.auditLog || [])],
      };
    });
    const nextReview = buildBudgetReviewRecord({
      reviewId,
      payload,
      project: currentProject,
      entry,
      baselineSnapshot,
      previousHistory: existingReview?.history || [],
      actorName: user?.name || currentProject?.tpm || "TPM",
      actorRole: user?.role || "TPM",
    });
    setBudgetReviews((arr) => {
      const exists = arr.some((review) => review.id === reviewId);
      if (!exists) return [nextReview, ...arr];
      return arr.map((review) => (review.id === reviewId ? nextReview : review));
    });
    return entry;
  };

  // ---- Batch deliveries (TPM "Deliver batch" per phase) ----
  const deliverBatch = ({ projectId, phaseId, phaseName, proposedAmount, clientComment, clientRepresentative, ...details }) => {
    const proj = projects.find((p) => p.id === projectId);
    const id = `bd-${Date.now().toString(36)}`;
    const stage = details.rnd ? "rnd-review" : "cfo-recovery";
    const rndDecision = details.rnd?.decision || null;
    const isRecoverable = details.isRecoverable !== false;
    const budgetType = normalizeBudgetType(proj?.lastBudgetSubmission?.budgetType || proj?.type || (details.rnd ? "RnD" : "Production"));
    const isTestingDelivery = stage === "rnd-review" && budgetType === "Testing";
    const status =
      stage === "rnd-review"
        ? isTestingDelivery
          ? "testing-submitted"
          : rndDecision === "accept"
            ? "sample-approved"
            : rndDecision === "reject"
              ? "sample-rejected"
              : "changes-requested"
        : isRecoverable ? "pending-cfo" : "non-recoverable";
    const deliveredAt = new Date().toISOString();
    const entry = {
      id,
      projectId,
      projectName: proj?.name || projectId,
      client: proj?.client || "—",
      phaseId,
      phaseName: phaseName || phaseId,
      proposedAmount: Number(proposedAmount || 0),
      clientComment: clientComment || "",
      clientRepresentative: clientRepresentative || "",
      deliveredBy: user?.name || "TPM",
      deliveredAt,
      stage,
      budgetType,
      isRecoverable,
      sampleIteration: Number(details.sampleIteration || 1),
      status,
      actualRecovered: stage === "cfo-recovery" && !isRecoverable ? 0 : null,
      recoveryVariance: stage === "cfo-recovery" && !isRecoverable ? -Number(proposedAmount || 0) : null,
      cfoNote: stage === "cfo-recovery" && !isRecoverable ? "Marked non-recoverable by TPM" : "",
      cfoAt: stage === "cfo-recovery" && !isRecoverable ? deliveredAt : null,
      cfoBy: stage === "cfo-recovery" && !isRecoverable ? user?.name || "TPM" : null,
      history: [
        stage === "rnd-review"
          ? {
              at: deliveredAt,
              actor: `${user?.name || "R&D"} · ${user?.role || "R&D"}`,
              action: isTestingDelivery
                ? "Submitted testing sample"
                : rndDecision === "accept"
                  ? "Accepted sample delivery"
                  : rndDecision === "reject"
                    ? "Rejected sample delivery"
                    : "Requested changes on sample delivery",
              detail: `${phaseName || phaseId} · ${Number(proposedAmount).toLocaleString()}`,
            }
          : {
              at: deliveredAt,
              actor: `${user?.name || "TPM"} · ${user?.role || "TPM"}`,
              action: isRecoverable ? "Delivered batch to CFO" : "Delivered non-recoverable batch",
              detail: `${phaseName || phaseId} · ${Number(proposedAmount || 0).toLocaleString()}`,
            },
      ],
      ...details,
    };
    setBatchDeliveries((arr) => [entry, ...arr]);
    setPhaseLogApprovalStatus(
      projectId,
      phaseId,
      stage === "rnd-review"
        ? isTestingDelivery
          ? "pending-cfo"
          : rndDecision === "accept"
            ? "approved"
            : rndDecision === "reject"
              ? "rejected"
              : "changes-requested"
        : isRecoverable ? "pending-cfo" : "approved"
    );
    if (stage === "rnd-review") {
      upsertProjectOverride(projectId, (project) => ({
        ...project,
        type: !isTestingDelivery && rndDecision === "accept" ? "Production" : "R&D",
        readyForTpmBudget: !isTestingDelivery && rndDecision === "accept",
        pendingBudgetSubmission: null,
        workflowStage: isTestingDelivery
          ? "awaiting-rnd-budget"
          : rndDecision === "accept"
            ? "tpm-budget-ready"
            : rndDecision === "reject"
              ? "sample-rejected"
              : "awaiting-rework-budget",
        status: isTestingDelivery
          ? "Awaiting R&D budget"
          : rndDecision === "accept"
            ? "Ready for TPM budget"
            : rndDecision === "reject"
              ? "Sample rejected"
              : "Awaiting rework budget",
        promotedToProductionAt: !isTestingDelivery && rndDecision === "accept"
          ? deliveredAt
          : project.promotedToProductionAt || null,
        auditLog: [
          {
            id: `a-${projectId}-${Date.now().toString(36)}-delivery`,
            ts: deliveredAt,
            actor: `${user?.name || "R&D"} · ${user?.role || "R&D"}`,
            action: isTestingDelivery
              ? "Testing sample submitted"
              : rndDecision === "accept"
                ? "Sample accepted"
                : rndDecision === "reject"
                  ? "Sample rejected"
                  : "Sample marked for rework",
            detail: `${phaseName || phaseId} · ${Number(proposedAmount || 0).toLocaleString()}`,
          },
          ...(project.auditLog || []),
        ],
      }));
    }
    return entry;
  };

  const recordActualRecovery = (id, { actualRecovered, cfoNote }) => {
    const target = batchDeliveries.find((delivery) => delivery.id === id);
    const amount = Number(actualRecovered);
    setBatchDeliveries((arr) => arr.map((d) => (
      d.id === id
        ? {
            ...d,
            actualRecovered: amount,
            recoveryVariance: amount - Number(d.proposedAmount || 0),
            cfoNote: cfoNote || "",
            cfoAt: new Date().toISOString(),
            cfoBy: user?.name || "CFO",
            status: amount >= d.proposedAmount ? "recovered" : "partial-recovered",
            history: [
              {
                at: new Date().toISOString(),
                actor: `${user?.name || "CFO"} · CFO`,
                action: "Recorded actual recovery",
                detail: `$${amount.toLocaleString()} vs proposed $${Number(d.proposedAmount || 0).toLocaleString()}`,
              },
              ...(d.history || []),
            ],
          }
        : d
    )));
    if (target) {
      setPhaseLogApprovalStatus(
        target.projectId,
        target.phaseId,
        amount === 0 ? "rejected" : amount >= target.proposedAmount ? "approved" : "partial"
      );
      const nextDeliveries = batchDeliveries.map((delivery) => (
        delivery.id === id ? { ...delivery, actualRecovered: amount } : delivery
      ));
      const recoveredTotal = nextDeliveries
        .filter((delivery) => delivery.projectId === target.projectId && delivery.stage !== "rnd-review")
        .reduce((sum, delivery) => sum + Number(delivery.actualRecovered || 0), 0);
      setRecoveries((current) => ({ ...current, [target.projectId]: recoveredTotal }));
    }
  };

  // ---- Budget Reviews (CTO edits original TPM ask, forwards to CFO for final decision) ----
  const ctoModifyBudgetReview = ({ reviewId, projectId, projectName, tpm, requestedBudget, modifiedPhases, modifiedItems, ctoComment }) => {
    const phaseTotal = (modifiedPhases || []).reduce((sum, phase) => (
      sum + Number(phase.infra || 0) + Number(phase.model || 0) + Number(phase.subs || 0)
    ), 0);
    const itemSummary = cloneBudgetItems(modifiedItems || {});
    const itemTotals = {
      models: sumBudgetLines(itemSummary.models),
      infra: sumBudgetLines(itemSummary.infra),
      subs: sumBudgetLines(itemSummary.subs),
    };
    const total = modifiedItems ? (itemTotals.models + itemTotals.infra + itemTotals.subs) : phaseTotal;
    const now = new Date().toISOString();
    setBudgetReviews((arr) => {
      const existingIdx = arr.findIndex((r) => r.id === reviewId);
      const previous = existingIdx >= 0 ? arr[existingIdx] : null;
      const base = {
        ...(previous || {}),
        id: reviewId,
        projectId,
        projectName,
        tpm,
        requestedBudget,
        modifiedPhases,
        modifiedItems: modifiedItems ? itemSummary : previous?.modifiedItems,
        modifiedTotal: total,
        aiCost: modifiedItems ? itemTotals.models : Number(previous?.aiCost || 0),
        infraCost: modifiedItems ? itemTotals.infra : Number(previous?.infraCost || 0),
        subsCost: modifiedItems ? itemTotals.subs : Number(previous?.subsCost || 0),
        items: modifiedItems ? itemSummary : cloneBudgetItems(previous?.items || {}),
        ctoComment,
        ctoBy: user?.name || "CTO",
        ctoAt: now,
        stage: "CFO Review",
        status: "forwarded-cfo",
        cfoDecision: null,
      };
      const historyEntry = {
        at: now,
        actor: `${user?.name || "CTO"} · CTO`,
        action: "Modified & forwarded to CFO",
        detail: modifiedItems
          ? `Total ${total} · ${itemSummary.models.length + itemSummary.infra.length + itemSummary.subs.length} line item${itemSummary.models.length + itemSummary.infra.length + itemSummary.subs.length === 1 ? "" : "s"}`
          : `Total ${total} · ${modifiedPhases.length} phase${modifiedPhases.length === 1 ? "" : "s"}`,
      };
      if (existingIdx >= 0) {
        return arr.map((r, i) => (i === existingIdx ? { ...base, history: [...(previous.history || []), historyEntry] } : r));
      }
      return [{ ...base, history: [historyEntry] }, ...arr];
    });
    setBudgets((arr) => arr.map((budget) => (
      budget.id === budgetReviews.find((review) => review.id === reviewId)?.sourceBudgetId
        ? { ...budget, status: "forwarded-cfo", ctoAt: now, ctoComment }
        : budget
    )));
    upsertProjectOverride(projectId, (projectEntry) => ({
      ...projectEntry,
      status: "Awaiting CFO approval",
      pendingBudgetSubmission: projectEntry.pendingBudgetSubmission
        ? {
            ...projectEntry.pendingBudgetSubmission,
            stage: "pending-cfo",
            ctoAt: now,
          }
        : projectEntry.pendingBudgetSubmission,
    }));
    return total;
  };

  const ctoRejectBudgetReview = ({ reviewId, projectId, projectName, tpm, requestedBudget, ctoComment }) => {
    const now = new Date().toISOString();
    const currentReview = budgetReviews.find((review) => review.id === reviewId);
    setBudgetReviews((arr) => {
      const idx = arr.findIndex((r) => r.id === reviewId);
      const entry = {
        ...(idx >= 0 ? arr[idx] : {}),
        id: reviewId,
        projectId,
        projectName,
        tpm,
        requestedBudget,
        modifiedPhases: [],
        modifiedTotal: 0,
        ctoComment,
        ctoBy: user?.name || "CTO",
        ctoAt: now,
        stage: "Rejected",
        status: "rejected-by-cto",
        cfoDecision: null,
      };
      const historyEntry = { at: now, actor: `${user?.name || "CTO"} · CTO`, action: "CTO rejected", detail: ctoComment || "" };
      if (idx >= 0) return arr.map((r, i) => (i === idx ? { ...entry, history: [...(arr[idx].history || []), historyEntry] } : r));
      return [{ ...entry, history: [historyEntry] }, ...arr];
    });
    setBudgets((arr) => arr.map((budget) => (
      budget.id === currentReview?.sourceBudgetId
        ? { ...budget, status: "rejected-by-cto", ctoAt: now, ctoComment }
        : budget
    )));
    if (currentReview?.baselineSnapshot) {
      upsertProjectOverride(projectId, (projectEntry) => ({
        ...buildProjectBaselineFromSnapshot(projectEntry, currentReview.baselineSnapshot),
        auditLog: [
          {
            id: `a-${projectId}-${Date.now().toString(36)}-cto-reject`,
            ts: now,
            actor: `${user?.name || "CTO"} · CTO`,
            action: "Budget rejected by CTO",
            detail: ctoComment || "Rejected before CFO review",
          },
          ...(projectEntry.auditLog || []),
        ],
      }));
    }
  };

  // Return budget to TPM/R&D with comments — TPM sees it as an editable, resubmittable draft.
  const ctoReturnBudgetReview = ({ reviewId, projectId, projectName, tpm, requestedBudget, ctoComment, returnTo }) => {
    const now = new Date().toISOString();
    const currentReview = budgetReviews.find((review) => review.id === reviewId);
    setBudgetReviews((arr) => {
      const idx = arr.findIndex((r) => r.id === reviewId);
      const entry = {
        ...(idx >= 0 ? arr[idx] : {}),
        id: reviewId,
        projectId,
        projectName,
        tpm,
        returnedTo: returnTo || "TPM",
        requestedBudget,
        modifiedPhases: [],
        modifiedTotal: 0,
        ctoComment,
        ctoBy: user?.name || "CTO",
        ctoAt: now,
        stage: "CTO Review",
        status: "returned-to-tpm",
        cfoDecision: null,
      };
      const historyEntry = { at: now, actor: `${user?.name || "CTO"} · CTO`, action: `Returned to ${returnTo || "TPM"} with comments`, detail: ctoComment || "" };
      if (idx >= 0) return arr.map((r, i) => (i === idx ? { ...entry, history: [...(arr[idx].history || []), historyEntry] } : r));
      return [{ ...entry, history: [historyEntry] }, ...arr];
    });
    setBudgets((arr) => arr.map((budget) => (
      budget.id === currentReview?.sourceBudgetId
        ? { ...budget, status: "returned-to-tpm", ctoAt: now, ctoComment }
        : budget
    )));
    if (currentReview?.baselineSnapshot) {
      upsertProjectOverride(projectId, (projectEntry) => ({
        ...buildProjectBaselineFromSnapshot(projectEntry, currentReview.baselineSnapshot),
        auditLog: [
          {
            id: `a-${projectId}-${Date.now().toString(36)}-cto-return`,
            ts: now,
            actor: `${user?.name || "CTO"} · CTO`,
            action: `Budget returned to ${returnTo || "TPM"}`,
            detail: ctoComment || "Returned for edits",
          },
          ...(projectEntry.auditLog || []),
        ],
      }));
    }
  };

  const cfoDecideBudgetReview = (reviewId, { decision, amount, comment, reviewSeed }) => {
    const at = new Date().toISOString();
    const baseReview = budgetReviews.find((review) => review.id === reviewId) || reviewSeed;

    if (!baseReview) return null;

    const requestedTotal = Number(
      baseReview.modifiedTotal
      || baseReview.recommendedBudget
      || baseReview.requestedBudget
      || 0
    );
    const approvedAmount = Number(amount || requestedTotal || 0);
    const statusMap = { approve: "approved", partial: "partial", reject: "rejected", return: "returned" };
    const actionLabel = {
      approve: "CFO approved",
      partial: "CFO partial approval",
      reject: "CFO rejected",
      return: "CFO returned for changes",
    }[decision];
    const nextReview = {
      ...baseReview,
      status: statusMap[decision] || "returned",
      stage: decision === "return" ? "CTO Review" : decision === "reject" ? "Rejected" : "Approved",
      cfoDecision: {
        decision,
        amount: decision === "reject" ? 0 : approvedAmount,
        comment: comment || "",
        at,
        by: user?.name || "CFO",
      },
      history: [
        ...(baseReview.history || []),
        { at, actor: `${user?.name || "CFO"} · CFO`, action: actionLabel, detail: comment || "" },
      ],
    };

    setBudgetReviews((arr) => {
      const exists = arr.some((review) => review.id === reviewId);
      if (!exists) return [nextReview, ...arr];
      return arr.map((review) => (review.id === reviewId ? nextReview : review));
    });
    setBudgets((arr) => arr.map((budget) => (
      budget.id === baseReview.sourceBudgetId
        ? {
            ...budget,
            status: nextReview.status,
            cfoDecision: nextReview.cfoDecision,
            approvedAmount: decision === "approve" || decision === "partial" ? approvedAmount : 0,
          }
        : budget
    )));

    if (decision === "approve" || decision === "partial") {
      const project = projects.find((entry) => entry.id === baseReview.projectId);
      const scaledProjectState = buildProjectBudgetStateFromReview({
        projectEntry: project || {},
        review: nextReview,
        approvedAmount,
      });
      const members = mergeTeamMembers(project?.teamMembers || [], project?.kickoffMail?.recipients || []);
      const requestedLines = summarizeRequestedLines(scaledProjectState.budgetItems || nextReview.items || {}, project);
      const budgetType = normalizeBudgetType(project?.lastBudgetSubmission?.budgetType || nextReview.budgetType || "Production");
      const itEntry = {
        id: `it-${reviewId}`,
        sourceReviewId: reviewId,
        sourceType: "budget-review",
        projectId: baseReview.projectId,
        projectName: baseReview.projectName,
        approvedAmount,
        status: "pending-it",
        approvedAt: at,
        approvedBy: user?.name || "CFO",
        approvedRole: user?.role || "CFO",
        budgetType,
        requestedModels: requestedLines.models,
        requestedInfra: requestedLines.infra,
        requestedSubs: requestedLines.subs,
        members,
        note: comment || "",
      };
      setItProvisioningRequests((arr) => [itEntry, ...arr.filter((request) => request.id !== itEntry.id)]);
      upsertProjectOverride(baseReview.projectId, (projectEntry) => ({
        ...projectEntry,
        ...buildProjectBudgetStateFromReview({
          projectEntry,
          review: nextReview,
          approvedAmount,
        }),
        itProvisioningStatus: "pending-it",
        auditLog: [
          {
            id: `a-${baseReview.projectId}-${Date.now().toString(36)}-it`,
            ts: at,
            actor: `${user?.name || "CFO"} · CFO`,
            action: "Budget approved and routed to IT",
            detail: `${formatBudgetTypeLabel(itEntry.budgetType)} · ${approvedAmount.toLocaleString()} · ${members.length} member${members.length === 1 ? "" : "s"} queued for access`,
          },
          ...(projectEntry.auditLog || []),
        ],
      }));
      return nextReview;
    }

    setItProvisioningRequests((arr) => arr.filter((request) => request.sourceReviewId !== reviewId));
    if (baseReview.baselineSnapshot) {
      upsertProjectOverride(baseReview.projectId, (projectEntry) => ({
        ...buildProjectBaselineFromSnapshot(projectEntry, baseReview.baselineSnapshot),
        itProvisioningStatus: null,
        auditLog: [
          {
            id: `a-${baseReview.projectId}-${Date.now().toString(36)}-cfo-reset`,
            ts: at,
            actor: `${user?.name || "CFO"} · CFO`,
            action: decision === "return" ? "Budget returned for changes" : "Budget rejected by CFO",
            detail: comment || (decision === "return" ? "Returned to CTO for revision" : "Rejected"),
          },
          ...(projectEntry.auditLog || []),
        ],
      }));
    }

    return nextReview;
  };

  const createChangeRequest = ({ projectId, reason, urgency, expectedTasks, timelineDelta, breakdown }) => {
    const project = projects.find((entry) => entry.id === projectId);
    const id = `cr-${Date.now().toString(36)}`;
    const now = new Date().toISOString();
    const normalizedBreakdown = {
      models: breakdown?.models?.enabled ? {
        amount: Number(breakdown.models.amount || 0),
        optionLabel: breakdown.models.optionLabel || "",
        note: breakdown.models.note || "",
      } : null,
      infra: breakdown?.infra?.enabled ? {
        amount: Number(breakdown.infra.amount || 0),
        optionLabel: breakdown.infra.optionLabel || "",
        note: breakdown.infra.note || "",
      } : null,
      subs: breakdown?.subs?.enabled ? {
        amount: Number(breakdown.subs.amount || 0),
        optionLabel: breakdown.subs.optionLabel || "",
        note: breakdown.subs.note || "",
      } : null,
    };
    const amount = Number(
      (normalizedBreakdown.models?.amount || 0)
      + (normalizedBreakdown.infra?.amount || 0)
      + (normalizedBreakdown.subs?.amount || 0)
    );
    const entry = normalizeChangeRequest({
      id,
      projectId,
      projectName: project?.name || projectId,
      type: amount > 0 ? "Budget change" : "Scope / timeline change",
      amount,
      currentBudget: Number(project?.approvedBudget || 0),
      requestedBudget: Number(project?.approvedBudget || 0) + amount,
      requester: user?.name || "TPM",
      urgency: urgency || "Normal",
      stage: "CTO Review",
      createdAt: now,
      reason,
      expectedTasks: expectedTasks || "",
      timelineDelta: timelineDelta || "",
      breakdown: normalizedBreakdown,
      history: [
        {
          at: now,
          actor: `${user?.name || "TPM"} · ${user?.role || "TPM"}`,
          action: "Submitted change request",
          detail: `${amount > 0 ? `$${amount.toLocaleString()}` : "No direct budget delta"}${timelineDelta ? ` · ${timelineDelta}` : ""}`,
        },
      ],
    });
    setChangeRequests((arr) => [entry, ...arr]);
    return entry;
  };

  const ctoDecideChangeRequest = (id, { decision, amount, comment }) => {
    const at = new Date().toISOString();
    setChangeRequests((requests) => requests.map((request) => {
      if (request.id !== id) return request;

      if (decision === "reject") {
        return {
          ...request,
          stage: "Rejected",
          status: "rejected",
          ctoDecision: { decision, amount: 0, comment: comment || "", at, by: user?.name || "CTO" },
          history: [
            ...(request.history || []),
            { at, actor: `${user?.name || "CTO"} · CTO`, action: "CTO rejected", detail: comment || "Rejected" },
          ],
        };
      }

      if (decision === "approve") {
        const finalAmount = Number(amount || request.amount || 0);
        return {
          ...request,
          stage: "Approved",
          status: "approved",
          ctoDecision: { decision, amount: finalAmount, comment: comment || "", at, by: user?.name || "CTO" },
          finalDecision: { actor: "CTO", amount: finalAmount, at, comment: comment || "" },
          history: [
            ...(request.history || []),
            { at, actor: `${user?.name || "CTO"} · CTO`, action: "CTO approved", detail: `Approved at $${finalAmount.toLocaleString()}` },
          ],
        };
      }

      const forwardedAmount = Number(amount || request.amount || 0);
      return {
        ...request,
        stage: "CFO Review",
        status: "pending",
        ctoDecision: { decision: "forward", amount: forwardedAmount, comment: comment || "", at, by: user?.name || "CTO" },
        history: [
          ...(request.history || []),
          { at, actor: `${user?.name || "CTO"} · CTO`, action: "Forwarded to CFO", detail: `Forwarded at $${forwardedAmount.toLocaleString()}${comment ? ` · ${comment}` : ""}` },
        ],
      };
    }));
  };

  const cfoDecideChangeRequest = (id, { decision, amount, comment }) => {
    const at = new Date().toISOString();
    const currentRequest = changeRequests.find((entry) => entry.id === id);
    if (!currentRequest) return null;

    const finalAmount = Number(amount || currentRequest.ctoDecision?.amount || currentRequest.amount || 0);
    const nextStatus = decision === "reject"
      ? "rejected"
      : decision === "partial"
        ? "partial"
        : decision === "return"
          ? "returned"
          : "approved";
    const nextStage = decision === "return"
      ? "CTO Review"
      : nextStatus === "approved" || nextStatus === "partial"
        ? "Approved"
        : "Rejected";
    const nextRequest = {
      ...currentRequest,
      stage: nextStage,
      status: nextStatus,
      cfoDecision: {
        decision,
        amount: decision === "reject" ? 0 : finalAmount,
        comment: comment || "",
        at,
        by: user?.name || "CFO",
      },
      finalDecision: decision === "reject" ? null : { actor: "CFO", amount: finalAmount, at, comment: comment || "" },
      history: [
        ...(currentRequest.history || []),
        {
          at,
          actor: `${user?.name || "CFO"} · CFO`,
          action:
            decision === "partial"
              ? "CFO partial approval"
              : decision === "return"
                ? "Returned to CTO"
                : decision === "reject"
                  ? "CFO rejected"
                  : "CFO approved",
          detail: decision === "reject" ? (comment || "Rejected") : `$${finalAmount.toLocaleString()}${comment ? ` · ${comment}` : ""}`,
        },
      ],
    };

    setChangeRequests((requests) => requests.map((entry) => (
      entry.id === id ? nextRequest : entry
    )));

    if (decision === "approve" || decision === "partial") {
      const project = projects.find((entry) => entry.id === currentRequest.projectId);
      const members = mergeTeamMembers(project?.teamMembers || [], project?.kickoffMail?.recipients || []);
      const requestedModels = currentRequest.breakdown?.models?.amount ? [{
        id: `${currentRequest.id}-model`,
        label: currentRequest.breakdown.models.optionLabel || "Model change",
        provider: "Anthropic",
        amount: Number(currentRequest.breakdown.models.amount || 0),
      }] : [];
      const requestedInfra = currentRequest.breakdown?.infra?.amount ? [{
        id: `${currentRequest.id}-infra`,
        label: currentRequest.breakdown.infra.optionLabel || "Infrastructure change",
        amount: Number(currentRequest.breakdown.infra.amount || 0),
      }] : [];
      const requestedSubs = currentRequest.breakdown?.subs?.amount ? [{
        id: `${currentRequest.id}-subs`,
        label: currentRequest.breakdown.subs.optionLabel || "Subscription change",
        amount: Number(currentRequest.breakdown.subs.amount || 0),
      }] : [];
      const itEntry = {
        id: `it-cr-${currentRequest.id}`,
        sourceReviewId: currentRequest.id,
        sourceType: "change-request",
        projectId: currentRequest.projectId,
        projectName: currentRequest.projectName,
        approvedAmount: finalAmount,
        status: "pending-it",
        approvedAt: at,
        approvedBy: user?.name || "CFO",
        approvedRole: user?.role || "CFO",
        budgetType: normalizeBudgetType(project?.lastBudgetSubmission?.budgetType || project?.type || "Production"),
        requestedModels,
        requestedInfra,
        requestedSubs,
        members,
        note: comment || "",
      };
      setItProvisioningRequests((entries) => [itEntry, ...entries.filter((entry) => entry.id !== itEntry.id)]);
      upsertProjectOverride(currentRequest.projectId, (projectEntry) => ({
        ...projectEntry,
        itProvisioningStatus: "pending-it",
        auditLog: [
          {
            id: `a-${currentRequest.projectId}-${Date.now().toString(36)}-cr`,
            ts: at,
            actor: `${user?.name || "CFO"} · CFO`,
            action: "Change request approved and routed to IT",
            detail: `${currentRequest.type} · $${finalAmount.toLocaleString()}${comment ? ` · ${comment}` : ""}`,
          },
          ...(projectEntry.auditLog || []),
        ],
      }));
    }

    return nextRequest;
  };

  const saveItMonthlyActual = (projectId, payload) => {
    const updatedAt = new Date().toISOString();
    const dailyActuals = Array.isArray(payload?.dailyActuals) ? payload.dailyActuals : [];
    const dailyTotals = dailyActuals.reduce((sum, row) => ({
      modelActual: sum.modelActual + Number(row?.modelActual || 0),
      infraActual: sum.infraActual + Number(row?.infraActual || 0),
      subsActual: sum.subsActual + Number(row?.subsActual || 0),
    }), { modelActual: 0, infraActual: 0, subsActual: 0 });
    const modelActual = dailyActuals.length ? dailyTotals.modelActual : Number(payload?.modelActual || 0);
    const infraActual = dailyActuals.length ? dailyTotals.infraActual : Number(payload?.infraActual || 0);
    const subsActual = dailyActuals.length ? dailyTotals.subsActual : Number(payload?.subsActual || 0);
    const totalActual = modelActual + infraActual + subsActual;
    const monthEndActual = Number(payload?.monthEndActual || 0);
    setItMonthlyActuals((entries) => ({
      ...entries,
      [projectId]: {
        ...(entries[projectId] || {}),
        ...payload,
        dailyActuals,
        modelActual,
        infraActual,
        subsActual,
        totalActual,
        monthEndActual,
        monthEndDate: payload?.monthEndDate || entries[projectId]?.monthEndDate || "",
        updatedAt,
        updatedBy: user?.name || "IT",
      },
    }));
    return updatedAt;
  };

  const provisionModelKeys = (requestId, { lines = [], note = "" }) => {
    const request = itProvisioningRequests.find((entry) => entry.id === requestId);
    if (!request) return null;
    const at = new Date().toISOString();
    const project = projects.find((entry) => entry.id === request.projectId);

    const createdKeys = lines
      .filter((line) => line.fullKey && String(line.fullKey).trim())
      .map((line, index) => {
        const teamMembers = request.members.filter((member) => (line.memberIds || []).includes(member.id));
        const fullKey = String(line.fullKey).trim();
        return {
          id: `k-${request.projectId}-${Date.now().toString(36)}-${index + 1}`,
          project: request.projectId,
          projectName: request.projectName,
          provider: line.provider || "Anthropic",
          model: line.label,
          type: request.budgetType === "Production" ? "Production" : "R&D",
          env: line.env || "testing",
          fullKey,
          maskedKey: maskKey(fullKey),
          tags: [request.budgetType.toLowerCase(), line.env || "testing", "it-provisioned"],
          lastUsed: at,
          usage: 0,
          createdBy: user?.name || "IT",
          createdAt: at,
          status: "active",
          members: teamMembers.map((member) => ({
            id: member.id,
            name: member.name,
            role: member.role,
            email: member.email,
          })),
          sourceReviewId: request.sourceReviewId,
        };
      });

    setModelKeyRecords((arr) => [...createdKeys, ...arr]);
    setItProvisioningRequests((arr) => arr.map((entry) => (
      entry.id === requestId
        ? {
            ...entry,
            status: "completed",
            provisionedAt: at,
            provisionedBy: user?.name || "IT",
            note,
            lines: lines.map((line) => ({
              ...line,
              maskedKey: line.fullKey ? maskKey(String(line.fullKey).trim()) : "",
            })),
          }
        : entry
    )));
    if (project) {
      upsertProjectOverride(project.id, (projectEntry) => ({
        ...projectEntry,
        itProvisioningStatus: "completed",
        auditLog: [
          {
            id: `a-${project.id}-${Date.now().toString(36)}-keys`,
            ts: at,
            actor: `${user?.name || "IT"} · ${user?.role || "IT"}`,
            action: "Model keys provisioned",
            detail: `${createdKeys.length} key${createdKeys.length === 1 ? "" : "s"} provisioned${note ? ` · ${note}` : ""}`,
          },
          ...(projectEntry.auditLog || []),
        ],
      }));
    }
    return createdKeys;
  };

  const bufferOverview = useMemo(() => {
    const perProject = projects.map((project) => {
      const allocated = Math.round(Number(project.approvedBudget || 0) * (Number(project.buffer || 0) / 100));
      const seedConsumed = Number(BUFFER.perProject.find((entry) => entry.id === project.id)?.consumed || 0);
      const consumed = Math.min(allocated, Number(bufferPool.projectConsumed?.[project.id] || seedConsumed));
      return {
        id: project.id,
        name: project.name,
        approved: project.approvedBudget,
        allocated,
        consumed,
        status: consumed >= allocated && allocated > 0 ? "critical" : consumed >= allocated * 0.7 ? "using" : "reserved",
      };
    });
    return {
      total: Number(bufferPool.total || 0),
      available: Number(bufferPool.available || 0),
      consumed: Math.max(0, Number(bufferPool.total || 0) - Number(bufferPool.available || 0)),
      policyPct: Number(bufferPool.policyPct || BUFFER.policyPct || 0),
      history: bufferPool.history || [],
      alerts: bufferPool.alerts || [],
      perProject,
    };
  }, [bufferPool, projects]);

  const role = user?.role || null;
  const value = {
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
    projects,
    visibleProjects,
    bufferOverview,
    teamRemovals,
    removeProjectTeamMember,
    addProjectTeamMembers,
    setBuffer,
    applyBufferAction,
    setRecovery,
    addProject,
    seedDemoProject,
    // task logs
    taskLogs,
    getPhaseLogs,
    logPhaseTask,
    updatePhaseTask,
    deletePhaseTask,
    isTaskEditable,
    TASK_EDIT_WINDOW_MS,
    // top-ups
    topupRequests,
    createTopupRequest,
    ctoDecideTopup,
    cfoDecideTopup,
    // budgets & batch deliveries
    budgets,
    submitBudget,
    batchDeliveries,
    deliverBatch,
    recordActualRecovery,
    // CTO budget review modifications
    budgetReviews,
    changeRequests,
    createChangeRequest,
    ctoModifyBudgetReview,
    ctoRejectBudgetReview,
    ctoReturnBudgetReview,
    cfoDecideBudgetReview,
    ctoDecideChangeRequest,
    cfoDecideChangeRequest,
    modelKeyRecords,
    itProvisioningRequests,
    provisionModelKeys,
    itMonthlyActuals,
    saveItMonthlyActual,
  };
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useApp = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside AppProvider");
  return ctx;
};
