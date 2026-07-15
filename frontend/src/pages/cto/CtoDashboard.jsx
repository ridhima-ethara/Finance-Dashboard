import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useApp } from "../../context/AppContext";
import { fmtCurrency, fmtPct } from "../../lib/format";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import {
  ClipboardCheck,
  GitPullRequest,
  AlertTriangle,
  ChevronRight,
  FolderKanban,
  Gauge,
  Activity,
  Layers,
  Cpu,
  TrendingUp,
  Plus,
  ArrowUpRightSquare,
  PackageCheck,
} from "lucide-react";
import { Button } from "../../components/ui/button";
import NewProjectDialog from "../../components/NewProjectDialog";
import { summarizeLoggedProject } from "../../lib/projectMetrics";

const CtoDashboard = () => {
  const { visibleProjects, taskLogs, budgetReviews, changeRequests, topupRequests, batchDeliveries } = useApp();
  const [newProjectOpen, setNewProjectOpen] = useState(false);

  const projectUsage = useMemo(
    () => visibleProjects.map((project) => ({ project, usage: summarizeLoggedProject(project, taskLogs) })),
    [visibleProjects, taskLogs]
  );

  const pendingReviews = budgetReviews.filter((review) => {
    const status = String(review.status || "").trim().toLowerCase();
    return ["pending-cto", "returned", "resubmitted"].includes(status);
  }).length;
  const pendingCRs = changeRequests.filter((request) => request.stage === "CTO Review").length;
  const pendingTopups = topupRequests.filter((request) => request.status === "pending-cto").length;
  const pendingTestingSamples = batchDeliveries.filter((delivery) => delivery.status === "testing-submitted").length;
  const highRisk = projectUsage.filter((entry) => entry.usage.utilization >= 90).length;
  const overBudget = projectUsage.filter((entry) => entry.usage.utilization >= 100).length;

  const inExecution = visibleProjects.filter((p) => p.status === "Execution").length;
  const inDiscovery = visibleProjects.filter((p) => p.status === "Discovery").length;
  const orgUtil = useMemo(() => {
    const totApproved = visibleProjects.reduce((s, p) => s + (p.approvedBudget || 0), 0);
    const totLogged = projectUsage.reduce((sum, entry) => sum + entry.usage.loggedSpend, 0);
    return totApproved ? Math.round((totLogged / totApproved) * 100) : 0;
  }, [projectUsage, visibleProjects]);
  const avgHealth = useMemo(() => {
    if (!visibleProjects.length) return "Green";
    const overs = projectUsage.filter((entry) => entry.usage.utilization >= 100).length;
    const watch = projectUsage.filter((entry) => entry.usage.utilization >= 85 && entry.usage.utilization < 100).length;
    if (overs >= 2) return "Red";
    if (overs >= 1 || watch >= 3) return "Amber";
    return "Green";
  }, [projectUsage, visibleProjects]);

  // Per-project comparison data
  const cmpEstActual = useMemo(
    () => projectUsage
      .filter(({ project, usage }) => (project.approvedBudget || 0) + usage.loggedSpend > 0)
      .map(({ project, usage }) => ({
        name: project.name.split(" ")[0],
        budget: project.approvedBudget || 0,
        logged: usage.loggedSpend || 0,
      })),
    [projectUsage]
  );
  const cmpReqApp = useMemo(
    () =>
      visibleProjects
        .filter((p) => (p.approvedBudget || 0) > 0)
        .map((p) => ({
          name: p.name.split(" ")[0],
          requested: Math.round((p.approvedBudget || 0) * 1.1),
          approved: p.approvedBudget || 0,
        })),
    [visibleProjects]
  );
  const watchlistProjects = useMemo(
    () => projectUsage
      .filter(({ project, usage }) => project.health !== "healthy" || usage.utilization >= 85)
      .sort((left, right) => right.usage.utilization - left.usage.utilization),
    [projectUsage]
  );
  const scrollToMonitoring = () => {
    document.getElementById("cto-project-monitoring")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="space-y-6" data-testid="page-cto-dashboard">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] font-semibold text-fuchsia-400">
            <span className="w-6 h-px bg-fuchsia-400" />
            CTO Portal · Executive View
          </div>
          <h1 className="mt-2 font-display font-semibold text-3xl tracking-tight text-white">
            Portfolio operations
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Project-wise utilization &amp; owned consumption tracking · June 2026
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => setNewProjectOpen(true)}
            className="h-9 rounded-lg bg-fuchsia-500 hover:bg-fuchsia-600 gap-2 text-white shadow-[0_0_20px_rgba(232,25,184,0.35)]"
            data-testid="btn-cto-new-project"
          >
            <Plus className="w-3.5 h-3.5" />
            New project
          </Button>
        </div>
      </div>

      {/* CTO alert strip */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-3" data-testid="cto-alert-strip">
        <Link to="/budget-reviews" data-testid="cto-tile-reviews" className="rounded-2xl border border-fuchsia-500/25 bg-fuchsia-500/[0.06] hover:bg-fuchsia-500/[0.10] transition-colors p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-fuchsia-500/15 border border-fuchsia-500/30 flex items-center justify-center flex-shrink-0">
            <ClipboardCheck className="w-4 h-4 text-fuchsia-300" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] uppercase tracking-widest font-semibold text-fuchsia-300">Budget reviews</div>
            <div className="text-white font-display font-semibold text-xl tabular">{pendingReviews} pending</div>
          </div>
          <ChevronRight className="w-4 h-4 text-fuchsia-300" />
        </Link>
        <Link to="/change-requests" data-testid="cto-tile-crs" className="rounded-2xl border border-amber-500/25 bg-amber-500/[0.06] hover:bg-amber-500/[0.10] transition-colors p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center flex-shrink-0">
            <GitPullRequest className="w-4 h-4 text-amber-300" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] uppercase tracking-widest font-semibold text-amber-300">Change requests</div>
            <div className="text-white font-display font-semibold text-xl tabular">{pendingCRs} pending</div>
          </div>
          <ChevronRight className="w-4 h-4 text-amber-300" />
        </Link>
          <Link to="/projects" data-testid="cto-tile-topups" className="rounded-2xl border border-sky-500/25 bg-sky-500/[0.06] hover:bg-sky-500/[0.10] transition-colors p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-500/15 border border-sky-500/30 flex items-center justify-center flex-shrink-0">
              <ArrowUpRightSquare className="w-4 h-4 text-sky-300" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[10px] uppercase tracking-widest font-semibold text-sky-300">Budget changes in projects</div>
              <div className="text-white font-display font-semibold text-xl tabular">{pendingTopups} pending</div>
            </div>
            <ChevronRight className="w-4 h-4 text-sky-300" />
        </Link>
        <Link to="/approvals" data-testid="cto-tile-testing-submitted" className="rounded-2xl border border-emerald-500/25 bg-emerald-500/[0.06] hover:bg-emerald-500/[0.10] transition-colors p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center flex-shrink-0">
            <PackageCheck className="w-4 h-4 text-emerald-300" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] uppercase tracking-widest font-semibold text-emerald-300">Testing submitted</div>
            <div className="text-white font-display font-semibold text-xl tabular">{pendingTestingSamples}</div>
          </div>
          <ChevronRight className="w-4 h-4 text-emerald-300" />
        </Link>
        <button
          type="button"
          onClick={scrollToMonitoring}
          data-testid="cto-tile-highrisk"
          className="rounded-2xl border border-red-500/25 bg-red-500/[0.06] hover:bg-red-500/[0.10] transition-colors p-4 flex items-center gap-3 text-left"
        >
          <div className="w-10 h-10 rounded-xl bg-red-500/15 border border-red-500/30 flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-4 h-4 text-red-300" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] uppercase tracking-widest font-semibold text-red-300">High-risk projects</div>
            <div className="text-white font-display font-semibold text-xl tabular">{highRisk}</div>
          </div>
          <ChevronRight className="w-4 h-4 text-red-300" />
        </button>
        <Link to="/projects" data-testid="cto-tile-overbudget" className="rounded-2xl border border-white/10 bg-white/[0.04] hover:bg-white/[0.06] transition-colors p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-4 h-4 text-zinc-300" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-400">Over budget</div>
            <div className="text-white font-display font-semibold text-xl tabular">{overBudget}</div>
          </div>
          <ChevronRight className="w-4 h-4 text-zinc-400" />
        </Link>
      </div>

      {/* CTO KPIs (operational, not financial totals) */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Stat label="Active projects" value={String(visibleProjects.length)} icon={FolderKanban} tone="magenta" testid="cto-kpi-active" />
        <Stat label="In execution" value={String(inExecution)} icon={Activity} tone="positive" testid="cto-kpi-exec" />
        <Stat label="In discovery" value={String(inDiscovery)} icon={Cpu} testid="cto-kpi-discovery" />
        <Stat label="Portfolio utilization" value={fmtPct(orgUtil)} icon={Gauge} tone={orgUtil >= 90 ? "negative" : orgUtil >= 75 ? "warning" : "positive"} testid="cto-kpi-util" />
        <Stat label="Health" value={avgHealth} tone={avgHealth === "Green" ? "positive" : avgHealth === "Amber" ? "warning" : "negative"} icon={TrendingUp} testid="cto-kpi-health" />
        <Stat label="Phases in flight" value={String(visibleProjects.reduce((s, p) => s + (p.phases?.filter((ph) => ph.health !== "healthy").length || 0), 0))} icon={Layers} testid="cto-kpi-phases" />
      </div>

      {/* Project monitoring */}
      <Panel
        testid="cto-util-bars"
        title="Project monitoring snapshot"
        subtitle="Logged spend as % of approved budget · click to drill into the live project"
      >
        <div className="space-y-2.5">
          {projectUsage.map(({ project, usage }) => {
            const pct = project.approvedBudget ? Math.round((usage.loggedSpend / project.approvedBudget) * 100) : 0;
            const color = pct >= 100 ? "#EF4444" : pct >= 90 ? "#F59E0B" : pct >= 70 ? "#E619B8" : "#10B981";
            return (
              <Link
                to={`/projects/${project.id}`}
                key={project.id}
                data-testid={`cto-util-${project.id}`}
                className="block p-3 rounded-lg border border-white/5 bg-white/[0.02] hover:border-fuchsia-500/30 hover:bg-white/[0.04] transition-colors"
              >
                <div className="flex items-center justify-between text-xs mb-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-1.5 h-4 rounded-full flex-shrink-0" style={{ background: color }} />
                    <span className="text-white font-medium truncate">{project.name}</span>
                    <span className="text-[10px] text-zinc-500 flex-shrink-0">
                      {project.client} · TPM {project.tpm}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="text-zinc-400 tabular">
                      {fmtCurrency(usage.loggedSpend, { compact: false })} / {fmtCurrency(project.approvedBudget)}
                    </span>
                    <span className="font-semibold tabular w-10 text-right" style={{ color }}>
                      {fmtPct(pct)}
                    </span>
                    <ChevronRight className="w-3 h-3 text-zinc-600" />
                  </div>
                </div>
                <div className="h-2 rounded-full bg-white/[0.05] overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${Math.min(pct, 100)}%`, background: color }} />
                </div>
              </Link>
            );
          })}
          {visibleProjects.length === 0 && (
            <div className="text-center py-6 text-xs text-zinc-500">No projects yet — create one to get started.</div>
          )}
        </div>
      </Panel>

      <Panel
        testid="cto-watchlist"
        title="Projects needing attention"
        subtitle="Project monitoring is consolidated here so CTO can track risk, logged burn, and delivery progress without a separate tab."
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {watchlistProjects.slice(0, 6).map(({ project, usage }) => {
            const remainingBudget = Number(project.approvedBudget || 0) - usage.loggedSpend;
            return (
              <Link
                key={project.id}
                to={`/projects/${project.id}`}
                className="rounded-xl border border-white/5 bg-white/[0.02] hover:border-fuchsia-500/25 p-4 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-white truncate">{project.name}</div>
                    <div className="text-[11px] text-zinc-500 mt-0.5">{project.client} · TPM {project.tpm}</div>
                  </div>
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold ${
                    usage.utilization >= 100
                      ? "bg-red-500/15 text-red-300"
                      : usage.utilization >= 90
                        ? "bg-amber-500/15 text-amber-300"
                        : "bg-fuchsia-500/15 text-fuchsia-300"
                  }`}>
                    {fmtPct(usage.utilization)}
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-3 text-[11px]">
                  <MonitorMetric label="Logged" value={fmtCurrency(usage.loggedSpend, { compact: false })} />
                  <MonitorMetric label="Run rate" value={`${fmtCurrency(usage.runRate, { compact: false })}/day`} />
                  <MonitorMetric
                    label="Remaining"
                    value={fmtCurrency(remainingBudget, { compact: false })}
                    valueClass={remainingBudget >= 0 ? "text-emerald-300" : "text-red-300"}
                  />
                </div>
                <div className="mt-3 h-1.5 rounded-full bg-white/[0.05] overflow-hidden">
                  <div
                    className={`h-full rounded-full ${usage.taskCompletion >= 100 ? "bg-emerald-500" : "bg-fuchsia-500"}`}
                    style={{ width: `${Math.min(usage.taskCompletion, 100)}%` }}
                  />
                </div>
                <div className="mt-1.5 text-[11px] text-zinc-500">
                  {usage.loggedTasks.toLocaleString()} of {usage.targetTasks.toLocaleString()} target tasks logged
                </div>
              </Link>
            );
          })}
          {watchlistProjects.length === 0 && (
            <div className="lg:col-span-2 rounded-xl border border-dashed border-white/10 bg-white/[0.02] p-6 text-center text-xs text-zinc-500">
              No projects are on watch right now.
            </div>
          )}
        </div>
      </Panel>

      {/* Comparison charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel testid="cto-cmp-est-actual" title="Budget vs Logged" subtitle="Per project · submitted budget vs logged usage">
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={cmpEstActual}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#1F1F2A" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#71717A" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "#71717A" }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip contentStyle={{ background: "#12121A", border: "1px solid #26262F", borderRadius: 12 }} formatter={(v) => fmtCurrency(v)} />
                <Legend iconType="square" wrapperStyle={{ fontSize: 10 }} />
                <Bar dataKey="budget" name="Budget" fill="#3B82F6" radius={[3, 3, 0, 0]} maxBarSize={26} />
                <Bar dataKey="logged" name="Logged" fill="#E619B8" radius={[3, 3, 0, 0]} maxBarSize={26} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel testid="cto-cmp-req-approved" title="Requested vs Approved" subtitle="Per project · TPM ask vs CTO-approved">
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={cmpReqApp}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#1F1F2A" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#71717A" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "#71717A" }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip contentStyle={{ background: "#12121A", border: "1px solid #26262F", borderRadius: 12 }} formatter={(v) => fmtCurrency(v)} />
                <Legend iconType="square" wrapperStyle={{ fontSize: 10 }} />
                <Bar dataKey="requested" name="Requested" fill="#F59E0B" radius={[3, 3, 0, 0]} maxBarSize={26} />
                <Bar dataKey="approved" name="Approved" fill="#10B981" radius={[3, 3, 0, 0]} maxBarSize={26} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>

      {/* Projects list */}
      <Panel
        id="cto-project-monitoring"
        testid="cto-projects-list"
        title="Project monitoring"
        subtitle="Logged usage, run rate, remaining budget, and delivery target for each active project."
      >
        <div className="overflow-x-auto -mx-1">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500 border-b border-white/5">
                <th className="text-left py-2 px-3">Project</th>
                <th className="text-left py-2 px-3">Client</th>
                <th className="text-left py-2 px-3">TPM</th>
                <th className="text-left py-2 px-3">Status</th>
                <th className="text-right py-2 px-3">Approved</th>
                <th className="text-right py-2 px-3">Logged</th>
                <th className="text-right py-2 px-3">Run rate</th>
                <th className="text-right py-2 px-3">Remaining</th>
                <th className="text-right py-2 px-3">Task target</th>
                <th className="text-right py-2 px-3">Done</th>
                <th className="text-left py-2 px-3">Health</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {projectUsage.map(({ project, usage }) => {
                return (
                  <tr key={project.id} data-testid={`cto-row-${project.id}`} className="border-b border-white/5 hover:bg-white/[0.03]">
                    <td className="py-3 px-3">
                      <Link to={`/projects/${project.id}`} className="font-medium text-white hover:text-fuchsia-300">
                        {project.name}
                      </Link>
                    </td>
                    <td className="py-3 px-3 text-xs text-zinc-300">{project.client}</td>
                    <td className="py-3 px-3 text-xs text-zinc-300">{project.tpm}</td>
                    <td className="py-3 px-3 text-xs text-zinc-400">{project.status}</td>
                    <td className="py-3 px-3 text-right text-zinc-200 tabular">{fmtCurrency(project.approvedBudget)}</td>
                    <td className="py-3 px-3 text-right text-white font-semibold tabular">{fmtCurrency(usage.loggedSpend, { compact: false })}</td>
                    <td className="py-3 px-3 text-right text-zinc-200 tabular">{fmtCurrency(usage.runRate, { compact: false })}/d</td>
                    <td className={`py-3 px-3 text-right font-semibold tabular ${usage.remainingBudget >= 0 ? "text-emerald-300" : "text-red-300"}`}>
                      {fmtCurrency(usage.remainingBudget, { compact: false })}
                    </td>
                    <td className="py-3 px-3 text-right text-zinc-200 tabular">{usage.targetTasks.toLocaleString()}</td>
                    <td className="py-3 px-3 text-right text-fuchsia-300 font-semibold tabular">{usage.loggedTasks.toLocaleString()}</td>
                    <td className="py-3 px-3">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold ${
                          project.health === "healthy" ? "bg-emerald-500/15 text-emerald-300" : project.health === "watch" ? "bg-amber-500/15 text-amber-300" : "bg-red-500/15 text-red-300"
                        }`}
                      >
                        {project.health}
                      </span>
                    </td>
                    <td className="py-3 px-2 text-right">
                      <ChevronRight className="w-4 h-4 text-zinc-600" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>

      <NewProjectDialog open={newProjectOpen} onOpenChange={setNewProjectOpen} />
    </div>
  );
};

const Panel = ({ title, subtitle, children, testid, id }) => (
  <div id={id} className="bg-[#12121A] rounded-2xl border border-white/5 p-5" data-testid={testid}>
    <div className="mb-3">
      <div className="font-display font-semibold text-[15px] text-white">{title}</div>
      {subtitle && <div className="text-xs text-zinc-500 mt-0.5">{subtitle}</div>}
    </div>
    {children}
  </div>
);

const Stat = ({ label, value, icon: Icon, tone = "neutral", testid }) => {
  const tones = { positive: "text-emerald-300", negative: "text-red-300", warning: "text-amber-300", neutral: "text-white", magenta: "text-fuchsia-300" };
  return (
    <div className="bg-[#12121A] rounded-2xl border border-white/5 p-4" data-testid={testid}>
      <div className="flex items-center justify-between">
        <div className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">{label}</div>
        {Icon && (
          <div className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center">
            <Icon className={`w-3.5 h-3.5 ${tones[tone]}`} />
          </div>
        )}
      </div>
      <div className={`mt-2 font-display font-semibold text-xl tabular ${tones[tone]}`}>{value}</div>
    </div>
  );
};

const MonitorMetric = ({ label, value, valueClass = "text-white" }) => (
  <div className="rounded-lg border border-white/5 bg-white/[0.02] p-3">
    <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500">{label}</div>
    <div className={`mt-1 text-sm font-semibold tabular ${valueClass}`}>{value}</div>
  </div>
);

export default CtoDashboard;
