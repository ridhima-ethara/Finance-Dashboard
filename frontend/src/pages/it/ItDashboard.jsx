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
import { BEDROCK_MODELS } from "../../data/mockCatalog";

const todayIso = () => new Date().toISOString().slice(0, 10);

const buildUsageRow = (index = 0, row = {}) => ({
  id: row.id || `usage-${Date.now().toString(36)}-${index + 1}`,
  modelId: row.modelId || "",
  modelName: row.modelName || "",
  cost: row.cost ?? "",
  inputTokens: row.inputTokens ?? "",
  outputTokens: row.outputTokens ?? "",
});

const buildProjectDraft = (actualSummary, activeKeys = 0) => {
  const latestDaily = actualSummary.dailyActuals[actualSummary.dailyActuals.length - 1];
  return {
    actualDate: latestDaily?.date || todayIso(),
    modelActual: latestDaily?.modelActual ?? actualSummary.modelActual ?? "",
    infraActual: latestDaily?.infraActual ?? actualSummary.infraActual ?? "",
    subsActual: latestDaily?.subsActual ?? actualSummary.subsActual ?? "",
    activeKeys: actualSummary.activeKeys || activeKeys || 0,
    note: actualSummary.note || "",
    modelUsage: actualSummary.modelUsage.map((row, index) => buildUsageRow(index, row)),
  };
};

const upsertDailyActualRow = (rows = [], nextRow) => {
  const filtered = (Array.isArray(rows) ? rows : []).filter((row) => row?.date !== nextRow.date);
  return [...filtered, nextRow].sort(
    (left, right) => new Date(left.date || 0).getTime() - new Date(right.date || 0).getTime()
  );
};

