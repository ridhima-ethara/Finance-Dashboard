import { useMemo, useState } from "react";
import { useApp } from "../../context/AppContext";
import { fmtCurrency, fmtPct } from "../../lib/format";
import { NOTIFICATIONS, APPROVALS, THRESHOLDS } from "../../data/mockData";
import { Link } from "react-router-dom";
import {
  FolderKanban, ShieldCheck, Gauge, TrendingUp, GitPullRequest, Heart, Flame, Clock3,
  Sparkles, ChevronRight, AlertTriangle, Calendar, Undo2, Edit3,
} from "lucide-react";
import { Button } from "../../components/ui/button";
import { ResponsiveContainer, BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend, PieChart, Pie, Cell } from "recharts";
import RequestBudgetDialog from "../../components/RequestBudgetDialog";
import ProjectsTable from "../../components/dashboard/ProjectsTable";
import {
  buildExecutionProjectView,
  buildLoggedDailyRows,
  isProjectInRndLane,
  isProjectInTpmLane,
  summarizeLoggedProject,
} from "../../lib/projectMetrics";
import { buildProjectBudgetBuilderHref } from "../../lib/projectBudgetRoute";

const KpiCard = ({ label, value, sublabel, details = [], icon: Icon, tone = "neutral", testid, to }) => {
  const toneMap = {
    positive: "text-emerald-300",
    negative: "text-red-300",
    warning: "text-amber-300",
    neutral: "text-zinc-300",
    magenta: "text-fuchsia-300",
  };
  const inner = (
    <>
      <div className="flex items-center justify-between gap-2">
        <div className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">{label}</div>
        {Icon && (
          <div className="w-6 h-6 rounded-md bg-white/5 flex items-center justify-center flex-shrink-0">
            <Icon className={`w-3 h-3 ${toneMap[tone]}`} />
          </div>
        )}
      </div>
      <div className="mt-1.5 font-display font-semibold text-xl tabular text-white">{value}</div>
      {sublabel && <div className="mt-0.5 text-[10px] text-zinc-500 tabular">{sublabel}</div>}
      {details.length > 0 && (
        <div className="mt-2 border-t border-white/5 pt-2 space-y-1">
          {details.map((detail) => (
            <div key={detail.label} className="flex items-center justify-between gap-2 text-[11px]">
              <span className="text-zinc-500">{detail.label}</span>
              <span className={`font-semibold tabular ${toneMap[detail.tone || "neutral"]}`}>{detail.value}</span>
            </div>
          ))}
        </div>
      )}
    </>
  );
  if (to) {
    return (
      <Link data-testid={testid} to={to} className="bg-[#12121A] rounded-xl border border-white/5 p-3 card-hover block hover:border-fuchsia-500/30 transition-colors">
        {inner}
      </Link>
    );
  }
  return (
    <div data-testid={testid} className="bg-[#12121A] rounded-xl border border-white/5 p-3 card-hover">
      {inner}
    </div>
  );
};

const Panel = ({ title, subtitle, right, children, testid }) => (
  <div className="bg-[#12121A] rounded-2xl border border-white/5 p-5" data-testid={testid}>
    <div className="flex items-start justify-between gap-2 mb-3">
      <div>
        <div className="font-display font-semibold text-[15px] text-white">{title}</div>
        {subtitle && <div className="text-xs text-zinc-500 mt-0.5">{subtitle}</div>}
      </div>
      {right}
    </div>
    {children}
  </div>
);

