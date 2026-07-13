import { Link } from "react-router-dom";
import { useMemo, useState } from "react";
import { KeyRound, ShieldCheck, Users, ChevronRight, Save, Database } from "lucide-react";
import { useApp } from "../../context/AppContext";
import { fmtCurrency } from "../../lib/format";
import { summarizeLoggedProject } from "../../lib/projectMetrics";
import { Button } from "../../components/ui/button";
import { toast } from "sonner";

const ItDashboard = () => {
  const { itProvisioningRequests, modelKeyRecords, projects, taskLogs, itMonthlyActuals, saveItMonthlyActual } = useApp();
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
      .map((project) => ({
        ...project,
        usage: summarizeLoggedProject(project, taskLogs),
        monthlyActual: itMonthlyActuals[project.id] || {},
        activeKeys: modelKeyRecords.filter((entry) => entry.project === project.id && entry.status === "active").length,
      }));
  }, [itProvisioningRequests, modelKeyRecords, projects, taskLogs, itMonthlyActuals]);

  const setDraft = (projectId, key, value) => {
    setDrafts((current) => ({
      ...current,
      [projectId]: {
        ...(current[projectId] || {}),
        [key]: value,
      },
    }));
  };

  const saveActuals = (projectId) => {
    const base = itMonthlyActuals[projectId] || {};
    const draft = drafts[projectId] || {};
    saveItMonthlyActual(projectId, {
      modelActual: Number(draft.modelActual ?? base.modelActual ?? 0),
      infraActual: Number(draft.infraActual ?? base.infraActual ?? 0),
      subsActual: Number(draft.subsActual ?? base.subsActual ?? 0),
      activeKeys: Number(draft.activeKeys ?? base.activeKeys ?? 0),
      note: draft.note ?? base.note ?? "",
    });
    toast.success("Monthly actuals saved", { description: `${projects.find((project) => project.id === projectId)?.name || "Project"} updated for CFO reporting.` });
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
          CFO-approved budgets land here so IT can add model keys and allocate them to project members.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Pending provisioning" value={String(pending.length)} icon={ShieldCheck} />
        <Stat label="Provisioned requests" value={String(completed.length)} icon={KeyRound} />
        <Stat label="Active keys" value={String(modelKeyRecords.filter((entry) => entry.status === "active").length)} icon={KeyRound} />
        <Stat label="Monthly actuals filed" value={String(Object.keys(itMonthlyActuals).length)} icon={Database} />
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
            <div className="font-display font-semibold text-[15px] text-white">Monthly actuals &amp; claimed log reconciliation</div>
            <div className="text-xs text-zinc-500 mt-0.5">
              IT records the model, infra, and subscription actuals that help CFO compare claimed daily task logs against the month-end actuals.
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
            const draft = drafts[project.id] || {};
            const actual = project.monthlyActual || {};
            return (
              <div key={project.id} className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <div className="text-sm font-semibold text-white">{project.name}</div>
                    <div className="text-[11px] text-zinc-500 mt-1">
                      Claimed via task logs {fmtCurrency(project.usage.loggedSpend, { compact: false })} · {project.usage.loggedTasks} tasks · {project.activeKeys} active key{project.activeKeys === 1 ? "" : "s"}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <Mini label="Logged spend" value={fmtCurrency(project.usage.loggedSpend, { compact: false })} />
                    <Mini label="Logged tasks" value={String(project.usage.loggedTasks)} />
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-1 md:grid-cols-5 gap-3">
                  <ActualField
                    label="Model actual"
                    value={draft.modelActual ?? actual.modelActual ?? ""}
                    onChange={(value) => setDraft(project.id, "modelActual", value)}
                  />
                  <ActualField
                    label="Infra actual"
                    value={draft.infraActual ?? actual.infraActual ?? ""}
                    onChange={(value) => setDraft(project.id, "infraActual", value)}
                  />
                  <ActualField
                    label="Subs actual"
                    value={draft.subsActual ?? actual.subsActual ?? ""}
                    onChange={(value) => setDraft(project.id, "subsActual", value)}
                  />
                  <ActualField
                    label="Active keys"
                    value={draft.activeKeys ?? actual.activeKeys ?? project.activeKeys}
                    onChange={(value) => setDraft(project.id, "activeKeys", value)}
                  />
                  <div className="flex items-end">
                    <Button
                      onClick={() => saveActuals(project.id)}
                      className="h-10 w-full rounded-lg bg-fuchsia-500 hover:bg-fuchsia-600 text-white gap-1.5 shadow-[0_0_20px_rgba(232,25,184,0.35)]"
                    >
                      <Save className="w-3.5 h-3.5" /> Save
                    </Button>
                  </div>
                </div>
                <textarea
                  value={draft.note ?? actual.note ?? ""}
                  onChange={(event) => setDraft(project.id, "note", event.target.value)}
                  rows={2}
                  placeholder="Optional note for CFO / audit trail"
                  className="mt-3 w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40 resize-none"
                />
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

export default ItDashboard;
