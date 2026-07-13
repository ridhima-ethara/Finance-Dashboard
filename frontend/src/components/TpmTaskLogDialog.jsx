import { useMemo, useState, useEffect } from "react";
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
} from "lucide-react";
import { toast } from "sonner";
import { useApp } from "../context/AppContext";
import { fmtCurrency } from "../lib/format";
import { BEDROCK_MODELS } from "../data/mockCatalog";

const uid = (prefix = "row") => `${prefix}-${Math.random().toString(36).slice(2, 8)}`;

const findModelMeta = (value = "") => {
  const needle = String(value || "").trim().toLowerCase();
  return BEDROCK_MODELS.find((model) => {
    const candidates = [
      model.id,
      model.name,
      `${model.name} · ${model.provider}`,
      `${model.name} ${model.provider}`,
    ];
    return candidates.some((candidate) => String(candidate || "").trim().toLowerCase() === needle);
  }) || BEDROCK_MODELS.find((model) => String(model.name || "").trim().toLowerCase() === needle) || null;
};

const buildSheetRow = (seed = {}) => {
  const meta = findModelMeta(seed.modelId || seed.modelName) || BEDROCK_MODELS[0];
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
  row.modelId
  || row.modelName
  || row.task
  || row.stage
  || Number(row.cost || 0)
  || Number(row.llmCalls || 0)
  || Number(row.inputTokens || 0)
  || Number(row.outputTokens || 0)
);

const normalizeRows = (rows = []) => (Array.isArray(rows) ? rows : []).map((row) => buildSheetRow(row));

const buildInitialSuccessfulRows = (editingLog) => {
  if (Array.isArray(editingLog?.successfulRows) && editingLog.successfulRows.length) {
    return normalizeRows(editingLog.successfulRows);
  }
  if (Array.isArray(editingLog?.modelUsage) && editingLog.modelUsage.length) {
    return editingLog.modelUsage.map((row) => buildSheetRow({
      modelId: row.modelId,
      modelName: row.modelName,
      task: "Imported task log",
      stage: "Execution",
      inputTokens: row.inputTokens,
      outputTokens: row.outputTokens,
      llmCalls: 0,
      cost: row.cost,
    }));
  }
  return [buildSheetRow()];
};

const buildInitialFailedRows = (editingLog) => {
  if (Array.isArray(editingLog?.failedRows) && editingLog.failedRows.length) {
    return normalizeRows(editingLog.failedRows);
  }
  return [];
};

const splitLine = (line, delimiter) => {
  if (delimiter === "\t") return line.split("\t");
  return line.split(",").map((part) => part.trim());
};

const normalizeHeaderKey = (value = "") => String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");

