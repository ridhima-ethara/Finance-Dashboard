import { useState, useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { fmtCurrency, fmtPct, fmtDate, healthColor, utilColor, varianceColor } from "../lib/format";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";
import { Button } from "../components/ui/button";
import {
  ArrowLeft, Sparkles, Lock, ArrowUpRightSquare, Users, Wallet, ListChecks, PackageCheck, ScrollText,
  Search, Plus, ChevronRight, User as UserIcon, Circle, CheckCircle2, Clock3, XCircle, Percent,
  Trash2, Pencil, FileText, Layers, Building2, MessageSquare, Shield, DollarSign, TrendingUp, TrendingDown,
} from "lucide-react";
import { useApp } from "../context/AppContext";
import { isTpmView } from "../lib/roles";
import { toast } from "sonner";
import { TEAM } from "../data/mockUsers";
import TopupRequestDialog from "../components/TopupRequestDialog";
import DeliverBatchDialog from "../components/DeliverBatchDialog";
import TpmTaskLogDialog from "../components/TpmTaskLogDialog";
import { DAILY_ACTIVITY } from "../data/mockAi";
import { ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, Area, AreaChart } from "recharts";

// Deterministic seed of team members per project — uses project id hash for stability.
const seedTeam = (project) => {
  if (!project) return [];
  const roster = [
    { name: project.tpm || "Arjun Mehta", role: "TPM", email: `${(project.tpm || "arjun").toLowerCase().split(" ")[0]}@ethara.ai` },
    { name: project.pl || "Aanya Sharma", role: "Project Lead", email: `${(project.pl || "aanya").toLowerCase().split(" ")[0]}@ethara.ai` },
    ...TEAM.filter((m) => m.role === "Engineer" || m.role === "Project Lead").slice(0, 2),
  ];
  // Dedupe by name
  const seen = new Set();
  return roster
    .filter((m) => (seen.has(m.name) ? false : seen.add(m.name)))
    .map((m, i) => ({
      id: `${project.id}-tm-${i + 1}`,
      name: m.name,
      role: m.role,
      email: m.email,
      status: i === 0 ? "Online" : i === 1 ? "Online" : "Away",
      tasksDone: [4, 2, 1, 0][i] ?? 0,
    }));
};

const statusMap = {
  "pending-cto": { label: "Pending · CTO", cls: "bg-amber-500/15 text-amber-300 border-amber-500/30", Icon: Clock3 },
  "pending-cfo": { label: "Pending · CFO", cls: "bg-sky-500/15 text-sky-300 border-sky-500/30", Icon: Clock3 },
  approved: { label: "Approved", cls: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30", Icon: CheckCircle2 },
  partial: { label: "Partially Approved", cls: "bg-emerald-500/10 text-emerald-300 border-emerald-500/25", Icon: Percent },
  rejected: { label: "Rejected", cls: "bg-red-500/15 text-red-300 border-red-500/30", Icon: XCircle },
  recovered: { label: "Recovered · full", cls: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30", Icon: CheckCircle2 },
  "partial-recovered": { label: "Recovered · partial", cls: "bg-emerald-500/10 text-emerald-300 border-emerald-500/25", Icon: Percent },
};

const ProjectDetail = () => {
  const { id } = useParams();
  const {
    setAiOpen, projects, role, topupRequests, batchDeliveries, getPhaseLogs, isTaskEditable, deletePhaseTask,
  } = useApp();
  const p = projects.find((x) => x.id === id);
  const isTPM = isTpmView(role);
  const isCFO = role === "CFO";

  const [topupOpen, setTopupOpen] = useState(false);
  const [deliverPhase, setDeliverPhase] = useState(null); // {project, phase} or null
  const [taskLogPhase, setTaskLogPhase] = useState(null); // phase for log dialog
  const [editingLog, setEditingLog] = useState(null);
  const [teamSearch, setTeamSearch] = useState("");

  const team = useMemo(() => seedTeam(p), [p]);
  const filteredTeam = team.filter((m) =>
    !teamSearch.trim() || m.name.toLowerCase().includes(teamSearch.toLowerCase()) || m.email.toLowerCase().includes(teamSearch.toLowerCase())
  );

  // Aggregate all TPM logs across all phases for the Tasks tab
  const allLogs = useMemo(() => {
    if (!p) return [];
    return (p.phases || []).flatMap((ph) => getPhaseLogs(p.id, ph.id).map((l) => ({ ...l, phaseName: ph.name })));
  }, [p, getPhaseLogs]);

  // Top-ups + batch deliveries for this project (used in the Batch tab)
  const projectTopups = useMemo(() => topupRequests.filter((r) => r.projectId === id), [topupRequests, id]);
  const projectBatches = useMemo(() => batchDeliveries.filter((b) => b.projectId === id), [batchDeliveries, id]);

  if (!p) {
    return (
      <div className="p-6" data-testid="project-not-found">
        Project not found.
        <Link className="ml-2 text-fuchsia-400" to="/projects">Back</Link>
      </div>
    );
  }

  const prjCode = `PRJ${String(Math.abs((p.id || "").split("").reduce((a, c) => a + c.charCodeAt(0), 0)) % 100000).padStart(5, "0")}`;
  const startDate = p.phases?.[0]?.dates?.split(" ")[0] || p.status;

  return (
    <div className="space-y-6" data-testid={`page-project-${p.id}`}>
      {/* Header */}
      <div>
        <Link to="/projects" className="text-xs text-fuchsia-300 inline-flex items-center gap-1 hover:text-fuchsia-200" data-testid="breadcrumb-back">
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Projects
        </Link>
        <div className="mt-2 flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="font-display font-semibold text-3xl tracking-tight text-white">{p.name}</h1>
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border ${p.type === "R&D" ? "bg-fuchsia-500/10 text-fuchsia-300 border-fuchsia-500/30" : "bg-emerald-500/10 text-emerald-300 border-emerald-500/30"}`}>
                <Circle className="w-1.5 h-1.5 fill-current" /> {p.type === "R&D" ? "R&D" : "Production"}
              </span>
            </div>
            <div className="mt-1 text-xs text-zinc-500 tabular">
              {prjCode} · Started {startDate} · {team.length} team members · Client {p.client}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAiOpen(true)}
              className="h-9 rounded-lg border-white/10 gap-2"
              data-testid="btn-ask-ai"
            >
              <Sparkles className="w-3.5 h-3.5 text-fuchsia-400" />
              Ask AI
            </Button>
            {isTPM && (
              <Button size="sm" onClick={() => setTopupOpen(true)} className="h-9 rounded-lg bg-fuchsia-500 hover:bg-fuchsia-600 gap-2" data-testid="btn-request-topup">
                <ArrowUpRightSquare className="w-3.5 h-3.5" /> Request top-up
              </Button>
            )}
            {isCFO && (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold bg-white/[0.04] border border-white/10 text-zinc-300" data-testid="cfo-readonly-badge">
                <Lock className="w-3 h-3" /> Read-only view
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="team" className="w-full">
        <TabsList className="bg-transparent p-0 gap-4 border-b border-white/10 rounded-none h-auto w-full justify-start" data-testid="project-tabs">
          <TabTrigger value="team" icon={Users} label="Team" testid="tab-team" />
          <TabTrigger value="budget" icon={Wallet} label="Budget" testid="tab-budget" />
          <TabTrigger value="tasks" icon={ListChecks} label="Tasks" testid="tab-tasks" />
          <TabTrigger value="batch" icon={PackageCheck} label="Batch" testid="tab-batch" />
          <TabTrigger value="logs" icon={ScrollText} label="Logs" testid="tab-logs" />
        </TabsList>

        {/* ---- Team ---- */}
        <TabsContent value="team" className="mt-6">
          <div className="bg-[#12121A] rounded-2xl border border-white/5 overflow-hidden" data-testid="team-panel">
            <div className="p-4 border-b border-white/5 flex items-center gap-3 flex-wrap">
              <div className="relative flex-1 min-w-[240px]">
                <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  value={teamSearch}
                  onChange={(e) => setTeamSearch(e.target.value)}
                  placeholder="Search team members…"
                  data-testid="team-search"
                  className="w-full h-10 pl-8 pr-3 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40"
                />
              </div>
              {isTPM && role !== "R&D" && (
                <Button size="sm" onClick={() => toast.info("Add member — coming soon")} data-testid="btn-add-member" className="h-9 rounded-lg bg-fuchsia-500 hover:bg-fuchsia-600 text-white gap-1.5 shadow-[0_0_20px_rgba(232,25,184,0.35)]">
                  <Plus className="w-3.5 h-3.5" /> Add member
                </Button>
              )}
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500 border-b border-white/5 bg-white/[0.02]">
                  <th className="text-left py-3 px-5">Name</th>
                  <th className="text-left py-3 px-2">Role</th>
                  <th className="text-left py-3 px-2">Status</th>
                  <th className="text-right py-3 px-2">Tasks Done</th>
                  <th className="text-right py-3 px-5 w-14">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredTeam.length === 0 && (
                  <tr><td colSpan="5" className="py-6 text-center text-xs text-zinc-500">No team members match.</td></tr>
                )}
                {filteredTeam.map((m) => (
                  <tr key={m.id} data-testid={`team-row-${m.id}`} className="border-b border-white/5 last:border-0 hover:bg-white/[0.03]">
                    <td className="py-3 px-5">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-fuchsia-500/15 border border-fuchsia-500/25 flex items-center justify-center text-[11px] font-semibold text-fuchsia-200">
                          {m.name.split(" ").map((n) => n[0]).slice(0, 2).join("")}
                        </div>
                        <div>
                          <div className="text-white font-medium">{m.name}</div>
                          <div className="text-[11px] text-zinc-500">{m.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-2">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-fuchsia-500/10 border border-fuchsia-500/25 text-fuchsia-200">{m.role}</span>
                    </td>
                    <td className="py-3 px-2">
                      <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium ${m.status === "Online" ? "text-emerald-300" : "text-amber-300"}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${m.status === "Online" ? "bg-emerald-400" : "bg-amber-400"}`} />
                        {m.status}
                      </span>
                    </td>
                    <td className="py-3 px-2 text-right tabular text-white font-semibold">{m.tasksDone}</td>
                    <td className="py-3 px-5 text-right text-zinc-500">
                      <button className="w-7 h-7 rounded-md hover:bg-white/[0.06] inline-flex items-center justify-center" title="More">
                        <span className="inline-block w-1 h-1 rounded-full bg-current mx-0.5" />
                        <span className="inline-block w-1 h-1 rounded-full bg-current mx-0.5" />
                        <span className="inline-block w-1 h-1 rounded-full bg-current mx-0.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="p-3 border-t border-white/5 text-[11px] text-zinc-500">
              Showing <span className="text-zinc-300 tabular">1-{filteredTeam.length}</span> of <span className="text-zinc-300 tabular">{team.length}</span> members
            </div>
          </div>
        </TabsContent>

        {/* ---- Budget ---- */}
        <TabsContent value="budget" className="mt-6 space-y-4" data-testid="budget-panel">
          {(() => {
            const spent = Number(p.actualSpend || 0);
            const cap = Number(p.approvedBudget || 0);
            const remaining = Number(p.remaining || (cap - spent));
            const utilPct = cap > 0 ? Math.round((spent / cap) * 100) : 0;
            const remainingPct = cap > 0 ? Math.round((remaining / cap) * 100) : 0;
            const budgetCount = (p.phases || []).length || 1;
            const burnRate = Number(p.burnRate || 0);
            const runwayDays = burnRate > 0 && remaining > 0 ? Math.floor(remaining / burnRate) : 0;
            // Scale portfolio DAILY_ACTIVITY to this project's proportion for a per-project daily-burn series
            const scale = cap > 0 ? Math.min(1, cap / 250000) : 0.05;
            const burnSeries = DAILY_ACTIVITY.slice(-15).map((d) => ({
              date: d.date.slice(5),
              total: Math.round(d.spend * scale),
            }));
            return (
              <>
                <div>
                  <h2 className="font-display font-semibold text-xl text-white">Budget</h2>
                  <p className="text-xs text-zinc-500 mt-0.5">Budget usage and forecast for this project.</p>
                </div>

                {/* KPI grid — Spent/Cap card spans 2 rows */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div
                    className="md:row-span-2 rounded-2xl border border-fuchsia-500/30 bg-gradient-to-br from-fuchsia-500/[0.14] via-fuchsia-500/[0.05] to-transparent p-5 flex flex-col justify-between min-h-[220px]"
                    data-testid="budget-kpi-spent-cap"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] uppercase tracking-widest font-semibold text-fuchsia-200">Spent / Cap</span>
                        {cap === 0 && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[9px] font-semibold bg-fuchsia-500/20 text-fuchsia-200 border border-fuchsia-500/30">No Budget</span>
                        )}
                      </div>
                      <div className="mt-4 font-display font-semibold text-white text-3xl tabular leading-tight">
                        {fmtCurrency(spent, { compact: false })}
                        <span className="text-fuchsia-200/60 text-xl"> / {fmtCurrency(cap, { compact: false })}</span>
                      </div>
                    </div>
                    <div className="mt-6">
                      <div className="h-2 rounded-full bg-white/[0.08] overflow-hidden">
                        <div
                          className={`h-full transition-all ${utilPct >= 100 ? "bg-red-400" : utilPct >= 90 ? "bg-amber-400" : "bg-fuchsia-400"}`}
                          style={{ width: `${Math.min(utilPct, 100)}%` }}
                          data-testid="budget-kpi-spent-cap-bar"
                        />
                      </div>
                      <div className="mt-2 text-[11px] text-fuchsia-200/70">
                        {cap === 0 ? "awaiting budget setup" : `${utilPct}% consumed · ${fmtCurrency(remaining, { compact: false })} left`}
                      </div>
                    </div>
                  </div>

                  <MiniKpi testid="budget-kpi-count" label="Budget Count" value={String(budgetCount)} />
                  <MiniKpi testid="budget-kpi-total" label="Total Budget" value={fmtCurrency(cap, { compact: false })} sub={`${cap > 0 ? "100" : "0"}%`} />
                  <MiniKpi testid="budget-kpi-consumed" label="Total Consumed" value={fmtCurrency(spent, { compact: false })} sub={`${utilPct}%`} accent={utilPct >= 90 ? "text-red-300" : "text-white"} />
                  <MiniKpi testid="budget-kpi-remaining" label="Total Remaining" value={fmtCurrency(remaining, { compact: false })} sub={`${remainingPct}%`} accent={remaining >= 0 ? "text-emerald-300" : "text-red-300"} />
                  <MiniKpi testid="budget-kpi-burn-rate" label="Daily Burn Rate" value={fmtCurrency(burnRate, { compact: false })} sub={cap > 0 ? `${Math.round((burnRate / cap) * 100 * 100) / 100}% of cap/day` : "0%"} />
                  <MiniKpi testid="budget-kpi-runway" label="Runway Days" value={String(runwayDays)} sub={burnRate > 0 ? "at current burn" : "—"} />
                </div>

                {/* Daily Burn rate chart */}
                <div className="bg-[#12121A] rounded-2xl border border-white/5 p-5" data-testid="daily-burn-rate-chart">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="font-display font-semibold text-[15px] text-white">Daily Burn rate</div>
                      <div className="text-xs text-zinc-500 mt-0.5">Last 15 days · per-project daily consumption</div>
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] text-zinc-400">
                      <span className="w-2 h-2 rounded-full bg-fuchsia-400" />
                      Total
                    </div>
                  </div>
                  <div className="h-[240px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={burnSeries}>
                        <defs>
                          <linearGradient id={`brn-${p.id}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#E619B8" stopOpacity={0.35} />
                            <stop offset="100%" stopColor="#E619B8" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#1F1F2A" />
                        <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#71717A" }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 10, fill: "#71717A" }} axisLine={false} tickLine={false} tickFormatter={(v) => (v >= 1000 ? `$${(v / 1000).toFixed(1)}k` : `$${v}`)} />
                        <Tooltip contentStyle={{ background: "#12121A", border: "1px solid #26262F", borderRadius: 12 }} formatter={(v) => fmtCurrency(v, { compact: false })} />
                        <Area type="monotone" dataKey="total" name="Total" stroke="#E619B8" strokeWidth={2.5} fill={`url(#brn-${p.id})`} dot={{ r: 3, fill: "#E619B8" }} activeDot={{ r: 5 }} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Burn per phase table */}
                <div className="bg-[#12121A] rounded-2xl border border-white/5 p-5" data-testid="burn-per-phase-table">
                  <div className="mb-3">
                    <div className="font-display font-semibold text-[15px] text-white">Burn per phase</div>
                    <div className="text-xs text-zinc-500 mt-0.5">Batch-level breakdown of tasks, burn, approval, and feedback</div>
                  </div>
                  {(p.phases || []).length === 0 ? (
                    <div className="text-xs text-zinc-500 py-6 text-center">No phases defined yet.</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500 border-b border-white/5">
                            <th className="text-left py-2 px-3">Batch</th>
                            <th className="text-right py-2 px-3">Videos</th>
                            <th className="text-right py-2 px-3">Burn</th>
                            <th className="text-right py-2 px-3">Approval</th>
                            <th className="text-left py-2 px-3">Feedback</th>
                            <th className="w-10" />
                          </tr>
                        </thead>
                        <tbody>
                          {(p.phases || []).map((ph) => {
                            const videos = Number(ph.totalTasks || ph.tasks || 0);
                            const burn = Number(ph.actual || 0);
                            const est = Number(ph.estimated || 0);
                            const apprPct = est > 0 ? Math.round((burn / est) * 100) : 0;
                            const fbTone = ph.health === "healthy" ? "text-emerald-300 bg-emerald-500/15 border-emerald-500/30"
                              : ph.health === "warning" ? "text-amber-300 bg-amber-500/15 border-amber-500/30"
                              : "text-red-300 bg-red-500/15 border-red-500/30";
                            return (
                              <tr key={ph.id} data-testid={`burn-phase-${ph.id}`} className="border-b border-white/5 last:border-0 hover:bg-white/[0.03]">
                                <td className="py-3 px-3 text-white font-medium">{ph.name}</td>
                                <td className="py-3 px-3 text-right tabular text-zinc-200">{videos || "—"}</td>
                                <td className="py-3 px-3 text-right tabular text-white font-semibold">{fmtCurrency(burn, { compact: false })}</td>
                                <td className="py-3 px-3 text-right tabular">
                                  <span className={apprPct >= 100 ? "text-red-300" : apprPct >= 90 ? "text-amber-300" : "text-emerald-300"}>{apprPct}%</span>
                                </td>
                                <td className="py-3 px-3">
                                  <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold border capitalize ${fbTone}`}>{ph.health || "healthy"}</span>
                                </td>
                                <td className="py-3 px-3 text-right">
                                  <Link to={`/projects/${p.id}/phase/${ph.id}`} className="text-zinc-500 hover:text-fuchsia-300 inline-flex">
                                    <ChevronRight className="w-4 h-4" />
                                  </Link>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Top-up requests (kept — accessible from within the specific project) */}
                <div className="bg-[#12121A] rounded-2xl border border-white/5 p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <ArrowUpRightSquare className="w-4 h-4 text-fuchsia-300" />
                      <div className="font-display font-semibold text-[15px] text-white">Top-up requests</div>
                    </div>
                    {isTPM && (
                      <Button size="sm" onClick={() => setTopupOpen(true)} className="h-8 rounded-md bg-fuchsia-500/15 hover:bg-fuchsia-500/25 border border-fuchsia-500/25 text-fuchsia-300 text-xs gap-1" data-testid="btn-raise-topup-project">
                        <Plus className="w-3 h-3" /> Raise top-up
                      </Button>
                    )}
                  </div>
                  {projectTopups.length === 0 ? (
                    <div className="text-xs text-zinc-500 py-4 text-center">No top-ups raised for this project.</div>
                  ) : (
                    <div className="space-y-2">
                      {projectTopups.map((r) => {
                        const st = statusMap[r.status] || statusMap["pending-cto"];
                        return (
                          <Link to={`/topup-requests/${r.id}`} key={r.id} className="flex items-center gap-3 p-3 rounded-lg border border-white/5 hover:border-fuchsia-500/25 bg-white/[0.02]">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold border ${st.cls}`}>
                              <st.Icon className="w-3 h-3" /> {st.label}
                            </span>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm text-white font-medium">{r.phaseName}</div>
                              <div className="text-[11px] text-zinc-500 line-clamp-1">{r.reason}</div>
                            </div>
                            <div className="text-right">
                              <div className="text-xs text-zinc-500">Requested</div>
                              <div className="text-sm text-white font-semibold tabular">{fmtCurrency(r.amount, { compact: false })}</div>
                            </div>
                            <ChevronRight className="w-4 h-4 text-zinc-500" />
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            );
          })()}
        </TabsContent>

        {/* ---- Tasks ---- */}
        <TabsContent value="tasks" className="mt-6" data-testid="tasks-panel">
          <div className="bg-[#12121A] rounded-2xl border border-white/5 p-5">
            <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
              <div>
                <div className="font-display font-semibold text-[15px] text-white flex items-center gap-2">
                  <ListChecks className="w-4 h-4 text-fuchsia-300" /> Daily task log
                  <span className="text-xs text-zinc-500 font-normal">({allLogs.length})</span>
                </div>
                <div className="text-xs text-zinc-500 mt-0.5">Logged by TPM · visible to CTO &amp; CFO · editable within 24 hours</div>
              </div>
              {isTPM && p.phases?.[0] && (
                <Button
                  size="sm"
                  onClick={() => { setEditingLog(null); setTaskLogPhase(p.phases[0]); }}
                  data-testid="btn-log-task"
                  className="h-8 rounded-lg bg-fuchsia-500 hover:bg-fuchsia-600 text-white gap-1.5 shadow-[0_0_20px_rgba(232,25,184,0.35)]"
                >
                  <Plus className="w-3.5 h-3.5" /> Log task
                </Button>
              )}
            </div>

            {allLogs.length === 0 ? (
              <div className="rounded-lg border border-dashed border-white/10 bg-white/[0.02] p-8 text-center text-xs text-zinc-500">
                {isTPM ? "No tasks logged yet. Use the Batch tab to log daily tasks per phase." : "No TPM logs for this project yet."}
              </div>
            ) : (
              <>
              {/* Phase-wise progress bars */}
              {(p.phases || []).some((ph) => Number(ph.totalTasks || ph.tasks || 0) > 0) && (
                <div className="mb-4 grid grid-cols-1 md:grid-cols-2 gap-2" data-testid="phase-progress-grid">
                  {(p.phases || []).map((ph) => {
                    const planned = Number(ph.totalTasks || ph.tasks || 0);
                    if (planned <= 0) return null;
                    const logs = getPhaseLogs(p.id, ph.id);
                    const done = logs.reduce((s, l) => s + (Number(l.tasksDone) || 0), 0);
                    const pct = planned ? Math.min(100, Math.round((done / planned) * 100)) : 0;
                    return (
                      <div key={ph.id} data-testid={`phase-progress-${ph.id}`} className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
                        <div className="flex items-center justify-between text-[11px] mb-1.5">
                          <span className="text-white font-medium">{ph.name}</span>
                          <span className="text-zinc-500 tabular"><span className="text-white font-semibold">{done.toLocaleString()}</span> / {planned.toLocaleString()} · <span className="text-fuchsia-300 font-semibold">{pct}%</span></span>
                        </div>
                        <div className="h-2 rounded-full bg-white/[0.05] overflow-hidden">
                          <div className={`h-full transition-all ${pct >= 100 ? "bg-emerald-500" : "bg-fuchsia-500"}`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500 border-b border-white/5">
                      <th className="text-left py-2 px-3">Task</th>
                      <th className="text-left py-2 px-3">Phase</th>
                      <th className="text-left py-2 px-3">Assignee</th>
                      <th className="text-right py-2 px-3">Tasks Done</th>
                      <th className="text-right py-2 px-3">Est. cost</th>
                      <th className="text-left py-2 px-3">Date</th>
                      {isTPM && <th className="text-right py-2 px-3">Actions</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {allLogs.map((l) => {
                      const editable = isTaskEditable(l);
                      return (
                        <tr key={l.id} data-testid={`task-row-${l.id}`} className="border-b border-white/5 last:border-0 hover:bg-white/[0.03]">
                          <td className="py-3 px-3">
                            <div className="text-white font-medium">{l.name}</div>
                            {l.notes && <div className="text-[11px] text-zinc-500 line-clamp-1 mt-0.5">{l.notes}</div>}
                          </td>
                          <td className="py-3 px-3 text-xs text-fuchsia-300">{l.phaseName}</td>
                          <td className="py-3 px-3 text-xs text-zinc-300">
                            <span className="inline-flex items-center gap-1"><UserIcon className="w-3 h-3 text-zinc-500" /> {l.assignee}</span>
                          </td>
                          <td className="py-3 px-3 text-right tabular text-white font-semibold">{Number(l.tasksDone || 0).toLocaleString()}</td>
                          <td className="py-3 px-3 text-right tabular text-white font-semibold">{fmtCurrency(l.cost, { compact: false })}</td>
                          <td className="py-3 px-3 text-xs text-zinc-400 tabular">{l.date}</td>
                          {isTPM && (
                            <td className="py-3 px-3 text-right">
                              {editable ? (
                                <div className="inline-flex items-center gap-0.5 justify-end">
                                  <button
                                    onClick={() => { setEditingLog(l); setTaskLogPhase(p.phases.find((ph) => ph.id === l.phaseId)); }}
                                    data-testid={`task-edit-${l.id}`}
                                    className="w-7 h-7 rounded-md hover:bg-fuchsia-500/15 text-zinc-500 hover:text-fuchsia-300 flex items-center justify-center"
                                    title="Edit (within 24h)"
                                  >
                                    <Pencil className="w-3 h-3" />
                                  </button>
                                  <button
                                    onClick={() => {
                                      if (!isTaskEditable(l)) { toast.error("Task log is locked (>24h)"); return; }
                                      deletePhaseTask(p.id, l.phaseId, l.id);
                                      toast.success("Task log deleted");
                                    }}
                                    data-testid={`task-delete-${l.id}`}
                                    className="w-7 h-7 rounded-md hover:bg-red-500/15 text-zinc-500 hover:text-red-300 flex items-center justify-center"
                                    title="Delete (within 24h)"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              ) : (
                                <span className="text-[10px] text-zinc-600 inline-flex items-center gap-0.5"><Lock className="w-2.5 h-2.5" /> locked</span>
                              )}
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              </>
            )}
          </div>
        </TabsContent>

        {/* ---- Batch ---- */}
        <TabsContent value="batch" className="mt-6" data-testid="batch-panel">
          <div className="space-y-3">
            {(p.phases || []).length === 0 && (
              <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-12 text-center text-xs text-zinc-500">
                No phases defined yet. Use Budget Builder to add phases.
              </div>
            )}
            {(role === "R&D" ? (p.phases || []).slice(0, 1) : (p.phases || [])).map((ph) => {
              const delivery = projectBatches.find((b) => b.phaseId === ph.id);
              const topupsForPhase = projectTopups.filter((r) => r.phaseId === ph.id);
              const variance = ph.estimated - ph.actual;
              const util = ph.estimated ? Math.round((ph.actual / ph.estimated) * 100) : 0;
              const hc = healthColor(ph.health);
              const logs = getPhaseLogs(p.id, ph.id);
              return (
                <div key={ph.id} data-testid={`batch-phase-${ph.id}`} className="bg-[#12121A] rounded-2xl border border-white/5 p-5">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-fuchsia-500/10 text-fuchsia-300 border border-fuchsia-500/25">
                          <Layers className="w-3 h-3" /> {ph.name}
                        </span>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${hc.text} ${hc.bg} ${hc.border}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${hc.dot}`} /> {hc.label}
                        </span>
                        {delivery && (
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold border ${(statusMap[delivery.status] || statusMap["pending-cfo"]).cls}`}>
                            <PackageCheck className="w-3 h-3" /> {(statusMap[delivery.status] || statusMap["pending-cfo"]).label}
                          </span>
                        )}
                      </div>
                      <div className="mt-2 text-xs text-zinc-500 tabular">{ph.dates}</div>
                      <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2">
                        <MiniStat label="Estimated" value={fmtCurrency(ph.estimated, { compact: false })} />
                        <MiniStat label="Actual" value={fmtCurrency(ph.actual, { compact: false })} tone="magenta" />
                        <MiniStat label="Variance" value={`${variance > 0 ? "+" : ""}${fmtCurrency(variance, { compact: false })}`} tone={variance >= 0 ? "emerald" : "red"} />
                        <MiniStat label="Utilization" value={fmtPct(util)} tone={util >= 90 ? "warning" : "emerald"} />
                      </div>
                    </div>
                    {isTPM && (
                      <div className="flex items-center gap-2 flex-wrap">
                        <Button
                          size="sm"
                          onClick={() => { setEditingLog(null); setTaskLogPhase(ph); }}
                          data-testid={`btn-log-task-${ph.id}`}
                          className="h-8 rounded-md bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-zinc-200 text-xs gap-1"
                        >
                          <Plus className="w-3 h-3" /> Log task
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => setTopupOpen(true)}
                          data-testid={`btn-topup-${ph.id}`}
                          className="h-8 rounded-md bg-fuchsia-500/15 hover:bg-fuchsia-500/25 border border-fuchsia-500/25 text-fuchsia-300 text-xs gap-1"
                        >
                          <ArrowUpRightSquare className="w-3 h-3" /> Top-up
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => setDeliverPhase(ph)}
                          disabled={!!delivery}
                          data-testid={`btn-deliver-${ph.id}`}
                          className="h-8 rounded-md bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-500/25 disabled:text-emerald-200 text-white text-xs gap-1"
                        >
                          <PackageCheck className="w-3 h-3" /> {delivery ? "Delivered" : "Deliver batch"}
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Sub-lists: logs + top-ups + delivery status */}
                  <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
                    <SubList
                      title={`Tasks (${logs.length})`}
                      icon={FileText}
                      empty={logs.length === 0 ? "No tasks logged." : null}
                      testid={`sub-logs-${ph.id}`}
                    >
                      {logs.slice(0, 3).map((l) => (
                        <div key={l.id} className="p-2 rounded-md bg-white/[0.02] border border-white/5">
                          <div className="text-[11px] text-white font-medium truncate">{l.name}</div>
                          <div className="text-[10px] text-zinc-500 tabular">{l.assignee} · {l.hours}h · {fmtCurrency(l.cost, { compact: false })}</div>
                        </div>
                      ))}
                      {logs.length > 3 && <div className="text-[10px] text-zinc-500 pl-1">+{logs.length - 3} more</div>}
                    </SubList>

                    <SubList
                      title={`Top-ups (${topupsForPhase.length})`}
                      icon={ArrowUpRightSquare}
                      empty={topupsForPhase.length === 0 ? "No top-ups for this phase." : null}
                      testid={`sub-topups-${ph.id}`}
                    >
                      {topupsForPhase.map((r) => {
                        const st = statusMap[r.status] || statusMap["pending-cto"];
                        return (
                          <Link to={`/topup-requests/${r.id}`} key={r.id} className="block p-2 rounded-md bg-white/[0.02] border border-white/5 hover:border-fuchsia-500/25">
                            <div className="flex items-center justify-between gap-2">
                              <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-semibold border ${st.cls}`}>
                                <st.Icon className="w-2.5 h-2.5" /> {st.label}
                              </span>
                              <span className="text-[11px] text-white tabular font-semibold">{fmtCurrency(r.amount, { compact: false })}</span>
                            </div>
                          </Link>
                        );
                      })}
                    </SubList>

                    <SubList
                      title="Delivery"
                      icon={PackageCheck}
                      empty={!delivery ? "Not delivered yet." : null}
                      testid={`sub-delivery-${ph.id}`}
                    >
                      {delivery && (
                        <div className="p-2 rounded-md bg-emerald-500/[0.05] border border-emerald-500/20 space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] text-zinc-400">Proposed</span>
                            <span className="text-[11px] text-white font-semibold tabular">{fmtCurrency(delivery.proposedAmount, { compact: false })}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] text-zinc-400">Recovered</span>
                            <span className={`text-[11px] font-semibold tabular ${delivery.actualRecovered != null ? "text-emerald-300" : "text-zinc-500"}`}>
                              {delivery.actualRecovered != null ? fmtCurrency(delivery.actualRecovered, { compact: false }) : "Awaiting CFO"}
                            </span>
                          </div>
                          {delivery.clientComment && (
                            <div className="text-[10px] text-zinc-300 leading-relaxed pt-1 border-t border-white/5 line-clamp-3">
                              <span className="text-emerald-200 font-semibold">Client: </span>{delivery.clientComment}
                            </div>
                          )}
                        </div>
                      )}
                    </SubList>
                  </div>
                </div>
              );
            })}
          </div>
        </TabsContent>

        {/* ---- Logs ---- */}
        <TabsContent value="logs" className="mt-6" data-testid="logs-panel">
          <div className="bg-[#12121A] rounded-2xl border border-white/5 p-5">
            <div className="flex items-center gap-2 mb-4">
              <ScrollText className="w-4 h-4 text-fuchsia-300" />
              <div className="font-display font-semibold text-[15px] text-white">Activity &amp; audit log</div>
            </div>
            <div className="space-y-3">
              {(p.auditLog || []).length === 0 && (
                <div className="text-xs text-zinc-500 text-center py-6">No activity yet.</div>
              )}
              {(p.auditLog || []).map((a) => (
                <div key={a.id} data-testid={`audit-${a.id}`} className="flex items-start gap-3 p-3 rounded-lg border border-white/5 bg-white/[0.02]">
                  <div className="w-7 h-7 rounded-full bg-fuchsia-500/15 border border-fuchsia-500/25 flex items-center justify-center flex-shrink-0">
                    <MessageSquare className="w-3.5 h-3.5 text-fuchsia-300" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap text-xs">
                      <span className="text-white font-semibold">{a.action}</span>
                      <span className="text-zinc-500">·</span>
                      <span className="text-zinc-300">{a.actor}</span>
                      <span className="text-zinc-500 tabular ml-auto">{fmtDate(a.ts)}</span>
                    </div>
                    {a.detail && <div className="text-[11px] text-zinc-400 mt-1 leading-relaxed">{a.detail}</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <TopupRequestDialog open={topupOpen} onOpenChange={setTopupOpen} project={p} />
      <DeliverBatchDialog
        open={!!deliverPhase}
        onOpenChange={(o) => !o && setDeliverPhase(null)}
        project={p}
        phase={deliverPhase}
      />
      <TpmTaskLogDialog
        open={!!taskLogPhase}
        onOpenChange={(o) => { if (!o) { setTaskLogPhase(null); setEditingLog(null); } }}
        project={p}
        phase={taskLogPhase}
        editingLog={editingLog}
      />
    </div>
  );
};

const TabTrigger = ({ value, icon: Icon, label, testid }) => (
  <TabsTrigger
    value={value}
    data-testid={testid}
    className="relative text-sm text-zinc-400 hover:text-zinc-100 data-[state=active]:text-fuchsia-300 data-[state=active]:bg-transparent gap-2 px-2 pb-3 pt-1 rounded-none data-[state=active]:shadow-none data-[state=active]:after:content-[''] data-[state=active]:after:absolute data-[state=active]:after:-bottom-px data-[state=active]:after:left-0 data-[state=active]:after:right-0 data-[state=active]:after:h-0.5 data-[state=active]:after:bg-fuchsia-500"
  >
    <Icon className="w-3.5 h-3.5" /> {label}
  </TabsTrigger>
);

const StatBlock = ({ label, value, hint, tone = "neutral", icon: Icon }) => {
  const tones = { positive: "text-emerald-300", negative: "text-red-300", warning: "text-amber-300", neutral: "text-white", magenta: "text-fuchsia-300" };
  return (
    <div className="bg-[#12121A] rounded-2xl border border-white/10 p-5">
      <div className="flex items-center justify-between">
        <div className="text-[10px] uppercase font-semibold tracking-widest text-zinc-500">{label}</div>
        {Icon && (
          <div className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center">
            <Icon className={`w-3.5 h-3.5 ${tones[tone]}`} />
          </div>
        )}
      </div>
      <div className={`mt-2 font-display font-semibold text-2xl tabular ${tones[tone]}`}>{value}</div>
      {hint && <div className="text-xs text-zinc-500 mt-1">{hint}</div>}
    </div>
  );
};

const MiniStat = ({ label, value, tone = "neutral" }) => {
  const tones = { emerald: "text-emerald-300", magenta: "text-fuchsia-300", warning: "text-amber-300", red: "text-red-300", neutral: "text-white" };
  return (
    <div className="rounded-lg border border-white/5 bg-white/[0.02] p-2.5">
      <div className="text-[9px] uppercase tracking-widest font-semibold text-zinc-500">{label}</div>
      <div className={`mt-0.5 text-sm font-semibold tabular ${tones[tone]}`}>{value}</div>
    </div>
  );
};

// KPI card used in the Budget tab redesign (Spent/Cap + smaller stat cells)
const MiniKpi = ({ label, value, sub, accent = "text-white", testid }) => (
  <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-4" data-testid={testid}>
    <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500">{label}</div>
    <div className={`mt-2 font-display text-2xl font-semibold tabular ${accent}`}>{value}</div>
    {sub && <div className="text-[11px] text-zinc-500 mt-1 tabular">{sub}</div>}
  </div>
);

const SubList = ({ title, icon: Icon, children, empty, testid }) => (
  <div className="rounded-lg border border-white/5 bg-white/[0.02] p-3" data-testid={testid}>
    <div className="flex items-center gap-1.5 mb-2 text-[10px] uppercase tracking-widest font-semibold text-zinc-500">
      <Icon className="w-3 h-3" /> {title}
    </div>
    {empty ? <div className="text-[11px] text-zinc-600 italic">{empty}</div> : <div className="space-y-1.5">{children}</div>}
  </div>
);

export default ProjectDetail;
