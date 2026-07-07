import { useState } from "react";
import { useApp } from "../../context/AppContext";
import { fmtCurrency, fmtPct } from "../../lib/format";
import { NOTIFICATIONS, APPROVALS, DAILY_ACTIVITY, MODEL_TRAJECTORY, THRESHOLDS } from "../../data/mockData";
import { RETURNED_BUDGETS, CHANGE_REQUESTS } from "../../data/mockTpm";
import { Link } from "react-router-dom";
import {
  FolderKanban, ShieldCheck, Undo2, Gauge, TrendingUp, Activity, Wallet, GitPullRequest, Heart, Flame, Clock3,
  Plus, Bell, Sparkles, ArrowUpRightSquare, ChevronRight, AlertTriangle, TriangleAlert,
} from "lucide-react";
import { Button } from "../../components/ui/button";
import { ResponsiveContainer, BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend, PieChart, Pie, Cell } from "recharts";
import RequestBudgetDialog from "../../components/RequestBudgetDialog";
import ChangeRequestDialog from "./ChangeRequestDialog";

const KpiCard = ({ label, value, sublabel, icon: Icon, tone = "neutral", testid, to }) => {
  const toneMap = {
    positive: "text-emerald-300",
    negative: "text-red-300",
    warning: "text-amber-300",
    neutral: "text-zinc-300",
    magenta: "text-fuchsia-300",
  };
  const inner = (
    <>
      <div className="flex items-center justify-between">
        <div className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">{label}</div>
        {Icon && (
          <div className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center">
            <Icon className={`w-3.5 h-3.5 ${toneMap[tone]}`} />
          </div>
        )}
      </div>
      <div className="mt-2 font-display font-semibold text-2xl tabular text-white">{value}</div>
      {sublabel && <div className="mt-1 text-[11px] text-zinc-500 tabular">{sublabel}</div>}
    </>
  );
  if (to) {
    return (
      <Link data-testid={testid} to={to} className="bg-[#12121A] rounded-2xl border border-white/5 p-4 card-hover block hover:border-fuchsia-500/30 transition-colors">
        {inner}
      </Link>
    );
  }
  return (
    <div data-testid={testid} className="bg-[#12121A] rounded-2xl border border-white/5 p-4 card-hover">
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
  const { user, visibleProjects } = useApp();
  const [requestOpen, setRequestOpen] = useState(false);
  const [crOpen, setCrOpen] = useState(false);

  // Compute TPM-scoped KPIs
  const approved = visibleProjects.reduce((s, p) => s + p.approvedBudget, 0);
  const actual = visibleProjects.reduce((s, p) => s + p.actualSpend, 0);
  const remaining = approved - actual;
  const util = approved ? Math.round((actual / approved) * 100) : 0;
  const burnRate = Math.round(visibleProjects.reduce((s, p) => s + p.burnRate, 0) * 1000);
  const runway = burnRate ? Math.round(remaining / burnRate) : "—";
  const today = DAILY_ACTIVITY[DAILY_ACTIVITY.length - 1];
  const overBudget = visibleProjects.filter((p) => p.utilization >= 100).length;
  const health = util >= 100 ? "Red" : util >= 90 ? "Amber" : util >= 75 ? "Amber" : "Green";
  const healthColor = health === "Green" ? "text-emerald-300" : health === "Amber" ? "text-amber-300" : "text-red-300";

  // Data
  const projectBarData = visibleProjects.map((p) => ({
    name: p.name.split(" ")[0],
    Claimed: p.approvedBudget,
    Actual: p.actualSpend,
    Exceeded: Math.max(0, p.actualSpend - p.approvedBudget),
  }));
  const modelPie = [
    { name: "Opus 4.8", value: 42, color: "#E619B8" },
    { name: "Gemini 2.5 Pro", value: 26, color: "#3B82F6" },
    { name: "GPT-4o", value: 18, color: "#10B981" },
    { name: "Sonnet", value: 9, color: "#F59E0B" },
    { name: "Kimi", value: 5, color: "#F97316" },
  ];
  const infraByProj = visibleProjects.map((p) => ({
    name: p.name.split(" ")[0],
    Infra: p.infrastructureCost,
  }));
  const subsCost = [
    { name: "Claude Max", cost: 1600 },
    { name: "Cursor Pro", cost: 360 },
    { name: "GitHub", cost: 855 },
    { name: "ChatGPT", cost: 600 },
  ];

  const upcomingPhase = visibleProjects[0]?.phases?.find((ph) => ph.health !== "healthy") || visibleProjects[0]?.phases?.[0];
  const pendingActions = APPROVALS.filter((a) => a.requester === user?.name).slice(0, 3);
  const recentNotifs = NOTIFICATIONS.slice(0, 4);

  return (
    <div className="space-y-6" data-testid="page-tpm-dashboard">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] font-semibold text-sky-300">
            <span className="w-6 h-px bg-sky-400" />
            TPM Portal
          </div>
          <h1 className="mt-2 font-display font-semibold text-3xl tracking-tight text-white">
            Welcome back, {user?.name?.split(" ")[0]}
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            {visibleProjects.length} project{visibleProjects.length === 1 ? "" : "s"} assigned to you · June 2026
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => setCrOpen(true)}
            variant="outline"
            className="h-9 rounded-lg border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 gap-2"
            data-testid="btn-open-cr"
          >
            <GitPullRequest className="w-4 h-4" />
            Raise change request
          </Button>
          <Link to="/budget-builder" className="inline-flex items-center gap-2 h-9 px-3 rounded-lg bg-fuchsia-500 hover:bg-fuchsia-600 text-white text-sm font-medium shadow-[0_0_20px_rgba(232,25,184,0.35)]" data-testid="btn-open-budget-builder">
            <Plus className="w-4 h-4" />
            Build budget
          </Link>
        </div>
      </div>

      {/* KPI Grid - 11 cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <KpiCard testid="kpi-active-projects" label="Active projects" value={String(visibleProjects.length)} icon={FolderKanban} tone="magenta" />
        <KpiCard testid="kpi-pending-approvals" label="Pending approvals" value={String(pendingActions.length)} icon={ShieldCheck} tone="warning" />
        <KpiCard testid="kpi-returned" label="Budgets returned" value={String(RETURNED_BUDGETS.length)} icon={Undo2} tone="warning" sublabel="Awaiting your edits" to={`/cto-review/${RETURNED_BUDGETS[0]?.id || ""}`} />
        <KpiCard testid="kpi-util" label="Budget utilization" value={fmtPct(util)} icon={Gauge} tone={util >= 90 ? "negative" : util >= 75 ? "warning" : "positive"} />
        <KpiCard testid="kpi-today-est" label="Today's estimated" value={fmtCurrency(today?.estimate || 0, { compact: false })} icon={TrendingUp} to="/consumption" />
        <KpiCard testid="kpi-today-actual" label="Today's actual" value={fmtCurrency(today?.spend || 0, { compact: false })} icon={Activity} tone="magenta" to="/consumption" />
        <KpiCard testid="kpi-remaining" label="Total remaining" value={fmtCurrency(remaining)} icon={Wallet} tone={remaining > 0 ? "positive" : "negative"} />
        <KpiCard testid="kpi-pending-cr" label="Pending change requests" value={String(CHANGE_REQUESTS.filter((c) => c.stage === "CTO Review").length)} icon={GitPullRequest} tone="warning" />
        <KpiCard testid="kpi-health" label="Budget health" value={health} icon={Heart} tone={health === "Green" ? "positive" : health === "Amber" ? "warning" : "negative"} sublabel={fmtPct(util)} />
        <KpiCard testid="kpi-burn-rate" label="Burn rate" value={`$${burnRate.toLocaleString()}/day`} icon={Flame} />
        <KpiCard testid="kpi-exhaustion" label="Exhaustion in" value={typeof runway === "number" ? `${runway} days` : runway} icon={Clock3} tone={typeof runway === "number" && runway < 14 ? "negative" : "neutral"} sublabel="At current burn" />
        <KpiCard testid="kpi-over" label="Over budget" value={String(overBudget)} icon={AlertTriangle} tone={overBudget > 0 ? "negative" : "positive"} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Panel testid="chart-claimed-actual" title="Claimed vs Actual vs Exceeded" subtitle="per project · $ thousands" >
          <div className="h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={projectBarData} barGap={2}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#1F1F2A" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#71717A" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "#71717A" }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} />
                <Tooltip contentStyle={{ background: "#12121A", border: "1px solid #26262F", borderRadius: 12 }} labelStyle={{ color: "#f4f4f5" }} formatter={(v) => fmtCurrency(v, { compact: false })} />
                <Legend iconType="square" wrapperStyle={{ fontSize: 10 }} />
                <Bar dataKey="Claimed" fill="#E619B8" radius={[3,3,0,0]} maxBarSize={14} />
                <Bar dataKey="Actual" fill="#F472B6" radius={[3,3,0,0]} maxBarSize={14} />
                <Bar dataKey="Exceeded" fill="#EF4444" radius={[3,3,0,0]} maxBarSize={14} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel testid="chart-daily-spend" title="Daily spending trend" subtitle="last 30 days">
          <div className="h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={DAILY_ACTIVITY.slice(-14)}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#1F1F2A" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#71717A" }} axisLine={false} tickLine={false} tickFormatter={(d) => d.slice(-2)} />
                <YAxis tick={{ fontSize: 10, fill: "#71717A" }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v/1000).toFixed(1)}k`} />
                <Tooltip contentStyle={{ background: "#12121A", border: "1px solid #26262F", borderRadius: 12 }} formatter={(v) => fmtCurrency(v, { compact: false })} />
                <Line type="monotone" dataKey="spend" name="Actual" stroke="#E619B8" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="estimate" name="Estimate" stroke="#F59E0B" strokeWidth={2} strokeDasharray="4 4" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel testid="chart-model-dist" title="Model cost distribution" subtitle="% of AI spend">
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
              {modelPie.map((m) => (
                <div key={m.name} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-sm" style={{ background: m.color }} /><span className="text-zinc-300">{m.name}</span></div>
                  <span className="text-white font-semibold tabular">{m.value}%</span>
                </div>
              ))}
            </div>
          </div>
        </Panel>

        <Panel testid="chart-util-per-project" title="Budget utilization" subtitle="per project · thresholds 50/75/90/100%">
          <div className="space-y-2.5">
            {visibleProjects.map((p) => {
              const color = p.utilization >= 100 ? "#EF4444" : p.utilization >= 90 ? "#F59E0B" : p.utilization >= 75 ? "#F59E0B" : p.utilization >= 50 ? "#E619B8" : "#10B981";
              return (
                <div key={p.id}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-zinc-200">{p.name}</span>
                    <span className="font-semibold tabular" style={{ color }}>{fmtPct(p.utilization)}</span>
                  </div>
                  <div className="relative h-2 rounded-full bg-white/[0.05]">
                    <div className="h-full rounded-full" style={{ width: `${Math.min(p.utilization,100)}%`, background: color }} />
                    {THRESHOLDS.map((t) => (
                      <div key={t} className="absolute top-0 bottom-0 w-px" style={{ left: `${t}%`, background: p.utilization >= t ? "rgba(232,25,184,0.7)" : "rgba(255,255,255,0.15)" }} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>

        <Panel testid="chart-infra" title="Infrastructure cost" subtitle="AWS / GCP / Azure per project">
          <div className="h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={infraByProj}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#1F1F2A" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#71717A" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "#71717A" }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v/1000).toFixed(1)}k`} />
                <Tooltip contentStyle={{ background: "#12121A", border: "1px solid #26262F", borderRadius: 12 }} formatter={(v) => fmtCurrency(v, { compact: false })} />
                <Bar dataKey="Infra" fill="#3B82F6" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel testid="chart-subs" title="Subscription cost" subtitle="active SaaS lines">
          <div className="space-y-2.5">
            {subsCost.map((s) => (
              <div key={s.name} className="flex items-center justify-between p-2.5 rounded-lg border border-white/5 bg-white/[0.02]">
                <span className="text-sm text-zinc-200">{s.name}</span>
                <span className="text-sm font-semibold text-white tabular">${s.cost.toLocaleString()}/mo</span>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      {/* Widgets: pending actions / notifications / upcoming phase */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Panel testid="widget-upcoming-phase" title="Upcoming phase" subtitle={visibleProjects[0]?.name || "No project"}>
          {upcomingPhase ? (
            <Link to={`/projects/${visibleProjects[0].id}/phase/${upcomingPhase.id}`} className="block hover:opacity-90 transition-opacity" data-testid="link-upcoming-phase">
              <div className="text-sm font-semibold text-white">{upcomingPhase.name}</div>
              <div className="text-xs text-zinc-500 mt-1">{upcomingPhase.dates}</div>
              <div className="mt-3 grid grid-cols-3 gap-2">
                <div className="rounded-lg bg-white/[0.03] p-2">
                  <div className="text-[9px] uppercase tracking-widest text-zinc-500 font-semibold">Est.</div>
                  <div className="text-sm font-semibold text-white tabular">{fmtCurrency(upcomingPhase.estimated)}</div>
                </div>
                <div className="rounded-lg bg-white/[0.03] p-2">
                  <div className="text-[9px] uppercase tracking-widest text-zinc-500 font-semibold">Actual</div>
                  <div className="text-sm font-semibold text-white tabular">{fmtCurrency(upcomingPhase.actual)}</div>
                </div>
                <div className="rounded-lg bg-white/[0.03] p-2">
                  <div className="text-[9px] uppercase tracking-widest text-zinc-500 font-semibold">Health</div>
                  <div className="text-sm font-semibold text-white capitalize">{upcomingPhase.health}</div>
                </div>
              </div>
              <div className="mt-3 inline-flex items-center gap-1 text-[11px] text-fuchsia-300 font-medium">
                Open phase workspace <ChevronRight className="w-3 h-3" />
              </div>
            </Link>
          ) : <div className="text-xs text-zinc-500">No upcoming phase.</div>}
        </Panel>

        <Panel testid="widget-pending-actions" title="Pending actions" subtitle="what needs your attention">
          <div className="space-y-2">
            {[
              { label: "Submit daily estimate for Kaiju Eval", link: "/consumption", icon: TrendingUp, tone: "text-fuchsia-300" },
              { label: `Review returned budget from CTO — ${RETURNED_BUDGETS[0]?.projectName || "Atlas Ingest"}`, link: `/cto-review/${RETURNED_BUDGETS[0]?.id || ""}`, icon: Undo2, tone: "text-amber-300" },
              { label: "Approve reimbursement · $420", link: "/reimbursements", icon: ShieldCheck, tone: "text-sky-300" },
              { label: "Confirm phase 2 completion — Talos", link: "/projects/talos", icon: ChevronRight, tone: "text-emerald-300" },
            ].map((a, i) => (
              <Link key={i} to={a.link} className="flex items-center gap-3 p-2.5 rounded-lg border border-white/5 hover:border-fuchsia-500/30 bg-white/[0.02] hover:bg-white/[0.06] transition-all" data-testid={`action-${i}`}>
                <a.icon className={`w-4 h-4 ${a.tone} flex-shrink-0`} />
                <span className="flex-1 text-xs text-zinc-100">{a.label}</span>
                <ChevronRight className="w-3.5 h-3.5 text-zinc-500" />
              </Link>
            ))}
          </div>
        </Panel>

        <Panel testid="widget-notifications" title="Notifications" subtitle="latest alerts" right={<Bell className="w-4 h-4 text-zinc-500" />}>
          <div className="space-y-2">
            {recentNotifs.map((n) => (
              <div key={n.id} className="flex items-start gap-2 p-2 rounded-lg border border-white/5 bg-white/[0.02]">
                <div className={`w-1 self-stretch rounded-full ${n.type === "danger" ? "bg-red-400" : n.type === "warning" ? "bg-amber-400" : n.type === "success" ? "bg-emerald-400" : "bg-sky-400"}`} />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-white">{n.title}</div>
                  <div className="text-[11px] text-zinc-500 mt-0.5 line-clamp-2">{n.detail}</div>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <RequestBudgetDialog open={requestOpen} onOpenChange={setRequestOpen} />
      <ChangeRequestDialog open={crOpen} onOpenChange={setCrOpen} />
    </div>
  );
};

export default TpmDashboard;