const parseSheetText = (text = "") => {
  const lines = String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (!lines.length) return [];

  const delimiter = lines[0].includes("\t") ? "\t" : ",";
  const firstRow = splitLine(lines[0], delimiter);
  const headerKeys = firstRow.map(normalizeHeaderKey);
  const hasHeader = headerKeys.includes("model") || headerKeys.includes("modelname");
  const columns = hasHeader
    ? headerKeys
    : ["model", "task", "stage", "inputtokens", "inputtokensm", "outputtokens", "outputtokensm", "llmcalls", "cost"];
  const dataLines = hasHeader ? lines.slice(1) : lines;

  return dataLines.map((line) => {
    const cells = splitLine(line, delimiter);
    const record = {};
    columns.forEach((column, index) => {
      const cell = cells[index] ?? "";
      if (column === "model" || column === "modelname") record.model = cell;
      if (column === "task") record.task = cell;
      if (column === "stage") record.stage = cell;
      if (column === "inputtokens") record.inputTokens = Number(cell || 0);
      if (column === "inputtokensm") record.inputTokensM = Number(cell || 0);
      if (column === "outputtokens") record.outputTokens = Number(cell || 0);
      if (column === "outputtokensm") record.outputTokensM = Number(cell || 0);
      if (column === "llmcalls") record.llmCalls = Number(cell || 0);
      if (column === "cost" || column === "cost$" || column === "costusd") record.cost = Number(cell || 0);
    });
    const meta = findModelMeta(record.model);
    return buildSheetRow({
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
    acc[key].tasksDone += 1;
    acc[key].cost += Number(row.cost || 0);
    acc[key].inputTokens += Number(row.inputTokens || 0);
    acc[key].outputTokens += Number(row.outputTokens || 0);
    return acc;
  }, {});
  return Object.values(grouped);
};

const TpmTaskLogDialog = ({ open, onOpenChange, project, phase, editingLog }) => {
  const { logPhaseTask, updatePhaseTask, getPhaseLogs, visibleProjects, user } = useApp();
  const isEdit = !!editingLog;

  const projectList = useMemo(() => (project ? [project] : visibleProjects), [project, visibleProjects]);
  const [projectId, setProjectId] = useState(project?.id || visibleProjects[0]?.id || "");
  const activeProject = useMemo(
    () => projectList.find((entry) => entry.id === projectId) || project || projectList[0] || null,
    [projectId, projectList, project]
  );
  const projectPhases = useMemo(() => activeProject?.phases || [], [activeProject]);
  const [phaseId, setPhaseId] = useState(phase?.id || projectPhases[0]?.id || "");

  useEffect(() => {
    if (!projectPhases.find((entry) => entry.id === phaseId)) {
      setPhaseId(projectPhases[0]?.id || "");
    }
  }, [projectPhases, phaseId]);

  const currentPhase = projectPhases.find((entry) => entry.id === phaseId) || phase || null;

  const [successfulTasks, setSuccessfulTasks] = useState(editingLog?.successfulTasks ?? editingLog?.tasksDone ?? 0);
  const [failedTasks, setFailedTasks] = useState(editingLog?.failedTasks ?? 0);
  const [successTrajectories, setSuccessTrajectories] = useState(editingLog?.successTrajectories ?? editingLog?.trajectories ?? 0);
  const [failedTrajectories, setFailedTrajectories] = useState(editingLog?.failedTrajectories ?? 0);
  const [date, setDate] = useState(editingLog?.date || new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState(editingLog?.notes || "");
  const [successfulRows, setSuccessfulRows] = useState(() => buildInitialSuccessfulRows(editingLog));
  const [failedRows, setFailedRows] = useState(() => buildInitialFailedRows(editingLog));
  const [successPaste, setSuccessPaste] = useState("");
  const [failedPaste, setFailedPaste] = useState("");

  useEffect(() => {
    if (!open) return;
    setSuccessfulTasks(editingLog?.successfulTasks ?? editingLog?.tasksDone ?? 0);
    setFailedTasks(editingLog?.failedTasks ?? 0);
    setSuccessTrajectories(editingLog?.successTrajectories ?? editingLog?.trajectories ?? 0);
    setFailedTrajectories(editingLog?.failedTrajectories ?? 0);
    setDate(editingLog?.date || new Date().toISOString().slice(0, 10));
    setNotes(editingLog?.notes || "");
    setSuccessfulRows(buildInitialSuccessfulRows(editingLog));
    setFailedRows(buildInitialFailedRows(editingLog));
    setSuccessPaste("");
    setFailedPaste("");
  }, [editingLog, open]);

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
  const allRows = useMemo(() => [...populatedSuccessRows, ...populatedFailedRows], [populatedSuccessRows, populatedFailedRows]);
  const derivedSuccessfulTasks = Number(successfulTasks || 0) || populatedSuccessRows.length;
  const derivedFailedTasks = Number(failedTasks || 0) || populatedFailedRows.length;
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
  const inputTokenTotal = useMemo(
    () => allRows.reduce((sum, row) => sum + Number(row.inputTokens || 0), 0),
    [allRows]
  );
  const outputTokenTotal = useMemo(
    () => allRows.reduce((sum, row) => sum + Number(row.outputTokens || 0), 0),
    [allRows]
  );
  const llmCallTotal = useMemo(
    () => allRows.reduce((sum, row) => sum + Number(row.llmCalls || 0), 0),
    [allRows]
  );
  const doneAlreadyExcludingEdit = isEdit ? doneAlready - (Number(editingLog?.successfulTasks ?? editingLog?.tasksDone) || 0) : doneAlready;
  const projectedDone = doneAlreadyExcludingEdit + derivedSuccessfulTasks;
  const progressPct = phaseTotalTasks > 0 ? Math.min(100, Math.round((projectedDone / phaseTotalTasks) * 100)) : 0;
  const primaryUsage = [...modelUsage].sort((left, right) => Number(right.cost || 0) - Number(left.cost || 0))[0];

  const updateSheetRow = (setter, id, key, value) => {
    setter((rows) => rows.map((row) => {
      if (row.id !== id) return row;
      const next = { ...row, [key]: value };
      if (key === "modelId") {
        const meta = BEDROCK_MODELS.find((model) => model.id === value);
        next.modelName = meta?.name || "";
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

  const addSheetRow = (setter) => setter((rows) => [...rows, buildSheetRow()]);
  const removeSheetRow = (setter, id) => setter((rows) => rows.filter((row) => row.id !== id));

  const importSheetRows = (type) => {
    const source = type === "success" ? successPaste : failedPaste;
    const parsed = parseSheetText(source);
    if (!parsed.length) {
      toast.error("No valid task rows found in the pasted sheet");
      return;
    }
    const setter = type === "success" ? setSuccessfulRows : setFailedRows;
    setter((rows) => {
      const current = rows.filter(rowHasData);
      return [...current, ...parsed];
    });
    if (type === "success") setSuccessPaste("");
    if (type === "failed") setFailedPaste("");
    toast.success(`${parsed.length} ${type === "success" ? "successful" : "failed"} row${parsed.length === 1 ? "" : "s"} imported`);
  };

  const reset = () => {
    setSuccessfulTasks(0);
    setFailedTasks(0);
    setSuccessTrajectories(0);
    setFailedTrajectories(0);
    setDate(new Date().toISOString().slice(0, 10));
    setNotes("");
    setSuccessfulRows([buildSheetRow()]);
    setFailedRows([]);
    setSuccessPaste("");
    setFailedPaste("");
  };

  const submit = () => {
    if (!activeProject) { toast.error("Select a project"); return; }
    if (!phaseId) { toast.error("Select a phase"); return; }
    if (!date) { toast.error("Date is required"); return; }
    if (derivedSuccessfulTasks <= 0 && derivedFailedTasks <= 0 && costTotal <= 0) {
      toast.error("Add at least one successful or failed task row for the day");
      return;
    }

    const autoName = `${currentPhase?.name || "Phase"} · ${date} · ${derivedSuccessfulTasks} success · ${derivedFailedTasks} failed`;
    const payload = {
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
                {activeProject?.name ? `${activeProject.name} · ` : ""}capture detailed successful and failed task rows, model cost, and token usage
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
                  {projectPhases.map((entry) => (
                    <option key={entry.id} value={entry.id} className="bg-[#12121A]">
                      {activeProject?.name ? `${activeProject.name} · ` : ""}{entry.name}{entry.totalTasks ? ` · ${entry.totalTasks} tasks planned` : ""}
                    </option>
                  ))}
                </select>
              </div>
            </Field>
          )}

          {phaseTotalTasks > 0 && (
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

          <TaskSheetSection
            title="Successful task log"
            accent="fuchsia"
            rows={successfulRows}
            pasteValue={successPaste}
            onPasteChange={setSuccessPaste}
            onImport={() => importSheetRows("success")}
            onAddRow={() => addSheetRow(setSuccessfulRows)}
            onUpdateRow={(id, key, value) => updateSheetRow(setSuccessfulRows, id, key, value)}
            onRemoveRow={(id) => removeSheetRow(setSuccessfulRows, id)}
            testidPrefix="success"
            helper="Paste rows copied from Excel / Sheets with columns: Model, Task, Stage, Input Tokens, Input Tokens (M), Output Tokens, Output Tokens (M), LLM Calls, Cost ($)."
          />

          <TaskSheetSection
            title="Failed task log"
            accent="amber"
            rows={failedRows}
            pasteValue={failedPaste}
            onPasteChange={setFailedPaste}
            onImport={() => importSheetRows("failed")}
            onAddRow={() => addSheetRow(setFailedRows)}
            onUpdateRow={(id, key, value) => updateSheetRow(setFailedRows, id, key, value)}
            onRemoveRow={(id) => removeSheetRow(setFailedRows, id)}
            testidPrefix="failed"
            helper="Capture failed tasks separately so the daily burn, token usage, and utilization view keep both successful and failed effort visible."
          />

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Field label="Successful tasks">
              <input
                type="number"
                min="0"
                value={successfulTasks}
                onChange={(e) => setSuccessfulTasks(Number(e.target.value) || 0)}
                data-testid="task-successful-count"
                className={`${summaryInp} tabular`}
              />
            </Field>
            <Field label="Failed tasks">
              <input
                type="number"
                min="0"
                value={failedTasks}
                onChange={(e) => setFailedTasks(Number(e.target.value) || 0)}
                data-testid="task-failed-count"
                className={`${summaryInp} tabular`}
              />
            </Field>
            <Field label="Successful trajectories">
              <input
                type="number"
                min="0"
                value={successTrajectories}
                onChange={(e) => setSuccessTrajectories(Number(e.target.value) || 0)}
                data-testid="task-successful-trajectories"
                className={`${summaryInp} tabular`}
              />
            </Field>
            <Field label="Failed trajectories">
              <input
                type="number"
                min="0"
                value={failedTrajectories}
                onChange={(e) => setFailedTrajectories(Number(e.target.value) || 0)}
                data-testid="task-failed-trajectories"
                className={`${summaryInp} tabular`}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Field label="Successful cost">
              <div className={`${summaryInp} text-emerald-300`} data-testid="task-successful-cost">{fmtCurrency(successCost, { compact: false })}</div>
            </Field>
            <Field label="Failed cost">
              <div className={`${summaryInp} text-amber-300`} data-testid="task-failed-cost">{fmtCurrency(failedCost, { compact: false })}</div>
            </Field>
            <Field label="Total cost">
              <div className={`${summaryInp} text-fuchsia-300`} data-testid="task-total-cost">{fmtCurrency(costTotal, { compact: false })}</div>
            </Field>
            <Field label="LLM calls">
              <div className={`${summaryInp} text-zinc-200`} data-testid="task-total-llm-calls">{llmCallTotal.toLocaleString()}</div>
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
                Failed cost / task: <span className="text-fuchsia-300 font-semibold tabular">{fmtCurrency(failedCost / Math.max(derivedFailedTasks, 1), { compact: false })}</span>
              </div>
              <div>
                Total trajectories: <span className="text-fuchsia-300 font-semibold tabular">{(derivedSuccessTrajectories + derivedFailedTrajectories).toLocaleString()}</span>
              </div>
              <div>
                Models logged today: <span className="text-fuchsia-300 font-semibold tabular">{modelUsage.length.toLocaleString()}</span>
              </div>
            </div>
          )}

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
            Logged totals roll into the non-CFO dashboards as owned consumption, while CFO keeps the actual-vs-approved finance view. Failed-task rows are preserved too so utilization, burn, and alerts can reflect the full day effort.
          </div>
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/[0.05] p-3 flex items-start gap-2 text-[11px] text-amber-100">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-300 flex-shrink-0 mt-0.5" />
            If you do not enter the successful / failed task totals manually, the log uses the imported row counts for that day.
          </div>
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
  pasteValue,
  onPasteChange,
  onImport,
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
        <textarea
          value={pasteValue}
          onChange={(e) => onPasteChange(e.target.value)}
          rows={3}
          placeholder="Paste Excel / Sheets rows here"
          data-testid={`${testidPrefix}-paste`}
          className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40 resize-none"
        />
        <Button
          type="button"
          onClick={onImport}
          data-testid={`${testidPrefix}-import`}
          className="h-10 self-start rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-zinc-200"
        >
          Import rows
        </Button>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[1180px] space-y-2">
          <div className="grid grid-cols-[1.35fr_1.1fr_.9fr_.9fr_.9fr_.9fr_.9fr_.8fr_.8fr_28px] gap-2 text-[10px] uppercase tracking-widest font-semibold text-zinc-500 pb-1 border-b border-white/5">
            <span>Model</span>
            <span>Task</span>
            <span>Stage</span>
            <span className="text-right">Input tokens</span>
            <span className="text-right">Input tokens (M)</span>
            <span className="text-right">Output tokens</span>
            <span className="text-right">Output tokens (M)</span>
            <span className="text-right">LLM calls</span>
            <span className="text-right">Cost ($)</span>
            <span />
          </div>
          {rows.map((row) => (
            <div key={row.id} className="grid grid-cols-[1.35fr_1.1fr_.9fr_.9fr_.9fr_.9fr_.9fr_.8fr_.8fr_28px] gap-2 items-center">
              <select
                value={row.modelId}
                onChange={(e) => onUpdateRow(row.id, "modelId", e.target.value)}
                data-testid={`${testidPrefix}-model-${row.id}`}
                className={rowInp}
              >
                {BEDROCK_MODELS.map((model) => (
                  <option key={model.id} value={model.id} className="bg-[#12121A]">
                    {model.name} · {model.provider}
                  </option>
                ))}
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
                placeholder="Stage"
              />
              <input
                type="number"
                min="0"
                step="1"
                value={row.inputTokens}
                onChange={(e) => onUpdateRow(row.id, "inputTokens", e.target.value)}
                data-testid={`${testidPrefix}-input-${row.id}`}
                className={`${rowInp} text-right tabular`}
              />
              <input
                type="number"
                min="0"
                step="0.001"
                value={row.inputTokensM}
                onChange={(e) => onUpdateRow(row.id, "inputTokensM", e.target.value)}
                data-testid={`${testidPrefix}-input-m-${row.id}`}
                className={`${rowInp} text-right tabular`}
              />
              <input
                type="number"
                min="0"
                step="1"
                value={row.outputTokens}
                onChange={(e) => onUpdateRow(row.id, "outputTokens", e.target.value)}
                data-testid={`${testidPrefix}-output-${row.id}`}
                className={`${rowInp} text-right tabular`}
              />
              <input
                type="number"
                min="0"
                step="0.001"
                value={row.outputTokensM}
                onChange={(e) => onUpdateRow(row.id, "outputTokensM", e.target.value)}
                data-testid={`${testidPrefix}-output-m-${row.id}`}
                className={`${rowInp} text-right tabular`}
              />
              <input
                type="number"
                min="0"
                step="1"
                value={row.llmCalls}
                onChange={(e) => onUpdateRow(row.id, "llmCalls", e.target.value)}
                data-testid={`${testidPrefix}-calls-${row.id}`}
                className={`${rowInp} text-right tabular`}
              />
              <input
                type="number"
                min="0"
                step="0.01"
                value={row.cost}
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

export default TpmTaskLogDialog;
