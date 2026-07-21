import { useMemo, useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "./ui/dialog";
import { Button } from "./ui/button";
import {
  CalendarDays,
  Send,
  X,
  ClipboardList,
  Layers,
  ListChecks,
  StickyNote,
  FolderKanban,
  Cpu,
  Coins,
  Plus,
  Trash2,
  AlertTriangle,
  Upload,
  FileText,
} from "lucide-react";
import { toast } from "sonner";
import { useApp } from "../context/AppContext";
import { fmtCurrency } from "../lib/format";
import { ADD_CUSTOM_MODEL_OPTION, buildModelOptionLabel, promptForCustomModel } from "../lib/modelCatalog";
import { buildProjectPhaseGate } from "../lib/projectMetrics";
import {
  DEFAULT_GENERAL_BUDGET_HEADERS,
  getGeneralActualRowsCostTotal,
  getGeneralActualRowsCount,
  normalizeGeneralActualRows,
  normalizeGeneralBudgetHeaders,
  parseGeneralActualSheetGrid,
  parseGeneralBudgetTable,
} from "../lib/generalBudget";

const uid = (prefix = "row") => `${prefix}-${Math.random().toString(36).slice(2, 8)}`;

const findModelMeta = (modelCatalog = [], value = "") => {
  const needle = String(value || "").trim().toLowerCase();
  return modelCatalog.find((model) => {
    const candidates = [
      model.id,
      model.name,
      `${model.name} · ${model.provider}`,
      `${model.name} ${model.provider}`,
    ];
    return candidates.some((candidate) => String(candidate || "").trim().toLowerCase() === needle);
  }) || modelCatalog.find((model) => String(model.name || "").trim().toLowerCase() === needle) || null;
};

const buildSheetRow = (modelCatalog = [], seed = {}) => {
  const meta = findModelMeta(modelCatalog, seed.modelId || seed.modelName) || modelCatalog[0];
  const inputTokens = Number(seed.inputTokens || 0);
  const outputTokens = Number(seed.outputTokens || 0);
  return {
    id: seed.id || uid("sheet"),
    modelId: seed.modelId || meta?.id || "",
    modelName: seed.modelName || meta?.name || "",
    task: seed.task || seed.name || "",
    stage: seed.stage || "",
    inputTokens,
    inputTokensM: Number(seed.inputTokensM || 0) || (inputTokens / 1000000),
    outputTokens,
    outputTokensM: Number(seed.outputTokensM || 0) || (outputTokens / 1000000),
    llmCalls: Number(seed.llmCalls || 0),
    cost: Number(seed.cost || 0),
  };
};

const rowHasData = (row = {}) => Boolean(
  row.task
  || row.stage
  || Number(row.cost || 0)
  || Number(row.llmCalls || 0)
  || Number(row.inputTokens || 0)
  || Number(row.outputTokens || 0)
);

const normalizeRows = (rows = [], modelCatalog = []) => (
  (Array.isArray(rows) ? rows : []).map((row) => buildSheetRow(modelCatalog, row))
);

const buildInitialSuccessfulRows = (editingLog, modelCatalog = []) => {
  if (Array.isArray(editingLog?.successfulRows) && editingLog.successfulRows.length) {
    return normalizeRows(editingLog.successfulRows, modelCatalog);
  }
  if (Array.isArray(editingLog?.modelUsage) && editingLog.modelUsage.length) {
    return editingLog.modelUsage.map((row) => buildSheetRow(modelCatalog, {
      modelId: row.modelId,
      modelName: row.modelName,
      task: row.tasksDone ? String(row.tasksDone) : "Imported task log",
      stage: "Execution",
      inputTokens: row.inputTokens,
      outputTokens: row.outputTokens,
      llmCalls: 0,
      cost: row.cost,
    }));
  }
  return [buildSheetRow(modelCatalog)];
};

const buildInitialFailedRows = (editingLog, modelCatalog = []) => {
  if (Array.isArray(editingLog?.failedRows) && editingLog.failedRows.length) {
    return normalizeRows(editingLog.failedRows, modelCatalog);
  }
  return [];
};

const normalizeHeaderKey = (value = "") => String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");

const parseNumericCell = (value) => {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const normalized = String(value ?? "")
    .replace(/[$,%\s]/g, "")
    .replace(/,/g, "")
    .trim();
  if (!normalized) return 0;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

const parseTaskQuantity = (value) => {
  const normalized = String(value ?? "").replace(/,/g, "").trim();
  if (!normalized) return 0;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
};

const getRowTaskQuantity = (row = {}) => {
  const explicit = parseTaskQuantity(row.task);
  return explicit > 0 ? explicit : 1;
};

const sumRowTaskQuantity = (rows = []) => (
  (Array.isArray(rows) ? rows : []).reduce((sum, row) => sum + (rowHasData(row) ? getRowTaskQuantity(row) : 0), 0)
);

const displayDraftNumber = (value, { decimals = null } = {}) => {
  const numeric = Number(value || 0);
  if (!numeric) return "";
  return decimals === null ? String(numeric) : numeric.toFixed(decimals);
};

const toDraftCountString = (value) => {
  const numeric = Number(value || 0);
  return numeric > 0 ? String(numeric) : "";
};

const parseSheetGrid = (grid = [], modelCatalog = []) => {
  const rows = (Array.isArray(grid) ? grid : [])
    .map((row) => (Array.isArray(row) ? row : [row]))
    .map((row) => row.map((cell) => (typeof cell === "string" ? cell.trim() : cell)))
    .filter((row) => row.some((cell) => String(cell ?? "").trim()));
  if (!rows.length) return [];

  const headerKeys = rows[0].map(normalizeHeaderKey);
  const hasHeader = headerKeys.includes("model") || headerKeys.includes("modelname");
  const columns = hasHeader
    ? headerKeys
    : ["model", "task", "stage", "inputtokens", "inputtokensm", "outputtokens", "outputtokensm", "llmcalls", "cost"];
  const dataRows = hasHeader ? rows.slice(1) : rows;

  return dataRows.map((cells) => {
    const record = {};
    columns.forEach((column, index) => {
      const cell = cells[index] ?? "";
      if (column === "model" || column === "modelname") record.model = String(cell || "").trim();
      if (column === "task") record.task = String(cell || "").trim();
      if (column === "stage") record.stage = String(cell || "").trim();
      if (column === "inputtokens") record.inputTokens = parseNumericCell(cell);
      if (column === "inputtokensm") record.inputTokensM = parseNumericCell(cell);
      if (column === "outputtokens") record.outputTokens = parseNumericCell(cell);
      if (column === "outputtokensm") record.outputTokensM = parseNumericCell(cell);
      if (column === "llmcall" || column === "llmcalls") record.llmCalls = parseNumericCell(cell);
      if (column === "cost" || column === "cost$" || column === "costusd") record.cost = parseNumericCell(cell);
    });
    const meta = findModelMeta(modelCatalog, record.model);
    return buildSheetRow(modelCatalog, {
      modelId: meta?.id || "",
      modelName: meta?.name || record.model || "",
      task: record.task,
      stage: record.stage,
      inputTokens: record.inputTokens,
      inputTokensM: record.inputTokensM,
      outputTokens: record.outputTokens,
      outputTokensM: record.outputTokensM,
      llmCalls: record.llmCalls,
      cost: record.cost,
    });
  }).filter(rowHasData);
};

const aggregateRowsByModel = (rows = []) => {
  const grouped = rows.reduce((acc, row) => {
    const key = row.modelId || row.modelName || uid("mdl");
    acc[key] = acc[key] || {
      modelId: row.modelId || "",
      modelName: row.modelName || "Unspecified model",
      tasksDone: 0,
      cost: 0,
      inputTokens: 0,
      outputTokens: 0,
    };
    acc[key].tasksDone += getRowTaskQuantity(row);
    acc[key].cost += Number(row.cost || 0);
    acc[key].inputTokens += Number(row.inputTokens || 0);
    acc[key].outputTokens += Number(row.outputTokens || 0);
    return acc;
  }, {});
  return Object.values(grouped);
};

const buildGeneralActualRow = (headers = DEFAULT_GENERAL_BUDGET_HEADERS, seed = {}) => {
  const safeHeaders = normalizeGeneralBudgetHeaders(headers);
  return {
    id: seed.id || uid("general"),
    estCost: Number(seed.estCost || seed.amount || seed.cost || 0),
    cells: Object.fromEntries(
      safeHeaders.map((header) => [header, String(seed.cells?.[header] ?? seed[header] ?? "").trim()])
    ),
  };
};

const generalActualRowHasData = (row = {}) => (
  Object.values(row.cells || {}).some((value) => String(value || "").trim())
  || Number(row.estCost || row.cost || row.amount || 0) > 0
);

const buildInitialGeneralActualRows = (editingLog, headers = DEFAULT_GENERAL_BUDGET_HEADERS) => {
  if (Array.isArray(editingLog?.generalActualRows) && editingLog.generalActualRows.length) {
    return normalizeGeneralActualRows(editingLog.generalActualRows, headers);
  }
  return [buildGeneralActualRow(headers)];
};

const TpmTaskLogDialog = ({ open, onOpenChange, project, phase, editingLog }) => {
  const {
    logPhaseTask,
    updatePhaseTask,
    getPhaseLogs,
    visibleProjects,
    budgets,
    budgetReviews,
    batchDeliveries,
    user,
    modelCatalog,
    addCustomModel,
  } = useApp();
  const isEdit = !!editingLog;

  const projectList = useMemo(() => (project ? [project] : visibleProjects), [project, visibleProjects]);
  const [projectId, setProjectId] = useState(project?.id || visibleProjects[0]?.id || "");
  const activeProject = useMemo(
    () => projectList.find((entry) => entry.id === projectId) || project || projectList[0] || null,
    [projectId, projectList, project]
  );
  const projectPhases = useMemo(() => activeProject?.phases || [], [activeProject]);
  const [phaseId, setPhaseId] = useState(phase?.id || projectPhases[0]?.id || "");
  const phaseGate = useMemo(
    () => buildProjectPhaseGate(activeProject, batchDeliveries),
    [activeProject, batchDeliveries]
  );
  const firstUnlockedPhaseId = useMemo(
    () => projectPhases.find((entry) => !phaseGate[entry.id]?.isLocked)?.id || projectPhases[0]?.id || "",
    [phaseGate, projectPhases]
  );

  useEffect(() => {
    if (!projectPhases.find((entry) => entry.id === phaseId)) {
      setPhaseId(firstUnlockedPhaseId);
      return;
    }
    if (!isEdit && phaseGate[phaseId]?.isLocked) {
      setPhaseId(firstUnlockedPhaseId);
    }
  }, [firstUnlockedPhaseId, isEdit, phaseGate, phaseId, projectPhases]);

  const currentPhase = projectPhases.find((entry) => entry.id === phaseId) || phase || null;
  const currentPhaseState = phaseGate[phaseId] || {
    isLocked: false,
    isSubmitted: false,
    batchLabel: "This batch",
    previousBatchLabel: "",
    previousPhaseName: "",
  };
  const currentPhaseDelivery = useMemo(
    () => (activeProject && phaseId
      ? batchDeliveries.find((delivery) => delivery.projectId === activeProject.id && delivery.phaseId === phaseId) || null
      : null),
    [activeProject, batchDeliveries, phaseId]
  );
  const isCurrentPhaseLocked = Boolean(currentPhaseState.isLocked);
  const isCurrentPhaseSubmitted = Boolean(currentPhaseDelivery);
  const currentPhaseLockMessage = isCurrentPhaseLocked
    ? `${currentPhaseState.previousBatchLabel || currentPhaseState.previousPhaseName || "The previous batch"} must be submitted before ${currentPhaseState.batchLabel || "this batch"} can be logged.`
    : isCurrentPhaseSubmitted
      ? `${currentPhaseState.batchLabel || "This batch"} has already been submitted, so daily task logging is locked.`
      : "";

  const [successfulTasks, setSuccessfulTasks] = useState(toDraftCountString(editingLog?.successfulTasks ?? editingLog?.tasksDone));
  const [failedTasks, setFailedTasks] = useState(toDraftCountString(editingLog?.failedTasks));
  const [successTrajectories, setSuccessTrajectories] = useState(toDraftCountString(editingLog?.successTrajectories ?? editingLog?.trajectories));
  const [failedTrajectories, setFailedTrajectories] = useState(toDraftCountString(editingLog?.failedTrajectories));
  const [date, setDate] = useState(editingLog?.date || new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState(editingLog?.notes || "");
  const [successfulRows, setSuccessfulRows] = useState(() => buildInitialSuccessfulRows(editingLog, modelCatalog));
  const [failedRows, setFailedRows] = useState(() => buildInitialFailedRows(editingLog, modelCatalog));
  const [successImportMeta, setSuccessImportMeta] = useState(null);
  const approvedGeneralBudgetLines = useMemo(() => {
    const projectLines = Array.isArray(activeProject?.budgetItems?.misc) ? activeProject.budgetItems.misc : [];
    if (projectLines.length) return projectLines;
    const latestRaisedBudget = [...(Array.isArray(budgets) ? budgets : []), ...(Array.isArray(budgetReviews) ? budgetReviews : [])]
      .filter((entry) => entry?.projectId === activeProject?.id)
      .sort((left, right) => new Date(right?.submittedAt || right?.createdAt || 0).getTime() - new Date(left?.submittedAt || left?.createdAt || 0).getTime())[0];
    return Array.isArray(latestRaisedBudget?.items?.misc) ? latestRaisedBudget.items.misc : [];
  }, [activeProject?.budgetItems?.misc, activeProject?.id, budgetReviews, budgets]);
  const generalBudgetTable = useMemo(
    () => parseGeneralBudgetTable(approvedGeneralBudgetLines),
    [approvedGeneralBudgetLines]
  );
  const hasGeneralBudget = approvedGeneralBudgetLines.length > 0;
  const generalActualHeaders = useMemo(
    () => normalizeGeneralBudgetHeaders(generalBudgetTable.isTableMode ? generalBudgetTable.headers : DEFAULT_GENERAL_BUDGET_HEADERS),
    [generalBudgetTable.headers, generalBudgetTable.isTableMode]
  );
  const [logMode, setLogMode] = useState(editingLog?.logType === "general-actual" ? "general" : "model");
  const [generalActualRows, setGeneralActualRows] = useState(() => buildInitialGeneralActualRows(editingLog, generalActualHeaders));
  const [generalImportMeta, setGeneralImportMeta] = useState(null);
  const wasOpenRef = useRef(false);
  const lastEditingLogIdRef = useRef(editingLog?.id || null);

  useEffect(() => {
    const openedNow = open && !wasOpenRef.current;
    const editingLogChanged = open && lastEditingLogIdRef.current !== (editingLog?.id || null);

    if (openedNow || editingLogChanged) {
      setSuccessfulTasks(toDraftCountString(editingLog?.successfulTasks ?? editingLog?.tasksDone));
      setFailedTasks(toDraftCountString(editingLog?.failedTasks));
      setSuccessTrajectories(toDraftCountString(editingLog?.successTrajectories ?? editingLog?.trajectories));
      setFailedTrajectories(toDraftCountString(editingLog?.failedTrajectories));
      setDate(editingLog?.date || new Date().toISOString().slice(0, 10));
      setNotes(editingLog?.notes || "");
      setSuccessfulRows(buildInitialSuccessfulRows(editingLog, modelCatalog));
      setFailedRows(buildInitialFailedRows(editingLog, modelCatalog));
      setSuccessImportMeta(null);
      setLogMode(editingLog?.logType === "general-actual" ? "general" : "model");
      setGeneralActualRows(buildInitialGeneralActualRows(editingLog, generalActualHeaders));
      setGeneralImportMeta(null);
    }

    wasOpenRef.current = open;
    lastEditingLogIdRef.current = editingLog?.id || null;
  }, [editingLog, generalActualHeaders, modelCatalog, open]);

  const existingLogs = useMemo(
    () => (activeProject && phaseId ? getPhaseLogs(activeProject.id, phaseId) : []),
    [activeProject, phaseId, getPhaseLogs]
  );
  const doneAlready = useMemo(
    () => existingLogs.reduce((sum, log) => sum + (Number(log.successfulTasks ?? log.tasksDone) || 0), 0),
    [existingLogs]
  );
  const phaseTotalTasks = Number(currentPhase?.totalTasks || currentPhase?.tasks || activeProject?.totalTasks || 0);

  const populatedSuccessRows = useMemo(() => successfulRows.filter(rowHasData), [successfulRows]);
  const populatedFailedRows = useMemo(() => failedRows.filter(rowHasData), [failedRows]);
  const populatedGeneralActualRows = useMemo(
    () => generalActualRows.filter(generalActualRowHasData),
    [generalActualRows]
  );
  const allRows = useMemo(() => [...populatedSuccessRows, ...populatedFailedRows], [populatedSuccessRows, populatedFailedRows]);
  const successfulTasksFromRows = useMemo(() => sumRowTaskQuantity(populatedSuccessRows), [populatedSuccessRows]);
  const failedTasksFromRows = useMemo(() => sumRowTaskQuantity(populatedFailedRows), [populatedFailedRows]);
  const derivedSuccessfulTasks = parseTaskQuantity(successfulTasks) || successfulTasksFromRows;
  const derivedFailedTasks = parseTaskQuantity(failedTasks) || failedTasksFromRows;
  const derivedSuccessTrajectories = Number(successTrajectories || 0);
  const derivedFailedTrajectories = Number(failedTrajectories || 0);

  const modelUsage = useMemo(() => aggregateRowsByModel(allRows), [allRows]);
  const successCost = useMemo(
    () => populatedSuccessRows.reduce((sum, row) => sum + Number(row.cost || 0), 0),
    [populatedSuccessRows]
  );
  const failedCost = useMemo(
    () => populatedFailedRows.reduce((sum, row) => sum + Number(row.cost || 0), 0),
    [populatedFailedRows]
  );
  const costTotal = successCost + failedCost;
  const generalActualCostTotal = useMemo(
    () => getGeneralActualRowsCostTotal(populatedGeneralActualRows),
    [populatedGeneralActualRows]
  );
  const generalActualRowCount = useMemo(
    () => getGeneralActualRowsCount(populatedGeneralActualRows),
    [populatedGeneralActualRows]
  );
  const inputTokenTotal = useMemo(
    () => allRows.reduce((sum, row) => sum + Number(row.inputTokens || 0), 0),
    [allRows]
  );
  const outputTokenTotal = useMemo(
    () => allRows.reduce((sum, row) => sum + Number(row.outputTokens || 0), 0),
    [allRows]
  );
  const approvedDailyAllocation = useMemo(
    () => Math.round(Number(activeProject?.approvedBudget || 0) / 30 * 100) / 100,
    [activeProject?.approvedBudget]
  );
  const effectiveCostTotal = logMode === "general" ? generalActualCostTotal : costTotal;
  const dailyAllocationVariance = approvedDailyAllocation - effectiveCostTotal;
  const dailyAllocationUtilization = approvedDailyAllocation > 0
    ? Math.round((effectiveCostTotal / approvedDailyAllocation) * 100)
    : 0;
  const doneAlreadyExcludingEdit = isEdit ? doneAlready - (Number(editingLog?.successfulTasks ?? editingLog?.tasksDone) || 0) : doneAlready;
  const projectedDone = doneAlreadyExcludingEdit + derivedSuccessfulTasks;
  const progressPct = phaseTotalTasks > 0 ? Math.min(100, Math.round((projectedDone / phaseTotalTasks) * 100)) : 0;
  const primaryUsage = [...modelUsage].sort((left, right) => Number(right.cost || 0) - Number(left.cost || 0))[0];
  // When logging, only offer the models/subscriptions that were asked for in this project's
  // approved budget (subscription names + model names). Fall back to the full catalog only if
  // the project has no budget items yet, so logging is never blocked.
  const modelOptions = useMemo(() => {
    const options = [];
    const seen = new Set();
    const push = (value, label) => {
      const v = String(value || "").trim();
      if (!v || seen.has(v.toLowerCase())) return;
      seen.add(v.toLowerCase());
      options.push({ value: v, label: String(label || v).trim() });
    };
    const projectBudgetItems = budgets
      .filter((entry) => entry.projectId === activeProject?.id)
      .map((entry) => entry.items || {});
    const allItems = [...projectBudgetItems, activeProject?.budgetItems || {}];
    allItems.forEach((items) => {
      (items.subs || []).forEach((sub) => push(sub.subscription || sub.optionId, sub.subscription || sub.optionLabel));
      (items.models || []).forEach((model) => {
        const meta = findModelMeta(modelCatalog, model.modelId || model.modelName);
        push(model.modelId || model.modelName, meta ? buildModelOptionLabel(meta) : (model.modelName || model.modelId));
      });
    });
    if (options.length === 0) {
      return modelCatalog.map((model) => ({ value: model.id, label: buildModelOptionLabel(model) }));
    }
    return options;
  }, [budgets, activeProject, modelCatalog]);

  const createAndSelectCustomModel = (setter, rowId) => {
    const created = promptForCustomModel(addCustomModel);
    if (!created) return;
    setter((rows) => rows.map((row) => (
      row.id === rowId
        ? { ...row, modelId: created.id, modelName: created.name }
        : row
    )));
    toast.success("Custom model added", {
      description: `${created.name} · ${created.provider} is now available in all model dropdowns.`,
    });
  };

  const updateSheetRow = (setter, id, key, value) => {
    if (key === "modelId" && value === ADD_CUSTOM_MODEL_OPTION) {
      createAndSelectCustomModel(setter, id);
      return;
    }
    setter((rows) => rows.map((row) => {
      if (row.id !== id) return row;
      const next = { ...row, [key]: value };
      if (key === "modelId") {
        const meta = modelCatalog.find((model) => model.id === value);
        next.modelName = meta?.name || modelOptions.find((option) => option.value === value)?.label || value || "";
      }
      if (["inputTokens", "outputTokens", "llmCalls", "cost", "inputTokensM", "outputTokensM"].includes(key)) {
        next[key] = Number(value || 0);
      }
      if (key === "inputTokens") {
        next.inputTokensM = Number(value || 0) / 1000000;
      }
      if (key === "outputTokens") {
        next.outputTokensM = Number(value || 0) / 1000000;
      }
      return next;
    }));
  };

  const addSheetRow = (setter) => setter((rows) => [...rows, buildSheetRow(modelCatalog)]);
  const removeSheetRow = (setter, id) => setter((rows) => rows.filter((row) => row.id !== id));
  const addGeneralActualRow = () => setGeneralActualRows((rows) => [...rows, buildGeneralActualRow(generalActualHeaders)]);
  const updateGeneralActualRow = (id, key, value) => {
    setGeneralActualRows((rows) => rows.map((row) => {
      if (row.id !== id) return row;
      if (key === "estCost") {
        return { ...row, estCost: Number(value || 0) };
      }
      return {
        ...row,
        cells: {
          ...row.cells,
          [key]: value,
        },
      };
    }));
  };
  const removeGeneralActualRow = (id) => setGeneralActualRows((rows) => rows.filter((row) => row.id !== id));

  const importSheetFile = async (type, file) => {
    if (!file) return;
    const lowerName = String(file.name || "").toLowerCase();
    if (!/\.(csv|xlsx|xls)$/.test(lowerName)) {
      toast.error("Upload a CSV or Excel file");
      return;
    }

    try {
      const XLSX = await import("xlsx");
      const workbook = lowerName.endsWith(".csv")
        ? XLSX.read(await file.text(), { type: "string" })
        : XLSX.read(await file.arrayBuffer(), { type: "array" });
      const firstSheet = workbook.SheetNames[0];
      const rawRows = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheet], {
        header: 1,
        raw: false,
        defval: "",
      });
      const parsed = parseSheetGrid(rawRows, modelCatalog);
      if (!parsed.length) {
        toast.error("No valid task rows found in the uploaded sheet");
        return;
      }

      const setter = type === "success" ? setSuccessfulRows : setFailedRows;
      const setMeta = setSuccessImportMeta;
      setter((rows) => {
        const current = rows.filter(rowHasData);
        return [...current, ...parsed];
      });
      setMeta({
        fileName: file.name,
        sheetName: firstSheet,
        rowCount: parsed.length,
      });
      toast.success(`${parsed.length} ${type === "success" ? "successful" : "failed"} row${parsed.length === 1 ? "" : "s"} imported from ${file.name}`);
    } catch (error) {
      toast.error("Could not read that sheet", {
        description: error?.message || "Please upload a valid CSV or Excel file.",
      });
    }
  };

  const importGeneralActualFile = async (file) => {
    if (!file) return;
    const lowerName = String(file.name || "").toLowerCase();
    if (!/\.(csv|xlsx|xls)$/.test(lowerName)) {
      toast.error("Upload a CSV or Excel file");
      return;
    }

    try {
      const XLSX = await import("xlsx");
      const workbook = lowerName.endsWith(".csv")
        ? XLSX.read(await file.text(), { type: "string" })
        : XLSX.read(await file.arrayBuffer(), { type: "array" });
      const firstSheet = workbook.SheetNames[0];
      const rawRows = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheet], {
        header: 1,
        raw: false,
        defval: "",
      });
      const parsed = parseGeneralActualSheetGrid(rawRows, generalActualHeaders);
      if (!parsed.rows.length) {
        toast.error("No valid budget rows found in the uploaded sheet");
        return;
      }

      setGeneralActualRows((rows) => {
        const current = rows.filter(generalActualRowHasData);
        return [...current, ...parsed.rows];
      });
      setGeneralImportMeta({
        fileName: file.name,
        sheetName: firstSheet,
        rowCount: parsed.rows.length,
      });
      toast.success(`${parsed.rows.length} general actual row${parsed.rows.length === 1 ? "" : "s"} imported from ${file.name}`);
    } catch (error) {
      toast.error("Could not read that sheet", {
        description: error?.message || "Please upload a valid CSV or Excel file.",
      });
    }
  };

  const reset = () => {
    setSuccessfulTasks("");
    setFailedTasks("");
    setSuccessTrajectories("");
    setFailedTrajectories("");
    setDate(new Date().toISOString().slice(0, 10));
    setNotes("");
    setSuccessfulRows([buildSheetRow(modelCatalog)]);
    setFailedRows([]);
    setSuccessImportMeta(null);
    setGeneralActualRows([buildGeneralActualRow(generalActualHeaders)]);
    setGeneralImportMeta(null);
  };

  const submit = () => {
    if (!activeProject) { toast.error("Select a project"); return; }
    if (!phaseId) { toast.error("Select a phase"); return; }
    if (isCurrentPhaseLocked) {
      toast.error("This phase is locked", {
        description: currentPhaseLockMessage,
      });
      return;
    }
    if (isCurrentPhaseSubmitted) {
      toast.error("Batch already submitted", {
        description: "Daily task logging is locked for phases that have already been submitted.",
      });
      return;
    }
    if (!date) { toast.error("Date is required"); return; }
    if (logMode === "general") {
      if (generalActualRowCount <= 0 && generalActualCostTotal <= 0) {
        toast.error("Add at least one general actual row for the day");
        return;
      }
      const autoName = `${currentPhase?.name || "Phase"} · ${date} · ${generalActualRowCount} actual row${generalActualRowCount === 1 ? "" : "s"}`;
      const payload = {
        logType: "general-actual",
        name: autoName,
        assignee: user?.name || "TPM",
        hours: 0,
        cost: generalActualCostTotal,
        tasksDone: generalActualRowCount,
        successfulTasks: generalActualRowCount,
        failedTasks: 0,
        trajectories: 0,
        successTrajectories: 0,
        failedTrajectories: 0,
        date,
        notes,
        evidence: "",
        modelId: "",
        modelName: "",
        inputTokens: 0,
        outputTokens: 0,
        modelUsage: [],
        successfulRows: [],
        failedRows: [],
        generalActualHeaders,
        generalActualRows: populatedGeneralActualRows,
      };

      if (isEdit) {
        updatePhaseTask(activeProject.id, phase?.id || phaseId, editingLog.id, payload);
        toast.success("General actual log updated", { description: `${activeProject.name} · ${currentPhase?.name || phaseId}` });
      } else {
        logPhaseTask({ projectId: activeProject.id, phaseId, ...payload });
        toast.success("General actual logged", {
          description: `${activeProject.name} · ${currentPhase?.name || phaseId} · ${fmtCurrency(generalActualCostTotal, { compact: false })}`,
        });
        reset();
      }
      onOpenChange(false);
      return;
    }

    if (derivedSuccessfulTasks <= 0 && derivedFailedTasks <= 0 && costTotal <= 0) {
      toast.error("Add at least one successful or failed task row for the day");
      return;
    }

    const autoName = `${currentPhase?.name || "Phase"} · ${date} · ${derivedSuccessfulTasks} success · ${derivedFailedTasks} failed`;
    const payload = {
      logType: "model-usage",
      name: autoName,
      assignee: user?.name || "TPM",
      hours: 0,
      cost: costTotal,
      tasksDone: derivedSuccessfulTasks,
      successfulTasks: derivedSuccessfulTasks,
      failedTasks: derivedFailedTasks,
      trajectories: derivedSuccessTrajectories,
      successTrajectories: derivedSuccessTrajectories,
      failedTrajectories: derivedFailedTrajectories,
      date,
      notes,
      evidence: "",
      modelId: primaryUsage?.modelId || "",
      modelName: primaryUsage?.modelName || "",
      inputTokens: inputTokenTotal,
      outputTokens: outputTokenTotal,
      modelUsage,
      successfulRows: populatedSuccessRows,
      failedRows: populatedFailedRows,
      generalActualHeaders: [],
      generalActualRows: [],
    };

    if (isEdit) {
      updatePhaseTask(activeProject.id, phase?.id || phaseId, editingLog.id, payload);
      toast.success("Task log updated", { description: `${activeProject.name} · ${currentPhase?.name || phaseId}` });
    } else {
      logPhaseTask({ projectId: activeProject.id, phaseId, ...payload });
      toast.success("Daily task logged", {
        description: `${activeProject.name} · ${currentPhase?.name || phaseId} · ${derivedSuccessfulTasks} success / ${derivedFailedTasks} failed`,
      });
      reset();
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[1080px] max-h-[92vh] overflow-y-auto bg-[#12121A] border border-white/10 text-zinc-100" data-testid="task-log-dialog">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-fuchsia-500/15 flex items-center justify-center border border-fuchsia-500/30">
              <ClipboardList className="w-4 h-4 text-fuchsia-300" />
            </div>
            <div>
              <DialogTitle className="font-display text-lg text-white">{isEdit ? "Edit daily task log" : "Log daily task"}</DialogTitle>
              <DialogDescription className="text-xs text-zinc-400">
                {activeProject?.name ? `${activeProject.name} · ` : ""}
                {logMode === "general"
                  ? "capture phase-wise general actuals from a CSV upload or manual table"
                  : "capture detailed successful and failed task rows, model cost, and token usage"}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {!isEdit && !project && projectList.length > 0 && (
            <Field label="Project *">
              <div className="relative">
                <FolderKanban className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <select
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  data-testid="task-project"
                  className="w-full h-10 pl-8 pr-3 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40"
                >
                  {projectList.map((entry) => (
                    <option key={entry.id} value={entry.id} className="bg-[#12121A]">
                      {entry.name}{entry.client ? ` · ${entry.client}` : ""}
                    </option>
                  ))}
                </select>
              </div>
            </Field>
          )}

          {!isEdit && (
            <Field label="Phase *">
              <div className="relative">
                <Layers className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <select
                  value={phaseId}
                  onChange={(e) => setPhaseId(e.target.value)}
                  data-testid="task-phase"
                  className="w-full h-10 pl-8 pr-3 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40"
                >
                  {projectPhases.length === 0 && <option value="">-- No phases available --</option>}
                  {projectPhases.map((entry) => {
                    const phaseMeta = phaseGate[entry.id] || {};
                    return (
                      <option
                        key={entry.id}
                        value={entry.id}
                        disabled={Boolean(phaseMeta.isLocked)}
                        className="bg-[#12121A]"
                      >
                        {activeProject?.name ? `${activeProject.name} · ` : ""}
                        {entry.name}
                        {phaseMeta.batchLabel ? ` · ${phaseMeta.batchLabel}` : ""}
                        {entry.totalTasks ? ` · ${entry.totalTasks} tasks planned` : ""}
                        {phaseMeta.isLocked ? ` · locked until ${phaseMeta.previousBatchLabel || phaseMeta.previousPhaseName || "previous batch"} is submitted` : ""}
                        {phaseMeta.isSubmitted ? " · submitted" : ""}
                      </option>
                    );
                  })}
                </select>
              </div>
            </Field>
          )}

          {currentPhaseLockMessage && (
            <div className="rounded-xl border border-amber-500/25 bg-amber-500/[0.06] p-3 flex items-start gap-2 text-[11px] text-amber-100">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-300 flex-shrink-0 mt-0.5" />
              <div>{currentPhaseLockMessage}</div>
            </div>
          )}

          {logMode !== "general" && phaseTotalTasks > 0 && (
            <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3" data-testid="task-progress">
              <div className="flex items-center justify-between text-[11px] text-zinc-400 mb-1.5">
                <span className="flex items-center gap-1"><ListChecks className="w-3 h-3 text-fuchsia-300" /> Phase progress</span>
                <span className="tabular">
                  <span className="text-white font-semibold">{projectedDone.toLocaleString()}</span>
                  <span className="text-zinc-500"> / {phaseTotalTasks.toLocaleString()} successful tasks</span>
                  <span className="ml-2 text-fuchsia-300 font-semibold">{progressPct}%</span>
                </span>
              </div>
              <div className="h-2 rounded-full bg-white/[0.05] overflow-hidden">
                <div className="h-full bg-fuchsia-500 transition-all" style={{ width: `${progressPct}%` }} data-testid="task-progress-bar" />
              </div>
            </div>
          )}

          <Field label="Date *">
            <div className="relative">
              <CalendarDays className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                data-testid="task-date"
                className="w-full h-10 pl-8 pr-3 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40"
              />
            </div>
          </Field>

          {hasGeneralBudget && (
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3" data-testid="task-log-mode-toggle">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500">Logging mode</div>
                  <div className="text-[11px] text-zinc-400 mt-1">
                    This project has a general budget. You can keep logging model usage, or upload/manual-log phase actuals against that general budget.
                  </div>
                </div>
                <div className="inline-flex rounded-lg border border-white/10 bg-white/[0.03] p-1">
                  <button
                    type="button"
                    onClick={() => setLogMode("model")}
                    data-testid="task-mode-model"
                    className={`px-3 py-1.5 rounded-md text-xs font-medium ${logMode === "model" ? "bg-fuchsia-500 text-white shadow-[0_0_20px_rgba(232,25,184,0.35)]" : "text-zinc-400 hover:text-zinc-100"}`}
                  >
                    Model usage
                  </button>
                  <button
                    type="button"
                    onClick={() => setLogMode("general")}
                    data-testid="task-mode-general"
                    className={`px-3 py-1.5 rounded-md text-xs font-medium ${logMode === "general" ? "bg-fuchsia-500 text-white shadow-[0_0_20px_rgba(232,25,184,0.35)]" : "text-zinc-400 hover:text-zinc-100"}`}
                  >
                    General actuals
                  </button>
                </div>
              </div>
            </div>
          )}

          <div style={{ display: logMode === "general" ? "none" : undefined }}>

          <TaskSheetSection
            title="Successful task log"
            accent="fuchsia"
            rows={successfulRows}
            modelOptions={modelOptions}
            importMeta={successImportMeta}
            onFileImport={(file) => importSheetFile("success", file)}
            onAddRow={() => addSheetRow(setSuccessfulRows)}
            onUpdateRow={(id, key, value) => updateSheetRow(setSuccessfulRows, id, key, value)}
            onRemoveRow={(id) => removeSheetRow(setSuccessfulRows, id)}
            testidPrefix="success"
            helper="Upload the successful-task CSV / Excel sheet with columns: Model, Task, Runs/Trajectories, Input Tokens, Input Tokens (M), Output Tokens, Output Tokens (M), Cost ($). The uploaded rows appear below in the manual editor."
          />

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Field label="Successful tasks">
              <input
                type="number"
                min="0"
                value={successfulTasks === "" ? displayDraftNumber(successfulTasksFromRows) : successfulTasks}
                onChange={(e) => setSuccessfulTasks(e.target.value)}
                data-testid="task-successful-count"
                className={`${summaryInp} tabular`}
              />
            </Field>
            <Field label="Successful trajectories">
              <input
                type="number"
                min="0"
                value={successTrajectories}
                onChange={(e) => setSuccessTrajectories(e.target.value)}
                data-testid="task-successful-trajectories"
                className={`${summaryInp} tabular`}
              />
            </Field>
            <Field label="Successful cost">
              <div className={`${summaryInp} text-emerald-300`} data-testid="task-successful-cost">{fmtCurrency(successCost, { compact: false })}</div>
            </Field>
            <Field label="Total cost">
              <div className={`${summaryInp} text-fuchsia-300`} data-testid="task-total-cost">{fmtCurrency(costTotal, { compact: false })}</div>
            </Field>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Field label="Input tokens">
              <div className={`${summaryInp} text-zinc-200`} data-testid="task-total-input">{inputTokenTotal.toLocaleString()}</div>
            </Field>
            <Field label="Input tokens (M)">
              <div className={`${summaryInp} text-zinc-200`} data-testid="task-total-input-m">{(inputTokenTotal / 1000000).toFixed(3)}</div>
            </Field>
            <Field label="Output tokens">
              <div className={`${summaryInp} text-zinc-200`} data-testid="task-total-output">{outputTokenTotal.toLocaleString()}</div>
            </Field>
            <Field label="Output tokens (M)">
              <div className={`${summaryInp} text-zinc-200`} data-testid="task-total-output-m">{(outputTokenTotal / 1000000).toFixed(3)}</div>
            </Field>
          </div>

          {(derivedSuccessfulTasks > 0 || derivedFailedTasks > 0 || costTotal > 0) && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-2 text-[11px] text-zinc-500">
              <div>
                Success cost / task: <span className="text-fuchsia-300 font-semibold tabular">{fmtCurrency(successCost / Math.max(derivedSuccessfulTasks, 1), { compact: false })}</span>
              </div>
              <div>
                Total trajectories: <span className="text-fuchsia-300 font-semibold tabular">{(derivedSuccessTrajectories + derivedFailedTrajectories).toLocaleString()}</span>
              </div>
              <div>
                Models logged today: <span className="text-fuchsia-300 font-semibold tabular">{modelUsage.length.toLocaleString()}</span>
              </div>
            </div>
          )}

          </div>

          {logMode === "general" && (
            <GeneralActualSection
              headers={generalActualHeaders}
              rows={generalActualRows}
              importMeta={generalImportMeta}
              onFileImport={importGeneralActualFile}
              onAddRow={addGeneralActualRow}
              onUpdateRow={updateGeneralActualRow}
              onRemoveRow={removeGeneralActualRow}
              rowCount={generalActualRowCount}
              costTotal={generalActualCostTotal}
              templateMode={generalBudgetTable.isTableMode ? "Custom table" : "General budget"}
              phaseSummaries={generalBudgetTable.phaseTotals}
            />
          )}

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Field label="Allocated / day">
              <div className={`${summaryInp} ${approvedDailyAllocation > 0 ? "text-white" : "text-zinc-500"}`} data-testid="task-day-allocated">
                {approvedDailyAllocation > 0 ? fmtCurrency(approvedDailyAllocation, { compact: false }) : "No approved daily allocation"}
              </div>
            </Field>
            <Field label="Logged today">
              <div className={`${summaryInp} text-fuchsia-300`} data-testid="task-day-logged">{fmtCurrency(effectiveCostTotal, { compact: false })}</div>
            </Field>
            <Field label={dailyAllocationVariance >= 0 ? "Remaining vs day" : "Exceeded vs day"}>
              <div
                className={`${summaryInp} ${dailyAllocationVariance >= 0 ? "text-emerald-300" : "text-red-300"}`}
                data-testid="task-day-variance"
              >
                {approvedDailyAllocation > 0 ? fmtCurrency(Math.abs(dailyAllocationVariance), { compact: false }) : "—"}
              </div>
            </Field>
            <Field label="Day utilization">
              <div
                className={`${summaryInp} ${dailyAllocationUtilization > 100 ? "text-red-300" : dailyAllocationUtilization >= 80 ? "text-amber-300" : "text-zinc-100"}`}
                data-testid="task-day-utilization"
              >
                {approvedDailyAllocation > 0 ? `${dailyAllocationUtilization}%` : "—"}
              </div>
            </Field>
          </div>

          <Field label="Note / remark" hint="Optional">
            <div className="relative">
              <StickyNote className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-3 pointer-events-none" />
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Progress notes, blockers, testing note, or handoff context"
                data-testid="task-notes"
                className="w-full pl-8 pr-3 py-2 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40 resize-none"
              />
            </div>
          </Field>

          <div className="rounded-lg border border-fuchsia-500/20 bg-fuchsia-500/[0.05] p-3 flex items-start gap-2 text-[11px] text-zinc-300">
            <Coins className="w-3.5 h-3.5 text-fuchsia-300 flex-shrink-0 mt-0.5" />
            {logMode === "general"
              ? "General actual logs roll into the project actuals for this project and surface through the CFO finance view by phase and by project."
              : "Logged totals roll into the non-CFO dashboards as owned consumption, while CFO keeps the actual-vs-approved finance view. Day allocation above uses the same approved-daily-budget comparison surfaced in the consumption dashboards."}
          </div>
          {logMode === "model" ? (
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/[0.05] p-3 flex items-start gap-2 text-[11px] text-amber-100">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-300 flex-shrink-0 mt-0.5" />
              If you leave the successful / failed task totals blank, the log automatically uses the uploaded task quantities for that day. Numeric task cells are summed; named task rows count as one task each.
            </div>
          ) : (
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/[0.05] p-3 flex items-start gap-2 text-[11px] text-amber-100">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-300 flex-shrink-0 mt-0.5" />
              Upload the phase sheet with your chosen header columns plus a cost column, or add the rows manually. Each row counts as one logged actual entry for this phase.
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border-white/10 bg-white/[0.04] text-zinc-300 hover:bg-white/[0.08]"
            data-testid="task-log-cancel"
          >
            <X className="w-3.5 h-3.5 mr-1" /> Cancel
          </Button>
          <Button
            onClick={submit}
            disabled={isCurrentPhaseLocked || isCurrentPhaseSubmitted}
            className="bg-fuchsia-500 hover:bg-fuchsia-600 text-white gap-1.5 shadow-[0_0_20px_rgba(232,25,184,0.35)]"
            data-testid="task-log-submit"
          >
            <Send className="w-3.5 h-3.5" /> {isEdit ? "Save changes" : "Log task"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const rowInp = "w-full h-9 px-3 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40";
const summaryInp = "w-full h-10 px-3 rounded-lg bg-white/[0.03] border border-white/5 text-sm flex items-center";

const Field = ({ label, hint, children }) => (
  <div>
    <div className="flex items-baseline justify-between mb-1.5">
      <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500">{label}</div>
      {hint && <div className="text-[10px] text-zinc-600">{hint}</div>}
    </div>
    {children}
  </div>
);

const TaskSheetSection = ({
  title,
  helper,
  rows,
  modelOptions,
  importMeta,
  onFileImport,
  onAddRow,
  onUpdateRow,
  onRemoveRow,
  testidPrefix,
  accent = "fuchsia",
}) => {
  const accentClasses = accent === "amber"
    ? "border-amber-500/20 bg-amber-500/[0.04] text-amber-200"
    : "border-fuchsia-500/20 bg-fuchsia-500/[0.04] text-fuchsia-200";

  return (
    <div className={`rounded-xl border p-4 ${accentClasses}`} data-testid={`${testidPrefix}-task-sheet`}>
      <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
        <div>
          <div className="text-sm font-semibold text-white flex items-center gap-2">
            <Cpu className={`w-4 h-4 ${accent === "amber" ? "text-amber-300" : "text-fuchsia-300"}`} />
            {title}
          </div>
          <div className="text-[11px] text-zinc-400 mt-1 max-w-3xl">{helper}</div>
        </div>
        <Button
          type="button"
          size="sm"
          onClick={onAddRow}
          data-testid={`${testidPrefix}-add-row`}
          className={`h-8 rounded-md border text-xs gap-1 ${accent === "amber" ? "bg-amber-500/15 hover:bg-amber-500/25 border-amber-500/25 text-amber-200" : "bg-fuchsia-500/15 hover:bg-fuchsia-500/25 border-fuchsia-500/25 text-fuchsia-300"}`}
        >
          <Plus className="w-3 h-3" /> Add row
        </Button>
      </div>

      <div className="grid gap-2 md:grid-cols-[1fr_auto] mb-3">
        <label
          className="h-11 rounded-lg border border-dashed border-white/15 bg-white/[0.03] px-3 text-sm text-zinc-200 flex items-center gap-2 cursor-pointer hover:bg-white/[0.06]"
          data-testid={`${testidPrefix}-upload-label`}
        >
          <Upload className={`w-4 h-4 ${accent === "amber" ? "text-amber-300" : "text-fuchsia-300"}`} />
          Upload Excel / CSV
          <input
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onFileImport(file);
              e.target.value = "";
            }}
            data-testid={`${testidPrefix}-upload`}
            className="hidden"
          />
        </label>
        <div className="text-[11px] text-zinc-500 self-center">
          First sheet is extracted and loaded into the editable manual section below.
        </div>
      </div>

      {importMeta && (
        <div className="mb-3 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-[11px] text-zinc-300" data-testid={`${testidPrefix}-import-meta`}>
          Imported <span className="text-white font-medium">{importMeta.fileName}</span>
          {importMeta.sheetName ? <span> · Sheet: {importMeta.sheetName}</span> : null}
          <span> · {importMeta.rowCount} row{importMeta.rowCount === 1 ? "" : "s"} loaded</span>
        </div>
      )}

      <div>
        <div className="space-y-2">
          <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500">
            Manual input section
          </div>
          <div className="grid grid-cols-[1.35fr_1.1fr_.9fr_.9fr_.9fr_.9fr_.9fr_.8fr_28px] gap-2 text-[10px] uppercase tracking-widest font-semibold text-zinc-500 pb-1 border-b border-white/5">
            <span>Model</span>
            <span>Task</span>
            <span>Runs/Trajectories</span>
            <span className="text-right">Input tokens</span>
            <span className="text-right">Input tokens (M)</span>
            <span className="text-right">Output tokens</span>
            <span className="text-right">Output tokens (M)</span>
            <span className="text-right">Cost ($)</span>
            <span />
          </div>
          {rows.map((row) => (
            <div key={row.id} className="grid grid-cols-[1.35fr_1.1fr_.9fr_.9fr_.9fr_.9fr_.9fr_.8fr_28px] gap-2 items-center">
              <select
                value={row.modelId}
                onChange={(e) => onUpdateRow(row.id, "modelId", e.target.value)}
                data-testid={`${testidPrefix}-model-${row.id}`}
                className={rowInp}
              >
                <option value="">Select model</option>
                {modelOptions.map((model) => (
                  <option key={model.value} value={model.value} className="bg-[#12121A]">
                    {model.label}
                  </option>
                ))}
                <option value={ADD_CUSTOM_MODEL_OPTION} className="bg-[#12121A]">
                  + Add new model...
                </option>
              </select>
              <input
                value={row.task}
                onChange={(e) => onUpdateRow(row.id, "task", e.target.value)}
                data-testid={`${testidPrefix}-task-${row.id}`}
                className={rowInp}
                placeholder="Task"
              />
              <input
                value={row.stage}
                onChange={(e) => onUpdateRow(row.id, "stage", e.target.value)}
                data-testid={`${testidPrefix}-stage-${row.id}`}
                className={rowInp}
                placeholder="Runs/Trajectories"
              />
              <input
                type="number"
                min="0"
                step="1"
                value={displayDraftNumber(row.inputTokens)}
                onChange={(e) => onUpdateRow(row.id, "inputTokens", e.target.value)}
                data-testid={`${testidPrefix}-input-${row.id}`}
                className={`${rowInp} text-right tabular`}
              />
              <input
                type="number"
                min="0"
                step="0.001"
                value={displayDraftNumber(row.inputTokensM, { decimals: 3 })}
                onChange={(e) => onUpdateRow(row.id, "inputTokensM", e.target.value)}
                data-testid={`${testidPrefix}-input-m-${row.id}`}
                className={`${rowInp} text-right tabular`}
              />
              <input
                type="number"
                min="0"
                step="1"
                value={displayDraftNumber(row.outputTokens)}
                onChange={(e) => onUpdateRow(row.id, "outputTokens", e.target.value)}
                data-testid={`${testidPrefix}-output-${row.id}`}
                className={`${rowInp} text-right tabular`}
              />
              <input
                type="number"
                min="0"
                step="0.001"
                value={displayDraftNumber(row.outputTokensM, { decimals: 3 })}
                onChange={(e) => onUpdateRow(row.id, "outputTokensM", e.target.value)}
                data-testid={`${testidPrefix}-output-m-${row.id}`}
                className={`${rowInp} text-right tabular`}
              />
              <input
                type="number"
                min="0"
                step="0.01"
                value={displayDraftNumber(row.cost)}
                onChange={(e) => onUpdateRow(row.id, "cost", e.target.value)}
                data-testid={`${testidPrefix}-cost-${row.id}`}
                className={`${rowInp} text-right tabular`}
              />
              <button
                type="button"
                onClick={() => onRemoveRow(row.id)}
                data-testid={`${testidPrefix}-remove-${row.id}`}
                className="w-7 h-7 rounded-md hover:bg-red-500/20 text-zinc-500 hover:text-red-300 flex items-center justify-center"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const GeneralActualSection = ({
  headers,
  rows,
  importMeta,
  onFileImport,
  onAddRow,
  onUpdateRow,
  onRemoveRow,
  rowCount,
  costTotal,
  templateMode,
  phaseSummaries = [],
}) => (
  <div className="space-y-4" data-testid="general-actual-section">
    <div className="rounded-xl border border-fuchsia-500/20 bg-fuchsia-500/[0.04] p-4">
      <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
        <div>
          <div className="text-sm font-semibold text-white flex items-center gap-2">
            <FileText className="w-4 h-4 text-fuchsia-300" />
            General actual log
          </div>
          <div className="text-[11px] text-zinc-400 mt-1 max-w-3xl">
            Upload the phase-wise CSV / Excel sheet or add manual rows. The cost column is summed into this phase&apos;s actuals and sent through the same approval flow downstream.
          </div>
        </div>
        <Button
          type="button"
          size="sm"
          onClick={onAddRow}
          data-testid="general-actual-add-row"
          className="h-8 rounded-md border text-xs gap-1 bg-fuchsia-500/15 hover:bg-fuchsia-500/25 border-fuchsia-500/25 text-fuchsia-300"
        >
          <Plus className="w-3 h-3" /> Add row
        </Button>
      </div>

      <div className="grid gap-2 md:grid-cols-[1fr_auto] mb-3">
        <label
          className="h-11 rounded-lg border border-dashed border-white/15 bg-white/[0.03] px-3 text-sm text-zinc-200 flex items-center gap-2 cursor-pointer hover:bg-white/[0.06]"
          data-testid="general-actual-upload-label"
        >
          <Upload className="w-4 h-4 text-fuchsia-300" />
          Upload Excel / CSV
          <input
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onFileImport(file);
              e.target.value = "";
            }}
            data-testid="general-actual-upload"
            className="hidden"
          />
        </label>
        <div className="text-[11px] text-zinc-500 self-center">
          Current template: {templateMode} · expected columns: {headers.join(", ")} + Cost.
        </div>
      </div>

      {importMeta && (
        <div className="mb-3 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-[11px] text-zinc-300" data-testid="general-actual-import-meta">
          Imported <span className="text-white font-medium">{importMeta.fileName}</span>
          {importMeta.sheetName ? <span> · Sheet: {importMeta.sheetName}</span> : null}
          <span> · {importMeta.rowCount} row{importMeta.rowCount === 1 ? "" : "s"} loaded</span>
        </div>
      )}

      <div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500 border-b border-white/5">
              {headers.map((header) => (
                <th key={header} className="text-left py-2 px-3">{header}</th>
              ))}
              <th className="text-right py-2 px-3">Cost ($)</th>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-white/5 last:border-b-0">
                {headers.map((header) => (
                  <td key={`${row.id}-${header}`} className="py-2 px-3">
                    <input
                      value={row.cells?.[header] || ""}
                      onChange={(e) => onUpdateRow(row.id, header, e.target.value)}
                      data-testid={`general-actual-cell-${row.id}-${header}`}
                      className={rowInp}
                    />
                  </td>
                ))}
                <td className="py-2 px-3">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={displayDraftNumber(row.estCost)}
                    onChange={(e) => onUpdateRow(row.id, "estCost", e.target.value)}
                    data-testid={`general-actual-cost-${row.id}`}
                    className={`${rowInp} text-right tabular`}
                  />
                </td>
                <td className="py-2 px-3">
                  <button
                    type="button"
                    onClick={() => onRemoveRow(row.id)}
                    data-testid={`general-actual-remove-${row.id}`}
                    className="w-7 h-7 rounded-md hover:bg-red-500/20 text-zinc-500 hover:text-red-300 flex items-center justify-center"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>

    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <Field label="Rows logged">
        <div className={`${summaryInp} text-zinc-100`} data-testid="general-actual-row-count">{rowCount.toLocaleString()}</div>
      </Field>
      <Field label="Phase actual">
        <div className={`${summaryInp} text-fuchsia-300`} data-testid="general-actual-total-cost">{fmtCurrency(costTotal, { compact: false })}</div>
      </Field>
      <Field label="Template columns">
        <div className={`${summaryInp} text-zinc-200`} data-testid="general-actual-header-count">{headers.length.toLocaleString()}</div>
      </Field>
      <Field label="Budget source">
        <div className={`${summaryInp} text-zinc-200`} data-testid="general-actual-template-mode">{templateMode}</div>
      </Field>
    </div>

    {phaseSummaries.length > 0 && (
      <div className="flex flex-wrap gap-2">
        {phaseSummaries.map((entry) => (
          <div key={entry.phaseId} className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs">
            <div className="text-zinc-500">{entry.phaseName}</div>
            <div className="text-white font-semibold tabular">{fmtCurrency(entry.total, { compact: false })}</div>
          </div>
        ))}
      </div>
    )}
  </div>
);

export default TpmTaskLogDialog;