const TpmDashboard = () => {
  const { user, visibleProjects, budgetReviews, role, taskLogs, budgets, changeRequests } = useApp();
  const [requestOpen, setRequestOpen] = useState(false);
  const isRnd = role === "R&D";
  const executionLane = isRnd ? "rnd" : "production";
  const usageOptions = useMemo(() => ({ lane: executionLane }), [executionLane]);

  // Returned budgets addressed to me (or my role)
  const myReturnedBudgets = (budgetReviews || []).filter((r) => (
    (r.status === "returned-to-tpm" || r.status === "rejected-by-cto") &&
    (r.tpm === user?.name || (user?.role === "R&D" && r.returnedTo === "R&D"))
  ));

  const dashboardProjects = useMemo(
    () => visibleProjects
      .filter((project) => project.id === "budget-visualization-demo" || (isRnd ? isProjectInRndLane(project) : isProjectInTpmLane(project)))
      .map((project) => buildExecutionProjectView(project, budgets, executionLane)),
    [visibleProjects, budgets, executionLane, isRnd]
  );
  const underRndProjects = useMemo(
    () => (isRnd ? [] : visibleProjects.filter((project) => isProjectInRndLane(project))),
    [visibleProjects, isRnd]
  );
  const projectUsage = useMemo(
    () => dashboardProjects.map((project) => ({ project, usage: summarizeLoggedProject(project, taskLogs, usageOptions) })),
    [dashboardProjects, taskLogs, usageOptions]
  );
  const dailyRows = useMemo(
    () => buildLoggedDailyRows(dashboardProjects, taskLogs, usageOptions),
    [dashboardProjects, taskLogs, usageOptions]
  );

  // Compute TPM-scoped KPIs
  const approved = dashboardProjects.reduce((s, p) => s + Number(p.approvedBudget || 0), 0);
  const logged = projectUsage.reduce((sum, entry) => sum + entry.usage.loggedSpend, 0);
  const remaining = approved - logged;
  const util = approved ? Math.round((logged / approved) * 100) : 0;
  const burnRate = Math.round(projectUsage.reduce((sum, entry) => sum + entry.usage.runRate, 0));
  const latestDay = dailyRows.reduce((latest, row) => row.date > latest ? row.date : latest, "");
  const today = dailyRows
    .filter((row) => row.date === latestDay)
    .reduce((sum, row) => ({ spend: sum.spend + row.spent, approvedDaily: sum.approvedDaily + row.approvedDaily }), { spend: 0, approvedDaily: 0 });
  const overBudget = projectUsage.filter((entry) => entry.usage.utilization >= 100).length;
  const health = util >= 100 ? "Red" : util >= 90 ? "Amber" : util >= 75 ? "Amber" : "Green";
  const targetTasks = projectUsage.reduce((sum, entry) => sum + entry.usage.targetTasks, 0);
  const doneTasks = projectUsage.reduce((sum, entry) => sum + entry.usage.loggedTasks, 0);
  const inputTokens = projectUsage.reduce((sum, entry) => sum + entry.usage.inputTokens, 0);
  const outputTokens = projectUsage.reduce((sum, entry) => sum + entry.usage.outputTokens, 0);

  // Data
  const projectBarData = projectUsage.map(({ project, usage }) => ({
    name: project.name.split(" ")[0],
    Budget: project.approvedBudget,
    Logged: usage.loggedSpend,
    Remaining: Math.max(0, usage.remainingBudget),
  }));
  const modelUsageMap = {};
  projectUsage.forEach(({ usage }) => {
    usage.models.forEach((model) => {
      modelUsageMap[model.modelName] = modelUsageMap[model.modelName] || {
        name: model.modelName,
        value: 0,
        tasks: 0,
        inputTokens: 0,
        outputTokens: 0,
      };
      modelUsageMap[model.modelName].value += model.cost;
      modelUsageMap[model.modelName].tasks += model.tasksDone;
      modelUsageMap[model.modelName].inputTokens += model.inputTokens;
      modelUsageMap[model.modelName].outputTokens += model.outputTokens;
    });
  });
  const palette = ["#E619B8", "#3B82F6", "#10B981", "#F59E0B", "#F97316", "#94A3B8"];
  const modelPie = Object.values(modelUsageMap)
    .sort((left, right) => right.value - left.value)
    .slice(0, 6)
    .map((entry, index) => ({ ...entry, color: palette[index % palette.length] }));
  const dailySpendData = Array.from(
    dailyRows.reduce((map, row) => {
      const current = map.get(row.date) || { date: row.date, logged: 0, allocated: 0 };
      current.logged += row.spent;
      current.allocated += row.approvedDaily;
      map.set(row.date, current);
      return map;
    }, new Map()).values()
  ).slice(-14);
  const completionByProject = projectUsage.map(({ project, usage }) => ({
    name: project.name.split(" ")[0],
    Completion: usage.targetTasks > 0 ? Math.round((usage.loggedTasks / usage.targetTasks) * 100) : 0,
  }));
  const pendingActions = APPROVALS.filter((a) => a.requester === user?.name).slice(0, 3);

  if (isRnd) {
    return <RndPortalOverview
      user={user}
      projects={dashboardProjects}
      projectUsage={projectUsage}
      approved={approved}
      logged={logged}
      remaining={remaining}
      util={util}
      targetTasks={targetTasks}
      doneTasks={doneTasks}
      health={health}
      hasLogs={dailyRows.length > 0}
      usageOptions={usageOptions}
    />;
  }

  return (
    <div className="space-y-4" data-testid="page-tpm-dashboard">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] font-semibold text-sky-300">
            <span className="w-6 h-px bg-sky-400" />
            {isRnd ? "RL Environment Portal" : "Projects Portal"}
          </div>
          <h1 className="mt-1.5 font-display font-semibold text-2xl tracking-tight text-white">
            Welcome back, {user?.name?.split(" ")[0]}
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            {dashboardProjects.length} active project{dashboardProjects.length === 1 ? "" : "s"}
            {!isRnd && underRndProjects.length > 0 ? ` · ${underRndProjects.length} under R&D currently` : ""}
            {" · June 2026"}
          </p>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
        <KpiCard testid="kpi-active-projects" label="Active projects" value={String(dashboardProjects.length)} icon={FolderKanban} tone="magenta" />
        <KpiCard testid="kpi-pending-approvals" label="Pending approvals" value={String(pendingActions.length)} icon={ShieldCheck} tone="warning" />
        <KpiCard testid="kpi-util" label="Budget utilization" value={fmtPct(util)} icon={Gauge} tone={util >= 90 ? "negative" : util >= 75 ? "warning" : "positive"} />
        <KpiCard
          testid="kpi-today-consumption"
          label="Log today's consumption"
          value={fmtCurrency(today?.spend || 0, { compact: false })}
          icon={Calendar}
          tone="magenta"
          sublabel="Tap to submit"
          details={[
            { label: "Logged spent", value: fmtCurrency(logged, { compact: false }), tone: "magenta" },
            { label: "Total remaining", value: fmtCurrency(remaining, { compact: false }), tone: remaining > 0 ? "positive" : "negative" },
          ]}
          to="/consumption"
        />
        <KpiCard testid="kpi-pending-cr" label="Pending additional requests" value={String(changeRequests.filter((request) => request.stage === "CTO Review").length)} icon={GitPullRequest} tone="warning" />
        <KpiCard testid="kpi-health" label="Budget health" value={health} icon={Heart} tone={health === "Green" ? "positive" : health === "Amber" ? "warning" : "negative"} sublabel={fmtPct(util)} />
        <KpiCard testid="kpi-burn-rate" label="Burn rate" value={fmtCurrency(burnRate, { compact: false })} icon={Flame} sublabel="Logged avg / day" />
        <KpiCard testid="kpi-over" label="Target progress" value={targetTasks > 0 ? `${doneTasks}/${targetTasks}` : `${doneTasks}`} icon={AlertTriangle} tone={doneTasks >= targetTasks && targetTasks > 0 ? "positive" : "warning"} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Panel testid="chart-claimed-actual" title="Budget vs logged vs remaining" subtitle="per project · owned consumption only" >
          <div className="h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={projectBarData} barGap={2}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#1F1F2A" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#71717A" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "#71717A" }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} />
                <Tooltip contentStyle={{ background: "#12121A", border: "1px solid #26262F", borderRadius: 12 }} labelStyle={{ color: "#f4f4f5" }} formatter={(v) => fmtCurrency(v, { compact: false })} />
                <Legend iconType="square" wrapperStyle={{ fontSize: 10 }} />
                <Bar dataKey="Budget" fill="#E619B8" radius={[3,3,0,0]} maxBarSize={14} />
                <Bar dataKey="Logged" fill="#F472B6" radius={[3,3,0,0]} maxBarSize={14} />
                <Bar dataKey="Remaining" fill="#10B981" radius={[3,3,0,0]} maxBarSize={14} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel testid="chart-daily-spend" title="Daily logged spend vs daily budget" subtitle="last 14 days">
          <div className="h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dailySpendData}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#1F1F2A" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#71717A" }} axisLine={false} tickLine={false} tickFormatter={(d) => d.slice(-2)} />
                <YAxis tick={{ fontSize: 10, fill: "#71717A" }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v/1000).toFixed(1)}k`} />
                <Tooltip contentStyle={{ background: "#12121A", border: "1px solid #26262F", borderRadius: 12 }} formatter={(v) => fmtCurrency(v, { compact: false })} />
                <Line type="monotone" dataKey="logged" name="Logged" stroke="#E619B8" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="allocated" name="Allocated" stroke="#F59E0B" strokeWidth={2} strokeDasharray="4 4" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel testid="chart-model-dist" title="Model usage distribution" subtitle="% of logged model spend">
          <div className="flex items-center gap-3 h-[240px]">
            <div className="w-40 h-40">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={modelPie} dataKey="value" innerRadius={45} outerRadius={70} paddingAngle={2} stroke="none">
                    {modelPie.map((m, i) => <Cell key={i} fill={m.color} />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex-1 space-y-1">
              {modelPie.length === 0 && <div className="text-xs text-zinc-500">Log model usage to see distribution.</div>}
              {modelPie.map((m) => (
                <div key={m.name} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-sm" style={{ background: m.color }} /><span className="text-zinc-300">{m.name}</span></div>
                  <span className="text-white font-semibold tabular">{fmtCurrency(m.value, { compact: false })}</span>
                </div>
              ))}
            </div>
          </div>
        </Panel>

        <Panel testid="chart-util-per-project" title="Budget utilization" subtitle="per project · thresholds 50/75/90/100%">
          <div className="space-y-2.5">
            {projectUsage.map(({ project, usage }) => {
              const color = usage.utilization >= 100 ? "#EF4444" : usage.utilization >= 90 ? "#F59E0B" : usage.utilization >= 75 ? "#F59E0B" : usage.utilization >= 50 ? "#E619B8" : "#10B981";
              return (
                <div key={project.id}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-zinc-200">{project.name}</span>
                    <span className="font-semibold tabular" style={{ color }}>{fmtPct(usage.utilization)}</span>
                  </div>
                  <div className="relative h-2 rounded-full bg-white/[0.05]">
                    <div className="h-full rounded-full" style={{ width: `${Math.min(usage.utilization,100)}%`, background: color }} />
                    {THRESHOLDS.map((t) => (
                      <div key={t} className="absolute top-0 bottom-0 w-px" style={{ left: `${t}%`, background: usage.utilization >= t ? "rgba(232,25,184,0.7)" : "rgba(255,255,255,0.15)" }} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>

        <div className={isRnd ? "lg:col-span-2" : ""}>
          <Panel testid="chart-infra" title="Task completion by project" subtitle="logged tasks vs target tasks">
            <div className="h-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={completionByProject}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#1F1F2A" />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#71717A" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "#71717A" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
                  <Tooltip contentStyle={{ background: "#12121A", border: "1px solid #26262F", borderRadius: 12 }} formatter={(v) => `${v}%`} />
                  <Bar dataKey="Completion" fill="#3B82F6" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Panel>
        </div>

      </div>

      {/* Returned budgets — edit & resubmit */}
      {myReturnedBudgets.length > 0 && (
        <div className="bg-[#12121A] rounded-2xl border border-amber-500/20 p-5" data-testid="widget-returned-budgets">
          <div className="flex items-start justify-between gap-2 mb-3">
            <div>
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest font-semibold text-amber-300">
                <Undo2 className="w-3 h-3" /> Returned by CTO
              </div>
              <div className="font-display font-semibold text-[15px] text-white mt-1">Budgets awaiting your revision</div>
              <div className="text-xs text-zinc-500 mt-0.5">Edit &amp; resubmit — your inputs are pre-filled</div>
            </div>
            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30">
              {myReturnedBudgets.length} pending
            </span>
          </div>
          <div className="space-y-2">
            {myReturnedBudgets.map((r) => (
              <Link
                key={r.id}
                to={buildProjectBudgetBuilderHref(r.projectId, {
                  edit: r.id,
                  budgetType: r.budgetType,
                  sampleIteration: r.sampleIteration,
                })}
                data-testid={`returned-budget-${r.id}`}
                className="flex items-start gap-3 p-3 rounded-lg border border-white/5 hover:border-amber-500/30 bg-white/[0.02] hover:bg-white/[0.04] transition-all group"
              >
                <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/25 flex items-center justify-center flex-shrink-0">
                  <Edit3 className="w-3.5 h-3.5 text-amber-300" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-white">{r.projectName}</div>
                  <div className="text-[11px] text-zinc-500 mt-0.5">
                    Returned {new Date(r.ctoAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })} · Original ask <span className="text-zinc-300 tabular">{fmtCurrency(r.requestedBudget, { compact: false })}</span>
                  </div>
                  {r.ctoComment && <div className="text-xs text-zinc-300 mt-1 line-clamp-2"><span className="text-fuchsia-300 font-semibold">CTO:</span> {r.ctoComment}</div>}
                </div>
                <ChevronRight className="w-4 h-4 text-zinc-500 group-hover:text-amber-300 flex-shrink-0" />
              </Link>
            ))}
          </div>
        </div>
      )}

      {!isRnd && (
        <Panel
          testid="widget-under-rnd-projects"
          title="Projects under RL Environment currently"
          subtitle="Assigned Projects members can track kickoff context here. These become budgetable after RL Environment sample acceptance."
          right={underRndProjects.length > 0 ? (
            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-sky-500/15 text-sky-300 border border-sky-500/30">
              {underRndProjects.length} waiting
            </span>
          ) : null}
        >
          {underRndProjects.length === 0 ? (
            <div className="text-xs text-zinc-500">No assigned projects are waiting in the R&D lane right now.</div>
          ) : (
            <div className="space-y-2.5">
              {underRndProjects.map((project) => {
                const kickoffGoal = project.goal || project.kickoffMail?.goal || "";
                const kickoffRecipients = project.kickoffMail?.recipients || project.teamMembers || [];
                const requirementsCount = project.kickoffMail?.requirements?.length || project.docs?.length || 0;
                return (
                  <Link
                    key={project.id}
                    to={`/projects/${project.id}`}
                    data-testid={`under-rnd-project-${project.id}`}
                    className="flex items-start gap-3 rounded-xl border border-white/5 bg-white/[0.02] p-3 hover:border-sky-500/30 hover:bg-white/[0.04] transition-all group"
                  >
                    <div className="w-9 h-9 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center flex-shrink-0">
                      <Clock3 className="w-4 h-4 text-sky-300" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-white truncate">{project.name}</div>
                          <div className="text-[11px] text-zinc-500 truncate">{project.client || project.clientProjectName || "Client project"}</div>
                        </div>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-sky-500/15 text-sky-300 border border-sky-500/30 flex-shrink-0">
                          Under R&amp;D currently
                        </span>
                      </div>
                      {kickoffGoal && (
                        <div className="mt-2 text-xs text-zinc-300 line-clamp-2">
                          <span className="text-sky-300 font-semibold">Project Goal:</span> {kickoffGoal}
                        </div>
                      )}
                      <div className="mt-2 text-[11px] text-zinc-500">
                        {kickoffRecipients.length} kickoff recipient{kickoffRecipients.length === 1 ? "" : "s"} · {requirementsCount} requirement{requirementsCount === 1 ? "" : "s"}
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-zinc-500 group-hover:text-sky-300 flex-shrink-0" />
                  </Link>
                );
              })}
            </div>
          )}
        </Panel>
      )}

      {/* Projects table with expandable phase drawer (log daily task / raise top-up per phase) */}
      <ProjectsTable projectsOverride={dashboardProjects} usageOptions={usageOptions} />

      <RequestBudgetDialog open={requestOpen} onOpenChange={setRequestOpen} />
    </div>
  );
};

const RndPortalOverview = ({
  user, projects, projectUsage, approved, logged, remaining, util,
  targetTasks, doneTasks, health, hasLogs, usageOptions,
}) => {
  const attention = projectUsage.filter(({ project, usage }) => Number(project.approvedBudget || 0) <= 0 || usage.utilization >= 75);
  const healthTone = health === "Green" ? "text-emerald-300 bg-emerald-500/10 border-emerald-500/25" : health === "Amber" ? "text-amber-300 bg-amber-500/10 border-amber-500/25" : "text-red-300 bg-red-500/10 border-red-500/25";
  return <div className="mx-auto max-w-[1180px] space-y-4" data-testid="page-tpm-dashboard">
    <div className="flex items-end justify-between gap-4 flex-wrap">
      <div>
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] font-semibold text-fuchsia-300">
          <span className="h-2 w-2 rounded-[3px] bg-fuchsia-500" /> RL Environment Portal
        </div>
        <h1 className="mt-2 font-display text-2xl font-semibold tracking-tight text-white">Welcome back, {user?.name?.split(" ")[0] || "R&D"}</h1>
        <p className="mt-1 text-xs text-zinc-400">{projects.length} active project{projects.length === 1 ? "" : "s"} · Live approved budget and logged task activity</p>
      </div>
      <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${healthTone}`}>
        <span className="h-1.5 w-1.5 rounded-full bg-current" /> Budget health: {health}
      </span>
    </div>

    {!hasLogs && <div className="flex items-center gap-3 rounded-2xl border border-fuchsia-500/20 bg-fuchsia-500/[0.06] p-3.5" data-testid="rnd-consumption-banner">
      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-fuchsia-500 text-white"><Edit3 className="h-4 w-4" /></div>
      <div className="min-w-0 flex-1"><div className="text-sm font-semibold text-white">No consumption logged yet</div><div className="mt-0.5 text-xs text-zinc-400">Log today’s tasks to unlock burn rate, model usage, and daily trends.</div></div>
      <Button asChild className="h-9 flex-shrink-0 rounded-lg bg-fuchsia-500 text-white hover:bg-fuchsia-600"><Link to="/consumption">Log today’s consumption</Link></Button>
    </div>}

    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <OverviewKpi label="Total budget" value={fmtCurrency(approved, { compact: false })} note={`across ${projects.length} projects`} />
      <OverviewKpi label="Logged spend" value={fmtCurrency(logged, { compact: false })} note={`${fmtPct(util)} utilization`} tone="magenta" />
      <OverviewKpi label="Remaining" value={fmtCurrency(remaining, { compact: false })} note={`${fmtPct(Math.max(0, 100 - util))} of budget left`} tone={remaining >= 0 ? "positive" : "negative"} />
      <OverviewKpi label="Task progress" value={`${doneTasks.toLocaleString()} / ${targetTasks.toLocaleString()}`} note="target tasks completed" />
    </div>

    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Panel title="Budget vs logged, per project" subtitle="Live allocation and task-log consumption" testid="rnd-budget-bars">
        <div className="space-y-3">
          {projectUsage.map(({ project, usage }) => {
            const budget = Number(project.approvedBudget || 0);
            const pct = budget > 0 ? Math.round((usage.loggedSpend / budget) * 100) : 0;
            return <Link to={`/projects/${project.id}`} key={project.id} className="block rounded-lg px-2 py-1.5 hover:bg-white/[0.03]">
              <div className="mb-1.5 flex items-center justify-between gap-3 text-xs"><span className="font-semibold text-zinc-200">{project.name}</span><span className="tabular text-zinc-400">{fmtCurrency(usage.loggedSpend, { compact: false })} / {fmtCurrency(budget, { compact: false })}</span></div>
              <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]"><div className={`h-full rounded-full ${pct >= 100 ? "bg-red-500" : pct >= 75 ? "bg-amber-500" : "bg-fuchsia-500"}`} style={{ width: `${Math.min(pct, 100)}%` }} /></div>
            </Link>;
          })}
          {!projectUsage.length && <div className="py-8 text-center text-xs text-zinc-500">No active project budgets available.</div>}
        </div>
      </Panel>

      <Panel title="Needs attention" subtitle="Budget and allocation health flags" testid="rnd-attention">
        <div className="space-y-2">
          {attention.slice(0, 6).map(({ project, usage }) => {
            const noBudget = Number(project.approvedBudget || 0) <= 0;
            const tone = noBudget ? "text-zinc-400 bg-white/[0.05]" : usage.utilization >= 100 ? "text-red-300 bg-red-500/10" : "text-amber-300 bg-amber-500/10";
            return <Link key={project.id} to={`/projects/${project.id}`} className="flex items-start gap-3 rounded-xl border border-white/5 p-3 hover:border-fuchsia-500/25">
              <span className={`mt-0.5 rounded-full px-2 py-0.5 text-[10px] font-semibold ${tone}`}>{noBudget ? "Info" : usage.utilization >= 100 ? "Over" : "Watch"}</span>
              <div className="min-w-0 flex-1"><div className="text-sm font-semibold text-white">{project.name}</div><div className="mt-0.5 text-xs text-zinc-500">{noBudget ? "No approved budget yet. Build and submit a budget to begin tracking." : `${fmtPct(usage.utilization)} utilized · ${fmtCurrency(usage.remainingBudget, { compact: false })} remaining.`}</div></div>
              <ChevronRight className="mt-1 h-3.5 w-3.5 text-zinc-500" />
            </Link>;
          })}
          {!attention.length && <div className="flex min-h-[130px] flex-col items-center justify-center text-center"><Heart className="h-7 w-7 text-emerald-300" /><div className="mt-2 text-sm font-semibold text-white">All projects are healthy</div><div className="mt-1 text-xs text-zinc-500">There are no budget or allocation flags right now.</div></div>}
        </div>
      </Panel>
    </div>

    <ProjectsTable projectsOverride={projects} usageOptions={usageOptions} />
  </div>;
};

const OverviewKpi = ({ label, value, note, tone = "neutral" }) => {
  const valueTone = tone === "positive" ? "text-emerald-300" : tone === "negative" ? "text-red-300" : tone === "magenta" ? "text-fuchsia-300" : "text-white";
  return <div className="rounded-2xl border border-white/5 bg-[#12121A] p-4">
    <div className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">{label}</div>
    <div className={`mt-1.5 font-display text-2xl font-semibold tabular ${valueTone}`}>{value}</div>
    <div className="mt-0.5 text-[11px] text-zinc-500">{note}</div>
  </div>;
};

export default TpmDashboard;
