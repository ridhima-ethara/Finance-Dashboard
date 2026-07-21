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
import {
  buildDeliverableCostMetrics,
  buildBudgetTracks,
  buildProjectPhaseGate,
  filterLogsByLane,
  getLaneBudgetTrack,
  getTaskLogRecordedCost,
  summarizeLoggedProject,
} from "../../lib/projectMetrics";

const HealthBadge = ({ h }) => {
  const c = healthColor(h);
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border ${c.text} ${c.bg} ${c.border}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {c.label}
    </span>
  );
};

const ProjectsTable = ({ projectsOverride = null, usageOptions = {} }) => {
  const [expanded, setExpanded] = useState({ "crowley-gen": true });
  const [drawer, setDrawer] = useState(null); // { project, phase }
  const nav = useNavigate();
  const { visibleProjects, role, taskLogs, batchDeliveries, budgets, topupRequests, changeRequests } = useApp();
  const isRnd = role === "R&D";
  const isCfo = role === "CFO";
  const isTPM = isTpmView(role);
  const ownerLabel = role === "CFO" ? "TPM" : "PL";
  const logLane = usageOptions?.lane || "all";

  const toggle = (id) => setExpanded((e) => ({ ...e, [id]: !e[id] }));

  const projects = projectsOverride || visibleProjects;
  const projectMetrics = useMemo(
    () => Object.fromEntries(projects.map((project) => [project.id, summarizeLoggedProject(project, taskLogs, usageOptions)])),
    [projects, taskLogs, usageOptions]
  );
  const projectTracks = useMemo(
    () => Object.fromEntries(projects.map((project) => [project.id, buildBudgetTracks(project, budgets)])),
    [projects, budgets]
  );
  const totals = projects.reduce(
    (a, p) => ({
      approved: a.approved + p.approvedBudget,
      est: a.est + p.estimatedBudget,
      actual: a.actual + (isCfo ? Number(p.cfoActualSpend || p.actualSpend || 0) : (projectMetrics[p.id]?.loggedSpend || 0)),
      variance: a.variance + (isCfo ? Number(p.cfoVariance || p.variance || 0) : ((p.approvedBudget || 0) - (projectMetrics[p.id]?.loggedSpend || 0))),
      remaining: a.remaining + (isCfo ? Number(p.cfoRemaining || p.remaining || 0) : (projectMetrics[p.id]?.remainingBudget || 0)),
      burnRate: a.burnRate + (isCfo ? Number(p.cfoBurnRate || 0) : Number(projectMetrics[p.id]?.runRate || 0)),
      targetTasks: a.targetTasks + (projectMetrics[p.id]?.targetTasks || 0),
      doneTasks: a.doneTasks + (projectMetrics[p.id]?.loggedTasks || 0),
    }),
    { approved: 0, est: 0, actual: 0, variance: 0, remaining: 0, burnRate: 0, targetTasks: 0, doneTasks: 0 }
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
            {projects.length} projects · {fmtCurrency(totals.actual)} of {fmtCurrency(totals.approved)}{isCfo ? " actuals visible" : " logged consumption visible only"}{isRnd ? " · expand a row for phase list and detail view" : ""}
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
              const displayActual = isCfo ? Number(p.cfoActualSpend || p.actualSpend || 0) : logged.loggedSpend;
              const displayRemaining = isCfo ? Number(p.cfoRemaining || p.remaining || 0) : logged.remainingBudget;
              const displayUtil = isCfo ? Number(p.cfoUtilization || p.utilization || 0) : logged.utilization;
              const displayRunRate = isCfo ? Number(p.cfoBurnRate || 0) : logged.runRate;
              const isOpen = !!expanded[p.id];
              const isRejectedProject = Boolean(p.budgetRejection);
              const projectDetailTrack = getLaneBudgetTrack(p, budgets, logLane) || projectTracks[p.id]?.ordered?.[0]?.latest || null;
              const phaseGate = buildProjectPhaseGate(p, batchDeliveries);
              return (
                <Fragment key={p.id}>
                  <tr
                    data-testid={`project-row-${p.id}`}
                    className={`border-b border-white/5 transition-colors group ${
                      isRejectedProject
                        ? "bg-red-500/[0.03] opacity-60"
                        : "hover:bg-white/5"
                    }`}
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
                            {isRejectedProject && (
                              <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded border bg-red-500/10 border-red-500/30 text-red-300">
                                Budget rejected
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-zinc-500">{p.client}</div>
                        </div>
                      </button>
                    </td>
                    <td className="py-3 px-2 text-right tabular text-sm text-zinc-100">{fmtCurrency(p.approvedBudget)}</td>
                    {isCfo ? (
                      <>
                        <td className="py-3 px-2 text-right tabular text-sm text-zinc-400">{fmtCurrency(p.estimatedBudget)}</td>
                        <td className="py-3 px-2 text-right tabular text-sm font-medium text-white">{fmtCurrency(displayActual)}</td>
                        <td className={`py-3 px-2 text-right tabular text-sm font-semibold ${varianceColor(Number(p.cfoVariance || p.variance || 0))}`}>
                          {Number(p.cfoVariance || p.variance || 0) > 0 ? "+" : ""}{fmtCurrency(Number(p.cfoVariance || p.variance || 0))}
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
                        {(isCfo ? p.cfoTopModel || p.topModel : logged.topModel)} <ChevronRight className="w-3 h-3" />
                      </button>
                    </td>
                  </tr>
                  {isOpen && (
                    <tr className="bg-white/[2.5%] border-b border-white/5" data-testid={`project-expand-${p.id}`}>
                      <td colSpan={11} className="px-6 py-5">
                        {isRnd ? (
                          <div className="space-y-3">
                            <div className="rounded-xl border border-white/10 bg-[#12121A] overflow-hidden">
                              <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-white/5">
                                <div className="text-[10px] uppercase tracking-widest text-zinc-500 font-semibold">
                                  Phase list
                                </div>
                                <div className="text-[11px] text-zinc-500">
                                  Allocated vs consumed with request visibility
                                </div>
                              </div>
                              {(p.phases || []).length === 0 ? (
                                <div className="px-4 py-6 text-center text-xs text-zinc-500">
                                  No phases defined for this project yet.
                                </div>
                              ) : (
                                <table className="w-full">
                                  <thead>
                                    <tr className="text-[10px] uppercase tracking-widest text-zinc-500 font-semibold border-b border-white/5 bg-white/[0.02]">
                                      <th className="text-left py-2.5 px-4">Phase</th>
                                      <th className="text-right py-2.5 px-4">Allocated</th>
                                      <th className="text-right py-2.5 px-4">Consumed</th>
                                      <th className="text-right py-2.5 px-4">Remaining</th>
                                      <th className="text-right py-2.5 px-4">Tasks</th>
                                      <th className="text-left py-2.5 px-4">Requests</th>
                                      <th className="text-right py-2.5 px-4"></th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {p.phases.map((ph) => {
                                      const phaseLogs = filterLogsByLane(p, taskLogs[`${p.id}::${ph.id}`] || [], logLane);
                                      const phaseConsumed = phaseLogs.reduce((sum, log) => sum + getTaskLogRecordedCost(log), 0);
                                      const phaseTasksDone = phaseLogs.reduce((sum, log) => sum + Number(log.tasksDone || 0), 0);
                                      const phaseTopups = topupRequests.filter((request) => request.projectId === p.id && request.phaseId === ph.id);
                                      const phaseChangeRequests = changeRequests.filter((request) => (
                                        request.projectId === p.id
                                          && (
                                            request.phaseId === ph.id
                                            || (request.affectedPhase || "").toLowerCase().includes(ph.name.toLowerCase())
                                          )
                                      ));
                                      const trackPhase = projectDetailTrack?.phases?.find((entry) => entry.id === ph.id || entry.name === ph.name) || null;
                                      const allocated = Number(trackPhase?.budget || ph.estimated || 0);
                                      const budgetChangeValue = phaseTopups.reduce((sum, request) => sum + Number(request.cfoDecision?.amount || request.amount || 0), 0);
                                      const changeRequestValue = phaseChangeRequests.reduce((sum, request) => sum + Number(request.finalDecision?.amount || request.amount || 0), 0);
                                      const currentTotal = allocated + budgetChangeValue + changeRequestValue;
                                      const remaining = currentTotal - phaseConsumed;

                                      return (
                                        <tr key={ph.id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.03]">
                                          <td className="py-3 px-4">
                                            <div className="text-sm font-medium text-white">{ph.name}</div>
                                            <div className="text-[11px] text-zinc-500">{ph.dates}</div>
                                          </td>
                                          <td className="py-3 px-4 text-right">
                                            <div className="tabular text-sm font-semibold text-white">{fmtCurrency(allocated, { compact: false })}</div>
                                            {(budgetChangeValue > 0 || changeRequestValue > 0) && (
                                              <div className="text-[10px] text-zinc-500">Current {fmtCurrency(currentTotal, { compact: false })}</div>
                                            )}
                                          </td>
                                          <td className="py-3 px-4 text-right tabular text-sm font-semibold text-fuchsia-300">
                                            {fmtCurrency(phaseConsumed, { compact: false })}
                                          </td>
                                          <td className={`py-3 px-4 text-right tabular text-sm font-semibold ${remaining < 0 ? "text-red-300" : "text-emerald-300"}`}>
                                            {fmtCurrency(remaining, { compact: false })}
                                          </td>
                                          <td className="py-3 px-4 text-right">
                                            <div className="tabular text-sm font-semibold text-white">{phaseTasksDone.toLocaleString()}</div>
                                            <div className="text-[10px] text-zinc-500">tasks logged</div>
                                          </td>
                                          <td className="py-3 px-4">
                                            <div className="text-[11px] text-zinc-300">
                                              {phaseTopups.length} change request{phaseTopups.length === 1 ? "" : "s"} · {phaseChangeRequests.length} change request{phaseChangeRequests.length === 1 ? "" : "s"}
                                            </div>
                                            <div className="text-[10px] text-zinc-500">
                                              +{fmtCurrency(budgetChangeValue + changeRequestValue, { compact: false })}
                                            </div>
                                          </td>
                                          <td className="py-3 px-4 text-right">
                                            <button
                                              onClick={() => setDrawer({ project: p, phase: ph, logLane })}
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
                              )}
                            </div>
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
                                    const phaseLogs = filterLogsByLane(p, taskLogs[`${p.id}::${ph.id}`] || [], logLane);
                                    const phaseLogged = phaseLogs.reduce((sum, log) => sum + getTaskLogRecordedCost(log), 0);
                                    const phaseTasksDone = phaseLogs.reduce((sum, log) => sum + Number(log.tasksDone || 0), 0);
                                    const variance = ph.estimated - ph.actual;
                                    const phaseState = phaseGate[ph.id] || {
                                      isLocked: false,
                                      isSubmitted: false,
                                      batchLabel: "",
                                      previousBatchLabel: "",
                                      previousPhaseName: "",
                                    };
                                    const isPhaseLocked = isTPM && phaseState.isLocked;
                                    const phaseStatusLabel = isPhaseLocked
                                      ? `Locked until ${phaseState.previousBatchLabel || phaseState.previousPhaseName || "previous batch"} is submitted`
                                      : phaseState.isSubmitted
                                        ? "Batch submitted"
                                        : "";
                                    return (
                                      <tr key={ph.id} className={`border-b border-white/5 last:border-0 ${isPhaseLocked ? "bg-white/[0.02] opacity-60" : ""}`}>
                                        <td className="py-2.5 px-4">
                                          <div className={`text-sm font-medium ${isPhaseLocked ? "text-zinc-500" : "text-zinc-100"}`}>{ph.name}</div>
                                          {(phaseState.batchLabel || phaseStatusLabel) && (
                                            <div className="text-[10px] text-zinc-500 mt-0.5">
                                              {phaseState.batchLabel || ""}
                                              {phaseStatusLabel ? ` · ${phaseStatusLabel}` : ""}
                                            </div>
                                          )}
                                        </td>
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
                                            disabled={isPhaseLocked}
                                            onClick={() => setDrawer({ project: p, phase: ph, logLane })}
                                            className={`text-xs font-medium ${isPhaseLocked ? "text-zinc-600 cursor-not-allowed" : "text-fuchsia-400 hover:text-fuchsia-300"}`}
                                            data-testid={`phase-view-${p.id}-${ph.id}`}
                                          >
                                            {isPhaseLocked ? "Locked" : "View details →"}
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
              <td className="py-3 px-2 text-right tabular text-sm text-zinc-400">
                {isCfo
                  ? (totals.burnRate >= 1000 ? `$${(totals.burnRate / 1000).toFixed(1)}k/day` : fmtCurrency(totals.burnRate, { compact: false }))
                  : "logged avg"}
              </td>
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
          {drawer && <PhaseDrawerContent project={drawer.project} phase={drawer.phase} logLane={drawer.logLane || "all"} />}
        </SheetContent>
      </Sheet>
    </div>
  );
};

const PhaseDrawerContent = ({ project, phase, logLane = "all" }) => {
  const { role, getPhaseLogs, deletePhaseTask, isTaskEditable, batchDeliveries, budgets, topupRequests, changeRequests } = useApp();
  const isTPM = isTpmView(role);
  const isCFO = role === "CFO";

  const tasks = getPhaseTasks(project.id, phase.id);
  const tpmLogs = filterLogsByLane(project, getPhaseLogs(project.id, phase.id), logLane);
  const loggedCost = tpmLogs.reduce((sum, log) => sum + getTaskLogRecordedCost(log), 0);
  const loggedTasks = tpmLogs.reduce((sum, log) => sum + Number(log.tasksDone || 0), 0);
  const loggedTrajectories = tpmLogs.reduce((sum, log) => sum + Number(log.trajectories || 0), 0);
  const loggedInputTokens = tpmLogs.reduce((sum, log) => sum + Number(log.inputTokens || 0), 0);
  const loggedOutputTokens = tpmLogs.reduce((sum, log) => sum + Number(log.outputTokens || 0), 0);
  const displaySpend = isCFO ? Number(phase.actual || 0) : loggedCost;
  const utilization = phase.estimated ? Math.round((displaySpend / phase.estimated) * 100) : 0;
  const targetTasks = Number(phase.totalTasks || phase.tasks || tasks.length || 0);
  const targetTrajectories = targetTasks * Number(phase.trajectoriesPerTask || 0);
  const activeBudgetTrack = getLaneBudgetTrack(project, budgets, logLane) || buildBudgetTracks(project, budgets).ordered[0]?.latest || null;
  const trackPhase = activeBudgetTrack?.phases?.find((entry) => entry.id === phase.id || entry.name === phase.name) || null;
  const submittedPhaseBudget = Number(trackPhase?.budget || phase.estimated || 0);
  const delivery = batchDeliveries.find((d) => d.projectId === project.id && d.phaseId === phase.id) || null;
  const phaseGate = buildProjectPhaseGate(project, batchDeliveries);
  const phaseState = phaseGate[phase.id] || {
    isLocked: false,
    isSubmitted: false,
    batchLabel: "This batch",
    previousBatchLabel: "",
    previousPhaseName: "",
  };
  const isPhaseLocked = isTPM && phaseState.isLocked;
  const isPhaseSubmitted = isTPM && Boolean(delivery);
  const canEdit = isTPM && !isPhaseLocked && !isPhaseSubmitted;
  const phaseLockMessage = isPhaseLocked
    ? `${phaseState.previousBatchLabel || phaseState.previousPhaseName || "The previous batch"} must be submitted before ${phaseState.batchLabel || "this batch"} can be logged.`
    : isPhaseSubmitted
      ? `${phaseState.batchLabel || "This batch"} has already been submitted, so daily task logging is locked.`
      : "";
  const deliverableMetrics = buildDeliverableCostMetrics({
    totalBudgetRequested: submittedPhaseBudget,
    totalTaskCount: targetTasks,
    completedDeliverables: loggedTasks,
    totalAmountConsumed: displaySpend,
  });
  const plannedCostPerTask = deliverableMetrics.perTaskCost;
  const plannedCostPerTrajectory = targetTrajectories > 0 ? submittedPhaseBudget / targetTrajectories : 0;
  const claimedCost = deliverableMetrics.claimedCost;
  const actualCost = deliverableMetrics.actualCost;
  const actualPerTask = deliverableMetrics.actualPerTaskCost;
  const actualPerTrajectory = (loggedTrajectories || targetTrajectories) > 0 ? displaySpend / (loggedTrajectories || targetTrajectories) : 0;
  const deliverableVariance = deliverableMetrics.variance;
  const phaseTopups = topupRequests.filter((request) => request.projectId === project.id && request.phaseId === phase.id);
  const phaseChangeRequests = changeRequests.filter((request) => (
    request.projectId === project.id
      && (
        request.phaseId === phase.id
        || (request.affectedPhase || "").toLowerCase().includes(phase.name.toLowerCase())
      )
  ));
  const budgetChangeValue = phaseTopups.reduce((sum, request) => sum + Number(request.cfoDecision?.amount || request.amount || 0), 0);
  const changeRequestValue = phaseChangeRequests.reduce((sum, request) => sum + Number(request.finalDecision?.amount || request.amount || 0), 0);
  const currentBudgetTotal = submittedPhaseBudget + budgetChangeValue + changeRequestValue;
  const remainingBudget = currentBudgetTotal - displaySpend;
  const budgetLabel = isCFO ? "Budget" : "Allocated";
  const spendLabel = isCFO ? "Actual" : "Consumed";

  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [editingLog, setEditingLog] = useState(null);
  const [topupOpen, setTopupOpen] = useState(false);
  const [deliverOpen, setDeliverOpen] = useState(false);

  const openEdit = (log) => {
    if (!canEdit) {
      toast.error(isPhaseLocked ? "This phase is locked" : "Batch already submitted", {
        description: phaseLockMessage,
      });
      return;
    }
    setEditingLog(log);
    setTaskDialogOpen(true);
  };
  const openNew = () => {
    if (!canEdit) {
      toast.error(isPhaseLocked ? "This phase is locked" : "Batch already submitted", {
        description: phaseLockMessage,
      });
      return;
    }
    setEditingLog(null);
    setTaskDialogOpen(true);
  };
  const onDelete = (log) => {
    if (!canEdit) {
      toast.error(isPhaseLocked ? "This phase is locked" : "Batch already submitted", {
        description: phaseLockMessage,
      });
      return;
    }
    if (!isTaskEditable(log)) { toast.error("Task log is locked (>24h)"); return; }
    deletePhaseTask(project.id, phase.id, log.id);
    toast.success("Task log deleted");
  };

  return (
    <>
      <SheetHeader>
        <div className="text-[10px] uppercase tracking-widest font-semibold text-fuchsia-400">
          {project.name} · {project.client}
        </div>
        <SheetTitle className="font-display text-2xl text-white">{phase.name}</SheetTitle>
        <SheetDescription className="text-xs text-zinc-400">
          {phaseState.batchLabel || "Batch"} · {phase.dates} · TPM {project.tpm}
          {isCFO && <span className="ml-2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-white/[0.04] border border-white/10 text-zinc-400"><Lock className="w-2.5 h-2.5" /> Read-only</span>}
        </SheetDescription>
      </SheetHeader>

      {/* TPM actions */}
      {isTPM && (
        <div className="mt-4 flex items-center gap-2 flex-wrap">
          <Button
            onClick={openNew}
            disabled={!canEdit}
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
            <ArrowUpRightSquare className="w-3.5 h-3.5" /> Raise additional request
          </Button>
          <Button
            onClick={() => setDeliverOpen(true)}
            variant="outline"
            disabled={!!delivery || isPhaseLocked}
            data-testid="drawer-btn-deliver"
            className="h-9 rounded-lg border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-60 gap-1.5"
          >
            <PackageCheck className="w-3.5 h-3.5" /> {delivery ? "Batch delivered" : "Deliver batch"}
          </Button>
        </div>
      )}

      {isTPM && phaseLockMessage && (
        <div className="mt-4 rounded-xl border border-amber-500/25 bg-amber-500/[0.06] px-3 py-2 text-[11px] text-amber-100">
          {phaseLockMessage}
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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-4">
        <DrawerStat label={budgetLabel} value={fmtCurrency(submittedPhaseBudget, { compact: false })} />
        <DrawerStat label={spendLabel} value={fmtCurrency(displaySpend, { compact: false })} tone="magenta" />
        <DrawerStat label="Remaining" value={fmtCurrency(remainingBudget, { compact: false })} tone={remainingBudget < 0 ? "negative" : "positive"} />
        <DrawerStat label="Utilization" value={fmtPct(utilization)} tone={utilization >= 100 ? "negative" : utilization >= 85 ? "warning" : "positive"} />
        <DrawerStat label="Tasks done" value={`${loggedTasks}/${targetTasks}`} />
        <DrawerStat label="Input tokens" value={loggedInputTokens.toLocaleString()} />
        <DrawerStat label="Output tokens" value={loggedOutputTokens.toLocaleString()} />
      </div>

      <div className="mt-5 grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4" data-testid="drawer-submitted-budget-view">
          <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500">Submitted task budget view</div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <DrawerStat label="Target tasks" value={targetTasks.toLocaleString()} />
            <DrawerStat label="Deliverables completed" value={loggedTasks.toLocaleString()} />
            <DrawerStat label="Per task cost" value={targetTasks > 0 ? fmtCurrency(plannedCostPerTask, { compact: false }) : "—"} tone="magenta" />
            <DrawerStat label="Cost / trajectory" value={targetTrajectories > 0 ? fmtCurrency(plannedCostPerTrajectory, { compact: false }) : "—"} tone="magenta" />
            <DrawerStat label="Claimed cost" value={loggedTasks > 0 ? fmtCurrency(claimedCost, { compact: false }) : "—"} />
            <DrawerStat label="Actual cost" value={loggedTasks > 0 ? fmtCurrency(actualCost, { compact: false }) : "—"} tone={isCFO ? "warning" : "neutral"} />
            <DrawerStat label="Actual / task" value={loggedTasks > 0 ? fmtCurrency(actualPerTask, { compact: false }) : "—"} tone={isCFO ? "warning" : "neutral"} />
            <DrawerStat label="Variance" value={loggedTasks > 0 ? fmtCurrency(deliverableVariance, { compact: false }) : "—"} tone={deliverableVariance > 0 ? "negative" : deliverableVariance < 0 ? "positive" : "neutral"} />
          </div>
          <div className="mt-3 text-[11px] text-zinc-500">
            Submitted budget {activeBudgetTrack?.budgetType ? `· ${activeBudgetTrack.budgetType}` : ""} {activeBudgetTrack?.submittedAt ? `· ${new Date(activeBudgetTrack.submittedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : ""}
          </div>
        </div>
        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4" data-testid="drawer-budget-related-detail">
          <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500">Budget-related detail</div>
          <div className="mt-3 space-y-2 text-sm">
            <BudgetActivityRow label="Allocated budget" value={fmtCurrency(submittedPhaseBudget, { compact: false })} />
            <BudgetActivityRow label="Current total" value={fmtCurrency(currentBudgetTotal, { compact: false })} />
            <BudgetActivityRow label="Consumed amount" value={fmtCurrency(displaySpend, { compact: false })} />
            <BudgetActivityRow label="Remaining balance" value={fmtCurrency(remainingBudget, { compact: false })} />
            <BudgetActivityRow label="Actual / trajectory" value={(loggedTrajectories || targetTrajectories) > 0 ? fmtCurrency(actualPerTrajectory, { compact: false }) : "—"} />
            <BudgetActivityRow label="Budget change value" value={`${phaseTopups.length} · ${fmtCurrency(budgetChangeValue, { compact: false })}`} />
            <BudgetActivityRow label="Change request value" value={`${phaseChangeRequests.length} · ${fmtCurrency(changeRequestValue, { compact: false })}`} />
            <BudgetActivityRow label="Delivery status" value={delivery ? delivery.status.replace(/-/g, " ") : "Not delivered"} />
          </div>
        </div>
      </div>

      <div className="mt-5 space-y-3">
        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
          <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500">Budget changes ({phaseTopups.length})</div>
          {phaseTopups.length === 0 ? (
            <div className="mt-3 text-[11px] text-zinc-500">No change requests for this phase.</div>
          ) : (
            <div className="mt-3 space-y-2">
              {phaseTopups.map((request) => (
                <TopupRequestCard key={request.id} request={request} />
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
          <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500">Change requests ({phaseChangeRequests.length})</div>
          {phaseChangeRequests.length === 0 ? (
            <div className="mt-3 text-[11px] text-zinc-500">No change requests for this phase.</div>
          ) : (
            <div className="mt-3 space-y-2">
              {phaseChangeRequests.map((request) => (
                <ChangeRequestCard key={request.id} request={request} />
              ))}
            </div>
          )}
        </div>
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
                  <th className="text-right py-2 px-2">Traj.</th>
                  <th className="text-right py-2 px-2">Est. cost</th>
                  <th className="text-right py-2 px-2">Cost / task</th>
                  <th className="text-right py-2 px-2">Tokens</th>
                  <th className="w-6"></th>
                </tr>
              </thead>
              <tbody>
                {tpmLogs.length === 0 ? (
                  <tr><td colSpan="9" className="py-4 text-center text-zinc-500">
                    {isTPM ? "No tasks logged yet — use Log daily task above." : "No TPM logs for this phase yet."}
                  </td></tr>
                ) : tpmLogs.map((log) => {
                  const editable = isTaskEditable(log);
                  const modelLabel = Array.isArray(log.modelUsage) && log.modelUsage.length
                    ? log.modelUsage.map((usage) => usage.modelName).join(", ")
                    : log.modelName || "—";
                  const logCost = getTaskLogRecordedCost(log);
                  const logCostPerTask = Number(log.tasksDone || 0) > 0 ? logCost / Number(log.tasksDone || 0) : 0;
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
                      <td className="py-2 px-2 text-right tabular text-zinc-300">{Number(log.trajectories || 0).toLocaleString()}</td>
                      <td className="py-2 px-2 text-right tabular text-fuchsia-300 font-semibold">{fmtCurrency(logCost, { compact: false })}</td>
                      <td className="py-2 px-2 text-right tabular text-zinc-200">{log.tasksDone ? fmtCurrency(logCostPerTask, { compact: false }) : "—"}</td>
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
                        ) : isTPM ? (
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

const getChangeRequestStatusMeta = (request) => {
  const label = String(request?.finalDecision?.outcome || request?.stage || "Open");
  if (/approved/i.test(label)) return { label, cls: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" };
  if (/reject/i.test(label)) return { label, cls: "bg-red-500/15 text-red-300 border-red-500/30" };
  if (/return/i.test(label)) return { label, cls: "bg-amber-500/15 text-amber-300 border-amber-500/30" };
  return { label, cls: "bg-sky-500/15 text-sky-300 border-sky-500/30" };
};

const ChangeRequestCard = ({ request }) => {
  const status = getChangeRequestStatusMeta(request);
  const approvedAmount = Number(request?.finalDecision?.amount || request?.amount || 0);

  return (
    <div className="rounded-lg border border-white/5 bg-white/[0.02] p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="text-[11px] text-white font-medium">{request.type || "Change request"}</div>
            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold border ${status.cls}`}>
              {status.label}
            </span>
          </div>
          <div className="mt-1 text-[10px] text-zinc-500 line-clamp-2">{request.reason || "No reason provided."}</div>
          {request.affectedPhase && (
            <div className="mt-2 text-[10px] text-zinc-400">Phase · {request.affectedPhase}</div>
          )}
        </div>
        <div className="text-right flex-shrink-0">
          <div className="text-[10px] text-zinc-500">
            {new Date(request.createdAt || Date.now()).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
          </div>
          <div className="mt-1 text-[11px] font-semibold tabular text-white">{fmtCurrency(approvedAmount, { compact: false })}</div>
        </div>
      </div>
    </div>
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

const BudgetActivityRow = ({ label, value }) => (
  <div className="flex items-center justify-between gap-3">
    <span className="text-zinc-400">{label}</span>
    <span className="text-white font-semibold tabular text-right">{value}</span>
  </div>
);

export default ProjectsTable;
