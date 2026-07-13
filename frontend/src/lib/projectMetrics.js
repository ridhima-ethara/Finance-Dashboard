const TRACK_LABELS = {
  Testing: "Testing",
  RnD: "R&D",
  Rework: "Rework",
  Production: "Production",
};

const RND_WORKFLOW_STAGES = new Set([
  "awaiting-testing-budget",
  "testing-budget-pending",
  "testing-active",
  "awaiting-rnd-budget",
  "rnd-budget-pending",
  "sample-active",
  "awaiting-rework-budget",
  "rework-budget-pending",
  "sample-rejected",
]);

const TPM_WORKFLOW_STAGES = new Set([
  "tpm-budget-ready",
  "production-budget-pending",
  "production-active",
]);

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

const getSheetRows = (log = {}, key) =>
  (Array.isArray(log?.[key]) ? log[key] : [])
    .map((entry) => ({
      id: entry?.id || "",
      modelId: entry?.modelId || "",
      modelName: entry?.modelName || entry?.modelLabel || "Unspecified model",
      task: entry?.task || entry?.name || "",
      stage: entry?.stage || "",
      cost: Number(entry?.cost || 0),
      llmCalls: Number(entry?.llmCalls || 0),
      inputTokens: Number(entry?.inputTokens || 0),
      inputTokensM: Number(entry?.inputTokensM || 0) || (Number(entry?.inputTokens || 0) / 1000000),
      outputTokens: Number(entry?.outputTokens || 0),
      outputTokensM: Number(entry?.outputTokensM || 0) || (Number(entry?.outputTokens || 0) / 1000000),
    }))
    .filter((entry) => (
      entry.modelId
      || entry.modelName
      || entry.task
      || entry.stage
      || entry.cost
      || entry.llmCalls
      || entry.inputTokens
      || entry.outputTokens
    ));

const getDetailedTaskRows = (log = {}) => [
  ...getSheetRows(log, "successfulRows").map((entry) => ({ ...entry, status: "success" })),
  ...getSheetRows(log, "failedRows").map((entry) => ({ ...entry, status: "failed" })),
];

export const getTaskLogRecordedCost = (log) => {
  const detailedRows = getDetailedTaskRows(log);
  if (detailedRows.length) {
    return detailedRows.reduce((sum, entry) => sum + Number(entry.cost || 0), 0);
  }
  if (Array.isArray(log?.modelUsage) && log.modelUsage.length) {
    return log.modelUsage.reduce((sum, entry) => sum + Number(entry.cost || 0), 0);
  }
  return Number(log?.cost || 0);
};

const getLogTimestamp = (log) => {
  const raw = log?.createdAt || (log?.date ? `${log.date}T00:00:00.000Z` : "");
  const ts = raw ? new Date(raw).getTime() : 0;
  return Number.isNaN(ts) ? 0 : ts;
};

const getPromotionTimestamp = (project) => {
  const ts = project?.promotedToProductionAt ? new Date(project.promotedToProductionAt).getTime() : 0;
  return Number.isNaN(ts) ? 0 : ts;
};

export const getProjectWorkflowStage = (project = {}) => {
  if (project?.pendingBudgetSubmission?.stage) return project.pendingBudgetSubmission.stage;
  if (project?.workflowStage) return project.workflowStage;
  if (project?.readyForTpmBudget) return "tpm-budget-ready";
  if (project?.type === "Production") {
    return Number(project?.approvedBudget || 0) > 0 ? "production-active" : "production-budget-pending";
  }
  return Number(project?.approvedBudget || 0) > 0 ? "sample-active" : "awaiting-testing-budget";
};

export const isProjectInTpmLane = (project = {}) => {
  const stage = getProjectWorkflowStage(project);
  return Boolean(project?.readyForTpmBudget) || Boolean(project?.type === "Production") || TPM_WORKFLOW_STAGES.has(stage);
};

export const isProjectInRndLane = (project = {}) => {
  const stage = getProjectWorkflowStage(project);
  return !isProjectInTpmLane(project) && (Boolean(project?.type === "R&D") || RND_WORKFLOW_STAGES.has(stage));
};

