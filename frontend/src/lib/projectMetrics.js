const TRACK_LABELS = {
  Testing: "Testing",
  RnD: "R&D",
  Rework: "Rework",
  Production: "Production",
};

export const normalizeBudgetType = (budgetType = "") => {
  const value = String(budgetType || "").trim().toLowerCase();
  if (value === "testing") return "Testing";
  if (value === "rnd" || value === "r&d") return "RnD";
  if (value === "sample" || value === "rework") return "Rework";
  if (value === "production") return "Production";
  return budgetType || "Budget";
};

export const formatBudgetTypeLabel = (budgetType = "") =>
  TRACK_LABELS[normalizeBudgetType(budgetType)] || budgetType || "Budget";

export const getProjectPhaseIds = (project) => (project?.phases || []).map((phase) => phase.id);

export const getProjectLogs = (taskLogs = {}, project) =>
  getProjectPhaseIds(project).flatMap((phaseId) => taskLogs[`${project.id}::${phaseId}`] || []);

const normalizeUsageRows = (log) => {
  if (Array.isArray(log?.modelUsage) && log.modelUsage.length) {
    return log.modelUsage.map((entry) => ({
      modelId: entry.modelId || "",
      modelName: entry.modelName || entry.modelLabel || "Unspecified model",
      tasksDone: Number(entry.tasksDone || 0),
      cost: Number(entry.cost || 0),
      inputTokens: Number(entry.inputTokens || 0),
      outputTokens: Number(entry.outputTokens || 0),
    }));
  }

  if (log?.modelName || log?.modelId) {
    return [{
      modelId: log.modelId || "",
      modelName: log.modelName || "Unspecified model",
      tasksDone: Number(log.tasksDone || 0),
      cost: Number(log.cost || 0),
      inputTokens: Number(log.inputTokens || 0),
      outputTokens: Number(log.outputTokens || 0),
    }];
  }

  return [];
};

export const summarizeLoggedProject = (project, taskLogs = {}) => {
  const logs = getProjectLogs(taskLogs, project);
  const byModel = {};

  let loggedSpend = 0;
  let loggedTasks = 0;
  let loggedTrajectories = 0;
  let inputTokens = 0;
  let outputTokens = 0;

  logs.forEach((log) => {
    loggedSpend += Number(log.cost || 0);
    loggedTasks += Number(log.tasksDone || 0);
    loggedTrajectories += Number(log.trajectories || 0);

    const usageRows = normalizeUsageRows(log);
    if (!usageRows.length) {
      inputTokens += Number(log.inputTokens || 0);
      outputTokens += Number(log.outputTokens || 0);
    }

    usageRows.forEach((usage) => {
      inputTokens += usage.inputTokens;
      outputTokens += usage.outputTokens;
      const key = usage.modelId || usage.modelName;
      byModel[key] = byModel[key] || {
        modelId: usage.modelId,
        modelName: usage.modelName,
        tasksDone: 0,
        cost: 0,
        inputTokens: 0,
        outputTokens: 0,
      };
      byModel[key].tasksDone += usage.tasksDone;
      byModel[key].cost += usage.cost;
      byModel[key].inputTokens += usage.inputTokens;
      byModel[key].outputTokens += usage.outputTokens;
    });
  });

  const targetTasks = Number(
    project?.totalTasks
    || (project?.phases || []).reduce((sum, phase) => sum + Number(phase.totalTasks || phase.tasks || 0), 0)
    || 0
  );
  const approvedBudget = Number(project?.approvedBudget || 0);
  const remainingBudget = approvedBudget - loggedSpend;
  const utilization = approvedBudget > 0 ? Math.round((loggedSpend / approvedBudget) * 100) : 0;
  const taskCompletion = targetTasks > 0 ? Math.min(100, Math.round((loggedTasks / targetTasks) * 100)) : 0;
  const activeDays = new Set(logs.map((log) => log.date).filter(Boolean)).size;
  const runRate = activeDays > 0 ? loggedSpend / activeDays : 0;
  const models = Object.values(byModel).sort((left, right) => right.cost - left.cost || right.tasksDone - left.tasksDone);

  return {
    logs,
    loggedSpend,
    loggedTasks,
    loggedTrajectories,
    inputTokens,
    outputTokens,
    targetTasks,
    remainingBudget,
    utilization,
    taskCompletion,
    runRate,
    models,
    topModel: models[0]?.modelName || project?.topModel || "—",
  };
};

const normalizeTrackEntry = (entry) => {
  const normalizedType = normalizeBudgetType(entry?.budgetType);

  return {
    id: entry?.id,
    projectId: entry?.projectId,
    budgetType: normalizedType,
    title: formatBudgetTypeLabel(normalizedType),
    total: Number(entry?.totals?.total || entry?.total || 0),
    submittedAt: entry?.submittedAt || entry?.createdAt || null,
    submittedBy: entry?.submittedBy || entry?.createdBy || "",
    status: entry?.status || "submitted",
    totalTasks: Number(entry?.totalTasks || 0),
    totalTrajectories: Number(entry?.totalTrajectories || 0),
    phases: entry?.phases || [],
    items: entry?.items || {},
    sampleIteration: Number(entry?.sampleIteration || 1),
    sourceDeliveryId: entry?.sourceDeliveryId || null,
  };
};

export const buildBudgetTracks = (project, budgets = []) => {
  const seen = new Set();
  const projectHistory = Array.isArray(project?.budgetTrackHistory) ? project.budgetTrackHistory : [];
  const liveBudgets = budgets
    .filter((entry) => entry.projectId === project?.id)
    .map(normalizeTrackEntry);

  const entries = [...projectHistory.map(normalizeTrackEntry), ...liveBudgets]
    .filter((entry) => {
      const key = `${entry.id}:${entry.submittedAt || ""}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((left, right) => new Date(right.submittedAt || 0).getTime() - new Date(left.submittedAt || 0).getTime());

  const grouped = entries.reduce((acc, entry) => {
    const key = entry.budgetType;
    acc[key] = acc[key] || [];
    acc[key].push(entry);
    return acc;
  }, {});

  return {
    entries,
    grouped,
    ordered: ["Testing", "RnD", "Rework", "Production"]
      .filter((key) => grouped[key]?.length)
      .map((key) => ({
        key,
        label: formatBudgetTypeLabel(key),
        latest: grouped[key][0],
        history: grouped[key],
      })),
  };
};
