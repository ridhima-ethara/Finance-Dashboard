import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { USERS, ROLES, PROJECTS } from "../data/mockData";
import { BEDROCK_MODELS } from "../data/mockCatalog";
import { BUFFER } from "../data/mockCfo";
import {
  DEMO_BATCH_DELIVERIES,
  DEMO_BUDGET_REVIEWS,
  DEMO_BUDGETS,
  DEMO_BUFFER_POOL,
  DEMO_BUFFERS,
  DEMO_CHANGE_REQUESTS,
  DEMO_IT_PROVISIONING,
  DEMO_IT_MONTHLY_ACTUALS,
  DEMO_MODEL_KEYS,
  DEMO_TASK_LOGS,
  DEMO_TEAM_REMOVALS,
  DEMO_TOPUP_REQUESTS,
} from "../data/demoState";
import { formatBudgetTypeLabel, normalizeBudgetType, summarizeItProjectActuals } from "../lib/projectMetrics";
import { buildCustomModelId } from "../lib/modelCatalog";
import { areBudgetItemsEqual, getCtoForwardLabel, hasCtoModifiedBudgetReview } from "../lib/budgetReview";
import {
  getGeneralActualRowsCostTotal,
  getGeneralActualRowsCount,
  isGeneralActualLog,
  normalizeGeneralActualRows,
} from "../lib/generalBudget";
import { findProjectDirectoryMember } from "../data/employeeDirectory";

// ---- Shared backend workspace sync ------------------------------------------------
// The app now persists all workspace state to a real backend (MongoDB via FastAPI)
// so data survives cache clears, incognito sessions, other devices, and is visible
// to every role that signs into the shared workspace.
// See backend/server.py — GET/PUT /api/workspace endpoints.
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "";
const WORKSPACE_ENDPOINT = `${BACKEND_URL}/api/workspace`;

// Keys inside the workspace state doc. Order does not matter.
const WORKSPACE_SLICE_KEYS = [
  "buffers",
  "bufferPool",
  "recoveries",
  "customModels",
  "customProjects",
  "taskLogs",
  "topupRequests",
  "budgets",
  "batchDeliveries",
  "budgetReviews",
  "changeRequests",
  "teamRemovals",
  "modelKeys",
  "itProvisioning",
  "itMonthlyActuals",
];

const AppContext = createContext(null);
const SESSION_KEY = "ethara.session.v1";
const BUFFERS_KEY = "ethara.buffers.v3";
const RECOVERY_KEY = "ethara.recovery.v3";
const CUSTOM_PROJECTS_KEY = "ethara.customProjects.v3";
const TASK_LOGS_KEY = "ethara.taskLogs.v3";
const TOPUP_REQ_KEY = "ethara.topupRequests.v3";
const BUDGETS_KEY = "ethara.budgets.v3";
const BATCH_DELIVERIES_KEY = "ethara.batchDeliveries.v3";
const BUDGET_REVIEWS_KEY = "ethara.budgetReviews.v3";
const CHANGE_REQUESTS_KEY = "ethara.changeRequests.v3";
const TEAM_REMOVALS_KEY = "ethara.teamRemovals.v3";
const MODEL_KEYS_KEY = "ethara.modelKeys.v3";
const IT_PROVISIONING_KEY = "ethara.itProvisioning.v3";
const BUFFER_POOL_KEY = "ethara.bufferPool.v3";
const IT_MONTHLY_ACTUALS_KEY = "ethara.itMonthlyActuals.v3";
const CUSTOM_MODELS_KEY = "ethara.customModels.v2";

const readJSON = (key, fallback) => {
  try {
    return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
  } catch {
    return fallback;
  }
};

// Ensure canonical seed records (e.g. mapped project approvals) always load,
// even when localStorage already holds a persisted list. The seed is authoritative for its own
// ids, so seed updates always take effect (a stale localStorage copy can't override them);
// user-created entries (any other id) are preserved.
const mergeSeedById = (seed = [], stored = []) => {
  const storedList = Array.isArray(stored) ? stored : [];
  const seedIds = new Set(seed.map((entry) => entry?.id));
  return [...seed, ...storedList.filter((entry) => !seedIds.has(entry?.id))];
};

// Seeded subscription asks were consolidated into the approved budgets (see DEMO_BUDGETS). Any
// stale localStorage copy of these change requests is dropped on load so their amount is not
// double-counted against the budget.
const RETIRED_CHANGE_REQUEST_IDS = new Set([
  "cr-zoro-claude-max",
  "cr-zoro-codex-pro",
  "cr-tron-claude-1",
  "cr-tron-claude-2",
]);
const dropRetiredChangeRequests = (list = []) => list.filter((entry) => !RETIRED_CHANGE_REQUEST_IDS.has(entry?.id));

// The canonical Zoro/Tron budget reviews are seeded in DEMO_BUDGET_REVIEWS. Drop stale/leftover
// reviews from localStorage: (a) any review for a removed demo project (id starts with "demo-"),
// which opens blank in the approval queue and clutters the CTO budget-review list; and (b) any
// non-canonical review for zoro/tron. This keeps only the correct, non-blank reviews.
const SEEDED_REVIEW_PROJECT_IDS = new Set(["zoro", "tron"]);
const CANONICAL_REVIEW_IDS = new Set(["review-zoro-rnd", "review-tron-rnd"]);
const isRemovedDemoRef = (entry) => String(entry?.projectId || "").startsWith("demo-");
const dropStaleSeededReviews = (list = []) =>
  list.filter((entry) => {
    if (isRemovedDemoRef(entry)) return false;
    if (SEEDED_REVIEW_PROJECT_IDS.has(entry?.projectId)) return CANONICAL_REVIEW_IDS.has(entry?.id);
    return true;
  });

const normalizeModelRecord = (model = {}, index = 0) => ({
  id: String(model.id || buildCustomModelId(model) || `custom.model.${index + 1}`),
  name: String(model.name || `Custom model ${index + 1}`).trim(),
  provider: String(model.provider || "Custom").trim(),
  modality: String(model.modality || "Chat").trim(),
  pricePer1kIn: Number(model.pricePer1kIn || 0),
  pricePer1kOut: Number(model.pricePer1kOut || 0),
  isCustom: Boolean(model.isCustom),
});

const dedupeModels = (models = []) => {
  const seen = new Set();
  return (Array.isArray(models) ? models : []).reduce((acc, model, index) => {
    const normalized = normalizeModelRecord(model, index);
    const idKey = String(normalized.id || "").trim().toLowerCase();
    const nameKey = `${String(normalized.name || "").trim().toLowerCase()}::${String(normalized.provider || "").trim().toLowerCase()}`;
    const key = idKey || nameKey;
    if (!key || seen.has(key) || seen.has(nameKey)) return acc;
    seen.add(key);
    seen.add(nameKey);
    acc.push(normalized);
    return acc;
  }, []);
};

const mergeModelCatalog = (baseModels = [], customModels = []) => {
  const seen = new Set();
  return [...(Array.isArray(baseModels) ? baseModels : []), ...dedupeModels(customModels)].reduce((acc, model, index) => {
    const normalized = index < baseModels.length ? model : normalizeModelRecord(model, index);
    const idKey = String(normalized.id || "").trim().toLowerCase();
    const nameKey = `${String(normalized.name || "").trim().toLowerCase()}::${String(normalized.provider || "").trim().toLowerCase()}`;
    if (!idKey && !nameKey) return acc;
    if (seen.has(idKey) || seen.has(nameKey)) return acc;
    if (idKey) seen.add(idKey);
    if (nameKey) seen.add(nameKey);
    acc.push(normalized);
    return acc;
  }, []);
};

const findModelInCatalog = (catalog = BEDROCK_MODELS, value = "") => {
  const needle = String(value || "").trim().toLowerCase();
  if (!needle) return null;
  return (catalog || []).find((model) => {
    const candidates = [
      model.id,
      model.name,
      `${model.name} · ${model.provider}`,
      `${model.name} ${model.provider}`,
    ];
    return candidates.some((candidate) => String(candidate || "").trim().toLowerCase() === needle);
  }) || null;
};

const parseTaskQuantity = (value) => {
  if (typeof value === "number") return Number.isFinite(value) && value > 0 ? value : 0;
  const normalized = String(value ?? "").replace(/,/g, "").trim();
  if (!normalized) return 0;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
};

const getTaskQuantityFromRow = (row = {}) => {
  const explicitQuantity = parseTaskQuantity(row.task);
  return explicitQuantity > 0 ? explicitQuantity : 1;
};

const maskValue = (value = "", lead = 7, tail = 4, minimumMask = 8) => {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const safeLead = Math.min(Math.max(lead, 1), Math.max(raw.length - 1, 1));
  const safeTail = Math.min(Math.max(tail, 1), Math.max(raw.length - safeLead, 1));
  return `${raw.slice(0, safeLead)}${"•".repeat(Math.max(minimumMask, raw.length - safeLead - safeTail))}${raw.slice(-safeTail)}`;
};

const maskKey = (full) => maskValue(full, 7, 4, 18);
const maskInternalToken = (token) => maskValue(token, 12, 6, 12);
const providerPrefix = {
  Anthropic: "ant",
  AWS: "aws",
  Azure: "azr",
  Amazon: "amz",
  GCP: "gcp",
  Meta: "met",
  Mistral: "mis",
  Cohere: "coh",
  AI21: "ai21",
  "Stability AI": "stb",
  OpenAI: "oai",
  OpenRouter: "orx",
  "AIML APIs": "aim",
  Moonshot: "kmi",
  Google: "gog",
  xAI: "xai",
  "Moonshot AI": "kmi",
  "Zhipu AI": "glm",
};

const buildSyntheticKey = ({ provider, env, seed }) => {
  const prefix = providerPrefix[provider] || "mdl";
  const mode = env === "production" ? "live" : "test";
  const safeSeed = String(seed || "demo").replace(/[^a-z0-9]/gi, "").slice(0, 14) || Math.random().toString(36).slice(2, 10);
  return `sk-${prefix}-${mode}-${safeSeed}${Math.random().toString(36).slice(2, 8)}`;
};

const buildInternalPlatformToken = ({ projectId = "project", memberId = "member", provider = "", modelLabel = "", lineId = "" }) => {
  const scope = [projectId, memberId, lineId || provider || modelLabel]
    .map((value) => String(value || "").replace(/[^a-z0-9]/gi, "").toLowerCase())
    .filter(Boolean)
    .join("")
    .slice(0, 18) || "platform";
  return `eth_${scope}_${Math.random().toString(36).slice(2, 14)}`;
};

const buildGatewayExpiry = (env = "testing") => new Date(
  Date.now() + (env === "production" ? 90 : 45) * 24 * 60 * 60 * 1000
).toISOString();