export const filterLogsByLane = (project, logs = [], lane = "all") => {
  const entries = Array.isArray(logs) ? logs : [];
  if (lane === "all") return entries;

  const promotionTs = getPromotionTimestamp(project);
  if (!promotionTs) {
    if (lane === "production") return isProjectInTpmLane(project) ? entries : [];
    if (lane === "rnd") return isProjectInRndLane(project) ? entries : [];
    return entries;
  }

  return entries.filter((log) => (
    lane === "production"
      ? getLogTimestamp(log) >= promotionTs
      : getLogTimestamp(log) < promotionTs
  ));
};

export const getProjectLogs = (taskLogs = {}, project, options = {}) =>
  filterLogsByLane(
    project,
    getProjectPhaseIds(project).flatMap((phaseId) => taskLogs[`${project.id}::${phaseId}`] || []),
    options.lane || "all"
  );

const normalizeUsageRows = (log) => {
  const detailedRows = getDetailedTaskRows(log);
  if (detailedRows.length) {
    const grouped = detailedRows.reduce((acc, entry) => {
      const key = entry.modelId || entry.modelName;
      acc[key] = acc[key] || {
        modelId: entry.modelId || "",
        modelName: entry.modelName || "Unspecified model",
        tasksDone: 0,
        cost: 0,
        inputTokens: 0,
        outputTokens: 0,
      };
      acc[key].tasksDone += 1;
      acc[key].cost += Number(entry.cost || 0);
      acc[key].inputTokens += Number(entry.inputTokens || 0);
      acc[key].outputTokens += Number(entry.outputTokens || 0);
      return acc;
    }, {});
    return Object.values(grouped);
  }

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

export const summarizeLoggedProject = (project, taskLogs = {}, options = {}) => {
  const logs = getProjectLogs(taskLogs, project, options);
  const byModel = {};

  let loggedSpend = 0;
  let loggedTasks = 0;
  let failedTasks = 0;
  let loggedTrajectories = 0;
  let failedTrajectories = 0;
  let inputTokens = 0;
  let outputTokens = 0;
  let successfulCost = 0;
  let failedCost = 0;

  logs.forEach((log) => {
    loggedSpend += getTaskLogRecordedCost(log);
    loggedTasks += Number(log.successfulTasks ?? log.tasksDone ?? 0);
    failedTasks += Number(log.failedTasks || 0);
    loggedTrajectories += Number(log.successTrajectories ?? log.trajectories ?? 0);
    failedTrajectories += Number(log.failedTrajectories || 0);

    const detailedRows = getDetailedTaskRows(log);
    if (detailedRows.length) {
      successfulCost += detailedRows
        .filter((entry) => entry.status === "success")
        .reduce((sum, entry) => sum + Number(entry.cost || 0), 0);
      failedCost += detailedRows
        .filter((entry) => entry.status === "failed")
        .reduce((sum, entry) => sum + Number(entry.cost || 0), 0);
    } else {
      successfulCost += Number(log.cost || 0);
    }

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
    failedTasks,
    loggedTrajectories,
    failedTrajectories,
    inputTokens,
    outputTokens,
    successfulCost,
    failedCost,
    targetTasks,
    remainingBudget,
    utilization,
    taskCompletion,
    runRate,
    models,
    topModel: models[0]?.modelName || project?.topModel || "—",
  };
};

export const normalizeItModelUsageRows = (rows = []) =>
  (Array.isArray(rows) ? rows : [])
    .map((entry, index) => ({
      id: entry?.id || `it-model-${index + 1}`,
      modelId: entry?.modelId || "",
      modelName: entry?.modelName || entry?.label || "",
      cost: Number(entry?.cost || 0),
      inputTokens: Number(entry?.inputTokens || 0),
      outputTokens: Number(entry?.outputTokens || 0),
    }))
    .filter((entry) => entry.modelId || entry.modelName || entry.cost || entry.inputTokens || entry.outputTokens);

export const summarizeItProjectActuals = (entry = {}) => {
  const dailyActuals = (Array.isArray(entry?.dailyActuals) ? entry.dailyActuals : [])
    .map((row) => ({
      date: row?.date || "",
      modelActual: Number(row?.modelActual || 0),
      infraActual: Number(row?.infraActual || 0),
      subsActual: Number(row?.subsActual || 0),
      total: Number(row?.modelActual || 0) + Number(row?.infraActual || 0) + Number(row?.subsActual || 0),
    }))
    .filter((row) => row.date || row.total > 0)
    .sort((left, right) => new Date(left.date || 0).getTime() - new Date(right.date || 0).getTime());

  const modelUsage = normalizeItModelUsageRows(entry?.modelUsage || []);
  const modelUsageActual = modelUsage.reduce((sum, row) => sum + Number(row.cost || 0), 0);
  const dailyTotals = dailyActuals.reduce((sum, row) => ({
    modelActual: sum.modelActual + row.modelActual,
    infraActual: sum.infraActual + row.infraActual,
    subsActual: sum.subsActual + row.subsActual,
  }), { modelActual: 0, infraActual: 0, subsActual: 0 });

  const modelActual = dailyActuals.length
    ? dailyTotals.modelActual
    : Math.max(Number(entry?.modelActual || 0), modelUsageActual);
  const infraActual = dailyActuals.length
    ? dailyTotals.infraActual
    : Number(entry?.infraActual || 0);
  const subsActual = dailyActuals.length
    ? dailyTotals.subsActual
    : Number(entry?.subsActual || 0);
  const monthEndActual = Number(entry?.monthEndActual || 0);
  const monthEndDate = entry?.monthEndDate || dailyActuals[dailyActuals.length - 1]?.date || entry?.updatedAt?.slice(0, 10) || "";
  const totalActual = Number(entry?.totalActual || 0) || (modelActual + infraActual + subsActual);
  const latestDailyActual = dailyActuals[dailyActuals.length - 1]?.total || Number(entry?.dailyApiCost || 0);
  const runRate = dailyActuals.length ? totalActual / dailyActuals.length : latestDailyActual;

  return {
    modelActual,
    infraActual,
    subsActual,
    monthEndActual,
    monthEndDate,
    totalActual,
    dailyActuals,
    latestDailyActual,
    runRate,
    modelUsage,
    activeKeys: Number(entry?.activeKeys || 0),
    note: entry?.note || "",
    updatedAt: entry?.updatedAt || null,
    updatedBy: entry?.updatedBy || "",
  };
};

export const summarizeProjectModelUsage = (project, taskLogs = {}, actualEntry = {}) => {
  const actuals = summarizeItProjectActuals(actualEntry);
  if (actuals.modelUsage.length) {
    return [...actuals.modelUsage].sort((left, right) => right.cost - left.cost || right.inputTokens - left.inputTokens);
  }
  return summarizeLoggedProject(project, taskLogs).models;
};

const getMonthLabel = (monthKey = "") => {
  if (!monthKey) return "Current";
  const [year, month] = String(monthKey).split("-").map(Number);
  if (!year || !month) return "Current";
  return new Date(year, month - 1, 1).toLocaleDateString("en-US", { month: "short", year: "numeric" });
};

const getDaysInMonth = (monthKey = "") => {
  const [year, month] = String(monthKey).split("-").map(Number);
  if (!year || !month) return 30;
  return new Date(year, month, 0).getDate();
};

export const buildItActualDailyRows = (projects = [], itMonthlyActuals = {}) => {
  const rows = [];

  (projects || []).forEach((project) => {
    const actuals = summarizeItProjectActuals(itMonthlyActuals[project?.id] || {});
    const approvedDaily = Math.round(Number(project?.approvedBudget || 0) / 30);

    if (actuals.dailyActuals.length) {
      actuals.dailyActuals.forEach((row) => {
        rows.push({
          date: row.date,
          projectId: project.id,
          projectName: project.name,
          actual: row.total,
          budget: approvedDaily,
          modelActual: row.modelActual,
          infraActual: row.infraActual,
          subsActual: row.subsActual,
        });
      });
      return;
    }

    if (actuals.latestDailyActual > 0 && actuals.updatedAt) {
      rows.push({
        date: actuals.updatedAt.slice(0, 10),
        projectId: project.id,
        projectName: project.name,
        actual: actuals.latestDailyActual,
        budget: approvedDaily,
        modelActual: actuals.modelActual,
        infraActual: actuals.infraActual,
        subsActual: actuals.subsActual,
      });
    }
  });

  return rows.sort((left, right) => (
    new Date(left.date || 0).getTime() - new Date(right.date || 0).getTime()
      || left.projectName.localeCompare(right.projectName)
  ));
};

export const buildItMonthEndRows = (projects = [], itMonthlyActuals = {}) => {
  const rows = [];

  (projects || []).forEach((project) => {
    const actuals = summarizeItProjectActuals(itMonthlyActuals[project?.id] || {});
    if (actuals.monthEndActual <= 0) return;

    const monthKey = (actuals.monthEndDate || new Date().toISOString()).slice(0, 7);
    const monthDays = getDaysInMonth(monthKey);
    const approvedDaily = Math.round(Number(project?.approvedBudget || 0) / 30);
    const monthlyBudget = approvedDaily * monthDays;

    rows.push({
      monthKey,
      monthLabel: getMonthLabel(monthKey),
      projectId: project.id,
      projectName: project.name,
      budget: monthlyBudget,
      actual: actuals.monthEndActual,
      variance: actuals.monthEndActual - monthlyBudget,
    });
  });

  return rows.sort((left, right) => (
    left.monthKey.localeCompare(right.monthKey)
      || left.projectName.localeCompare(right.projectName)
  ));
};

export const buildLoggedDailyRows = (projects = [], taskLogs = {}, options = {}) => {
  const rows = [];

  (projects || []).forEach((project) => {
    const approvedDaily = Math.round(Number(project?.approvedBudget || 0) / 30);
    const daily = {};

    getProjectLogs(taskLogs, project, options).forEach((log) => {
      const date = log.date || log.createdAt?.slice(0, 10);
      if (!date) return;
      daily[date] = daily[date] || {
        date,
        projectId: project.id,
        projectName: project.name,
        spent: 0,
        successfulCost: 0,
        failedCost: 0,
        approvedDaily,
        tasks: 0,
        failedTasks: 0,
        trajectories: 0,
        failedTrajectories: 0,
        inputTokens: 0,
        outputTokens: 0,
      };
      daily[date].spent += getTaskLogRecordedCost(log);
      daily[date].tasks += Number(log.successfulTasks ?? log.tasksDone ?? 0);
      daily[date].failedTasks += Number(log.failedTasks || 0);
      daily[date].trajectories += Number(log.successTrajectories ?? log.trajectories ?? 0);
      daily[date].failedTrajectories += Number(log.failedTrajectories || 0);

      const detailedRows = getDetailedTaskRows(log);
      if (detailedRows.length) {
        daily[date].successfulCost += detailedRows
          .filter((entry) => entry.status === "success")
          .reduce((sum, entry) => sum + Number(entry.cost || 0), 0);
        daily[date].failedCost += detailedRows
          .filter((entry) => entry.status === "failed")
          .reduce((sum, entry) => sum + Number(entry.cost || 0), 0);
      } else {
        daily[date].successfulCost += Number(log.cost || 0);
      }

      const usageRows = normalizeUsageRows(log);
      if (usageRows.length) {
        usageRows.forEach((usage) => {
          daily[date].inputTokens += Number(usage.inputTokens || 0);
          daily[date].outputTokens += Number(usage.outputTokens || 0);
        });
      } else {
        daily[date].inputTokens += Number(log.inputTokens || 0);
        daily[date].outputTokens += Number(log.outputTokens || 0);
      }
    });

    rows.push(...Object.values(daily));
  });

  return rows.sort((left, right) => (
    new Date(left.date).getTime() - new Date(right.date).getTime()
      || left.projectName.localeCompare(right.projectName)
  ));
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

const formatTrackPhaseDates = (phase = {}) => {
  if (phase?.dates) return phase.dates;
  if (phase?.start || phase?.end) return `${phase.start || "—"} → ${phase.end || "—"}`;
  return "Not scheduled";
};

const mapTrackPhaseToProjectPhase = (phase = {}, index = 0) => ({
  id: phase.id || `phase-${index + 1}`,
  name: phase.name || `Phase ${index + 1}`,
  dates: formatTrackPhaseDates(phase),
  start: phase.start || "",
  end: phase.end || "",
  estimated: Number(phase.budget || phase.estimated || phase.total || 0),
  actual: Number(phase.actual || 0),
  totalTasks: Number(phase.tasks || phase.totalTasks || 0),
  tasks: Number(phase.tasks || phase.totalTasks || 0),
  trajectoriesPerTask: Number(phase.trajectories || phase.trajectoriesPerTask || 0),
  health: phase.health || "healthy",
});

export const buildBudgetTracks = (project, budgets = []) => {
  const seen = new Set();
  const projectHistory = Array.isArray(project?.budgetTrackHistory) ? project.budgetTrackHistory : [];
  const liveBudgets = budgets
    .filter((entry) => entry.projectId === project?.id)
    .map(normalizeTrackEntry);

  const entries = [...liveBudgets, ...projectHistory.map(normalizeTrackEntry)]
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

export const getLaneBudgetTrack = (project, budgets = [], lane = "all") => {
  const tracks = buildBudgetTracks(project, budgets);
  if (lane === "production") return tracks.grouped?.Production?.[0] || null;
  if (lane === "rnd") return tracks.entries.find((entry) => entry.budgetType !== "Production") || null;
  return tracks.entries[0] || null;
};

export const buildExecutionProjectView = (project, budgets = [], lane = "all") => {
  if (!project || lane === "all") return project;

  const stage = getProjectWorkflowStage(project);
  const track = getLaneBudgetTrack(project, budgets, lane);

  if (lane === "production") {
    const hasApprovedProductionBudget =
      normalizeBudgetType(project?.lastBudgetSubmission?.budgetType || "") === "Production"
      || stage === "production-active";
    const canFallbackToCurrentState =
      project?.type === "Production"
      && !project?.readyForTpmBudget
      && stage !== "tpm-budget-ready";

    if (!track && !canFallbackToCurrentState) {
      return {
        ...project,
        approvedBudget: 0,
        estimatedBudget: 0,
        remaining: 0,
        utilization: 0,
        burnRate: 0,
        totalTasks: 0,
        phases: [],
      };
    }

    return {
      ...project,
      approvedBudget: track
        ? (hasApprovedProductionBudget ? Number(project?.approvedBudget || track.total || 0) : Number(track.total || 0))
        : Number(project?.approvedBudget || 0),
      estimatedBudget: track
        ? (hasApprovedProductionBudget ? Number(project?.estimatedBudget || project?.approvedBudget || track.total || 0) : Number(track.total || 0))
        : Number(project?.estimatedBudget || project?.approvedBudget || 0),
      totalTasks: track
        ? Number(track.totalTasks || 0)
        : Number(project?.totalTasks || 0),
      phases: track?.phases?.length
        ? track.phases.map(mapTrackPhaseToProjectPhase)
        : (canFallbackToCurrentState ? (project?.phases || []) : []),
      type: "Production",
    };
  }

  return {
    ...project,
    approvedBudget: Number(project?.approvedBudget || track?.total || 0),
    estimatedBudget: Number(project?.estimatedBudget || project?.approvedBudget || track?.total || 0),
    totalTasks: Number(project?.totalTasks || track?.totalTasks || 0),
    phases: track?.phases?.length ? track.phases.map(mapTrackPhaseToProjectPhase) : (project?.phases || []),
  };
};