const ItDashboard = () => {
  const {
    itProvisioningRequests,
    modelKeyRecords,
    projects,
    taskLogs,
    itMonthlyActuals,
    saveItMonthlyActual,
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
        return {
          ...project,
          usage: summarizeLoggedProject(project, taskLogs),
          actualEntry,
          actualSummary,
          activeKeys: modelKeyRecords.filter((entry) => entry.project === project.id && entry.status === "active").length,
        };
      });
  }, [itProvisioningRequests, modelKeyRecords, projects, taskLogs, itMonthlyActuals]);

  const updateDraft = (projectId, actualSummary, activeKeys, updater) => {
    setDrafts((current) => {
      const base = current[projectId] || buildProjectDraft(actualSummary, activeKeys);
      const next = typeof updater === "function" ? updater(base) : { ...base, ...updater };
      return { ...current, [projectId]: next };
    });
  };

  const addModelUsageRow = (projectId, actualSummary, activeKeys) => {
    updateDraft(projectId, actualSummary, activeKeys, (draft) => ({
      ...draft,
      modelUsage: [...draft.modelUsage, buildUsageRow(draft.modelUsage.length)],
    }));
  };

  const updateModelUsageRow = (projectId, actualSummary, activeKeys, rowId, key, value) => {
    updateDraft(projectId, actualSummary, activeKeys, (draft) => ({
      ...draft,
      modelUsage: draft.modelUsage.map((row) => {
        if (row.id !== rowId) return row;
        if (key === "modelId") {
          const selected = BEDROCK_MODELS.find((model) => model.id === value);
          return {
            ...row,
            modelId: value,
            modelName: selected?.name || row.modelName || "",
          };
        }
        return { ...row, [key]: value };
      }),
    }));
  };

  const removeModelUsageRow = (projectId, actualSummary, activeKeys, rowId) => {
    updateDraft(projectId, actualSummary, activeKeys, (draft) => ({
      ...draft,
      modelUsage: draft.modelUsage.filter((row) => row.id !== rowId),
    }));
  };

  const saveActuals = (project) => {
    const actualSummary = project.actualSummary;
    const draft = drafts[project.id] || buildProjectDraft(actualSummary, project.activeKeys);
    const dailyRow = {
      date: draft.actualDate || todayIso(),
      modelActual: Number(draft.modelActual || 0),
      infraActual: Number(draft.infraActual || 0),
      subsActual: Number(draft.subsActual || 0),
    };
    const dailyActuals = upsertDailyActualRow(project.actualEntry.dailyActuals || actualSummary.dailyActuals, dailyRow);
    const modelUsage = normalizeItModelUsageRows(draft.modelUsage).map((row) => ({
      ...row,
      modelName: row.modelName || BEDROCK_MODELS.find((model) => model.id === row.modelId)?.name || "Unspecified model",
    }));
    const totals = dailyActuals.reduce((sum, row) => ({
      modelActual: sum.modelActual + Number(row.modelActual || 0),
      infraActual: sum.infraActual + Number(row.infraActual || 0),
      subsActual: sum.subsActual + Number(row.subsActual || 0),
    }), { modelActual: 0, infraActual: 0, subsActual: 0 });
    const totalActual = totals.modelActual + totals.infraActual + totals.subsActual;
    const latestDailyActual = Number(dailyRow.modelActual || 0) + Number(dailyRow.infraActual || 0) + Number(dailyRow.subsActual || 0);

    saveItMonthlyActual(project.id, {
      dailyActuals,
      modelUsage,
      modelActual: totals.modelActual,
      infraActual: totals.infraActual,
      subsActual: totals.subsActual,
      totalActual,
      dailyApiCost: latestDailyActual,
      activeKeys: Number(draft.activeKeys || project.activeKeys || 0),
      note: draft.note || "",
    });

    setDrafts((current) => {
      const next = { ...current };
      delete next[project.id];
      return next;
    });

    toast.success("Daily actuals saved", {
      description: `${project.name} updated with ${fmtCurrency(latestDailyActual, { compact: false })} for ${draft.actualDate || todayIso()}.`,
    });
  };

  return (
    <div className="space-y-6" data-testid="page-it-dashboard">
      <div>
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] font-semibold text-cyan-300">
          <span className="w-6 h-px bg-cyan-400" />
          IT Portal · Access Provisioning
        </div>
        <h1 className="mt-2 font-display font-semibold text-3xl tracking-tight text-white">Approved budget access queue</h1>
        <p className="text-sm text-zinc-400 mt-1">
          CFO-approved budgets land here so IT can allocate model keys, file day-wise API actuals, and publish the live model usage mix for Finance views.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Pending provisioning" value={String(pending.length)} icon={ShieldCheck} />
        <Stat label="Provisioned requests" value={String(completed.length)} icon={KeyRound} />
        <Stat label="Active keys" value={String(modelKeyRecords.filter((entry) => entry.status === "active").length)} icon={KeyRound} />
        <Stat label="Actuals filed" value={String(Object.keys(itMonthlyActuals).length)} icon={Database} />
      </div>

      <div className="bg-[#12121A] rounded-2xl border border-white/5 p-5">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
          <div>
            <div className="font-display font-semibold text-[15px] text-white">Pending IT actions</div>
            <div className="text-xs text-zinc-500 mt-0.5">Open a request in Model Keys to add the key values and assign them to members.</div>
          </div>
          <Link to="/keys" className="inline-flex items-center gap-1 text-xs text-fuchsia-300 hover:text-fuchsia-200 font-medium">
            Open Model Keys <ChevronRight className="w-3 h-3" />
          </Link>
        </div>
        <div className="space-y-3">
          {pending.length === 0 && (
            <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-8 text-center text-xs text-zinc-500">
              No pending CFO-approved provisioning requests right now.
            </div>
          )}
          {pending.map((request) => (
            <div key={request.id} className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <div className="text-sm font-semibold text-white">{request.projectName}</div>
                  <div className="text-[11px] text-zinc-500 mt-1">
                    {request.budgetType} · approved by {request.approvedBy} · {new Date(request.approvedAt || Date.now()).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}
                  </div>
                </div>
                <div className="text-sm font-semibold text-fuchsia-300 tabular">{fmtCurrency(request.approvedAmount, { compact: false })}</div>
              </div>
              <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3 text-[11px]">
                <Mini label="Models" value={String(request.requestedModels?.length || 0)} />
                <Mini label="Infra lines" value={String(request.requestedInfra?.length || 0)} />
                <Mini label="Members" value={String(request.members?.length || 0)} icon={Users} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-[#12121A] rounded-2xl border border-white/5 p-5">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
          <div>
            <div className="font-display font-semibold text-[15px] text-white">Daily actuals &amp; model usage reconciliation</div>
            <div className="text-xs text-zinc-500 mt-0.5">
              IT files the daily API actuals and the per-model usage mix that feed the CFO actuals, recovery, and monitoring views.
            </div>
          </div>
          <Link to="/reports" className="inline-flex items-center gap-1 text-xs text-fuchsia-300 hover:text-fuchsia-200 font-medium">
            Open Reports <ChevronRight className="w-3 h-3" />
          </Link>
        </div>

        <div className="space-y-3">
          {actualProjects.length === 0 && (
            <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-8 text-center text-xs text-zinc-500">
              No approved projects have reached the IT actuals stage yet.
            </div>
          )}
          {actualProjects.map((project) => {
            const draft = drafts[project.id] || buildProjectDraft(project.actualSummary, project.activeKeys);
            const actual = project.actualSummary;
            const modelUsageRows = draft.modelUsage;
            return (
              <div key={project.id} className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <div className="text-sm font-semibold text-white">{project.name}</div>
                    <div className="text-[11px] text-zinc-500 mt-1">
                      Logged by delivery {fmtCurrency(project.usage.loggedSpend, { compact: false })} · {project.usage.loggedTasks} tasks · {project.activeKeys} active key{project.activeKeys === 1 ? "" : "s"}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <Mini label="IT actual to date" value={fmtCurrency(actual.totalActual, { compact: false })} />
                    <Mini label="Last daily actual" value={fmtCurrency(actual.latestDailyActual, { compact: false })} />
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-1 md:grid-cols-6 gap-3">
                  <DateField
                    label="Actual date"
                    value={draft.actualDate}
                    onChange={(value) => updateDraft(project.id, actual, project.activeKeys, { actualDate: value })}
                  />
                  <ActualField
                    label="Model actual"
                    value={draft.modelActual}
                    onChange={(value) => updateDraft(project.id, actual, project.activeKeys, { modelActual: value })}
                  />
                  <ActualField
                    label="Infra actual"
                    value={draft.infraActual}
                    onChange={(value) => updateDraft(project.id, actual, project.activeKeys, { infraActual: value })}
                  />
                  <ActualField
                    label="Subs actual"
                    value={draft.subsActual}
                    onChange={(value) => updateDraft(project.id, actual, project.activeKeys, { subsActual: value })}
                  />
                  <ActualField
                    label="Active keys"
                    value={draft.activeKeys}
                    onChange={(value) => updateDraft(project.id, actual, project.activeKeys, { activeKeys: value })}
                  />
                  <div className="flex items-end">
                    <Button
                      onClick={() => saveActuals(project)}
                      className="h-10 w-full rounded-lg bg-fuchsia-500 hover:bg-fuchsia-600 text-white gap-1.5 shadow-[0_0_20px_rgba(232,25,184,0.35)]"
                    >
                      <Save className="w-3.5 h-3.5" /> Save
                    </Button>
                  </div>
                </div>

                <div className="mt-4 rounded-xl border border-white/10 bg-[#12121A] p-4">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div>
                      <div className="text-[10px] uppercase tracking-widest font-semibold text-cyan-300">Model usage filed by IT</div>
                      <div className="text-xs text-zinc-500 mt-0.5">This mix is used by Finance dashboards when IT has published actuals.</div>
                    </div>
                    <Button
                      variant="outline"
                      onClick={() => addModelUsageRow(project.id, actual, project.activeKeys)}
                      className="h-8 rounded-lg border-cyan-500/30 bg-cyan-500/10 text-cyan-200 hover:bg-cyan-500/20 gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add model
                    </Button>
                  </div>

                  <div className="mt-3 space-y-3">
                    {modelUsageRows.length === 0 && (
                      <div className="rounded-lg border border-dashed border-white/10 bg-white/[0.02] px-4 py-6 text-center text-xs text-zinc-500">
                        No model usage has been filed yet for this project.
                      </div>
                    )}
                    {modelUsageRows.map((row) => (
                      <div key={row.id} className="grid grid-cols-1 md:grid-cols-[2fr_1fr_1fr_1fr_auto] gap-3">
                        <div>
                          <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500 mb-1">Bedrock model</div>
                          <select
                            value={row.modelId}
                            onChange={(event) => updateModelUsageRow(project.id, actual, project.activeKeys, row.id, "modelId", event.target.value)}
                            className="w-full h-10 px-3 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40"
                          >
                            <option value="">Select model</option>
                            {BEDROCK_MODELS.map((model) => (
                              <option key={model.id} value={model.id}>
                                {model.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <ActualField
                          label="Actual cost"
                          value={row.cost}
                          onChange={(value) => updateModelUsageRow(project.id, actual, project.activeKeys, row.id, "cost", value)}
                        />
                        <ActualField
                          label="Input tokens"
                          value={row.inputTokens}
                          onChange={(value) => updateModelUsageRow(project.id, actual, project.activeKeys, row.id, "inputTokens", value)}
                        />
                        <ActualField
                          label="Output tokens"
                          value={row.outputTokens}
                          onChange={(value) => updateModelUsageRow(project.id, actual, project.activeKeys, row.id, "outputTokens", value)}
                        />
                        <div className="flex items-end">
                          <button
                            type="button"
                            onClick={() => removeModelUsageRow(project.id, actual, project.activeKeys, row.id)}
                            className="w-10 h-10 rounded-lg border border-red-500/20 bg-red-500/10 text-red-300 hover:bg-red-500/20 inline-flex items-center justify-center"
                            title="Remove model row"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <textarea
                  value={draft.note}
                  onChange={(event) => updateDraft(project.id, actual, project.activeKeys, { note: event.target.value })}
                  rows={2}
                  placeholder="Optional note for CFO / audit trail"
                  className="mt-3 w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40 resize-none"
                />

                <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3 text-[11px]">
                  <Mini label="Daily rows filed" value={String(actual.dailyActuals.length)} icon={CalendarDays} />
                  <Mini label="Models filed" value={String(actual.modelUsage.length || modelUsageRows.length)} icon={Cpu} />
                  <Mini label="Updated" value={actual.updatedAt ? new Date(actual.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "Not yet"} icon={Database} />
                </div>

                {actual.updatedAt && (
                  <div className="mt-2 text-[10px] text-zinc-500">
                    Last filed {new Date(actual.updatedAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })} · by {actual.updatedBy}
                  </div>
                )}
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
      <div className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">{label}</div>
      <div className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center">
        <Icon className="w-3.5 h-3.5 text-zinc-400" />
      </div>
    </div>
    <div className="mt-2 font-display font-semibold text-2xl tabular text-white">{value}</div>
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

const ActualField = ({ label, value, onChange }) => (
  <div>
    <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500 mb-1">{label}</div>
    <input
      type="number"
      min="0"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="w-full h-10 px-3 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-zinc-100 tabular focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40"
    />
  </div>
);

const DateField = ({ label, value, onChange }) => (
  <div>
    <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500 mb-1">{label}</div>
    <input
      type="date"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="w-full h-10 px-3 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40"
    />
  </div>
);

export default ItDashboard;
