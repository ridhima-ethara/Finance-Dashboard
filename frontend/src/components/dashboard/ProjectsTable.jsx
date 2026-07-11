import { Fragment, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight, ChevronDown, User, Calendar, Cpu, Layers, Plus, ArrowUpRightSquare, Pencil, Trash2, Lock, FileText, PackageCheck } from "lucide-react";
import { fmtCurrency, fmtPct, healthColor, varianceColor, utilColor } from "../../lib/format";
import { useApp } from "../../context/AppContext";
import { isTpmView } from "../../lib/roles";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "../ui/sheet";
import { Button } from "../ui/button";
import { getPhaseTasks } from "../../data/mockTpm";
import TpmTaskLogDialog from "../TpmTaskLogDialog";
import TopupRequestDialog from "../TopupRequestDialog";
import DeliverBatchDialog from "../DeliverBatchDialog";
import { toast } from "sonner";
import { buildBudgetTracks, summarizeLoggedProject } from "../../lib/projectMetrics";

const HealthBadge = ({ h }) => {
  const c = healthColor(h);
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border ${c.text} ${c.bg} ${c.border}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {c.label}
    </span>
  );
};

const ProjectsTable = () => {
  const [expanded, setExpanded] = useState({ "crowley-gen": true });
  const [drawer, setDrawer] = useState(null); // { project, phase }
  const nav = useNavigate();
  const { scope, visibleProjects, role, taskLogs, budgets, topupRequests } = useApp();
  const isRnd = role === "R&D";
  const isCfo = role === "CFO";
  const ownerLabel = role === "CFO" ? "TPM" : "PL";

  const toggle = (id) => setExpanded((e) => ({ ...e, [id]: !e[id] }));

  const projects = visibleProjects.filter((p) => scope === "all" || p.type === scope);
  const projectMetrics = useMemo(
    () => Object.fromEntries(projects.map((project) => [project.id, summarizeLoggedProject(project, taskLogs)])),
    [projects, taskLogs]
  );
  const projectTracks = useMemo(
    () => Object.fromEntries(projects.map((project) => [project.id, buildBudgetTracks(project, budgets)])),
    [projects, budgets]
  );
  const totals = projects.reduce(
    (a, p) => ({
      approved: a.approved + p.approvedBudget,
      est: a.est + p.estimatedBudget,
      actual: a.actual + (isCfo ? p.actualSpend : (projectMetrics[p.id]?.loggedSpend || 0)),
      variance: a.variance + (isCfo ? p.variance : ((p.approvedBudget || 0) - (projectMetrics[p.id]?.loggedSpend || 0))),
      remaining: a.remaining + (isCfo ? p.remaining : (projectMetrics[p.id]?.remainingBudget || 0)),
      targetTasks: a.targetTasks + (projectMetrics[p.id]?.targetTasks || 0),
      doneTasks: a.doneTasks + (projectMetrics[p.id]?.loggedTasks || 0),
    }),
    { approved: 0, est: 0, actual: 0, variance: 0, remaining: 0, targetTasks: 0, doneTasks: 0 }
  );
  const totalUtil = totals.approved > 0 ? Math.round((totals.actual / totals.approved) * 100) : 0;

  return (
    <div className="bg-[#12121A] rounded-2xl border border-white/10 overflow-hidden" data-testid="projects-table">
      <div className="flex items-start justify-between p-5 pb-3">
        <div>
          <div className="font-display font-semibold text-[15px] text-white">
            Projects — budget by project
          </div>
          <div className="text-xs text-zinc-500 mt-0.5">
            {projects.length} projects · {fmtCurrency(totals.actual)} of {fmtCurrency(totals.approved)}{isCfo ? " actuals visible" : " logged consumption visible only"}{isRnd ? " · expand a row for Testing / R&D / Rework" : ""}
          </div>
        </div>
        <div className="text-xs px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-zinc-400 tabular">
          Jun 1 – Jun 30, 2026
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="text-[10px] uppercase tracking-widest text-zinc-500 font-semibold border-t border-b border-white/5 bg-white/5">
              <th className="text-left py-2.5 pl-6 pr-2">Project</th>
              <th className="text-right py-2.5 px-2">Budget</th>
              {isCfo ? (
                <>
                  <th className="text-right py-2.5 px-2">Estimated</th>
                  <th className="text-right py-2.5 px-2">Actual</th>
                  <th className="text-right py-2.5 px-2">Variance</th>
                </>
              ) : (
                <>
                  <th className="text-right py-2.5 px-2">Logged</th>
                  <th className="text-right py-2.5 px-2">Target tasks</th>
                  <th className="text-right py-2.5 px-2">Done tasks</th>
                </>
              )}
              <th className="text-right py-2.5 px-2">Remaining</th>
              <th className="text-right py-2.5 px-2">Util %</th>
              <th className="text-right py-2.5 px-2">Run rate</th>
              <th className="text-left py-2.5 px-2">Health</th>
              <th className="text-left py-2.5 px-2">{ownerLabel}</th>
              <th className="text-right py-2.5 pr-6 pl-2">Top model</th>
            </tr>
          </thead>
          <tbody>
            {projects.map((p) => {
              const logged = projectMetrics[p.id];
              const displayActual = isCfo ? p.actualSpend : logged.loggedSpend;
              const displayRemaining = isCfo ? p.remaining : logged.remainingBudget;
              const displayUtil = isCfo ? p.utilization : logged.utilization;
              const displayRunRate = isCfo ? p.burnRate * 1000 : logged.runRate;
              const isOpen = !!expanded[p.id];
              return (
                <Fragment key={p.id}>
                  <tr
                    data-testid={`project-row-${p.id}`}
                    className="border-b border-white/5 hover:bg-white/5 transition-colors group"
                  >
                    <td className="py-3 pl-6 pr-2">
                      <button
                        onClick={() => toggle(p.id)}
                        data-testid={`row-toggle-${p.id}`}
                        className="flex items-center gap-2 text-left"
                      >
                        {isOpen ? (
                          <ChevronDown className="w-4 h-4 text-zinc-500" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-zinc-500 group-hover:text-zinc-400" />
                        )}
                        <div>
                          <div className="flex items-center gap-2">
                            <div className="text-sm font-medium text-white">{p.name}</div>
                            <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded border ${
                              p.type === "R&D" ? "bg-violet-500/10 border-violet-500/30 text-violet-300" : "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                            }`}>
                              {p.type}
                            </span>
                          </div>
                          <div className="text-[11px] text-zinc-500">{p.client}</div>
                        </div>
                      </button>
                    </td>
                    <td className="py-3 px-2 text-right tabular text-sm text-zinc-100">{fmtCurrency(p.approvedBudget)}</td>
                    {isCfo ? (
                      <>
                        <td className="py-3 px-2 text-right tabular text-sm text-zinc-400">{fmtCurrency(p.estimatedBudget)}</td>
                        <td className="py-3 px-2 text-right tabular text-sm font-medium text-white">{fmtCurrency(p.actualSpend)}</td>
                        <td className={`py-3 px-2 text-right tabular text-sm font-semibold ${varianceColor(p.variance)}`}>
                          {p.variance > 0 ? "+" : ""}{fmtCurrency(p.variance)}
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="py-3 px-2 text-right tabular text-sm font-medium text-white">{fmtCurrency(logged.loggedSpend, { compact: false })}</td>
                        <td className="py-3 px-2 text-right tabular text-sm text-zinc-300">{logged.targetTasks.toLocaleString()}</td>
                        <td className="py-3 px-2 text-right tabular text-sm text-fuchsia-300 font-semibold">{logged.loggedTasks.toLocaleString()}</td>
                      </>
                    )}
                    <td className="py-3 px-2 text-right tabular text-sm text-zinc-100">{fmtCurrency(displayRemaining)}</td>
                    <td className={`py-3 px-2 text-right tabular text-sm font-semibold ${utilColor(displayUtil)}`}>
                      {fmtPct(displayUtil)}
                    </td>
                    <td className="py-3 px-2 text-right tabular text-sm text-zinc-400">
                      {displayRunRate >= 1000 ? `$${(displayRunRate / 1000).toFixed(1)}k/day` : fmtCurrency(displayRunRate, { compact: false })}
                    </td>
                    <td className="py-3 px-2"><HealthBadge h={p.health} /></td>
                    <td className="py-3 px-2 text-xs text-zinc-400">{role === "CFO" ? p.tpm : p.pl}</td>
                    <td className="py-3 pr-6 pl-2 text-right">
                      <button
                        onClick={() => nav(`/projects/${p.id}`)}
                        data-testid={`project-open-${p.id}`}
                        className="inline-flex items-center gap-1 text-xs text-fuchsia-400 hover:text-fuchsia-300 font-medium"
                      >
                        {(isCfo ? p.topModel : logged.topModel)} <ChevronRight className="w-3 h-3" />
                      </button>
                    </td>
                  </tr>
                  {isOpen && (
                    <tr className="bg-white/[2.5%] border-b border-white/5" data-testid={`project-expand-${p.id}`}>
                      <td colSpan={11} className="px-6 py-5">
                        {isRnd ? (
                          <div className="space-y-3">
                            <div className="text-[10px] uppercase tracking-widest text-zinc-500 font-semibold">
                              Testing / R&amp;D / Rework
                            </div>
                            {projectTracks[p.id]?.ordered?.length ? (
                              <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                                {projectTracks[p.id].ordered.map((track) => {
                                  const relatedTopups = topupRequests.filter((request) => request.projectId === p.id);
                                  return (
                                    <div key={track.key} className="rounded-xl border border-white/10 bg-[#12121A] p-4">
                                      <div className="flex items-start justify-between gap-2">
                                        <div>
                                          <div className="text-[10px] uppercase tracking-widest font-semibold text-fuchsia-300">{track.label}</div>
                                          <div className="mt-1 text-lg font-display font-semibold text-white">{fmtCurrency(track.latest.total, { compact: false })}</div>
                                        </div>
                                        <span className="text-[10px] px-2 py-0.5 rounded-md border border-white/10 bg-white/[0.03] text-zinc-300">
                                          {track.latest.status}
                                        </span>
                                      </div>
                                      <div className="mt-3 space-y-1.5 text-[11px] text-zinc-400">
                                        <div className="flex items-center justify-between">
                                          <span>Target tasks</span>
                                          <span className="text-white font-semibold tabular">{track.latest.totalTasks.toLocaleString()}</span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                          <span>Trajectories</span>
                                          <span className="text-white font-semibold tabular">{track.latest.totalTrajectories.toLocaleString()}</span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                          <span>Top-ups tracked</span>
                                          <span className="text-white font-semibold tabular">{relatedTopups.length}</span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                          <span>Latest submit</span>
                                          <span className="text-white font-semibold">{new Date(track.latest.submittedAt || Date.now()).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-6 text-center text-xs text-zinc-500">
                                No Testing, R&amp;D, or Rework budget has been submitted for this project yet.
                              </div>
                            )}
                          </div>
                        ) : (
                          <>
                            <div className="text-[10px] uppercase tracking-widest text-zinc-500 font-semibold mb-3">
                              {isCfo ? "Phases" : "Owned consumption by phase"}
                            </div>
                            <div className="bg-[#12121A] rounded-xl border border-white/10 overflow-hidden">
                              <table className="w-full">
                                <thead>
                                  <tr className="text-[10px] uppercase tracking-widest text-zinc-500 font-semibold border-b border-white/5">
                                    <th className="text-left py-2 px-4">Phase</th>
                                    <th className="text-left py-2 px-4">Dates</th>
                                    <th className="text-right py-2 px-4">Budget</th>
                                    {isCfo ? (
                                      <>
                                        <th className="text-right py-2 px-4">Actual</th>
                                        <th className="text-right py-2 px-4">Variance</th>
                                      </>
                                    ) : (
                                      <>
                                        <th className="text-right py-2 px-4">Logged</th>
                                        <th className="text-right py-2 px-4">Done tasks</th>
                                      </>
                                    )}
                                    <th className="text-left py-2 px-4">Health</th>
                                    <th className="text-right py-2 px-4"></th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {p.phases.map((ph) => {
                                    const phaseLogs = (taskLogs[`${p.id}::${ph.id}`] || []);
                                    const phaseLogged = phaseLogs.reduce((sum, log) => sum + Number(log.cost || 0), 0);
                                    const phaseTasksDone = phaseLogs.reduce((sum, log) => sum + Number(log.tasksDone || 0), 0);
                                    const variance = ph.estimated - ph.actual;
                                    return (
                                      <tr key={ph.id} className="border-b border-white/5 last:border-0">
                                        <td className="py-2.5 px-4 text-sm text-zinc-100 font-medium">{ph.name}</td>
                                        <td className="py-2.5 px-4 text-xs text-zinc-400 tabular">{ph.dates}</td>
                                        <td className="py-2.5 px-4 text-right tabular text-sm text-zinc-100">{fmtCurrency(ph.estimated)}</td>
                                        {isCfo ? (
                                          <>
                                            <td className="py-2.5 px-4 text-right tabular text-sm font-medium text-white">{fmtCurrency(ph.actual)}</td>
                                            <td className={`py-2.5 px-4 text-right tabular text-sm font-semibold ${varianceColor(variance)}`}>
                                              {variance > 0 ? "+" : ""}{fmtCurrency(variance)}
                                            </td>
                                          </>
                                        ) : (
                                          <>
                                            <td className="py-2.5 px-4 text-right tabular text-sm font-medium text-white">{fmtCurrency(phaseLogged, { compact: false })}</td>
                                            <td className="py-2.5 px-4 text-right tabular text-sm text-fuchsia-300 font-semibold">{phaseTasksDone.toLocaleString()}</td>
                                          </>
                                        )}
                                        <td className="py-2.5 px-4"><HealthBadge h={ph.health} /></td>
                                        <td className="py-2.5 px-4 text-right">
                                          <button
                                            onClick={() => setDrawer({ project: p, phase: ph })}
                                            className="text-xs text-fuchsia-400 hover:text-fuchsia-300 font-medium"
                                            data-testid={`phase-view-${p.id}-${ph.id}`}
                                          >
                                            View details →
                                          </button>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}

            {/* Totals */}
            <tr className="bg-white/5">
              <td className="py-3 pl-6 pr-2 text-sm font-semibold text-white">Portfolio total</td>
              <td className="py-3 px-2 text-right tabular text-sm font-semibold text-white">{fmtCurrency(totals.approved)}</td>
              {isCfo ? (
                <>
                  <td className="py-3 px-2 text-right tabular text-sm font-semibold text-zinc-200">{fmtCurrency(totals.est)}</td>
                  <td className="py-3 px-2 text-right tabular text-sm font-semibold text-white">{fmtCurrency(totals.actual)}</td>
                  <td className={`py-3 px-2 text-right tabular text-sm font-semibold ${varianceColor(totals.variance)}`}>
                    {totals.variance > 0 ? "+" : ""}{fmtCurrency(totals.variance)}
                  </td>
                </>
              ) : (
                <>
                  <td className="py-3 px-2 text-right tabular text-sm font-semibold text-white">{fmtCurrency(totals.actual, { compact: false })}</td>
                  <td className="py-3 px-2 text-right tabular text-sm font-semibold text-zinc-200">{totals.targetTasks.toLocaleString()}</td>
                  <td className="py-3 px-2 text-right tabular text-sm font-semibold text-fuchsia-300">{totals.doneTasks.toLocaleString()}</td>
                </>
              )}
              <td className="py-3 px-2 text-right tabular text-sm font-semibold text-white">{fmtCurrency(totals.remaining)}</td>
              <td className={`py-3 px-2 text-right tabular text-sm font-semibold ${utilColor(totalUtil)}`}>{fmtPct(totalUtil)}</td>
              <td className="py-3 px-2 text-right tabular text-sm text-zinc-400">{isCfo ? "$5.4k/day" : "logged avg"}</td>
              <td className="py-3 px-2" />
              <td className="py-3 px-2" />
              <td className="py-3 pr-6 pl-2" />
            </tr>
          </tbody>
        </table>
      </div>

      {/* Phase detail drawer */}
      <Sheet open={!!drawer} onOpenChange={(o) => !o && setDrawer(null)}>
        <SheetContent className="bg-[#0F0F16] border-white/10 text-zinc-100 w-full sm:max-w-lg overflow-y-auto" data-testid="phase-drawer">
          {drawer && <PhaseDrawerContent project={drawer.project} phase={drawer.phase} />}
        </SheetContent>
      </Sheet>
    </div>
  );
};

const PhaseDrawerContent = ({ project, phase }) => {
  const { role, getPhaseLogs, deletePhaseTask, isTaskEditable, batchDeliveries } = useApp();
  const isTPM = isTpmView(role);
  const isCFO = role === "CFO";
  const canEdit = isTPM; // Only TPM can edit/log

  const tasks = getPhaseTasks(project.id, phase.id);
  const tpmLogs = getPhaseLogs(project.id, phase.id);
  const loggedCost = tpmLogs.reduce((sum, log) => sum + Number(log.cost || 0), 0);
  const loggedTasks = tpmLogs.reduce((sum, log) => sum + Number(log.tasksDone || 0), 0);
  const loggedInputTokens = tpmLogs.reduce((sum, log) => sum + Number(log.inputTokens || 0), 0);
  const loggedOutputTokens = tpmLogs.reduce((sum, log) => sum + Number(log.outputTokens || 0), 0);
  const displaySpend = isCFO ? Number(phase.actual || 0) : loggedCost;
  const utilization = phase.estimated ? Math.round((displaySpend / phase.estimated) * 100) : 0;

  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [editingLog, setEditingLog] = useState(null);
  const [topupOpen, setTopupOpen] = useState(false);
  const [deliverOpen, setDeliverOpen] = useState(false);

  const openEdit = (log) => { setEditingLog(log); setTaskDialogOpen(true); };
  const openNew = () => { setEditingLog(null); setTaskDialogOpen(true); };
  const onDelete = (log) => {
    if (!isTaskEditable(log)) { toast.error("Task log is locked (>24h)"); return; }
    deletePhaseTask(project.id, phase.id, log.id);
    toast.success("Task log deleted");
  };

  // Existing batch delivery for this phase (if any) — surface to CFO/TPM
  const delivery = batchDeliveries.find((d) => d.projectId === project.id && d.phaseId === phase.id);

  return (
    <>
      <SheetHeader>
        <div className="text-[10px] uppercase tracking-widest font-semibold text-fuchsia-400">
          {project.name} · {project.client}
        </div>
        <SheetTitle className="font-display text-2xl text-white">{phase.name}</SheetTitle>
        <SheetDescription className="text-xs text-zinc-400">
          {phase.dates} · TPM {project.tpm}
          {isCFO && <span className="ml-2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-white/[0.04] border border-white/10 text-zinc-400"><Lock className="w-2.5 h-2.5" /> Read-only</span>}
        </SheetDescription>
      </SheetHeader>

      {/* TPM actions */}
      {isTPM && (
        <div className="mt-4 flex items-center gap-2 flex-wrap">
          <Button
            onClick={openNew}
            data-testid="drawer-btn-log-task"
            className="h-9 rounded-lg bg-fuchsia-500 hover:bg-fuchsia-600 text-white gap-1.5 shadow-[0_0_20px_rgba(232,25,184,0.35)]"
          >
            <Plus className="w-3.5 h-3.5" /> Log daily task
          </Button>
          <Button
            onClick={() => setTopupOpen(true)}
            variant="outline"
            data-testid="drawer-btn-topup"
            className="h-9 rounded-lg border-fuchsia-500/30 bg-fuchsia-500/10 text-fuchsia-300 hover:bg-fuchsia-500/20 gap-1.5"
          >
            <ArrowUpRightSquare className="w-3.5 h-3.5" /> Raise top-up
          </Button>
          <Button
            onClick={() => setDeliverOpen(true)}
            variant="outline"
            disabled={!!delivery}
            data-testid="drawer-btn-deliver"
            className="h-9 rounded-lg border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-60 gap-1.5"
          >
            <PackageCheck className="w-3.5 h-3.5" /> {delivery ? "Batch delivered" : "Deliver batch"}
          </Button>
        </div>
      )}

      {/* Delivery status card — visible to all roles when a delivery exists */}
      {delivery && (
        <div className="mt-4 rounded-xl border border-emerald-500/25 bg-emerald-500/[0.05] p-3" data-testid="drawer-delivery-status">
          <div className="flex items-center gap-2 mb-1">
            <PackageCheck className="w-3.5 h-3.5 text-emerald-300" />
            <div className="text-[11px] uppercase tracking-widest font-semibold text-emerald-300">Batch delivered · {delivery.status.replace("-", " ")}</div>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-2">
            <div>
              <div className="text-[9px] uppercase tracking-widest font-semibold text-zinc-500">Proposed</div>
              <div className="text-sm text-white font-semibold tabular">{fmtCurrency(delivery.proposedAmount, { compact: false })}</div>
            </div>
            <div>
              <div className="text-[9px] uppercase tracking-widest font-semibold text-zinc-500">Actual recovered</div>
              <div className={`text-sm font-semibold tabular ${delivery.actualRecovered != null ? "text-emerald-300" : "text-zinc-500"}`}>
                {delivery.actualRecovered != null ? fmtCurrency(delivery.actualRecovered, { compact: false }) : "Awaiting CFO"}
              </div>
            </div>
          </div>
          {delivery.clientComment && (
            <div className="mt-2 text-[11px] text-zinc-300 leading-relaxed">
              <span className="text-emerald-200 font-semibold">Client: </span>{delivery.clientComment}
              {delivery.clientRepresentative && <span className="text-zinc-500"> · via {delivery.clientRepresentative}</span>}
            </div>
          )}
          {delivery.cfoNote && (
            <div className="mt-1 text-[11px] text-zinc-300 leading-relaxed">
              <span className="text-fuchsia-200 font-semibold">CFO: </span>{delivery.cfoNote}
            </div>
          )}
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-4">
        <DrawerStat label="Budget" value={fmtCurrency(phase.estimated)} />
        <DrawerStat label={isCFO ? "Actual" : "Logged"} value={fmtCurrency(displaySpend)} tone="magenta" />
        <DrawerStat label="Utilization" value={fmtPct(utilization)} tone={utilization >= 100 ? "negative" : utilization >= 85 ? "warning" : "positive"} />
        <DrawerStat label="Tasks done" value={`${loggedTasks}/${Number(phase.totalTasks || phase.tasks || tasks.length || 0)}`} />
        <DrawerStat label="Input tokens" value={loggedInputTokens.toLocaleString()} />
        <DrawerStat label="Output tokens" value={loggedOutputTokens.toLocaleString()} />
      </div>

      {/* TPM logged tasks & Planned tasks sections removed per product spec — surfaced via Daily consumption below */}

      {/* Daily consumption · last 7 days · scrollable · shows every TPM-logged task with dates */}
      <div className="mt-5">
        <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500 mb-2 flex items-center gap-1">
          <Calendar className="w-3 h-3" /> Daily consumption · last 7 days
          {isCFO && <span className="ml-1 text-zinc-600">· read-only</span>}
        </div>
        <div className="rounded-lg border border-white/5 bg-white/[0.02] overflow-hidden">
          <div className="max-h-64 overflow-y-auto" data-testid="drawer-daily-log-scroll">
            <table className="w-full text-xs" data-testid="drawer-daily-log">
              <thead className="sticky top-0 bg-[#12121A]/95 backdrop-blur">
                <tr className="text-[10px] uppercase tracking-widest text-zinc-500 border-b border-white/5">
                  <th className="text-left py-2 px-2">Date</th>
                  <th className="text-left py-2 px-2">Task</th>
                  <th className="text-left py-2 px-2">Model</th>
                  <th className="text-right py-2 px-2">Tasks done</th>
                  <th className="text-right py-2 px-2">Est. cost</th>
                  <th className="text-right py-2 px-2">Tokens</th>
                  <th className="w-6"></th>
                </tr>
              </thead>
              <tbody>
                {tpmLogs.length === 0 ? (
                  <tr><td colSpan="7" className="py-4 text-center text-zinc-500">
                    {isTPM ? "No tasks logged yet — use Log daily task above." : "No TPM logs for this phase yet."}
                  </td></tr>
                ) : tpmLogs.map((log) => {
                  const editable = isTaskEditable(log);
                  const modelLabel = Array.isArray(log.modelUsage) && log.modelUsage.length
                    ? log.modelUsage.map((usage) => usage.modelName).join(", ")
                    : log.modelName || "—";
                  return (
                    <tr key={log.id} data-testid={`daily-log-${log.id}`} className="border-b border-white/5 last:border-b-0 hover:bg-white/[0.03]">
                      <td className="py-2 px-2 text-white tabular whitespace-nowrap">
                        {new Date(log.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </td>
                      <td className="py-2 px-2">
                        <div className="text-zinc-100 truncate max-w-[220px]">{log.name}</div>
                        {log.notes && <div className="text-[10px] text-zinc-500 truncate max-w-[220px]">{log.notes}</div>}
                      </td>
                      <td className="py-2 px-2 text-[11px] text-zinc-300">{modelLabel}</td>
                      <td className="py-2 px-2 text-right tabular text-white font-semibold">{Number(log.tasksDone || 0).toLocaleString()}</td>
                      <td className="py-2 px-2 text-right tabular text-fuchsia-300 font-semibold">{fmtCurrency(log.cost, { compact: false })}</td>
                      <td className="py-2 px-2 text-right tabular text-zinc-300">
                        {(Number(log.inputTokens || 0) + Number(log.outputTokens || 0)).toLocaleString()}
                      </td>
                      <td className="py-2 px-1 text-right">
                        {canEdit && editable ? (
                          <div className="inline-flex items-center gap-0.5">
                            <button
                              onClick={() => openEdit(log)}
                              data-testid={`daily-log-edit-${log.id}`}
                              className="w-5 h-5 rounded hover:bg-fuchsia-500/15 text-zinc-500 hover:text-fuchsia-300 flex items-center justify-center"
                              title="Edit (within 24h)"
                            >
                              <Pencil className="w-2.5 h-2.5" />
                            </button>
                            <button
                              onClick={() => onDelete(log)}
                              data-testid={`daily-log-delete-${log.id}`}
                              className="w-5 h-5 rounded hover:bg-red-500/15 text-zinc-500 hover:text-red-300 flex items-center justify-center"
                              title="Delete (within 24h)"
                            >
                              <Trash2 className="w-2.5 h-2.5" />
                            </button>
                          </div>
                        ) : canEdit ? (
                          <Lock className="w-2.5 h-2.5 text-zinc-600 inline" />
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
        <div className="mt-2 text-[10px] text-zinc-500">
          Approved daily budget: <span className="text-white font-semibold tabular">{fmtCurrency(Math.round(project.approvedBudget / 30), { compact: false })}</span> · showing {tpmLogs.length} log{tpmLogs.length === 1 ? "" : "s"}
        </div>
      </div>

      <TpmTaskLogDialog
        open={taskDialogOpen}
        onOpenChange={(o) => { setTaskDialogOpen(o); if (!o) setEditingLog(null); }}
        project={project}
        phase={phase}
        editingLog={editingLog}
      />
      <TopupRequestDialog
        open={topupOpen}
        onOpenChange={setTopupOpen}
        project={project}
        defaultPhaseId={phase.id}
      />
      <DeliverBatchDialog
        open={deliverOpen}
        onOpenChange={setDeliverOpen}
        project={project}
        phase={phase}
      />
    </>
  );
};

const DrawerStat = ({ label, value, tone = "neutral" }) => {
  const tones = { positive: "text-emerald-300", negative: "text-red-300", warning: "text-amber-300", neutral: "text-white", magenta: "text-fuchsia-300" };
  return (
    <div className="rounded-lg bg-white/[0.03] border border-white/5 p-2.5">
      <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500">{label}</div>
      <div className={`text-base font-display font-semibold tabular mt-0.5 ${tones[tone]}`}>{value}</div>
    </div>
  );
};

export default ProjectsTable;
