import { Link } from "react-router-dom";
import { useMemo, useState } from "react";
import {
  KeyRound,
  ShieldCheck,
  Users,
  ChevronRight,
  Save,
  Database,
  Plus,
  Trash2,
  CalendarDays,
  Cpu,
  Upload,
  Server,
} from "lucide-react";
import { useApp } from "../../context/AppContext";
import { fmtCurrency } from "../../lib/format";
import {
  summarizeLoggedProject,
  summarizeItProjectActuals,
  normalizeItModelUsageRows,
} from "../../lib/projectMetrics";
import { Button } from "../../components/ui/button";
import { toast } from "sonner";

const todayIso = () => new Date().toISOString().slice(0, 10);

const toDraftNumberValue = (value) => {
  if (value === null || value === undefined || value === "") return "";
  return Number(value) === 0 ? "" : String(value);
};

const toSavedNumber = (value) => Number(value || 0);

const normalizeActualHeaderKey = (value = "") =>
  String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");

const parseActualNumericCell = (value) => {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const normalized = String(value ?? "")
    .replace(/[$,%\s]/g, "")
    .replace(/,/g, "")
    .trim();
  if (!normalized) return 0;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

const findModelMeta = (modelCatalog = [], value = "") => {
  const needle = String(value || "").trim().toLowerCase();
  if (!needle) return null;
  return modelCatalog.find((model) => {
    const candidates = [
      model.id,
      model.name,
      `${model.name} · ${model.provider}`,
      `${model.name} ${model.provider}`,
    ];
    return candidates.some(
      (candidate) => String(candidate || "").trim().toLowerCase() === needle
    );
  }) || modelCatalog.find((model) => String(model.name || "").trim().toLowerCase() === needle) || null;
};

const aggregateImportedModelRows = (rows = []) => {
  const grouped = (Array.isArray(rows) ? rows : []).reduce((acc, row, index) => {
    const key = `${row.modelId || row.modelName || `imported-model-${index + 1}`}::${row.provider || ""}`;
    acc[key] = acc[key] || {
      id: row.id || key,
      modelId: row.modelId || "",
      modelName: row.modelName || "Unspecified model",
      provider: row.provider || "",
      cost: 0,
      inputTokens: 0,
      outputTokens: 0,
    };
    acc[key].cost += Number(row.cost || 0);
    acc[key].inputTokens += Number(row.inputTokens || 0);
    acc[key].outputTokens += Number(row.outputTokens || 0);
    return acc;
  }, {});
  return Object.values(grouped).filter(
    (row) =>
      row.modelId
      || row.modelName
      || row.provider
      || row.cost
      || row.inputTokens
      || row.outputTokens
  );
};

const buildUsageRow = (index = 0, row = {}) => ({
  id: row.id || `usage-${Date.now().toString(36)}-${index + 1}`,
  modelId: row.modelId || "",
  modelName: row.modelName || "",
  provider: row.provider || "",
  cost: toDraftNumberValue(row.cost),
  inputTokens: toDraftNumberValue(row.inputTokens),
  outputTokens: toDraftNumberValue(row.outputTokens),
});

const buildProjectSeedModelUsage = (project = {}, modelCatalog = []) => {
  const budgetLines = Array.isArray(project?.budgetItems?.models)
    ? project.budgetItems.models
    : [];
  const seedRows = budgetLines
    .map((line, index) => {
      const meta = findModelMeta(
        modelCatalog,
        line.modelId || line.modelName || line.meta?.name || line.label
      );
      return buildUsageRow(index, {
        id: line.id || `seed-model-${index + 1}`,
        modelId: line.modelId || meta?.id || "",
        modelName:
          line.modelName
          || line.meta?.name
          || line.label
          || meta?.name
          || "",
        provider:
          line.provider
          || line.meta?.provider
          || meta?.provider
          || "",
      });
    })
    .filter((row) => row.modelId || row.modelName || row.provider);

  return seedRows.length ? seedRows : [buildUsageRow(0)];
};

const buildProjectDraft = (actualSummary, activeKeys = 0, modelSeedRows = []) => {
  const latestDaily = actualSummary.dailyActuals[actualSummary.dailyActuals.length - 1];
  const modelUsage = actualSummary.modelUsage.length
    ? actualSummary.modelUsage.map((row, index) => buildUsageRow(index, row))
    : modelSeedRows.map((row, index) => buildUsageRow(index, row));
  return {
    actualDate: latestDaily?.date || todayIso(),
    modelActual: toDraftNumberValue(latestDaily?.modelActual ?? actualSummary.modelActual),
    infraActual: toDraftNumberValue(latestDaily?.infraActual ?? actualSummary.infraActual),
    subsActual: toDraftNumberValue(latestDaily?.subsActual ?? actualSummary.subsActual),
    monthEndActual: toDraftNumberValue(actualSummary.monthEndActual),
    activeKeys: toDraftNumberValue(actualSummary.activeKeys || activeKeys),
    note: actualSummary.note || "",
    modelUsage: modelUsage.length ? modelUsage : [buildUsageRow(0)],
    importedDailyActuals: actualSummary.dailyActuals,
    importMeta: null,
  };
};

const upsertDailyActualRow = (rows = [], nextRow) => {
  const filtered = (Array.isArray(rows) ? rows : []).filter(
    (row) => row?.date !== nextRow.date
  );
  return [...filtered, nextRow].sort(
    (left, right) =>
      new Date(left.date || 0).getTime() - new Date(right.date || 0).getTime()
  );
};

const mergeDailyActualRows = (baseRows = [], incomingRows = []) =>
  (Array.isArray(incomingRows) ? incomingRows : []).reduce(
    (rows, row) =>
      upsertDailyActualRow(rows, {
        date: row.date || todayIso(),
        modelActual: Number(row.modelActual || 0),
        infraActual: Number(row.infraActual || 0),
        subsActual: Number(row.subsActual || 0),
      }),
    Array.isArray(baseRows) ? [...baseRows] : []
  );

const parseActualImportGrid = (grid = [], modelCatalog = []) => {
  const rows = (Array.isArray(grid) ? grid : [])
    .map((row) => (Array.isArray(row) ? row : [row]))
    .map((row) => row.map((cell) => (typeof cell === "string" ? cell.trim() : cell)))
    .filter((row) => row.some((cell) => String(cell ?? "").trim()));
  if (!rows.length) {
    return { dailyActuals: [], modelUsage: [], monthEndActual: 0, activeKeys: 0 };
  }

  const headerKeys = rows[0].map(normalizeActualHeaderKey);
  const hasHeader = headerKeys.some((key) => [
    "date",
    "actualdate",
    "modelprovider",
    "provider",
    "model",
    "modelname",
    "bedrockmodel",
    "modelactual",
    "infraactual",
    "subsactual",
    "subscriptionactual",
    "monthendactual",
    "cost",
    "actualcost",
    "activekeys",
  ].includes(key));
  const columns = hasHeader
    ? headerKeys
    : [
        "actualdate",
        "provider",
        "model",
        "cost",
        "inputtokens",
        "outputtokens",
        "modelactual",
        "infraactual",
        "subsactual",
        "monthendactual",
        "activekeys",
      ];
  const dataRows = hasHeader ? rows.slice(1) : rows;
  const dailyMap = new Map();
  const modelUsage = [];
  let monthEndActual = 0;
  let activeKeys = 0;

  const ensureDailyRow = (date) => {
    const key = date || todayIso();
    if (!dailyMap.has(key)) {
      dailyMap.set(key, {
        date: key,
        explicitModelActual: 0,
        derivedModelActual: 0,
        infraActual: 0,
        subsActual: 0,
        hasExplicitModelActual: false,
      });
    }
    return dailyMap.get(key);
  };

  dataRows.forEach((cells) => {
    const record = {
      actualDate: "",
      provider: "",
      model: "",
      cost: 0,
      inputTokens: 0,
      outputTokens: 0,
      modelActual: 0,
      infraActual: 0,
      subsActual: 0,
      monthEndActual: 0,
      activeKeys: 0,
    };

    columns.forEach((column, index) => {
      const cell = cells[index] ?? "";
      if (column === "date" || column === "actualdate") record.actualDate = String(cell || "").trim();
      if (column === "provider" || column === "modelprovider") record.provider = String(cell || "").trim();
      if (column === "model" || column === "modelname" || column === "bedrockmodel") record.model = String(cell || "").trim();
      if (column === "cost" || column === "actualcost" || column === "modelcost") record.cost = parseActualNumericCell(cell);
      if (column === "inputtokens") record.inputTokens = parseActualNumericCell(cell);
      if (column === "outputtokens") record.outputTokens = parseActualNumericCell(cell);
      if (column === "modelactual") record.modelActual = parseActualNumericCell(cell);
      if (column === "infraactual" || column === "infrastructureactual" || column === "infracost") record.infraActual = parseActualNumericCell(cell);
      if (column === "subsactual" || column === "subscriptionactual" || column === "subscost" || column === "subscriptioncost") record.subsActual = parseActualNumericCell(cell);
      if (column === "monthendactual") record.monthEndActual = parseActualNumericCell(cell);
      if (column === "activekeys") record.activeKeys = parseActualNumericCell(cell);
    });

    if (
      record.actualDate
      || record.modelActual
      || record.infraActual
      || record.subsActual
      || record.monthEndActual
      || record.activeKeys
      || (record.model && record.cost)
    ) {
      const dailyRow = ensureDailyRow(record.actualDate);
      if (record.modelActual > 0) {
        dailyRow.explicitModelActual += record.modelActual;
        dailyRow.hasExplicitModelActual = true;
      } else if (record.model && record.cost > 0) {
        dailyRow.derivedModelActual += record.cost;
      }
      dailyRow.infraActual += Number(record.infraActual || 0);
      dailyRow.subsActual += Number(record.subsActual || 0);
    }

    if (record.monthEndActual > 0) monthEndActual = Math.max(monthEndActual, record.monthEndActual);
    if (record.activeKeys > 0) activeKeys = Math.max(activeKeys, record.activeKeys);

    if (record.model || record.provider) {
      const meta = findModelMeta(modelCatalog, record.model);
      modelUsage.push({
        id: `imported-model-${record.model || record.provider}-${modelUsage.length + 1}`,
        modelId: meta?.id || "",
        modelName: meta?.name || record.model,
        provider: record.provider || meta?.provider || "",
        cost: Number(record.cost || 0),
        inputTokens: Number(record.inputTokens || 0),
        outputTokens: Number(record.outputTokens || 0),
      });
    }
  });

  const dailyActuals = Array.from(dailyMap.values())
    .map((row) => ({
      date: row.date,
      modelActual: row.hasExplicitModelActual ? row.explicitModelActual : row.derivedModelActual,
      infraActual: row.infraActual,
      subsActual: row.subsActual,
    }))
    .filter((row) => row.date || row.modelActual || row.infraActual || row.subsActual)
    .sort(
      (left, right) =>
        new Date(left.date || 0).getTime() - new Date(right.date || 0).getTime()
    );

  return {
    dailyActuals,
    modelUsage: aggregateImportedModelRows(modelUsage),
    monthEndActual,
    activeKeys,
  };
};

const buildProjectPhaseLabel = (project = {}) => {
  const phases = Array.isArray(project?.phases) ? project.phases : [];
  if (!phases.length) return "No scheduled phase";
  const firstPhase = phases[0]?.name || phases[0]?.dates || "Phase 1";
  return phases.length === 1 ? firstPhase : `${firstPhase} +${phases.length - 1}`;
};

const buildProjectedActualState = (project, draft) => {
  const seedDailyActuals = Array.isArray(draft.importedDailyActuals)
    ? draft.importedDailyActuals
    : (project.actualEntry.dailyActuals || project.actualSummary.dailyActuals || []);
  const modelUsageTotal = normalizeItModelUsageRows(draft.modelUsage).reduce(
    (sum, row) => sum + Number(row.cost || 0),
    0
  );
  const resolvedModelActual = modelUsageTotal > 0
    ? modelUsageTotal
    : toSavedNumber(draft.modelActual);
  const dailyRow = {
    date: draft.actualDate || todayIso(),
    modelActual: resolvedModelActual,
    infraActual: toSavedNumber(draft.infraActual),
    subsActual: toSavedNumber(draft.subsActual),
  };
  const latestDailyActual =
    Number(dailyRow.modelActual || 0)
    + Number(dailyRow.infraActual || 0)
    + Number(dailyRow.subsActual || 0);
  const hasExistingDateRow = seedDailyActuals.some((row) => row?.date === dailyRow.date);
  const dailyActuals = latestDailyActual > 0 || hasExistingDateRow
    ? upsertDailyActualRow(seedDailyActuals, dailyRow)
    : seedDailyActuals;
  const totals = dailyActuals.reduce(
    (sum, row) => ({
      modelActual: sum.modelActual + Number(row.modelActual || 0),
      infraActual: sum.infraActual + Number(row.infraActual || 0),
      subsActual: sum.subsActual + Number(row.subsActual || 0),
    }),
    { modelActual: 0, infraActual: 0, subsActual: 0 }
  );
  const totalActual = totals.modelActual + totals.infraActual + totals.subsActual;
  return {
    resolvedModelActual,
    latestDailyActual,
    dailyActuals,
    modelActual: totals.modelActual,
    infraActual: totals.infraActual,
    subsActual: totals.subsActual,
    totalActual,
    variance: Number(project.approvedBudget || 0) - totalActual,
  };
};

const buildStatusMeta = (project, projectedActual) => {
  const isActive =
    projectedActual.totalActual > 0
    || Number(project.activeKeys || 0) > 0
    || project.itProvisioningStatus === "completed";
  if (!isActive) return { label: "Inactive", cls: "text-zinc-400" };
  if (projectedActual.variance < 0) return { label: "Active", cls: "text-red-300" };
  return { label: "Active", cls: "text-emerald-300" };
};

const ItDashboard = () => {
  const {
    itProvisioningRequests,
    modelKeyRecords,
    projects,
    taskLogs,
    itMonthlyActuals,
    saveItMonthlyActual,
    modelCatalog,
  } = useApp();

  const [drafts, setDrafts] = useState({});

  const pending = useMemo(
    () => itProvisioningRequests.filter((request) => request.status === "pending-it"),
    [itProvisioningRequests]
  );
  const completed = useMemo(
    () => itProvisioningRequests.filter((request) => request.status === "completed"),
    [itProvisioningRequests]
  );
  const gatewayOverview = useMemo(() => {
    const accessTokens = modelKeyRecords.flatMap((entry) => entry.accessTokens || []);
    const activeTokens = accessTokens.filter((token) => token.status === "active");
    const expiringSoon = activeTokens.filter((token) => {
      if (!token.expiresAt) return false;
      const expiresAt = new Date(token.expiresAt).getTime();
      return Number.isFinite(expiresAt) && expiresAt <= Date.now() + (14 * 24 * 60 * 60 * 1000);
    }).length;
    return {
      activeTokens: activeTokens.length,
      governedProjects: new Set(modelKeyRecords.map((entry) => entry.project).filter(Boolean)).size,
      routes: new Set(activeTokens.map((token) => token.gatewayRoute || "/api/gateway/execute")).size,
      expiringSoon,
    };
  }, [modelKeyRecords]);

  const actualProjects = useMemo(() => {
    const relevantIds = new Set([
      ...itProvisioningRequests.map((entry) => entry.projectId),
      ...modelKeyRecords.map((entry) => entry.project),
    ]);
    return projects
      .filter((project) => relevantIds.has(project.id))
      .map((project) => {
        const actualEntry = itMonthlyActuals[project.id] || {};
        const actualSummary = summarizeItProjectActuals(actualEntry);
        const projectKeys = modelKeyRecords.filter((entry) => entry.project === project.id);
        const gatewayTokens = projectKeys.flatMap((entry) => entry.accessTokens || []);
        return {
          ...project,
          usage: summarizeLoggedProject(project, taskLogs),
          actualEntry,
          actualSummary,
          activeKeys: projectKeys.filter((entry) => entry.status === "active").length,
          gatewayTokens,
          gatewayRoutes: Array.from(new Set(projectKeys.map((entry) => entry.gatewayRoute || "/api/gateway/execute"))),
          governedBudgetLeft: projectKeys.reduce(
            (sum, entry) => sum + Number(entry.gatewayPolicy?.remainingBudget || 0),
            0
          ),
          phaseLabel: buildProjectPhaseLabel(project),
          seedModelUsage: buildProjectSeedModelUsage(project, modelCatalog),
        };
      })
      .sort((left, right) => left.name.localeCompare(right.name));
  }, [itProvisioningRequests, modelKeyRecords, projects, taskLogs, itMonthlyActuals, modelCatalog]);

  const updateDraft = (project, updater) => {
    setDrafts((current) => {
      const base =
        current[project.id]
        || buildProjectDraft(project.actualSummary, project.activeKeys, project.seedModelUsage);
      const next = typeof updater === "function" ? updater(base) : { ...base, ...updater };
      return { ...current, [project.id]: next };
    });
  };

  const addModelUsageRow = (project) => {
    updateDraft(project, (draft) => ({
      ...draft,
      modelUsage: [...draft.modelUsage, buildUsageRow(draft.modelUsage.length)],
    }));
  };

  const updateModelUsageRow = (project, rowId, key, value) => {
    updateDraft(project, (draft) => ({
      ...draft,
      modelUsage: draft.modelUsage.map((row) => {
        if (row.id !== rowId) return row;
        if (key === "modelName") {
          const meta = findModelMeta(modelCatalog, value);
          return {
            ...row,
            modelId: meta?.id || row.modelId || "",
            modelName: value,
            provider: meta?.provider || row.provider || "",
          };
        }
        return { ...row, [key]: value };
      }),
    }));
  };

  const removeModelUsageRow = (project, rowId) => {
    updateDraft(project, (draft) => ({
      ...draft,
      modelUsage:
        draft.modelUsage.length > 1
          ? draft.modelUsage.filter((row) => row.id !== rowId)
          : [buildUsageRow(0)],
    }));
  };

  const saveActuals = (project) => {
    const draft =
      drafts[project.id]
      || buildProjectDraft(project.actualSummary, project.activeKeys, project.seedModelUsage);
    const projectedActual = buildProjectedActualState(project, draft);
    const modelUsage = normalizeItModelUsageRows(draft.modelUsage).map((row) => {
      const meta = findModelMeta(modelCatalog, row.modelId || row.modelName);
      return {
        ...row,
        modelId: row.modelId || meta?.id || "",
        modelName: row.modelName || meta?.name || "Unspecified model",
        provider: row.provider || meta?.provider || "",
      };
    });

    saveItMonthlyActual(project.id, {
      dailyActuals: projectedActual.dailyActuals,
      modelUsage,
      modelActual: projectedActual.modelActual,
      infraActual: projectedActual.infraActual,
      subsActual: projectedActual.subsActual,
      totalActual: projectedActual.totalActual,
      dailyApiCost: projectedActual.latestDailyActual,
      monthEndActual: toSavedNumber(draft.monthEndActual),
      monthEndDate: draft.actualDate || todayIso(),
      activeKeys: toSavedNumber(draft.activeKeys || project.activeKeys),
      note: draft.note || "",
    });

    setDrafts((current) => {
      const next = { ...current };
      delete next[project.id];
      return next;
    });

    toast.success("Daily actuals saved", {
      description: `${project.name} updated with ${fmtCurrency(
        projectedActual.latestDailyActual,
        { compact: false }
      )} for ${draft.actualDate || todayIso()}.`,
    });
  };

  const importActualsFile = async (project, file) => {
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
      const parsed = parseActualImportGrid(rawRows, modelCatalog);
      if (
        !parsed.dailyActuals.length
        && !parsed.modelUsage.length
        && !parsed.monthEndActual
        && !parsed.activeKeys
      ) {
        toast.error("No valid IT actual rows found in the uploaded sheet");
        return;
      }

      const baseDailyRows =
        project.actualEntry.dailyActuals || project.actualSummary.dailyActuals || [];
      const mergedDailyActuals = mergeDailyActualRows(baseDailyRows, parsed.dailyActuals);
      const latestDaily =
        mergedDailyActuals[mergedDailyActuals.length - 1]
        || parsed.dailyActuals[parsed.dailyActuals.length - 1]
        || null;

      updateDraft(project, (draft) => ({
        ...draft,
        actualDate: latestDaily?.date || draft.actualDate || todayIso(),
        modelActual: latestDaily
          ? toDraftNumberValue(latestDaily.modelActual)
          : draft.modelActual,
        infraActual: latestDaily
          ? toDraftNumberValue(latestDaily.infraActual)
          : draft.infraActual,
        subsActual: latestDaily
          ? toDraftNumberValue(latestDaily.subsActual)
          : draft.subsActual,
        monthEndActual:
          parsed.monthEndActual > 0
            ? toDraftNumberValue(parsed.monthEndActual)
            : draft.monthEndActual,
        activeKeys:
          parsed.activeKeys > 0
            ? toDraftNumberValue(parsed.activeKeys)
            : draft.activeKeys,
        modelUsage: parsed.modelUsage.length
          ? parsed.modelUsage.map((row, index) => buildUsageRow(index, row))
          : draft.modelUsage,
        importedDailyActuals: mergedDailyActuals,
        importMeta: {
          fileName: file.name,
          sheetName: firstSheet,
          dailyRows: parsed.dailyActuals.length,
          modelRows: parsed.modelUsage.length,
        },
      }));

      toast.success("IT actuals imported", {
        description: `${file.name} loaded ${parsed.dailyActuals.length} daily row${
          parsed.dailyActuals.length === 1 ? "" : "s"
        } and ${parsed.modelUsage.length} model row${
          parsed.modelUsage.length === 1 ? "" : "s"
        }.`,
      });
    } catch (error) {
      toast.error("Could not read that sheet", {
        description: error?.message || "Please upload a valid CSV or Excel file.",
      });
    }
  };

  return (
    <div className="space-y-6" data-testid="page-it-dashboard">
      <div>
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] font-semibold text-cyan-300">
          <span className="w-6 h-px bg-cyan-400" />
          IT Portal · Provisioning & Actuals
        </div>
        <h1 className="mt-2 font-display font-semibold text-3xl tracking-tight text-white">
          Approved budget access queue
        </h1>
        <p className="text-sm text-zinc-400 mt-1">
          CFO-approved budgets land here so IT can provision access and log the
          day-wise actuals that flow back into Finance monitoring. Provider keys
          stay masked while project teams receive internal platform tokens for
          the gateway.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        <Stat label="Pending provisioning" value={String(pending.length)} icon={ShieldCheck} />
        <Stat label="Provisioned requests" value={String(completed.length)} icon={KeyRound} />
        <Stat
          label="Active keys"
          value={String(modelKeyRecords.filter((entry) => entry.status === "active").length)}
          icon={KeyRound}
        />
        <Stat label="Active tokens" value={String(gatewayOverview.activeTokens)} icon={ShieldCheck} />
        <Stat label="Gateway projects" value={String(gatewayOverview.governedProjects)} icon={Server} />
        <Stat
          label="Actuals filed"
          value={String(Object.keys(itMonthlyActuals).length)}
          icon={Database}
        />
      </div>

      <div className="bg-[#12121A] rounded-2xl border border-white/5 p-5">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
          <div>
            <div className="font-display font-semibold text-[15px] text-white">
              Gateway token allocation
            </div>
            <div className="text-xs text-zinc-500 mt-0.5">
              Internal platform tokens are what members use. Each call is routed
              through <span className="font-mono text-zinc-300">/api/gateway/execute</span>,
              where policy, budget, and rate checks happen before the provider
              key is used.
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          <Mini label="Active tokens" value={String(gatewayOverview.activeTokens)} icon={ShieldCheck} />
          <Mini label="Projects routed" value={String(gatewayOverview.governedProjects)} icon={Server} />
          <Mini label="Routes live" value={String(gatewayOverview.routes)} icon={ChevronRight} />
          <Mini label="Expiring in 14d" value={String(gatewayOverview.expiringSoon)} icon={CalendarDays} />
        </div>

        <div className="space-y-3">
          {actualProjects.map((project) => (
            <div key={`${project.id}-gateway`} className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <div className="text-sm font-semibold text-white">{project.name}</div>
                  <div className="text-[11px] text-zinc-500 mt-1">
                    {project.gatewayTokens.length} token{project.gatewayTokens.length === 1 ? "" : "s"} ·{" "}
                    {project.activeKeys} active key{project.activeKeys === 1 ? "" : "s"} ·{" "}
                    {project.gatewayRoutes[0] || "/api/gateway/execute"}
                  </div>
                </div>
                <div className="text-sm font-semibold text-cyan-200 tabular">
                  {fmtCurrency(project.governedBudgetLeft || 0, { compact: false })}
                </div>
              </div>
              <div className="mt-3 grid grid-cols-1 lg:grid-cols-3 gap-3 text-[11px]">
                <ProvisionMini
                  label="Models"
                  value={String(project.seedModelUsage.length || 0)}
                  detail={project.seedModelUsage.map((row) => row.modelName).filter(Boolean).join(" · ") || "No model rows mapped"}
                />
                <ProvisionMini
                  label="Members"
                  value={String(project.gatewayTokens.length)}
                  detail={project.gatewayTokens.map((token) => token.memberName).join(" · ") || "No token issued"}
                />
                <ProvisionMini
                  label="Policy"
                  value={project.gatewayTokens[0]?.rateLimitPerMinute ? `${project.gatewayTokens[0].rateLimitPerMinute}/min` : "Pending"}
                  detail={project.gatewayTokens[0]
                    ? `${(project.gatewayTokens[0].allowedNetworks || []).join(", ") || "Any network"} · ${(project.gatewayTokens[0].allowedDevices || []).join(", ") || "Any device"}`
                    : "Awaiting IT provisioning"}
                />
              </div>
            </div>
          ))}
          {actualProjects.length === 0 && (
            <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-8 text-center text-xs text-zinc-500">
              No gateway-managed projects are available yet.
            </div>
          )}
        </div>
      </div>

      <div className="bg-[#12121A] rounded-2xl border border-white/5 p-5">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
          <div>
            <div className="font-display font-semibold text-[15px] text-white">
              Pending IT actions
            </div>
            <div className="text-xs text-zinc-500 mt-0.5">
              Open the project Models tab to add the key values and assign them
              to members.
            </div>
          </div>
          <Link
            to="/projects"
            className="inline-flex items-center gap-1 text-xs text-fuchsia-300 hover:text-fuchsia-200 font-medium"
          >
            Open Projects <ChevronRight className="w-3 h-3" />
          </Link>
        </div>
        <div className="space-y-3">
          {pending.length === 0 && (
            <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-8 text-center text-xs text-zinc-500">
              No pending CFO-approved provisioning requests right now.
            </div>
          )}

          {pending.map((request) => (
            <div
              key={request.id}
              className="rounded-xl border border-white/10 bg-white/[0.02] p-4"
            >
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <div className="text-sm font-semibold text-white">
                    {request.projectName}
                  </div>
                  <div className="text-[11px] text-zinc-500 mt-1">
                    {request.budgetType} · approved by {request.approvedBy} ·{" "}
                    {new Date(request.approvedAt || Date.now()).toLocaleString(
                      "en-US",
                      { dateStyle: "medium", timeStyle: "short" }
                    )}
                  </div>
                </div>
                <div className="text-sm font-semibold text-fuchsia-300 tabular">
                  {fmtCurrency(request.approvedAmount, { compact: false })}
                </div>
              </div>
              <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3 text-[11px]">
                <Mini label="Models" value={String(request.requestedModels?.length || 0)} />
                <Mini label="Infra lines" value={String(request.requestedInfra?.length || 0)} />
                <Mini label="Members" value={String(request.members?.length || 0)} icon={Users} />
              </div>
              <div className="mt-3 text-[11px] text-zinc-500">
                Gateway route: <span className="font-mono text-zinc-200">{request.gatewayRoute || "/api/gateway/execute"}</span>
              </div>
              <div className="mt-3 flex justify-end">
                <Link
                  to={`/projects/${request.projectId}`}
                  className="inline-flex items-center gap-1 text-xs text-fuchsia-300 hover:text-fuchsia-200 font-medium"
                >
                  Open project <ChevronRight className="w-3 h-3" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-[#12121A] rounded-2xl border border-white/5 p-5">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
          <div>
            <div className="font-display font-semibold text-[15px] text-white">
              Daily actuals worksheet
            </div>
            <div className="text-xs text-zinc-500 mt-0.5">
              Spreadsheet-style logging for model costs, daily consumed budget,
              overall actuals, variance, and infra totals.
            </div>
          </div>
          <Link
            to="/reports"
            className="inline-flex items-center gap-1 text-xs text-fuchsia-300 hover:text-fuchsia-200 font-medium"
          >
            Open Reports <ChevronRight className="w-3 h-3" />
          </Link>
        </div>

        <div className="space-y-4">
          {actualProjects.length === 0 && (
            <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-8 text-center text-xs text-zinc-500">
              No approved projects have reached the IT actuals stage yet.
            </div>
          )}

          {actualProjects.map((project) => {
            const draft =
              drafts[project.id]
              || buildProjectDraft(
                project.actualSummary,
                project.activeKeys,
                project.seedModelUsage
              );
            const projectedActual = buildProjectedActualState(project, draft);
            const modelRows = draft.modelUsage.length
              ? draft.modelUsage
              : project.seedModelUsage;
            const rowSpan = Math.max(modelRows.length, 1);
            const statusMeta = buildStatusMeta(project, projectedActual);

            return (
              <div
                key={project.id}
                className="rounded-2xl border border-white/10 bg-white/[0.02] p-4"
              >
                <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
                  <div>
                    <div className="text-sm font-semibold text-white">
                      {project.name}
                    </div>
                    <div className="text-[11px] text-zinc-500 mt-1">
                      {project.client || "Client"} · {project.phaseLabel} ·{" "}
                      {fmtCurrency(project.approvedBudget || 0, { compact: false })} approved
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2 text-[10px] text-zinc-500">
                      <span className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-1">
                        {project.gatewayTokens.length} token{project.gatewayTokens.length === 1 ? "" : "s"}
                      </span>
                      <span className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-1">
                        {project.activeKeys} active key{project.activeKeys === 1 ? "" : "s"}
                      </span>
                      <span className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-1">
                        {fmtCurrency(project.governedBudgetLeft || 0, { compact: false })} gateway budget left
                      </span>
                    </div>
                  </div>
                  <div className="flex items-end gap-2 flex-wrap">
                    <DateField
                      label="Actual date"
                      value={draft.actualDate}
                      onChange={(value) =>
                        updateDraft(project, { actualDate: value })
                      }
                    />
                    <label className="inline-flex items-center justify-center gap-1.5 h-10 px-3 rounded-lg border border-cyan-500/30 bg-cyan-500/10 text-cyan-200 hover:bg-cyan-500/20 cursor-pointer text-xs font-medium">
                      <Upload className="w-3.5 h-3.5" />
                      CSV / Excel
                      <input
                        type="file"
                        accept=".csv,.xlsx,.xls"
                        className="hidden"
                        onChange={(event) => {
                          const selectedFile = event.target.files?.[0];
                          if (selectedFile) importActualsFile(project, selectedFile);
                          event.target.value = "";
                        }}
                      />
                    </label>
                    <Button
                      onClick={() => saveActuals(project)}
                      className="h-10 rounded-lg bg-fuchsia-500 hover:bg-fuchsia-600 text-white gap-1.5 shadow-[0_0_20px_rgba(232,25,184,0.35)]"
                    >
                      <Save className="w-3.5 h-3.5" />
                      Save daily actuals
                    </Button>
                  </div>
                </div>

                {draft.importMeta && (
                  <div className="mb-3 text-[10px] text-zinc-500">
                    Imported {draft.importMeta.fileName} · {draft.importMeta.dailyRows} daily row
                    {draft.importMeta.dailyRows === 1 ? "" : "s"} · {draft.importMeta.modelRows} model row
                    {draft.importMeta.modelRows === 1 ? "" : "s"}
                  </div>
                )}

                <div className="overflow-x-auto rounded-xl border border-white/5">
                  <table className="w-full min-w-[1420px] text-sm">
                    <thead>
                      <tr className="bg-white/[0.03] border-b border-white/5 text-[10px] uppercase tracking-widest font-semibold text-zinc-500">
                        <th className="py-2.5 px-3 text-left">Project</th>
                        <th className="py-2.5 px-3 text-left">External / Client</th>
                        <th className="py-2.5 px-3 text-left">Model Provider</th>
                        <th className="py-2.5 px-3 text-left">Models</th>
                        <th className="py-2.5 px-3 text-right">Models Cost ($)</th>
                        <th className="py-2.5 px-3 text-right">Approved Budget ($)</th>
                        <th className="py-2.5 px-3 text-left">
                          Last One Day Consumed Budget ($) ({draft.actualDate || todayIso()})
                        </th>
                        <th className="py-2.5 px-3 text-right">Overall Consumed Budget ($)</th>
                        <th className="py-2.5 px-3 text-right">Under / Over Budget</th>
                        <th className="py-2.5 px-3 text-left">Status</th>
                        <th className="py-2.5 px-3 text-right">EC2 Cost / Project</th>
                      </tr>
                    </thead>
                    <tbody>
                      {modelRows.map((row, index) => {
                        const modelMeta = findModelMeta(
                          modelCatalog,
                          row.modelId || row.modelName
                        );
                        const providerLabel =
                          row.provider
                          || modelMeta?.provider
                          || "—";
                        return (
                          <tr
                            key={row.id || `${project.id}-model-${index + 1}`}
                            className="border-b border-white/5 last:border-b-0 align-top"
                          >
                            {index === 0 && (
                              <>
                                <td
                                  rowSpan={rowSpan}
                                  className="py-3 px-3 text-white font-semibold align-top"
                                >
                                  {project.name}
                                </td>
                                <td rowSpan={rowSpan} className="py-3 px-3 align-top">
                                  <div className="text-white">{project.phaseLabel}</div>
                                  <div className="text-[11px] text-zinc-500 mt-1">
                                    {project.client || "Client"}
                                  </div>
                                </td>
                              </>
                            )}
                            <td className="py-3 px-3">
                              <input
                                type="text"
                                value={providerLabel === "—" ? "" : providerLabel}
                                onChange={(event) =>
                                  updateModelUsageRow(
                                    project,
                                    row.id,
                                    "provider",
                                    event.target.value
                                  )
                                }
                                placeholder="Provider"
                                className="w-full h-9 px-3 rounded-md bg-white/[0.04] border border-white/10 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
                              />
                            </td>
                            <td className="py-3 px-3">
                              <div className="flex items-center gap-2">
                                <input
                                  type="text"
                                  value={row.modelName || ""}
                                  onChange={(event) =>
                                    updateModelUsageRow(
                                      project,
                                      row.id,
                                      "modelName",
                                      event.target.value
                                    )
                                  }
                                  placeholder="Model name"
                                  className="flex-1 h-9 px-3 rounded-md bg-white/[0.04] border border-white/10 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
                                />
                                <button
                                  type="button"
                                  onClick={() => removeModelUsageRow(project, row.id)}
                                  className="w-9 h-9 rounded-md border border-red-500/20 bg-red-500/10 text-red-300 hover:bg-red-500/20 inline-flex items-center justify-center"
                                  title="Remove model row"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                            <td className="py-3 px-3">
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={row.cost ?? ""}
                                onChange={(event) =>
                                  updateModelUsageRow(
                                    project,
                                    row.id,
                                    "cost",
                                    event.target.value
                                  )
                                }
                                className="w-full h-9 px-3 rounded-md bg-white/[0.04] border border-white/10 text-sm text-zinc-100 tabular text-right focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
                              />
                            </td>
                            {index === 0 && (
                              <>
                                <td
                                  rowSpan={rowSpan}
                                  className="py-3 px-3 text-right text-white font-semibold tabular align-top"
                                >
                                  {fmtCurrency(project.approvedBudget || 0, {
                                    compact: false,
                                  })}
                                </td>
                                <td rowSpan={rowSpan} className="py-3 px-3 align-top">
                                  <div className="space-y-2 min-w-[220px]">
                                    <MiniInputRow label="Model">
                                      {projectedActual.resolvedModelActual > 0 ? (
                                        <div className="h-9 px-3 rounded-md bg-white/[0.03] border border-white/10 text-sm text-white tabular text-right leading-9">
                                          {fmtCurrency(
                                            projectedActual.resolvedModelActual,
                                            { compact: false }
                                          )}
                                        </div>
                                      ) : (
                                        <input
                                          type="number"
                                          min="0"
                                          step="0.01"
                                          value={draft.modelActual ?? ""}
                                          onChange={(event) =>
                                            updateDraft(project, {
                                              modelActual: event.target.value,
                                            })
                                          }
                                          className="w-full h-9 px-3 rounded-md bg-white/[0.04] border border-white/10 text-sm text-zinc-100 tabular text-right focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
                                        />
                                      )}
                                    </MiniInputRow>
                                    <MiniInputRow label="Infra">
                                      <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={draft.infraActual ?? ""}
                                        onChange={(event) =>
                                          updateDraft(project, {
                                            infraActual: event.target.value,
                                          })
                                        }
                                        className="w-full h-9 px-3 rounded-md bg-white/[0.04] border border-white/10 text-sm text-zinc-100 tabular text-right focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
                                      />
                                    </MiniInputRow>
                                    <MiniInputRow label="Subs">
                                      <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={draft.subsActual ?? ""}
                                        onChange={(event) =>
                                          updateDraft(project, {
                                            subsActual: event.target.value,
                                          })
                                        }
                                        className="w-full h-9 px-3 rounded-md bg-white/[0.04] border border-white/10 text-sm text-zinc-100 tabular text-right focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
                                      />
                                    </MiniInputRow>
                                    <div className="pt-1 border-t border-white/10 flex items-center justify-between text-[11px]">
                                      <span className="text-zinc-500">Total</span>
                                      <span className="text-white font-semibold tabular">
                                        {fmtCurrency(projectedActual.latestDailyActual, {
                                          compact: false,
                                        })}
                                      </span>
                                    </div>
                                  </div>
                                </td>
                                <td
                                  rowSpan={rowSpan}
                                  className="py-3 px-3 text-right text-white font-semibold tabular align-top"
                                >
                                  {fmtCurrency(projectedActual.totalActual, {
                                    compact: false,
                                  })}
                                </td>
                                <td
                                  rowSpan={rowSpan}
                                  className={`py-3 px-3 text-right font-semibold tabular align-top ${
                                    projectedActual.variance >= 0
                                      ? "bg-emerald-500/20 text-emerald-200"
                                      : "bg-red-500/20 text-red-200"
                                  }`}
                                >
                                  {projectedActual.variance >= 0 ? "" : "-"}
                                  {fmtCurrency(Math.abs(projectedActual.variance), {
                                    compact: false,
                                  })}
                                </td>
                                <td rowSpan={rowSpan} className="py-3 px-3 align-top">
                                  <span className={`text-sm font-semibold ${statusMeta.cls}`}>
                                    {statusMeta.label}
                                  </span>
                                </td>
                                <td
                                  rowSpan={rowSpan}
                                  className="py-3 px-3 text-right text-white font-semibold tabular align-top"
                                >
                                  {fmtCurrency(projectedActual.infraActual, {
                                    compact: false,
                                  })}
                                </td>
                              </>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="mt-4 flex items-center justify-between gap-3 flex-wrap">
                  <div className="inline-flex items-center gap-2 text-[11px] text-zinc-500">
                    <CalendarDays className="w-3.5 h-3.5 text-cyan-300" />
                    Logged spend {fmtCurrency(project.usage.loggedSpend, { compact: false })} ·{" "}
                    {project.usage.loggedTasks} tasks · {project.activeKeys} active key
                    {project.activeKeys === 1 ? "" : "s"}
                  </div>
                  <Button
                    onClick={() => addModelUsageRow(project)}
                    variant="outline"
                    className="h-8 rounded-lg border-cyan-500/30 bg-cyan-500/10 text-cyan-200 hover:bg-cyan-500/20 gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add model row
                  </Button>
                </div>

                <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
                  <ActualField
                    label="Month-end actual"
                    value={draft.monthEndActual}
                    onChange={(value) =>
                      updateDraft(project, { monthEndActual: value })
                    }
                  />
                  <ActualField
                    label="Active keys"
                    value={draft.activeKeys}
                    onChange={(value) =>
                      updateDraft(project, { activeKeys: value })
                    }
                  />
                  <Mini
                    label="Models filed"
                    value={String(
                      normalizeItModelUsageRows(draft.modelUsage).filter(
                        (row) => row.modelName || row.provider || row.cost
                      ).length
                    )}
                    icon={Cpu}
                  />
                </div>

                <textarea
                  value={draft.note}
                  onChange={(event) =>
                    updateDraft(project, { note: event.target.value })
                  }
                  rows={2}
                  placeholder="Optional note for CFO about the actuals, vendor invoice, or reconciliation context."
                  className="mt-3 w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 resize-none"
                />

                <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
                  <Mini
                    label="Daily rows filed"
                    value={String(projectedActual.dailyActuals.length)}
                    icon={CalendarDays}
                  />
                  <Mini
                    label="Updated"
                    value={
                      project.actualSummary.updatedAt
                        ? new Date(project.actualSummary.updatedAt).toLocaleDateString(
                            "en-US",
                            { month: "short", day: "numeric" }
                          )
                        : "Not yet"
                    }
                    icon={Database}
                  />
                  <Mini
                    label="Overall variance"
                    value={fmtCurrency(projectedActual.variance, { compact: false })}
                    icon={Server}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

const Stat = ({ label, value, icon: Icon }) => (
  <div className="bg-[#12121A] rounded-2xl border border-white/5 p-4">
    <div className="flex items-center justify-between">
      <div className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
        {label}
      </div>
      <div className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center">
        <Icon className="w-3.5 h-3.5 text-zinc-400" />
      </div>
    </div>
    <div className="mt-2 font-display font-semibold text-2xl tabular text-white">
      {value}
    </div>
  </div>
);

const Mini = ({ label, value, icon: Icon }) => (
  <div className="rounded-lg border border-white/5 bg-white/[0.03] p-3">
    <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500 flex items-center gap-1">
      {Icon && <Icon className="w-3 h-3" />}
      {label}
    </div>
    <div className="mt-1 text-sm font-semibold text-white tabular">{value}</div>
  </div>
);

const ProvisionMini = ({ label, value, detail }) => (
  <div className="rounded-lg border border-white/5 bg-white/[0.03] p-3">
    <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500">{label}</div>
    <div className="mt-1 text-sm font-semibold text-white tabular">{value}</div>
    <div className="mt-1 text-[11px] text-zinc-500 leading-relaxed">{detail}</div>
  </div>
);

const ActualField = ({ label, value, onChange }) => (
  <div>
    <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500 mb-1">
      {label}
    </div>
    <input
      type="number"
      min="0"
      step="0.01"
      value={value ?? ""}
      onChange={(event) => onChange(event.target.value)}
      className="w-full h-10 px-3 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-zinc-100 tabular focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
    />
  </div>
);

const DateField = ({ label, value, onChange }) => (
  <div>
    <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500 mb-1">
      {label}
    </div>
    <input
      type="date"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="w-full h-10 px-3 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
    />
  </div>
);

const MiniInputRow = ({ label, children }) => (
  <div>
    <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500 mb-1">
      {label}
    </div>
    {children}
  </div>
);

export default ItDashboard;