const normalizeGatewayList = (value, fallback = []) => {
  if (Array.isArray(value)) {
    const normalized = value.map((entry) => String(entry || "").trim()).filter(Boolean);
    return normalized.length ? normalized : [...fallback];
  }
  const normalized = String(value || "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  return normalized.length ? normalized : [...fallback];
};

const normalizeProvisionMember = (member = {}, index = 0, projectId = "project") => {
  const email = member.email || `${String(member.name || `member-${index + 1}`).toLowerCase().replace(/\s+/g, ".")}@ethara.ai`;
  const name = member.name || resolveMemberNameFromEmail(email);
  return {
    id: member.id || `${projectId}-member-${index + 1}`,
    name,
    role: member.role || "Member",
    email,
  };
};

const normalizeAccessTokenRecord = (token = {}, context = {}) => {
  const member = normalizeProvisionMember(context.member || {
    id: token.memberId,
    name: token.memberName || token.name,
    role: token.memberRole || token.role,
    email: token.memberEmail || token.email,
  }, context.index || 0, context.projectId || "project");
  const budgetCap = Number(token.budgetCap ?? context.budgetCap ?? 0);
  const remainingBudget = Number(token.remainingBudget ?? Math.max(0, budgetCap - Number(token.spentBudget || 0)));
  const internalToken = String(token.internalToken || buildInternalPlatformToken({
    projectId: context.projectId,
    memberId: member.id,
    provider: context.provider,
    modelLabel: context.modelLabel,
    lineId: context.lineId,
  })).trim();
  return {
    id: token.id || `tok-${member.id}-${String(context.lineId || context.modelId || context.modelLabel || "access").replace(/[^a-z0-9]/gi, "").toLowerCase().slice(0, 12)}`,
    memberId: member.id,
    memberName: member.name,
    memberEmail: member.email,
    memberRole: member.role,
    internalToken,
    maskedToken: token.maskedToken || maskInternalToken(internalToken),
    status: token.status || "active",
    env: token.env || context.env || "testing",
    gatewayRoute: token.gatewayRoute || context.gatewayRoute || "/api/gateway/execute",
    allowedModelId: token.allowedModelId || context.modelId || "",
    allowedModelLabel: token.allowedModelLabel || context.modelLabel || "Project access",
    provider: token.provider || context.provider || "",
    issuedAt: token.issuedAt || context.issuedAt || new Date().toISOString(),
    expiresAt: token.expiresAt || context.expiresAt || buildGatewayExpiry(context.env || token.env || "testing"),
    lastUsed: token.lastUsed || null,
    rateLimitPerMinute: Number(token.rateLimitPerMinute ?? context.rateLimitPerMinute ?? 120),
    budgetCap,
    remainingBudget,
    spentBudget: Number(token.spentBudget ?? Math.max(0, budgetCap - remainingBudget)),
    allowedNetworks: normalizeGatewayList(token.allowedNetworks, context.allowedNetworks || ["Corp VPN"]),
    allowedDevices: normalizeGatewayList(token.allowedDevices, context.allowedDevices || ["Managed laptop"]),
    usage: {
      requests: Number(token.usage?.requests ?? token.requestCount ?? 0),
      totalCost: Number(token.usage?.totalCost ?? token.totalCost ?? 0),
      inputTokens: Number(token.usage?.inputTokens ?? 0),
      outputTokens: Number(token.usage?.outputTokens ?? 0),
    },
  };
};

const normalizeGatewayPolicy = (policy = {}, context = {}) => ({
  allowedModelId: policy.allowedModelId || context.modelId || "",
  allowedModelLabel: policy.allowedModelLabel || context.modelLabel || "Project access",
  provider: policy.provider || context.provider || "",
  rateLimitPerMinute: Number(policy.rateLimitPerMinute ?? context.rateLimitPerMinute ?? 120),
  budgetCap: Number(policy.budgetCap ?? context.budgetCap ?? 0),
  remainingBudget: Number(policy.remainingBudget ?? context.remainingBudget ?? policy.budgetCap ?? context.budgetCap ?? 0),
  expiresAt: policy.expiresAt || context.expiresAt || buildGatewayExpiry(context.env || "testing"),
  allowedNetworks: normalizeGatewayList(policy.allowedNetworks, context.allowedNetworks || ["Corp VPN"]),
  allowedDevices: normalizeGatewayList(policy.allowedDevices, context.allowedDevices || ["Managed laptop"]),
});

const normalizeItProvisioningLine = (line = {}, request = {}, index = 0) => {
  const env = line.env || (request?.budgetType === "Production" ? "production" : "testing");
  const budgetCap = Number(line.budgetCap ?? line.amount ?? 0);
  return {
    id: line.id || `${request?.id || "it-request"}-line-${index + 1}`,
    label: line.label || line.model || line.optionLabel || `Provision line ${index + 1}`,
    modelId: line.modelId || "",
    provider: line.provider || "Anthropic",
    env,
    fullKey: String(line.fullKey || ""),
    maskedKey: line.maskedKey || (line.fullKey ? maskKey(String(line.fullKey).trim()) : ""),
    memberIds: Array.isArray(line.memberIds) && line.memberIds.length
      ? [...line.memberIds]
      : (request.members || []).map((member) => member.id),
    rateLimitPerMinute: Number(line.rateLimitPerMinute ?? 120),
    budgetCap,
    remainingBudget: Number(line.remainingBudget ?? budgetCap),
    allowedNetworks: normalizeGatewayList(line.allowedNetworks, ["Corp VPN"]),
    allowedDevices: normalizeGatewayList(line.allowedDevices, ["Managed laptop"]),
    expiresAt: line.expiresAt || buildGatewayExpiry(env),
    issuedTokenCount: Number(line.issuedTokenCount ?? line.memberIds?.length ?? 0),
  };
};

const normalizeItProvisioningRequest = (request = {}) => {
  const projectId = request.projectId || request.project || "project";
  const members = (Array.isArray(request.members) ? request.members : []).map((member, index) => (
    normalizeProvisionMember(member, index, projectId)
  ));
  const normalizeSummaryLine = (line = {}, index = 0) => ({
    id: line.id || `${projectId}-request-line-${index + 1}`,
    modelId: line.modelId || "",
    label: line.label || line.model || line.optionLabel || `Line ${index + 1}`,
    provider: line.provider || "Anthropic",
    amount: Number(line.amount || line.estCost || 0),
    usageTag: line.usageTag || "",
  });
  return {
    ...request,
    projectId,
    projectName: request.projectName || projectId,
    approvedAmount: Number(request.approvedAmount || 0),
    budgetType: request.budgetType || "Production",
    gatewayRoute: request.gatewayRoute || "/api/gateway/execute",
    members,
    requestedModels: (Array.isArray(request.requestedModels) ? request.requestedModels : []).map(normalizeSummaryLine),
    requestedInfra: (Array.isArray(request.requestedInfra) ? request.requestedInfra : []).map(normalizeSummaryLine),
    requestedSubs: (Array.isArray(request.requestedSubs) ? request.requestedSubs : []).map(normalizeSummaryLine),
    lines: (Array.isArray(request.lines) ? request.lines : []).map((line, index) => normalizeItProvisioningLine(line, { ...request, members }, index)),
  };
};

const normalizeModelKeyRecord = (record = {}) => {
  const projectId = record.project || record.projectId || "project";
  const provider = record.provider || "Anthropic";
  const modelLabel = record.model || record.label || "Project access";
  const env = record.env || "testing";
  const members = (Array.isArray(record.members) ? record.members : []).map((member, index) => (
    normalizeProvisionMember(member, index, projectId)
  ));
  const gatewayPolicy = normalizeGatewayPolicy(record.gatewayPolicy || {}, {
    modelId: record.modelId || "",
    modelLabel,
    provider,
    env,
    budgetCap: Number(record.gatewayPolicy?.budgetCap ?? 0),
    remainingBudget: Number(record.gatewayPolicy?.remainingBudget ?? record.gatewayPolicy?.budgetCap ?? 0),
    allowedNetworks: ["Corp VPN"],
    allowedDevices: ["Managed laptop"],
  });
  const fallbackBudgetPerMember = members.length ? gatewayPolicy.budgetCap / members.length : gatewayPolicy.budgetCap;
  const fallbackRemainingPerMember = members.length ? gatewayPolicy.remainingBudget / members.length : gatewayPolicy.remainingBudget;
  const accessTokens = (Array.isArray(record.accessTokens) && record.accessTokens.length
    ? record.accessTokens
    : members.map((member) => ({ memberId: member.id, memberName: member.name, memberEmail: member.email, memberRole: member.role })))
    .map((token, index) => normalizeAccessTokenRecord(token, {
      member: members[index] || members.find((member) => member.id === token.memberId),
      index,
      projectId,
      provider,
      modelId: record.modelId || "",
      modelLabel,
      env,
      lineId: record.id,
      gatewayRoute: record.gatewayRoute || "/api/gateway/execute",
      rateLimitPerMinute: gatewayPolicy.rateLimitPerMinute,
      budgetCap: fallbackBudgetPerMember,
      remainingBudget: fallbackRemainingPerMember,
      allowedNetworks: gatewayPolicy.allowedNetworks,
      allowedDevices: gatewayPolicy.allowedDevices,
      expiresAt: gatewayPolicy.expiresAt,
      issuedAt: record.createdAt,
    }));
  const fullKey = String(record.fullKey || "");
  return {
    ...record,
    project: projectId,
    projectName: record.projectName || projectId,
    provider,
    model: modelLabel,
    env,
    fullKey,
    maskedKey: record.maskedKey || (fullKey ? maskKey(fullKey) : ""),
    type: record.type || "R&D",
    tags: Array.isArray(record.tags) ? record.tags : [],
    lastUsed: record.lastUsed || record.createdAt || null,
    usage: Number(record.usage || 0),
    gatewayRoute: record.gatewayRoute || "/api/gateway/execute",
    gatewayPolicy,
    members,
    accessTokens,
  };
};

const resolveMemberNameFromEmail = (email = "") => {
  const localPart = String(email || "").split("@")[0] || "";
  const acronyms = {
    ai: "AI",
    cfo: "CFO",
    cto: "CTO",
    it: "IT",
    pl: "PL",
    ql: "QL",
    rd: "R&D",
    rnd: "R&D",
    tpm: "TPM",
  };
  return localPart
    .split(/[._-]+/)
    .filter(Boolean)
    .map((token) => {
      const lowered = token.toLowerCase();
      if (acronyms[lowered]) return acronyms[lowered];
      return token.charAt(0).toUpperCase() + token.slice(1);
    })
    .join(" ") || email;
};

const findDirectoryMember = ({ name, email }) => {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  if (normalizedEmail) {
    const matchByEmail = findProjectDirectoryMember({ email: normalizedEmail })
      || USERS.find((member) => String(member?.email || "").trim().toLowerCase() === normalizedEmail);
    if (matchByEmail) return matchByEmail;
  }
  const normalizedName = String(name || "").trim().toLowerCase();
  if (normalizedName) {
    return findProjectDirectoryMember({ name: normalizedName })
      || USERS.find((member) => String(member?.name || "").trim().toLowerCase() === normalizedName)
      || null;
  }
  return null;
};

const normalizeProjectMemberRole = (candidateRole = "", fallbackRole = "Member") => {
  if (fallbackRole === "TPM") return "TPM";
  if (fallbackRole === "R&D") return candidateRole === "Engineer" ? "Engineer" : "R&D";
  if (fallbackRole === "PL / QL") {
    if (candidateRole === "Quality Lead" || candidateRole === "QL") return "Quality Lead";
    if (candidateRole === "Project Lead" || candidateRole === "PL") return "Project Lead";
    return "PL / QL";
  }
  return candidateRole || fallbackRole;
};

const normalizeMemberRecord = (member, fallbackRole = "Member", fallbackStatus = "Pending kickoff") => ({
  id: member.id,
  name: member.name,
  role: member.role || fallbackRole,
  email: member.email || `${member.name.toLowerCase().replace(/\s+/g, ".")}@ethara.ai`,
  status: member.status || fallbackStatus,
  tasksDone: Number(member.tasksDone || 0),
});

const buildTeamMember = ({ projectId, name, email, role, fallbackStatus = "Pending kickoff", index = 0 }) => {
  const member = findDirectoryMember({ name, email });
  const resolvedEmail = email || member?.email || (name ? `${name.toLowerCase().replace(/\s+/g, ".")}@ethara.ai` : "");
  const resolvedName = name || member?.name || resolveMemberNameFromEmail(resolvedEmail);
  const resolvedRole = normalizeProjectMemberRole(member?.role || role || "", role || member?.role || "R&D");
  return normalizeMemberRecord({
    id: member?.id || `${projectId}-tm-${index + 1}`,
    name: resolvedName,
    role: resolvedRole,
    email: resolvedEmail,
    status: role === "TPM" ? "Online" : fallbackStatus,
  }, resolvedRole, fallbackStatus);
};

const mergeTeamMembers = (existing = [], incoming = []) => {
  const merged = new Map();
  [...existing, ...incoming].forEach((member, index) => {
    const key = member.id || member.email || member.name || `member-${index}`;
    if (!merged.has(key)) merged.set(key, normalizeMemberRecord(member));
  });
  return Array.from(merged.values());
};

const summarizeRequestedLines = (items = {}, fallbackProject, modelCatalog = BEDROCK_MODELS) => {
  const modelLines = (items.models || []).map((line, index) => {
    const meta = line.meta || findModelInCatalog(modelCatalog, line.modelId || line.modelName);
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

const normalizeTaskSheetRow = (row = {}, index = 0, status = "success", modelCatalog = BEDROCK_MODELS) => {
  const modelMeta = findModelInCatalog(modelCatalog, row.modelId || row.modelName);
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

const normalizeTaskSheetRows = (rows = [], status = "success", modelCatalog = BEDROCK_MODELS) =>
  (Array.isArray(rows) ? rows : [])
    .map((row, index) => normalizeTaskSheetRow(row, index, status, modelCatalog))
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
      acc[key].tasksDone += getTaskQuantityFromRow(row);
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
        action: "Submitted additional request",
        detail: `${request?.type || "Additional request"} · $${Number(request?.amount || 0).toLocaleString()}`,
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
  misc: cloneLines(items.misc || []),
});

const sumBudgetLines = (lines = []) =>
  (Array.isArray(lines) ? lines : []).reduce((sum, line) => sum + Number(line?.estCost || line?.amount || 0), 0);

const sumBudgetItems = (items = {}) =>
  sumBudgetLines(items.models) + sumBudgetLines(items.infra) + sumBudgetLines(items.subs) + sumBudgetLines(items.misc);

const formatBudgetMoney = (value = 0) =>
  `$${Number(value || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const buildBudgetItemsChangeSummary = (items = {}) => {
  const lineItems = cloneBudgetItems(items);
  const totals = {
    models: sumBudgetLines(lineItems.models),
    infra: sumBudgetLines(lineItems.infra),
    subs: sumBudgetLines(lineItems.subs),
    misc: sumBudgetLines(lineItems.misc),
  };
  const total = totals.models + totals.infra + totals.subs + totals.misc;
  const lineCount = lineItems.models.length + lineItems.infra.length + lineItems.subs.length + lineItems.misc.length;
  const parts = [
    totals.models > 0 ? `Models ${formatBudgetMoney(totals.models)}` : "",
    totals.infra > 0 ? `Infrastructure ${formatBudgetMoney(totals.infra)}` : "",
    totals.subs > 0 ? `Subscriptions ${formatBudgetMoney(totals.subs)}` : "",
    totals.misc > 0 ? `General ${formatBudgetMoney(totals.misc)}` : "",
  ].filter(Boolean);
  return [
    `Total ${formatBudgetMoney(total)}`,
    ...parts,
    lineCount > 0 ? `${lineCount} line item${lineCount === 1 ? "" : "s"}` : "",
  ].filter(Boolean).join(" · ");
};

const clonePhases = (phases = []) => phases.map((phase) => ({ ...phase }));

const normalizeBreakdownEntries = (section = {}, fallbackProvider = "") => {
  const rawEntries = Array.isArray(section?.entries) && section.entries.length
    ? section.entries
    : section?.enabled || section?.amount || section?.optionId || section?.optionLabel || section?.note
      ? [section]
      : [];

  return rawEntries
    .map((entry, index) => ({
      id: entry.id || `${String(fallbackProvider || "entry").toLowerCase()}-${index + 1}`,
      optionId: entry.optionId || "",
      optionLabel: String(entry.optionLabel || entry.label || "").trim(),
      note: String(entry.note || "").trim(),
      amount: Number(entry.amount || entry.estCost || 0),
      provider: String(entry.provider || fallbackProvider || "").trim(),
      billingUnit: entry.billingUnit || "",
    }))
    .filter((entry) => entry.amount > 0 || entry.optionLabel || entry.note);
};

const buildNormalizedBreakdownSection = (entries = [], extra = {}) => {
  if (!entries.length) return null;
  return {
    amount: entries.reduce((sum, entry) => sum + Number(entry.amount || 0), 0),
    optionLabel: entries.map((entry) => entry.optionLabel).filter(Boolean).join(" | "),
    note: entries.map((entry) => entry.note).filter(Boolean).join(" | "),
    entries,
    ...extra,
  };
};

const getPendingWorkflowMeta = (budgetType = "") => {
  const normalized = normalizeBudgetType(budgetType);
  if (normalized === "Testing") {
    return { stage: "testing-budget-pending", status: "Testing budget pending approval" };
  }
  if (normalized === "RnD") {
    return { stage: "rnd-budget-pending", status: "Sample budget pending approval" };
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
    return { stage: "sample-active", status: "Sample budget approved", type: "R&D", readyForTpmBudget: false };
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

const BUDGET_RETRY_DELAY_MS = 24 * 60 * 60 * 1000;

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
    ...cloneLines(items.misc || []).map((line) => ({ bucket: "misc", line })),
  ];
  let running = 0;
  const scaledBuckets = { models: [], infra: [], subs: [], misc: [] };
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
    teamType: payload.teamType || "",
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
    miscCost: Number(payload.totals?.general || payload.totals?.misc || 0),
    justification: `${formatBudgetTypeLabel(normalizedBudgetType)} budget submitted by ${actorName || "team"}${payload.teamType ? ` · ${payload.teamType} team` : ""} · ${Number(payload.totalTasks || 0).toLocaleString()} tasks${Number(payload.totalTrajectories || 0) ? ` · ${Number(payload.totalTrajectories || 0).toLocaleString()} trajectories` : ""}`,
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
        detail: `${formatBudgetTypeLabel(normalizedBudgetType)}${payload.teamType ? ` · ${payload.teamType}` : ""} · $${reviewTotal.toLocaleString()}`,
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
    budgetRejection: null,
    budgetRetryAvailableAt: null,
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

const buildBudgetRejectionState = ({
  actorName = "Approver",
  actorRole = "Approver",
  comment = "",
  at = new Date().toISOString(),
} = {}) => {
  const rejectedAtTs = new Date(at).getTime();
  const retryAtTs = Number.isFinite(rejectedAtTs)
    ? rejectedAtTs + BUDGET_RETRY_DELAY_MS
    : Date.now() + BUDGET_RETRY_DELAY_MS;
  const retryAt = new Date(retryAtTs).toISOString();

  return {
    budgetRejection: {
      at,
      by: actorName,
      role: actorRole,
      note: String(comment || "").trim(),
      retryAt,
    },
    budgetRetryAvailableAt: retryAt,
    pendingBudgetSubmission: null,
    workflowStage: "budget-rejected",
    status: "Budget rejected",
  };
};

const normalizeBudgetReviewRecord = (review = {}) => {
  const ctoModified = hasCtoModifiedBudgetReview(review);
  return {
    ...review,
    ctoModified,
    history: (Array.isArray(review.history) ? review.history : []).map((entry) => (
      entry?.action === "Modified & forwarded to CFO" && !ctoModified
        ? { ...entry, action: "Approved by CTO and forwarded to CFO" }
        : entry
    )),
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

  const [buffers, setBuffers] = useState(() => readJSON(BUFFERS_KEY, DEMO_BUFFERS));
  const [bufferPool, setBufferPool] = useState(() => readJSON(BUFFER_POOL_KEY, DEMO_BUFFER_POOL));
  const [recoveries, setRecoveries] = useState(() => readJSON(RECOVERY_KEY, {}));
  const [customModels, setCustomModels] = useState(() => dedupeModels(readJSON(CUSTOM_MODELS_KEY, [])));
  const [customProjects, setCustomProjects] = useState(() => readJSON(CUSTOM_PROJECTS_KEY, []));
  const [taskLogs, setTaskLogs] = useState(() => readJSON(TASK_LOGS_KEY, DEMO_TASK_LOGS));
  const [topupRequests, setTopupRequests] = useState(() => readJSON(TOPUP_REQ_KEY, DEMO_TOPUP_REQUESTS));
  const [budgets, setBudgets] = useState(() => mergeSeedById(DEMO_BUDGETS, readJSON(BUDGETS_KEY, [])));
  const [batchDeliveries, setBatchDeliveries] = useState(() => readJSON(BATCH_DELIVERIES_KEY, DEMO_BATCH_DELIVERIES));
  const [budgetReviews, setBudgetReviews] = useState(() => dropStaleSeededReviews(mergeSeedById(DEMO_BUDGET_REVIEWS, readJSON(BUDGET_REVIEWS_KEY, []))).map(normalizeBudgetReviewRecord));
  const [changeRequests, setChangeRequests] = useState(() => dropRetiredChangeRequests(mergeSeedById(DEMO_CHANGE_REQUESTS, readJSON(CHANGE_REQUESTS_KEY, []))).map(normalizeChangeRequest));
  const [teamRemovals, setTeamRemovals] = useState(() => readJSON(TEAM_REMOVALS_KEY, DEMO_TEAM_REMOVALS));
  const [modelKeyRecords, setModelKeyRecords] = useState(() => (
    (Array.isArray(readJSON(MODEL_KEYS_KEY, DEMO_MODEL_KEYS)) ? readJSON(MODEL_KEYS_KEY, DEMO_MODEL_KEYS) : DEMO_MODEL_KEYS)
      .map(normalizeModelKeyRecord)
  ));
  const [itProvisioningRequests, setItProvisioningRequests] = useState(() => (
    (Array.isArray(readJSON(IT_PROVISIONING_KEY, DEMO_IT_PROVISIONING)) ? readJSON(IT_PROVISIONING_KEY, DEMO_IT_PROVISIONING) : DEMO_IT_PROVISIONING)
      .map(normalizeItProvisioningRequest)
  ));
  const [itMonthlyActuals, setItMonthlyActuals] = useState(() => readJSON(IT_MONTHLY_ACTUALS_KEY, DEMO_IT_MONTHLY_ACTUALS));

  // Hydration + backend sync bookkeeping
  const [hydrated, setHydrated] = useState(false);
  const [syncStatus, setSyncStatus] = useState("idle"); // idle | loading | saving | error
  const saveTimerRef = useRef(null);
  const lastSavedPayloadRef = useRef("");

  useEffect(() => {
    if (user) localStorage.setItem(SESSION_KEY, JSON.stringify(user));
    else localStorage.removeItem(SESSION_KEY);
  }, [user]);

  // Persist to localStorage as an offline-friendly cache (backend is source of truth).
  useEffect(() => localStorage.setItem(BUFFERS_KEY, JSON.stringify(buffers)), [buffers]);
  useEffect(() => localStorage.setItem(BUFFER_POOL_KEY, JSON.stringify(bufferPool)), [bufferPool]);
  useEffect(() => localStorage.setItem(RECOVERY_KEY, JSON.stringify(recoveries)), [recoveries]);
  useEffect(() => localStorage.setItem(CUSTOM_MODELS_KEY, JSON.stringify(customModels)), [customModels]);
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

  // Apply a snapshot returned from the backend into every local state slice.
  const applyWorkspaceSnapshot = (snapshot) => {
    if (!snapshot || typeof snapshot !== "object") return;
    if (snapshot.buffers !== undefined) setBuffers(snapshot.buffers || {});
    if (snapshot.bufferPool !== undefined && snapshot.bufferPool) setBufferPool(snapshot.bufferPool);
    if (snapshot.recoveries !== undefined) setRecoveries(snapshot.recoveries || {});
    if (snapshot.customModels !== undefined) setCustomModels(dedupeModels(snapshot.customModels || []));
    if (snapshot.customProjects !== undefined) setCustomProjects(snapshot.customProjects || []);
    if (snapshot.taskLogs !== undefined) setTaskLogs(snapshot.taskLogs || {});
    if (snapshot.topupRequests !== undefined) setTopupRequests(snapshot.topupRequests || []);
    if (snapshot.budgets !== undefined) setBudgets(mergeSeedById(DEMO_BUDGETS, snapshot.budgets || []));
    if (snapshot.batchDeliveries !== undefined) setBatchDeliveries(snapshot.batchDeliveries || []);
    if (snapshot.budgetReviews !== undefined) {
      setBudgetReviews(dropStaleSeededReviews(mergeSeedById(DEMO_BUDGET_REVIEWS, snapshot.budgetReviews || [])).map(normalizeBudgetReviewRecord));
    }
    if (snapshot.changeRequests !== undefined) {
      setChangeRequests(dropRetiredChangeRequests(mergeSeedById(DEMO_CHANGE_REQUESTS, snapshot.changeRequests || [])).map(normalizeChangeRequest));
    }
    if (snapshot.teamRemovals !== undefined) setTeamRemovals(snapshot.teamRemovals || {});
    if (snapshot.modelKeys !== undefined) setModelKeyRecords(snapshot.modelKeys || []);
    if (snapshot.itProvisioning !== undefined) setItProvisioningRequests(snapshot.itProvisioning || []);
    if (snapshot.itMonthlyActuals !== undefined) setItMonthlyActuals(snapshot.itMonthlyActuals || {});
  };

  // Map either raw localStorage-shape (keys like "ethara.customProjects.v3") OR
  // workspace-shape (keys like "customProjects") to a canonical workspace snapshot.
  const normalizeRawImportPayload = (raw) => {
    if (!raw || typeof raw !== "object") return {};
    // Localstorage-key → slice-key mapping (both v2 and v3 supported).
    const localKeyMap = {
      "ethara.buffers.v3": "buffers",
      "ethara.buffers.v2": "buffers",
      "ethara.bufferPool.v3": "bufferPool",
      "ethara.bufferPool.v2": "bufferPool",
      "ethara.recovery.v3": "recoveries",
      "ethara.recovery.v2": "recoveries",
      "ethara.customModels.v2": "customModels",
      "ethara.customModels.v1": "customModels",
      "ethara.customProjects.v3": "customProjects",
      "ethara.customProjects.v2": "customProjects",
      "ethara.taskLogs.v3": "taskLogs",
      "ethara.taskLogs.v2": "taskLogs",
      "ethara.topupRequests.v3": "topupRequests",
      "ethara.topupRequests.v2": "topupRequests",
      "ethara.budgets.v3": "budgets",
      "ethara.budgets.v2": "budgets",
      "ethara.batchDeliveries.v3": "batchDeliveries",
      "ethara.batchDeliveries.v2": "batchDeliveries",
      "ethara.budgetReviews.v3": "budgetReviews",
      "ethara.budgetReviews.v2": "budgetReviews",
      "ethara.changeRequests.v3": "changeRequests",
      "ethara.changeRequests.v2": "changeRequests",
      "ethara.teamRemovals.v3": "teamRemovals",
      "ethara.teamRemovals.v2": "teamRemovals",
      "ethara.modelKeys.v3": "modelKeys",
      "ethara.modelKeys.v2": "modelKeys",
      "ethara.itProvisioning.v3": "itProvisioning",
      "ethara.itProvisioning.v2": "itProvisioning",
      "ethara.itMonthlyActuals.v3": "itMonthlyActuals",
      "ethara.itMonthlyActuals.v2": "itMonthlyActuals",
    };
    const out = {};
    Object.entries(raw).forEach(([key, val]) => {
      const sliceKey = localKeyMap[key] || (WORKSPACE_SLICE_KEYS.includes(key) ? key : null);
      if (!sliceKey) return;
      // localStorage stores each key as JSON.stringified — accept both string and parsed value.
      let parsed = val;
      if (typeof val === "string") {
        try { parsed = JSON.parse(val); } catch { parsed = val; }
      }
      out[sliceKey] = parsed;
    });
    return out;
  };

  // Returns { imported: [sliceKey...], skipped: [key...] }
  const importWorkspaceRaw = async (rawPayload) => {
    const snapshot = normalizeRawImportPayload(rawPayload);
    const importedKeys = Object.keys(snapshot);
    if (!importedKeys.length) {
      throw new Error("No recognized workspace keys found in the payload.");
    }
    // Merge with current values so unspecified slices are preserved.
    const merged = {
      buffers,
      bufferPool,
      recoveries,
      customModels,
      customProjects,
      taskLogs,
      topupRequests,
      budgets,
      batchDeliveries,
      budgetReviews,
      changeRequests,
      teamRemovals,
      modelKeys: modelKeyRecords,
      itProvisioning: itProvisioningRequests,
      itMonthlyActuals,
      ...snapshot,
    };
    applyWorkspaceSnapshot(merged);
    // Immediate push to backend so the import survives even if user closes the tab quickly.
    setSyncStatus("saving");
    try {
      const res = await fetch(WORKSPACE_ENDPOINT, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(merged),
      });
      if (!res.ok) throw new Error(`Workspace save failed: ${res.status}`);
      lastSavedPayloadRef.current = JSON.stringify(merged);
      setSyncStatus("idle");
    } catch (err) {
      setSyncStatus("error");
      throw err;
    }
    return { imported: importedKeys, count: importedKeys.length };
  };

  const exportWorkspaceSnapshot = () => ({
    buffers,
    bufferPool,
    recoveries,
    customModels,
    customProjects,
    taskLogs,
    topupRequests,
    budgets,
    batchDeliveries,
    budgetReviews,
    changeRequests,
    teamRemovals,
    modelKeys: modelKeyRecords,
    itProvisioning: itProvisioningRequests,
    itMonthlyActuals,
  });

  const fetchWorkspaceFromBackend = async () => {
    const res = await fetch(WORKSPACE_ENDPOINT, { headers: { "Content-Type": "application/json" } });
    if (!res.ok) throw new Error(`Workspace fetch failed: ${res.status}`);
    return res.json();
  };

  // Public helper used by the Dashboard "Refresh" button — re-pulls latest
  // workspace snapshot from the backend and applies it to local state.
  const refreshAppData = async () => {
    try {
      const remote = await fetchWorkspaceFromBackend();
      applyWorkspaceSnapshot(remote);
      lastSavedPayloadRef.current = JSON.stringify(WORKSPACE_SLICE_KEYS.reduce((acc, key) => {
        acc[key] = remote[key] !== undefined ? remote[key] : null;
        return acc;
      }, {}));
    } catch (err) {
      console.error("[workspace] refresh failed", err);
    }
  };

  // Initial hydration: pull backend, else migrate localStorage → backend.
  useEffect(() => {
    let cancelled = false;
    setSyncStatus("loading");
    (async () => {
      try {
        const remote = await fetchWorkspaceFromBackend();
        // Only treat backend as populated if it has actual user-generated content.
        // Cosmetic slices like bufferPool are always seeded with demo defaults and
        // must not be treated as "backend already has data" — otherwise we'd apply
        // empty content arrays over the live DEMO_* defaults and lose them.
        const CONTENT_SLICES = [
          "customProjects",
          "budgets",
          "budgetReviews",
          "changeRequests",
          "topupRequests",
          "batchDeliveries",
          "taskLogs",
        ];
        const remoteHasData = remote && CONTENT_SLICES.some((key) => {
          const val = remote[key];
          if (val === undefined || val === null) return false;
          if (Array.isArray(val)) return val.length > 0;
          if (typeof val === "object") return Object.keys(val).length > 0;
          return true;
        });
        if (cancelled) return;
        if (remoteHasData) {
          applyWorkspaceSnapshot(remote);
          lastSavedPayloadRef.current = JSON.stringify(WORKSPACE_SLICE_KEYS.reduce((acc, key) => {
            acc[key] = remote[key] !== undefined ? remote[key] : null;
            return acc;
          }, {}));
        } else {
          // Backend empty — migrate any existing localStorage data upstream.
          const localSnapshot = {
            buffers: readJSON(BUFFERS_KEY, {}),
            bufferPool: readJSON(BUFFER_POOL_KEY, null),
            recoveries: readJSON(RECOVERY_KEY, {}),
            customModels: readJSON(CUSTOM_MODELS_KEY, []),
            customProjects: readJSON(CUSTOM_PROJECTS_KEY, []),
            taskLogs: readJSON(TASK_LOGS_KEY, {}),
            topupRequests: readJSON(TOPUP_REQ_KEY, []),
            budgets: readJSON(BUDGETS_KEY, []),
            batchDeliveries: readJSON(BATCH_DELIVERIES_KEY, []),
            budgetReviews: readJSON(BUDGET_REVIEWS_KEY, []),
            changeRequests: readJSON(CHANGE_REQUESTS_KEY, []),
            teamRemovals: readJSON(TEAM_REMOVALS_KEY, {}),
            modelKeys: readJSON(MODEL_KEYS_KEY, []),
            itProvisioning: readJSON(IT_PROVISIONING_KEY, []),
            itMonthlyActuals: readJSON(IT_MONTHLY_ACTUALS_KEY, {}),
          };
          const localHasData = WORKSPACE_SLICE_KEYS.some((key) => {
            const val = localSnapshot[key];
            if (val === undefined || val === null) return false;
            if (Array.isArray(val)) return val.length > 0;
            if (typeof val === "object") return Object.keys(val).length > 0;
            return true;
          });
          if (localHasData) {
            await fetch(WORKSPACE_ENDPOINT, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(localSnapshot),
            });
            lastSavedPayloadRef.current = JSON.stringify(localSnapshot);
          } else {
            lastSavedPayloadRef.current = "";
          }
        }
        setSyncStatus("idle");
      } catch (err) {
        console.error("[workspace] initial sync failed", err);
        if (!cancelled) setSyncStatus("error");
      } finally {
        if (!cancelled) setHydrated(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Debounced push of the full snapshot to the backend on any state change.
  useEffect(() => {
    if (!hydrated) return;
    const snapshot = {
      buffers,
      bufferPool,
      recoveries,
      customModels,
      customProjects,
      taskLogs,
      topupRequests,
      budgets,
      batchDeliveries,
      budgetReviews,
      changeRequests,
      teamRemovals,
      modelKeys: modelKeyRecords,
      itProvisioning: itProvisioningRequests,
      itMonthlyActuals,
    };
    const serialized = JSON.stringify(snapshot);
    if (serialized === lastSavedPayloadRef.current) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      setSyncStatus("saving");
      try {
        const res = await fetch(WORKSPACE_ENDPOINT, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: serialized,
        });
        if (!res.ok) throw new Error(`Workspace save failed: ${res.status}`);
        lastSavedPayloadRef.current = serialized;
        setSyncStatus("idle");
      } catch (err) {
        console.error("[workspace] save failed", err);
        setSyncStatus("error");
      }
    }, 800);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [
    hydrated,
    buffers,
    bufferPool,
    recoveries,
    customModels,
    customProjects,
    taskLogs,
    topupRequests,
    budgets,
    batchDeliveries,
    budgetReviews,
    changeRequests,
    teamRemovals,
    modelKeyRecords,
    itProvisioningRequests,
    itMonthlyActuals,
  ]);

  // Refetch on tab focus so multiple roles/devices see each other's changes.
  useEffect(() => {
    if (!hydrated) return undefined;
    const onFocus = async () => {
      try {
        const remote = await fetchWorkspaceFromBackend();
        const serialized = JSON.stringify(WORKSPACE_SLICE_KEYS.reduce((acc, key) => {
          acc[key] = remote[key] !== undefined ? remote[key] : null;
          return acc;
        }, {}));
        if (serialized === lastSavedPayloadRef.current) return;
        applyWorkspaceSnapshot(remote);
        lastSavedPayloadRef.current = serialized;
      } catch (err) {
        console.error("[workspace] focus refresh failed", err);
      }
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [hydrated]);

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

  const modelCatalog = useMemo(
    () => mergeModelCatalog(BEDROCK_MODELS, customModels),
    [customModels]
  );

  const addCustomModel = ({ name, provider, modality, pricePer1kIn, pricePer1kOut }) => {
    const trimmedName = String(name || "").trim();
    if (!trimmedName) return null;
    const trimmedProvider = String(provider || "Custom").trim() || "Custom";
    const existing = modelCatalog.find((model) => (
      String(model.name || "").trim().toLowerCase() === trimmedName.toLowerCase()
      && String(model.provider || "").trim().toLowerCase() === trimmedProvider.toLowerCase()
    ));
    if (existing) return existing;

    const customModel = normalizeModelRecord({
      id: buildCustomModelId({ name: trimmedName, provider: trimmedProvider }),
      name: trimmedName,
      provider: trimmedProvider,
      modality: String(modality || "Chat").trim() || "Chat",
      pricePer1kIn: Number(pricePer1kIn || 0),
      pricePer1kOut: Number(pricePer1kOut || 0),
      isCustom: true,
    });

    setCustomModels((current) => dedupeModels([...current, customModel]));
    return customModel;
  };

  // Merge overrides + apply approved top-ups / change requests into project budgets
  const projects = useMemo(() => {
    const baseIds = new Set(PROJECTS.map((project) => project.id));
    // Seed projects are canonical: drop any custom project that duplicates a seed one by
    // name (e.g. a Zoro/Tron created manually before it was seeded) so it never shows twice.
    const baseNames = new Set(PROJECTS.map((project) => String(project.name || "").trim().toLowerCase()));
    const overrides = new Map(customProjects.map((project) => [project.id, project]));
    const merged = [
      ...PROJECTS.map((project) => ({ ...project, ...(overrides.get(project.id) || {}) })),
      ...customProjects.filter(
        (project) => !baseIds.has(project.id) && !baseNames.has(String(project.name || "").trim().toLowerCase())
      ),
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
    const latestApprovedBudgetByProject = {};
    const trackApprovedBudget = (projectId, amount, at) => {
      if (!projectId || amount <= 0) return;
      const ts = at ? new Date(at).getTime() : 0;
      const safeTs = Number.isNaN(ts) ? 0 : ts;
      const current = latestApprovedBudgetByProject[projectId];
      if (!current || safeTs >= current.ts) {
        latestApprovedBudgetByProject[projectId] = { amount, ts: safeTs };
      }
    };
    budgets.forEach((entry) => {
      if (entry.status !== "approved" && entry.status !== "partial") return;
      trackApprovedBudget(
        entry.projectId,
        Number(entry.approvedAmount || entry.cfoDecision?.amount || entry.totals?.total || 0),
        entry.cfoDecision?.at || entry.submittedAt
      );
    });
    budgetReviews.forEach((review) => {
      if (review.status !== "approved" && review.status !== "partial") return;
      trackApprovedBudget(
        review.projectId,
        Number(review.cfoDecision?.amount || review.modifiedTotal || review.requestedBudget || 0),
        review.cfoDecision?.at || review.submittedAt
      );
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
    const generalActualSpendByProject = {};
    Object.entries(taskLogs || {}).forEach(([key, logs]) => {
      const [projectId] = String(key || "").split("::");
      if (!projectId) return;
      (Array.isArray(logs) ? logs : []).forEach((log) => {
        if (!isGeneralActualLog(log)) return;
        const spend = Array.isArray(log.generalActualRows) && log.generalActualRows.length
          ? getGeneralActualRowsCostTotal(log.generalActualRows)
          : Number(log.cost || 0);
        generalActualSpendByProject[projectId] = (generalActualSpendByProject[projectId] || 0) + spend;
      });
    });
    return merged.map((p) => {
      const topupBonus = finalizedByProject[p.id] || 0;
      const changeBonus = finalizedChangesByProject[p.id] || 0;
      const baseApprovedBudget = Math.max(
        Number(p.approvedBudget || 0),
        Number(latestApprovedBudgetByProject[p.id]?.amount || 0)
      );
      const approvedBudget = baseApprovedBudget + topupBonus + changeBonus;
      const estimatedBudget = Math.max(Number(p.estimatedBudget || 0), baseApprovedBudget || 0);
      const generalActualSpend = Number(generalActualSpendByProject[p.id] || 0);
      const actualSpend = Number(p.actualSpend || 0) + generalActualSpend;
      const recoveredAmount = recoveries[p.id] ?? recoveryByProject[p.id] ?? p.recoveredAmount;
      const itActuals = summarizeItProjectActuals(itMonthlyActuals[p.id] || {});
      const hasItActuals = itActuals.totalActual > 0 || itActuals.dailyActuals.length > 0 || itActuals.modelUsage.length > 0 || itActuals.monthEndActual > 0;
      const cfoBaseActualSpend = hasItActuals
        ? (itActuals.monthEndActual > 0 ? itActuals.monthEndActual : itActuals.totalActual)
        : Number(p.actualSpend || 0);
      const cfoActualSpend = cfoBaseActualSpend + generalActualSpend;
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
        estimatedBudget,
        recoveredAmount,
        health: nextHealth,
        actualSpend,
        topupsTotal: (p.topupsTotal || 0) + topupBonus,
        changeRequestsTotal: (p.changeRequestsTotal || 0) + changeBonus,
        remaining: approvedBudget - actualSpend,
        utilization: approvedBudget > 0 ? Math.round((actualSpend / approvedBudget) * 100) : 0,
        itActuals,
        cfoActualSpend,
        cfoRemaining,
        cfoUtilization,
        cfoVariance,
        cfoBurnRate,
        cfoTopModel: itActuals.modelUsage[0]?.modelName || p.topModel || "—",
      };
    });
  }, [buffers, recoveries, customProjects, topupRequests, changeRequests, budgets, budgetReviews, batchDeliveries, itMonthlyActuals, taskLogs]);

  const visibleProjects = useMemo(() => {
    if (!user) return [];
    let list = projects.filter((project) => !project?.archived && !project?.deleted);
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
    return list;
  }, [projects, user]);

  // The client project name is visible only to the CFO. Mask it on the projects exposed to the
  // rest of the app; the internal `projects`/`visibleProjects` stay intact for edits and aggregation.
  const canViewClientName = user?.role === "CFO";
  const maskClientName = (project) => ({ ...project, client: "", clientProjectName: "" });
  const exposedProjects = useMemo(
    () => (canViewClientName ? projects : projects.map(maskClientName)),
    [projects, canViewClientName]
  );
  const exposedVisibleProjects = useMemo(
    () => (canViewClientName ? visibleProjects : visibleProjects.map(maskClientName)),
    [visibleProjects, canViewClientName]
  );

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

  // Edit core project details from the project view. Client name may only be changed by the CFO.
  const updateProjectDetails = (projectId, updates = {}) => {
    upsertProjectOverride(projectId, (project) => {
      const next = { ...project };
      if (typeof updates.name === "string" && updates.name.trim()) next.name = updates.name.trim();
      if (typeof updates.goal === "string") next.goal = updates.goal;
      if (typeof updates.startDate === "string" && updates.startDate) next.startDate = updates.startDate;
      if (typeof updates.estimatedEndDate === "string") next.estimatedEndDate = updates.estimatedEndDate;
      if (typeof updates.client === "string" && user?.role === "CFO") {
        next.client = updates.client;
        next.clientProjectName = updates.client;
      }
      next.auditLog = [
        {
          id: `a-${projectId}-${Date.now().toString(36)}-edit`,
          ts: new Date().toISOString(),
          actor: `${user?.name || "User"} · ${user?.role || "User"}`,
          action: "Project details updated",
          detail: Object.keys(updates).filter((key) => updates[key] !== undefined && updates[key] !== "").join(", ") || "Details edited",
        },
        ...(project.auditLog || []),
      ];
      return next;
    });
  };

  const addProjectTeamMembers = (projectId, members = [], source = "Budget Builder") => {
    if (!members.length) return;
    const currentProject = projects.find((project) => project.id === projectId);
    const incoming = members.map((member, index) => {
      const resolved = buildTeamMember({
        projectId,
        name: member.name,
        email: member.email,
        role: member.role,
        fallbackStatus: "Added later",
        index: (currentProject?.teamMembers || []).length + index,
      });
      return { ...resolved, role: member.role || resolved.role };
    });
    setTeamRemovals((prev) => {
      const currentRemoved = prev[projectId] || [];
      if (!currentRemoved.length) return prev;
      const incomingIds = new Set(incoming.map((member) => member.id));
      const nextRemoved = currentRemoved.filter((memberId) => !incomingIds.has(memberId));
      if (nextRemoved.length === currentRemoved.length) return prev;
      return { ...prev, [projectId]: nextRemoved };
    });
    upsertProjectOverride(projectId, (project) => {
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

  const updateProjectCoreMembers = (projectId, updates = {}, source = "CTO") => {
    const currentProject = projects.find((project) => project.id === projectId);
    if (!currentProject) return null;

    const now = new Date().toISOString();
    const currentTpmName = String(currentProject.tpm || "").trim();
    const currentRndLeadName = String(currentProject.rnd || "").trim();
    const nextTpmName = String(updates.tpmName || currentTpmName).trim();
    const nextTpmEmail = String(updates.tpmEmail || "").trim();
    const nextRndLeadName = String(updates.rndLeadName || currentRndLeadName).trim();
    const nextRndLeadEmail = String(updates.rndLeadEmail || "").trim();

    const baseTeam = mergeTeamMembers(
      currentProject.teamMembers?.length
        ? currentProject.teamMembers
        : [
            currentProject.tpm ? buildTeamMember({ projectId, name: currentProject.tpm, role: "TPM", fallbackStatus: "Online" }) : null,
            currentProject.pl ? buildTeamMember({ projectId, name: currentProject.pl, role: "Project Lead" }) : null,
            currentProject.rnd ? buildTeamMember({ projectId, name: currentProject.rnd, role: "R&D" }) : null,
            ...(currentProject.plMembers || []).map((name, index) => buildTeamMember({ projectId, name, role: "Project Lead", index })),
            ...(currentProject.qlMembers || []).map((name, index) => buildTeamMember({ projectId, name, role: "Quality Lead", index: index + 10 })),
            ...(currentProject.rndMembers || []).map((name, index) => buildTeamMember({ projectId, name, role: "R&D", index: index + 20 })),
          ].filter(Boolean),
    );

    const replaceCoreMember = (members, { currentName, nextName, nextEmail, role, fallbackStatus = "Pending kickoff" }) => {
      if (!nextName && !nextEmail) return { members, replacement: null };
      const replacement = buildTeamMember({
        projectId,
        name: nextName,
        email: nextEmail,
        role,
        fallbackStatus,
        index: members.length,
      });
      const currentKeys = new Set(
        [currentName]
          .filter(Boolean)
          .map((value) => String(value).trim().toLowerCase()),
      );
      const replacementKeys = new Set(
        [replacement.id, replacement.email, replacement.name]
          .filter(Boolean)
          .map((value) => String(value).trim().toLowerCase()),
      );
      const trimmedMembers = members.filter((member) => {
        const memberKeys = [member.id, member.email, member.name]
          .filter(Boolean)
          .map((value) => String(value).trim().toLowerCase());
        const matchesCurrent = currentKeys.size && memberKeys.some((value) => currentKeys.has(value));
        const matchesReplacement = memberKeys.some((value) => replacementKeys.has(value));
        return !matchesCurrent && !matchesReplacement;
      });
      return {
        members: mergeTeamMembers(trimmedMembers, [replacement]),
        replacement,
      };
    };

    const tpmResult = replaceCoreMember(baseTeam, {
      currentName: currentTpmName,
      nextName: nextTpmName,
      nextEmail: nextTpmEmail,
      role: "TPM",
      fallbackStatus: "Online",
    });
    const rndResult = replaceCoreMember(tpmResult.members, {
      currentName: currentRndLeadName,
      nextName: nextRndLeadName,
      nextEmail: nextRndLeadEmail,
      role: "R&D",
      fallbackStatus: "Pending kickoff",
    });
    const replacementMembers = [tpmResult.replacement, rndResult.replacement].filter(Boolean);

    setTeamRemovals((prev) => {
      const removed = prev[projectId] || [];
      if (!removed.length) return prev;
      const restoredIds = new Set(replacementMembers.map((member) => member.id));
      const nextRemoved = removed.filter((memberId) => !restoredIds.has(memberId));
      if (nextRemoved.length === removed.length) return prev;
      return { ...prev, [projectId]: nextRemoved };
    });

    upsertProjectOverride(projectId, (project) => {
      const teamMembers = rndResult.members;
      const kickoffRecipients = teamMembers.map((member) => ({
        id: member.id,
        name: member.name,
        role: member.role,
        email: member.email,
      }));
      const rndMembers = Array.from(new Set([
        ...((project.rndMembers || []).filter((name) => String(name || "").trim().toLowerCase() !== currentRndLeadName.toLowerCase())),
        ...teamMembers
          .filter((member) => member.role === "R&D" || member.role === "Engineer")
          .map((member) => member.name),
      ]));
      const auditEntry = {
        id: `a-${projectId}-${Date.now().toString(36)}-core`,
        ts: now,
        actor: `${user?.name || source} · ${user?.role || source}`,
        action: "Project core members updated",
        detail: `TPM: ${currentTpmName || "—"} → ${tpmResult.replacement?.name || currentTpmName || "—"} · R&D Lead: ${currentRndLeadName || "—"} → ${rndResult.replacement?.name || currentRndLeadName || "—"}`,
      };
      return {
        ...project,
        tpm: tpmResult.replacement?.name || currentTpmName,
        rnd: rndResult.replacement?.name || currentRndLeadName,
        rndMembers,
        teamMembers,
        kickoffMail: project.kickoffMail
          ? { ...project.kickoffMail, recipients: kickoffRecipients }
          : {
              sentAt: now,
              subject: `${project.name} kickoff`,
              sentBy: user?.name || source,
              sentByRole: user?.role || source,
              recipients: kickoffRecipients,
              attachmentCount: (project.docs || []).length,
            },
        auditLog: [auditEntry, ...(project.auditLog || [])],
      };
    });

    return {
      tpm: tpmResult.replacement?.name || currentTpmName,
      rndLead: rndResult.replacement?.name || currentRndLeadName,
    };
  };

  const archiveProject = (projectId, { mode = "archive", note = "" } = {}) => {
    const currentProject = projects.find((project) => project.id === projectId);
    if (!currentProject) return null;
    const now = new Date().toISOString();
    const isDelete = mode === "delete";
    upsertProjectOverride(projectId, (project) => ({
      ...project,
      archived: true,
      deleted: isDelete,
      archivedMode: isDelete ? "delete" : "archive",
      archivedAt: now,
      archivedBy: user?.name || "CTO",
      status: isDelete ? "Deleted" : "Archived",
      auditLog: [
        {
          id: `a-${projectId}-${Date.now().toString(36)}-${isDelete ? "delete" : "archive"}`,
          ts: now,
          actor: `${user?.name || "CTO"} · ${user?.role || "CTO"}`,
          action: isDelete ? "Project deleted from active workspace" : "Project archived",
          detail: note || (isDelete ? "Removed from active workspace by CTO" : "Archived from active workspace by CTO"),
        },
        ...(project.auditLog || []),
      ],
    }));
    return { id: projectId, mode: isDelete ? "delete" : "archive" };
  };

  const deleteProject = (projectId, options = {}) => archiveProject(projectId, { ...options, mode: "delete" });

  const addProject = (payload) => {
    const id = `p-${Date.now().toString(36)}`;
    const isTpmCreatedProject = String(payload.createdByRole || "").trim().toUpperCase() === "TPM";
    const explicitMembers = Array.isArray(payload.assignedMembers)
      ? payload.assignedMembers.filter((member) => member?.name || member?.email)
      : [];
    const fallbackRndMembers = payload.rndMembers || [];
    const fallbackPlMembers = payload.plMembers || [];
    const fallbackQlMembers = payload.qlMembers || [];
    const seededMembers = explicitMembers.length
      ? explicitMembers.map((member, index) => buildTeamMember({
          projectId: id,
          name: member.name,
          email: member.email,
          role: member.role,
          fallbackStatus: member.status || "Pending kickoff",
          index,
        }))
      : [
          payload.tpm ? { name: payload.tpm, role: "TPM", status: "Online" } : null,
          ...fallbackPlMembers.map((name) => ({ name, role: "PL / QL" })),
          ...fallbackQlMembers.map((name) => ({ name, role: "QL" })),
          ...fallbackRndMembers.map((name) => ({ name, role: "R&D" })),
        ]
          .filter(Boolean)
          .map((member, index) => buildTeamMember({
            projectId: id,
            name: member.name,
            email: member.email,
            role: member.role,
            fallbackStatus: member.status || "Pending kickoff",
            index,
          }));
    const teamMembers = mergeTeamMembers([], seededMembers);
    const tpmMember = teamMembers.find((member) => member.role === "TPM");
    const plMembers = payload.plMembers?.length
      ? payload.plMembers
      : teamMembers
          .filter((member) => member.role === "PL / QL" || member.role === "Project Lead")
          .map((member) => member.name);
    const qlMembers = payload.qlMembers?.length
      ? payload.qlMembers
      : teamMembers
          .filter((member) => member.role === "QL" || member.role === "Quality Lead")
          .map((member) => member.name);
    const rndMembers = payload.rndMembers?.length
      ? payload.rndMembers
      : teamMembers
          .filter((member) => member.role === "R&D" || member.role === "Engineer")
          .map((member) => member.name);
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
      goal: payload.goal || "",
      requirements: docs.map((doc) => ({
        id: doc.id,
        name: doc.name,
        kind: doc.kind,
        url: doc.url || "",
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
    const assignmentSummary = [
      payload.tpm ? `Assigned TPM: ${payload.tpm}` : null,
      plMembers.length ? `PL/QL: ${plMembers.join(", ")}` : null,
      qlMembers.length ? `QL: ${qlMembers.join(", ")}` : null,
      rndMembers.length ? `R&D: ${rndMembers.join(", ")}` : null,
    ].filter(Boolean);
    const kickoffSummary = [
      payload.startDate ? `Start ${payload.startDate}` : null,
      payload.goal ? `Project Goal: ${payload.goal}` : null,
      docs.length ? `${docs.length} attachment${docs.length === 1 ? "" : "s"}` : null,
    ].filter(Boolean);
    const proj = {
      id,
      name: payload.internalName,
      clientProjectName: payload.clientProjectName,
      client: payload.clientProjectName || "New Engagement",
      createdBy: payload.createdBy || "CTO",
      createdByRole: payload.createdByRole || "CTO",
      goal: payload.goal || "",
      pl: plMembers[0] || payload.tpm || tpmMember?.name || "",
      tpm: payload.tpm || tpmMember?.name || "",
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
      budgetItems: { models: [], infra: [], subs: [], misc: [] },
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
          detail: [...assignmentSummary, ...kickoffSummary].join(" · "),
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
    logType,
    generalActualHeaders,
    generalActualRows,
  }) => {
    const id = `tl-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const normalizedLogType = String(logType || "").trim() || "model-usage";
    if (normalizedLogType === "general-actual") {
      const normalizedHeaders = Array.isArray(generalActualHeaders) ? generalActualHeaders : [];
      const normalizedRows = normalizeGeneralActualRows(generalActualRows, normalizedHeaders);
      const rowCount = getGeneralActualRowsCount(normalizedRows);
      const totalCost = normalizedRows.length
        ? getGeneralActualRowsCostTotal(normalizedRows)
        : Number(cost) || 0;
      const entry = {
        id,
        projectId,
        phaseId,
        logType: normalizedLogType,
        name,
        assignee,
        hours: Number(hours) || 0,
        cost: totalCost,
        tasksDone: Number(successfulTasks ?? tasksDone) || rowCount,
        successfulTasks: Number(successfulTasks ?? tasksDone) || rowCount,
        failedTasks: 0,
        trajectories: 0,
        successTrajectories: 0,
        failedTrajectories: 0,
        approvalStatus: approvalStatus || "logged",
        date,
        notes: notes || "",
        evidence: evidence || "",
        modelId: "",
        modelName: "",
        inputTokens: 0,
        outputTokens: 0,
        successfulRows: [],
        failedRows: [],
        modelUsage: [],
        generalActualHeaders: normalizedHeaders,
        generalActualRows: normalizedRows,
        createdAt: new Date().toISOString(),
        createdBy: user?.name || "TPM",
      };
      setTaskLogs((prev) => {
        const key = taskKey(projectId, phaseId);
        const list = prev[key] || [];
        return { ...prev, [key]: [entry, ...list] };
      });
      return entry;
    }
    const normalizedSuccessfulRows = normalizeTaskSheetRows(successfulRows, "success", modelCatalog);
    const normalizedFailedRows = normalizeTaskSheetRows(failedRows, "failed", modelCatalog);
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
      logType: normalizedLogType,
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
      generalActualHeaders: [],
      generalActualRows: [],
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
          const nextLogType = String(patch.logType || t.logType || "model-usage").trim();
          if (nextLogType === "general-actual") {
            const normalizedHeaders = Array.isArray(patch.generalActualHeaders)
              ? patch.generalActualHeaders
              : (t.generalActualHeaders || []);
            const normalizedRows = Array.isArray(patch.generalActualRows)
              ? normalizeGeneralActualRows(patch.generalActualRows, normalizedHeaders)
              : (t.generalActualRows || []);
            const rowCount = getGeneralActualRowsCount(normalizedRows);
            const totalCost = normalizedRows.length
              ? getGeneralActualRowsCostTotal(normalizedRows)
              : Number(patch.cost ?? t.cost ?? 0);
            return {
              ...t,
              ...patch,
              logType: nextLogType,
              hours: Number(patch.hours ?? t.hours),
              cost: totalCost,
              tasksDone: Number(patch.successfulTasks ?? patch.tasksDone ?? t.successfulTasks ?? t.tasksDone ?? 0) || rowCount,
              successfulTasks: Number(patch.successfulTasks ?? patch.tasksDone ?? t.successfulTasks ?? t.tasksDone ?? 0) || rowCount,
              failedTasks: 0,
              trajectories: 0,
              successTrajectories: 0,
              failedTrajectories: 0,
              approvalStatus: patch.approvalStatus ?? t.approvalStatus ?? "logged",
              modelId: "",
              modelName: "",
              inputTokens: 0,
              outputTokens: 0,
              successfulRows: [],
              failedRows: [],
              modelUsage: [],
              generalActualHeaders: normalizedHeaders,
              generalActualRows: normalizedRows,
            };
          }
          const normalizedSuccessfulRows = Array.isArray(patch.successfulRows)
            ? normalizeTaskSheetRows(patch.successfulRows, "success", modelCatalog)
            : (t.successfulRows || []);
          const normalizedFailedRows = Array.isArray(patch.failedRows)
            ? normalizeTaskSheetRows(patch.failedRows, "failed", modelCatalog)
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
            logType: nextLogType,
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
            generalActualHeaders: [],
            generalActualRows: [],
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
    timelineDelta,
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
      timelineDelta: timelineDelta || "",
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
          action: "Submitted additional request",
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
        teamType: payload.teamType || "",
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
        detail: `$${requestedTotal.toLocaleString()}${payload.teamType ? ` · ${payload.teamType} team` : ""} · pending CTO review · ${Number(payload.totalTasks || 0).toLocaleString()} tasks${Number(payload.totalTrajectories || 0) ? ` · ${Number(payload.totalTrajectories || 0).toLocaleString()} trajectories` : ""}`,
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
        budgetRejection: null,
        budgetRetryAvailableAt: null,
        pendingBudgetSubmission: {
          reviewId,
          budgetType: normalizedBudgetType,
          teamType: payload.teamType || "",
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
    const isRndSubmissionOnly = stage === "rnd-review" && details.rnd?.submissionOnly === true;
    const isRecoverable = details.isRecoverable !== false;
    const budgetType = normalizeBudgetType(proj?.lastBudgetSubmission?.budgetType || proj?.type || (details.rnd ? "RnD" : "Production"));
    const isTestingDelivery = stage === "rnd-review" && budgetType === "Testing";
    const status =
      stage === "rnd-review"
        ? isTestingDelivery
          ? "testing-submitted"
          : isRndSubmissionOnly
            ? "feedback-pending"
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
                : isRndSubmissionOnly
                  ? "Submitted sample batch"
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
          ? "testing-submitted"
          : isRndSubmissionOnly
            ? "submitted"
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
        type: !isTestingDelivery && !isRndSubmissionOnly && rndDecision === "accept" ? "Production" : "R&D",
        readyForTpmBudget: !isTestingDelivery && !isRndSubmissionOnly && rndDecision === "accept",
        pendingBudgetSubmission: null,
        workflowStage: isTestingDelivery
          ? "awaiting-rnd-budget"
          : isRndSubmissionOnly
            ? "awaiting-client-feedback"
          : rndDecision === "accept"
            ? "tpm-budget-ready"
            : rndDecision === "reject"
              ? "sample-rejected"
              : "awaiting-rework-budget",
        status: isTestingDelivery
          ? "Awaiting Sample budget"
          : isRndSubmissionOnly
            ? "Sample submitted · awaiting client feedback"
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
              : isRndSubmissionOnly
                ? "Sample batch submitted"
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

  const recordRndBatchFeedback = (deliveryId, { decision, comment }) => {
    const target = batchDeliveries.find((delivery) => delivery.id === deliveryId && delivery.stage === "rnd-review");
    if (!target) return null;
    const at = new Date().toISOString();
    const nextStatus = decision === "accept" ? "sample-approved" : decision === "reject" ? "sample-rejected" : "changes-requested";
    setBatchDeliveries((arr) => arr.map((delivery) => (
      delivery.id === deliveryId
        ? {
            ...delivery,
            status: nextStatus,
            clientComment: comment || "",
            feedbackAt: at,
            feedbackBy: user?.name || "R&D",
            rnd: { ...(delivery.rnd || {}), decision },
            history: [
              {
                at,
                actor: `${user?.name || "R&D"} · ${user?.role || "R&D"}`,
                action: decision === "accept" ? "Recorded client acceptance" : decision === "reject" ? "Recorded client rejection" : "Recorded client changes requested",
                detail: comment || "No feedback note provided",
              },
              ...(delivery.history || []),
            ],
          }
        : delivery
    )));
    setPhaseLogApprovalStatus(target.projectId, target.phaseId, decision === "accept" ? "approved" : decision === "reject" ? "rejected" : "changes-requested");
    upsertProjectOverride(target.projectId, (project) => ({
      ...project,
      type: decision === "accept" ? "Production" : "R&D",
      readyForTpmBudget: decision === "accept",
      workflowStage: decision === "accept" ? "tpm-budget-ready" : decision === "reject" ? "sample-rejected" : "awaiting-rework-budget",
      status: decision === "accept" ? "Ready for TPM budget" : decision === "reject" ? "Sample rejected" : "Awaiting rework budget",
      promotedToProductionAt: decision === "accept" ? at : project.promotedToProductionAt || null,
      auditLog: [
        {
          id: `a-${target.projectId}-${Date.now().toString(36)}-feedback`,
          ts: at,
          actor: `${user?.name || "R&D"} · ${user?.role || "R&D"}`,
          action: decision === "accept" ? "Client accepted sample" : decision === "reject" ? "Client rejected sample" : "Client requested sample changes",
          detail: comment || "No feedback note provided",
        },
        ...(project.auditLog || []),
      ],
    }));
    return { ...target, status: nextStatus, clientComment: comment || "" };
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
  const ctoModifyBudgetReview = ({ reviewId, projectId, projectName, tpm, requestedBudget, modifiedPhases, modifiedItems, ctoComment, ctoModified = true }) => {
    const itemSummary = cloneBudgetItems(modifiedItems || {});
    const itemTotals = {
      models: sumBudgetLines(itemSummary.models),
      infra: sumBudgetLines(itemSummary.infra),
      subs: sumBudgetLines(itemSummary.subs),
      misc: sumBudgetLines(itemSummary.misc),
    };
    const total = itemTotals.models + itemTotals.infra + itemTotals.subs + itemTotals.misc;
    const ctoChangeSummary = buildBudgetItemsChangeSummary(itemSummary);
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
        aiCost: itemTotals.models,
        infraCost: itemTotals.infra,
        subsCost: itemTotals.subs,
        miscCost: itemTotals.misc,
        items: modifiedItems
          ? cloneBudgetItems(itemSummary)
          : cloneBudgetItems(previous?.items || {}),
        ctoComment,
        ctoChangeSummary,
        ctoBy: user?.name || "CTO",
        ctoAt: now,
        ctoModified,
        stage: "CFO Review",
        status: "forwarded-cfo",
        cfoDecision: null,
      };
      const historyEntry = {
        at: now,
        actor: `${user?.name || "CTO"} · CTO`,
        action: getCtoForwardLabel({ ...base, ctoModified }),
        detail: [
          modifiedItems ? ctoChangeSummary : `Total ${formatBudgetMoney(total)} · ${modifiedPhases.length} phase${modifiedPhases.length === 1 ? "" : "s"}`,
          ctoComment || "",
        ].filter(Boolean).join(" · "),
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
      budgetRejection: null,
      budgetRetryAvailableAt: null,
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
    upsertProjectOverride(projectId, (projectEntry) => ({
      ...buildProjectBaselineFromSnapshot(projectEntry, currentReview?.baselineSnapshot || null),
      ...buildBudgetRejectionState({
        actorName: user?.name || "CTO",
        actorRole: user?.role || "CTO",
        comment: ctoComment,
        at: now,
      }),
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
        stage: "Returned",
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
    upsertProjectOverride(projectId, (projectEntry) => ({
      ...buildProjectBaselineFromSnapshot(projectEntry, currentReview?.baselineSnapshot || null),
      budgetRejection: null,
      budgetRetryAvailableAt: null,
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
  };

  const cfoDecideBudgetReview = (reviewId, { decision, amount, comment, reviewSeed, modifiedItems }) => {
    const at = new Date().toISOString();
    const baseReview = budgetReviews.find((review) => review.id === reviewId) || reviewSeed;

    if (!baseReview) return null;

    const finalItems = cloneBudgetItems(modifiedItems || baseReview.items || {});
    const finalItemTotals = {
      models: sumBudgetLines(finalItems.models),
      infra: sumBudgetLines(finalItems.infra),
      subs: sumBudgetLines(finalItems.subs),
      misc: sumBudgetLines(finalItems.misc),
    };
    const finalItemTotal = finalItemTotals.models + finalItemTotals.infra + finalItemTotals.subs + finalItemTotals.misc;
    const cfoModified = !areBudgetItemsEqual(baseReview.items || {}, finalItems);
    const cfoChangeSummary = buildBudgetItemsChangeSummary(finalItems);
    const requestedTotal = Number(
      baseReview.modifiedTotal
      || baseReview.recommendedBudget
      || baseReview.requestedBudget
      || 0
    );
    const approvedAmount = Number(amount || finalItemTotal || requestedTotal || 0);
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
      ...(decision === "approve" || decision === "partial"
        ? {
            items: cloneBudgetItems(finalItems),
            aiCost: finalItemTotals.models,
            infraCost: finalItemTotals.infra,
            subsCost: finalItemTotals.subs,
            miscCost: finalItemTotals.misc,
            cfoModified,
            cfoChangeSummary,
          }
        : {}),
      cfoDecision: {
        decision,
        amount: decision === "reject" ? 0 : approvedAmount,
        comment: comment || "",
        at,
        by: user?.name || "CFO",
        modified: cfoModified,
        changeSummary: decision === "approve" || decision === "partial" ? cfoChangeSummary : "",
      },
      history: [
        ...(baseReview.history || []),
        {
          at,
          actor: `${user?.name || "CFO"} · CFO`,
          action: actionLabel,
          detail: decision === "approve" || decision === "partial"
            ? [cfoChangeSummary, comment || ""].filter(Boolean).join(" · ")
            : (comment || ""),
        },
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
      const requestedLines = summarizeRequestedLines(scaledProjectState.budgetItems || nextReview.items || {}, project, modelCatalog);
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
    upsertProjectOverride(baseReview.projectId, (projectEntry) => ({
      ...buildProjectBaselineFromSnapshot(projectEntry, baseReview.baselineSnapshot || null),
      itProvisioningStatus: null,
      ...(decision === "reject"
        ? buildBudgetRejectionState({
            actorName: user?.name || "CFO",
            actorRole: user?.role || "CFO",
            comment,
            at,
          })
        : {
            budgetRejection: null,
            budgetRetryAvailableAt: null,
          }),
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

    return nextReview;
  };

  const createChangeRequest = ({ projectId, reason, urgency, expectedTasks, timelineDelta, breakdown }) => {
    const project = projects.find((entry) => entry.id === projectId);
    const id = `cr-${Date.now().toString(36)}`;
    const now = new Date().toISOString();
    const modelEntries = normalizeBreakdownEntries(
      breakdown?.models,
      findModelInCatalog(modelCatalog, breakdown?.models?.optionId)?.provider || "Model"
    ).map((entry) => {
      const meta = findModelInCatalog(modelCatalog, entry.optionId || entry.optionLabel);
      return {
        ...entry,
        optionId: entry.optionId || meta?.id || "",
        optionLabel: entry.optionLabel || (meta ? `${meta.name} · ${meta.provider}` : "Model"),
        provider: entry.provider || meta?.provider || "Custom",
      };
    });
    const infraEntries = normalizeBreakdownEntries(breakdown?.infra, "Infrastructure");
    const subEntries = normalizeBreakdownEntries(breakdown?.subs, "Subscription").map((entry) => ({
      ...entry,
      billingUnit: entry.billingUnit || "per month",
    }));
    const normalizedBreakdown = {
      models: buildNormalizedBreakdownSection(modelEntries),
      infra: buildNormalizedBreakdownSection(infraEntries),
      subs: buildNormalizedBreakdownSection(subEntries, { billingUnit: "per month" }),
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
      type: "Additional request",
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
          action: "Submitted additional request",
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
      const requestedModels = normalizeBreakdownEntries(currentRequest.breakdown?.models).map((entry, index) => {
        const meta = findModelInCatalog(modelCatalog, entry.optionId || entry.optionLabel);
        return {
          id: entry.id || `${currentRequest.id}-model-${index + 1}`,
          modelId: entry.optionId || meta?.id || "",
          label: entry.optionLabel || meta?.name || "Model change",
          provider: entry.provider || meta?.provider || "Custom",
          amount: Number(entry.amount || 0),
          usageTag: entry.note || "",
        };
      });
      const requestedInfra = normalizeBreakdownEntries(currentRequest.breakdown?.infra).map((entry, index) => ({
        id: entry.id || `${currentRequest.id}-infra-${index + 1}`,
        label: entry.optionLabel || "Infrastructure change",
        amount: Number(entry.amount || 0),
      }));
      const requestedSubs = normalizeBreakdownEntries(currentRequest.breakdown?.subs).map((entry, index) => ({
        id: entry.id || `${currentRequest.id}-subs-${index + 1}`,
        label: entry.optionLabel || "Subscription change",
        amount: Number(entry.amount || 0),
      }));
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
            action: "Additional request approved and routed to IT",
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
        const env = line.env || "testing";
        const budgetCap = Number(line.budgetCap ?? line.amount ?? 0);
        const remainingBudget = Number(line.remainingBudget ?? budgetCap);
        const allowedNetworks = normalizeGatewayList(line.allowedNetworks, ["Corp VPN"]);
        const allowedDevices = normalizeGatewayList(line.allowedDevices, ["Managed laptop"]);
        const expiresAt = line.expiresAt || buildGatewayExpiry(env);
        const rateLimitPerMinute = Number(line.rateLimitPerMinute ?? 120);
        const perMemberBudgetCap = teamMembers.length ? budgetCap / teamMembers.length : budgetCap;
        const perMemberRemainingBudget = teamMembers.length ? remainingBudget / teamMembers.length : remainingBudget;
        const accessTokens = teamMembers.map((member, memberIndex) => normalizeAccessTokenRecord({}, {
          member,
          index: memberIndex,
          projectId: request.projectId,
          provider: line.provider || "Anthropic",
          modelId: line.modelId || "",
          modelLabel: line.label,
          env,
          lineId: line.id || `${request.id}-line-${index + 1}`,
          gatewayRoute: request.gatewayRoute || "/api/gateway/execute",
          rateLimitPerMinute,
          budgetCap: perMemberBudgetCap,
          remainingBudget: perMemberRemainingBudget,
          allowedNetworks,
          allowedDevices,
          expiresAt,
          issuedAt: at,
        }));
        return normalizeModelKeyRecord({
          id: `k-${request.projectId}-${Date.now().toString(36)}-${index + 1}`,
          project: request.projectId,
          projectName: request.projectName,
          provider: line.provider || "Anthropic",
          model: line.label,
          modelId: line.modelId || "",
          type: request.budgetType === "Production" ? "Production" : "R&D",
          env,
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
          gatewayRoute: request.gatewayRoute || "/api/gateway/execute",
          gatewayPolicy: {
            allowedModelId: line.modelId || "",
            allowedModelLabel: line.label,
            provider: line.provider || "Anthropic",
            rateLimitPerMinute,
            budgetCap,
            remainingBudget,
            expiresAt,
            allowedNetworks,
            allowedDevices,
          },
          accessTokens,
        });
      });

    setModelKeyRecords((arr) => {
      const retained = arr.filter((existing) => !createdKeys.some((created) => (
        created.project === existing.project
        && created.provider === existing.provider
        && created.model === existing.model
        && created.env === existing.env
      )));
      return [...createdKeys, ...retained].map(normalizeModelKeyRecord);
    });
    setItProvisioningRequests((arr) => arr.map((entry) => (
      entry.id === requestId
        ? normalizeItProvisioningRequest({
            ...entry,
            status: "completed",
            provisionedAt: at,
            provisionedBy: user?.name || "IT",
            note,
            lines: lines.map((line) => ({
              id: line.id,
              label: line.label,
              modelId: line.modelId || "",
              provider: line.provider || "Anthropic",
              env: line.env || "testing",
              maskedKey: line.fullKey ? maskKey(String(line.fullKey).trim()) : "",
              memberIds: Array.isArray(line.memberIds) ? [...line.memberIds] : [],
              rateLimitPerMinute: Number(line.rateLimitPerMinute ?? 120),
              budgetCap: Number(line.budgetCap ?? line.amount ?? 0),
              remainingBudget: Number(line.remainingBudget ?? line.budgetCap ?? line.amount ?? 0),
              allowedNetworks: normalizeGatewayList(line.allowedNetworks, ["Corp VPN"]),
              allowedDevices: normalizeGatewayList(line.allowedDevices, ["Managed laptop"]),
              expiresAt: line.expiresAt || buildGatewayExpiry(line.env || "testing"),
              issuedTokenCount: createdKeys.find((created) => (
                created.provider === (line.provider || "Anthropic")
                && created.model === line.label
                && created.env === (line.env || "testing")
              ))?.accessTokens?.length || 0,
            })),
          })
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
            detail: `${createdKeys.length} key${createdKeys.length === 1 ? "" : "s"} provisioned · ${createdKeys.reduce((sum, entry) => sum + (entry.accessTokens?.length || 0), 0)} internal token${createdKeys.reduce((sum, entry) => sum + (entry.accessTokens?.length || 0), 0) === 1 ? "" : "s"} issued${note ? ` · ${note}` : ""}`,
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
    hydrated,
    syncStatus,
    importWorkspaceRaw,
    exportWorkspaceSnapshot,
    login,
    logout,
    roles: ROLES,
    aiOpen,
    setAiOpen,
    notifOpen,
    setNotifOpen,
    scope,
    setScope,
    projects: exposedProjects,
    modelCatalog,
    addCustomModel,
    visibleProjects: exposedVisibleProjects,
    bufferOverview,
    teamRemovals,
    removeProjectTeamMember,
    addProjectTeamMembers,
    updateProjectCoreMembers,
    updateProjectDetails,
    archiveProject,
    deleteProject,
    setBuffer,
    applyBufferAction,
    setRecovery,
    addProject,
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
    recordRndBatchFeedback,
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
    refreshAppData,
  };
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useApp = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside AppProvider");
  return ctx;
};
