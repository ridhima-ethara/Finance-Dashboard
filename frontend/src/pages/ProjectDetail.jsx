import { useState, useMemo } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { fmtCurrency, fmtPct, fmtDate, healthColor } from "../lib/format";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";
import { Button } from "../components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../components/ui/dropdown-menu";
import {
  ArrowLeft, Sparkles, Lock, ArrowUpRightSquare, Users, Wallet, ListChecks, PackageCheck, ScrollText,
  Search, Plus, ChevronRight, User as UserIcon, Circle, CheckCircle2, Clock3, XCircle, Percent,
  Trash2, Pencil, FileText, Layers, MessageSquare, Shield, Mail,
} from "lucide-react";
import { useApp } from "../context/AppContext";
import { isTpmView } from "../lib/roles";
import { toast } from "sonner";
import { TEAM } from "../data/mockUsers";
import { BUDGET_REVIEWS, CHANGE_REQUESTS, getPhaseTasks } from "../data/mockTpm";
import TopupRequestDialog from "../components/TopupRequestDialog";
import DeliverBatchDialog from "../components/DeliverBatchDialog";
import TpmTaskLogDialog from "../components/TpmTaskLogDialog";
import { DAILY_ACTIVITY } from "../data/mockAi";
import { ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, Area, AreaChart } from "recharts";
import { buildBudgetTracks, formatBudgetTypeLabel, summarizeLoggedProject } from "../lib/projectMetrics";

// Deterministic seed of team members per project — uses project id hash for stability.
const seedTeam = (project) => {
  if (!project) return [];
  if (Array.isArray(project.teamMembers) && project.teamMembers.length) {
    return project.teamMembers.map((member, index) => ({
      id: member.id || `${project.id}-tm-${index + 1}`,
      name: member.name,
      role: member.role || (member.name === project.tpm ? "TPM" : "R&D"),
      email: member.email || `${member.name.toLowerCase().replace(/\s+/g, ".")}@ethara.ai`,
      status: member.status || (index === 0 ? "Online" : "Pending kickoff"),
      tasksDone: Number(member.tasksDone || 0),
    }));
  }
  const explicitMembers = (project.rndMembers || [])
    .map((name) => TEAM.find((member) => member.name === name) || { name, role: "R&D", email: `${name.toLowerCase().replace(/\s+/g, ".")}@ethara.ai` });
  const roster = [
    { name: project.tpm || "Arjun Mehta", role: "TPM", email: `${(project.tpm || "arjun").toLowerCase().split(" ")[0]}@ethara.ai` },
    { name: project.pl || "Aanya Sharma", role: "Project Lead", email: `${(project.pl || "aanya").toLowerCase().split(" ")[0]}@ethara.ai` },
    ...explicitMembers,
    ...TEAM.filter((m) => m.role === "Engineer" || m.role === "Project Lead").slice(0, Math.max(0, 2 - explicitMembers.length)),
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
  "non-recoverable": { label: "Non-recoverable", cls: "bg-zinc-500/15 text-zinc-300 border-zinc-500/30", Icon: Lock },
  "changes-requested": { label: "Changes requested", cls: "bg-amber-500/15 text-amber-300 border-amber-500/30", Icon: ChevronRight },
  "sample-approved": { label: "Sample accepted", cls: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30", Icon: CheckCircle2 },
  "sample-rejected": { label: "Sample rejected", cls: "bg-red-500/15 text-red-300 border-red-500/30", Icon: XCircle },
};

const ProjectDetail = () => {
  const { id } = useParams();
  const nav = useNavigate();
  const {
    setAiOpen, projects, role, topupRequests, batchDeliveries, budgets, budgetReviews, teamRemovals,
    removeProjectTeamMember, getPhaseLogs, isTaskEditable, deletePhaseTask, taskLogs,
  } = useApp();
  const p = projects.find((x) => x.id === id);
  const isTPM = isTpmView(role);
  const isCFO = role === "CFO";
  const isRndProject = p?.type === "R&D";
  const showRndBudgetTracks = isRndProject && role === "R&D";

  const [topupOpen, setTopupOpen] = useState(false);
  const [topupPhaseId, setTopupPhaseId] = useState("");
  const [deliverPhase, setDeliverPhase] = useState(null); // {project, phase} or null
  const [taskLogPhase, setTaskLogPhase] = useState(null); // phase for log dialog
  const [editingLog, setEditingLog] = useState(null);
  const [teamSearch, setTeamSearch] = useState("");
  const [selectedPhaseId, setSelectedPhaseId] = useState(() => p?.phases?.[0]?.id || "");

  const team = useMemo(() => {
    const removedTeamIds = teamRemovals[p?.id] || [];
    return seedTeam(p).filter((member) => !removedTeamIds.includes(member.id));
  }, [p, teamRemovals]);
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
  const projectBudgetRequests = useMemo(
    () => buildProjectBudgetRequests({ projectId: id, submittedBudgets: budgets, liveBudgetReviews: budgetReviews, seedBudgetReviews: BUDGET_REVIEWS }),
    [id, budgets, budgetReviews]
  );
  const budgetTracks = useMemo(() => buildBudgetTracks(p, budgets), [p, budgets]);
  const projectUsage = useMemo(() => summarizeLoggedProject(p, taskLogs), [p, taskLogs]);
  const projectChangeRequests = useMemo(() => CHANGE_REQUESTS.filter((request) => request.projectId === id), [id]);
  const selectedPhase = useMemo(
    () => (p?.phases || []).find((phase) => phase.id === selectedPhaseId) || p?.phases?.[0] || null,
    [p, selectedPhaseId]
  );
  const selectedPhaseTopups = useMemo(
    () => (selectedPhase ? projectTopups.filter((request) => request.phaseId === selectedPhase.id) : []),
    [projectTopups, selectedPhase]
  );
  const selectedPhaseChanges = useMemo(
    () => (selectedPhase ? projectChangeRequests.filter((request) => matchesPhaseLabel(request.affectedPhase, selectedPhase)) : []),
    [projectChangeRequests, selectedPhase]
  );
  const selectedPhaseBudgetItems = useMemo(
    () => (selectedPhase ? projectBudgetRequests.filter((request) => requestMatchesPhase(request, selectedPhase)) : []),
    [projectBudgetRequests, selectedPhase]
  );
  const selectedPhaseLogs = useMemo(
    () => (selectedPhase ? getPhaseLogs(p.id, selectedPhase.id) : []),
    [selectedPhase, getPhaseLogs, p]
  );
  const selectedPhaseDelivery = useMemo(
    () => (selectedPhase ? projectBatches.find((batch) => batch.phaseId === selectedPhase.id) || null : null),
    [selectedPhase, projectBatches]
  );
  const batchPhases = useMemo(() => (role === "R&D" ? (p?.phases || []).slice(0, 1) : (p?.phases || [])), [p?.phases, role]);
  const activeBatchPhaseId = useMemo(() => {
    const editable = batchPhases.find((phase) => {
      const delivery = projectBatches.find((entry) => entry.phaseId === phase.id);
      return !delivery || delivery.status === "changes-requested";
    });
    return editable?.id || null;
  }, [batchPhases, projectBatches]);

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
  const projectDocs = (Array.isArray(p.docs) && p.docs.length)
    ? p.docs
    : p.docUrl
      ? [{ id: `${p.id}-legacy-doc`, name: "Project brief link", url: p.docUrl, kind: "link" }]
      : [];
  const kickoffRecipients = p.kickoffMail?.recipients || team;
  const kickoffSentAt = p.kickoffMail?.sentAt
    ? new Date(p.kickoffMail.sentAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })
    : null;

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
              <Button size="sm" onClick={() => { setTopupPhaseId(""); setTopupOpen(true); }} className="h-9 rounded-lg bg-fuchsia-500 hover:bg-fuchsia-600 gap-2" data-testid="btn-request-topup">
                <ArrowUpRightSquare className="w-3.5 h-3.5" /> Request top-up
              </Button>
            )}
            {isCFO && (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold bg-white/[0.04] border border-white/10 text-zinc-300" data-testid="cfo-readonly-badge">
                <Lock className="w-3 h-3" /> Finance view
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="bg-[#12121A] rounded-2xl border border-white/5 p-4" data-testid="project-setup-grid">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <div className="font-display font-semibold text-[15px] text-white">Project setup summary</div>
            <div className="text-xs text-zinc-500 mt-0.5">Docs, kickoff, and member roster are kept compact here; full member detail stays in the Team tab.</div>
          </div>
          {projectDocs[0]?.url && (
            <a href={projectDocs[0].url} target="_blank" rel="noreferrer" className="text-xs text-fuchsia-300 hover:text-fuchsia-200 inline-flex items-center gap-1">
              Open primary doc <ChevronRight className="w-3 h-3" />
            </a>
          )}
        </div>
        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
          <CompactSetupStat
            title="Docs & attachments"
            value={String(projectDocs.length)}
            meta={projectDocs[0]?.name || "No docs added"}
            icon={FileText}
          />
          <CompactSetupStat
            title="Kickoff mail"
            value={kickoffSentAt ? "Sent" : "Pending"}
            meta={kickoffSentAt || `${kickoffRecipients.length} recipient${kickoffRecipients.length === 1 ? "" : "s"}`}
            icon={Mail}
          />
          <CompactSetupStat
            title="Assigned members"
            value={String(team.length)}
            meta={team.slice(0, 3).map((member) => member.name).join(", ") || "No members yet"}
            icon={Users}
          />
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
                <Button
                  size="sm"
                  onClick={() => nav(`/budget-builder?projectId=${p.id}`)}
                  data-testid="btn-add-member"
                  className="h-9 rounded-lg bg-fuchsia-500 hover:bg-fuchsia-600 text-white gap-1.5 shadow-[0_0_20px_rgba(232,25,184,0.35)]"
                >
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
                  <th className="text-right py-3 px-5 w-14">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredTeam.length === 0 && (
                  <tr><td colSpan="4" className="py-6 text-center text-xs text-zinc-500">No team members match.</td></tr>
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
                    <td className="py-3 px-5 text-right text-zinc-500">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="w-7 h-7 rounded-md hover:bg-white/[0.06] inline-flex items-center justify-center" title="Actions" data-testid={`team-actions-${m.id}`}>
                            <span className="inline-block w-1 h-1 rounded-full bg-current mx-0.5" />
                            <span className="inline-block w-1 h-1 rounded-full bg-current mx-0.5" />
                            <span className="inline-block w-1 h-1 rounded-full bg-current mx-0.5" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44 border-white/10 bg-[#12121A] text-zinc-200">
                          <DropdownMenuItem
                            onClick={() => {
                              removeProjectTeamMember(p.id, m.id);
                              toast.success("Team member removed", { description: `${m.name} removed from ${p.name}` });
                            }}
                            className="focus:bg-red-500/10 focus:text-red-300"
                            data-testid={`team-remove-${m.id}`}
                          >
                            <Trash2 className="w-3.5 h-3.5 text-red-300" />
                            Remove member
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
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
            const spent = Number(isCFO ? p.actualSpend || 0 : projectUsage.loggedSpend || 0);
            const cap = Number(p.approvedBudget || 0);
            const remaining = Number(isCFO ? (p.remaining || (cap - spent)) : (projectUsage.remainingBudget || (cap - spent)));
            const utilPct = cap > 0 ? Math.round((spent / cap) * 100) : 0;
            const remainingPct = cap > 0 ? Math.round((remaining / cap) * 100) : 0;
            const budgetCount = isRndProject ? Math.max(budgetTracks.entries.length, 1) : ((p.phases || []).length || 1);
            const burnRate = Number(isCFO ? (p.burnRate || 0) : (projectUsage.runRate || 0));
            const runwayDays = burnRate > 0 && remaining > 0 ? Math.floor(remaining / burnRate) : 0;
            const spendLabel = isCFO ? "Actual / Cap" : "Logged / Cap";
            const totalSpendLabel = isCFO ? "Total Actual" : "Total Logged";
            const latestBudgetEntry = budgetTracks.entries[0] || null;
            const totalTopupAmount = projectTopups.reduce((sum, request) => sum + getResolvedTopupAmount(request), 0);
            const totalChangeAmount = projectChangeRequests.reduce((sum, request) => sum + Number(request.amount || 0), 0);
            const currentBudgetEnvelope = cap + totalTopupAmount + totalChangeAmount;
            const seriesByDate = projectUsage.logs.reduce((map, log) => {
              if (!log.date) return map;
              map.set(log.date, (map.get(log.date) || 0) + Number(log.cost || 0));
              return map;
            }, new Map());
            const burnSeries = Array.from(seriesByDate.entries())
              .sort((left, right) => new Date(left[0]).getTime() - new Date(right[0]).getTime())
              .slice(-15)
              .map(([date, total]) => ({ date: date.slice(5), total }));
            const fallbackScale = cap > 0 ? Math.min(1, cap / 250000) : 0.05;
            const fallbackSeries = DAILY_ACTIVITY.slice(-15).map((day) => ({
              date: day.date.slice(5),
              total: Math.round(day.spend * fallbackScale),
            }));
            const displaySeries = burnSeries.length ? burnSeries : fallbackSeries;
            return (
              <>
                <div>
                  <h2 className="font-display font-semibold text-xl text-white">Budget</h2>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    {isCFO ? "Budget usage, approvals, and actuals for this project." : "Owned budget usage, logged spend, and delivery progress for this project."}
                  </p>
                </div>

                {/* KPI grid — Spent/Cap card spans 2 rows */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div
                    className="md:row-span-2 rounded-2xl border border-fuchsia-500/30 bg-gradient-to-br from-fuchsia-500/[0.14] via-fuchsia-500/[0.05] to-transparent p-5 flex flex-col justify-between min-h-[220px]"
                    data-testid="budget-kpi-spent-cap"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] uppercase tracking-widest font-semibold text-fuchsia-200">{spendLabel}</span>
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
                  <MiniKpi testid="budget-kpi-consumed" label={totalSpendLabel} value={fmtCurrency(spent, { compact: false })} sub={`${utilPct}%`} accent={utilPct >= 90 ? "text-red-300" : "text-white"} />
                  <MiniKpi testid="budget-kpi-remaining" label="Total Remaining" value={fmtCurrency(remaining, { compact: false })} sub={`${remainingPct}%`} accent={remaining >= 0 ? "text-emerald-300" : "text-red-300"} />
                  <MiniKpi testid="budget-kpi-burn-rate" label={isCFO ? "Daily Burn Rate" : "Daily Log Rate"} value={fmtCurrency(burnRate, { compact: false })} sub={cap > 0 ? `${Math.round((burnRate / cap) * 100 * 100) / 100}% of cap/day` : "0%"} />
                  <MiniKpi testid="budget-kpi-runway" label="Runway Days" value={String(runwayDays)} sub={burnRate > 0 ? "at current burn" : "—"} />
                </div>

                {/* Daily Burn rate chart */}
                <div className="bg-[#12121A] rounded-2xl border border-white/5 p-5" data-testid="daily-burn-rate-chart">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="font-display font-semibold text-[15px] text-white">{isCFO ? "Daily Burn rate" : "Daily logged spend"}</div>
                      <div className="text-xs text-zinc-500 mt-0.5">Last 15 days · per-project activity</div>
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] text-zinc-400">
                      <span className="w-2 h-2 rounded-full bg-fuchsia-400" />
                      Total
                    </div>
                  </div>
                  <div className="h-[240px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={displaySeries}>
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

                {!showRndBudgetTracks && (
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <MiniKpi
                      testid="budget-kpi-last-proposed"
                      label="Last Proposed Budget"
                      value={fmtCurrency(latestBudgetEntry?.total || 0, { compact: false })}
                      sub={latestBudgetEntry ? `${formatBudgetTypeLabel(latestBudgetEntry.budgetType)} · ${new Date(latestBudgetEntry.submittedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : "No budget submission yet"}
                    />
                    <MiniKpi
                      testid="budget-kpi-topups-total"
                      label="Top-ups Logged"
                      value={fmtCurrency(totalTopupAmount, { compact: false })}
                      sub={`${projectTopups.length} request${projectTopups.length === 1 ? "" : "s"}`}
                    />
                    <MiniKpi
                      testid="budget-kpi-changes-total"
                      label="Change Asks"
                      value={fmtCurrency(totalChangeAmount, { compact: false })}
                      sub={`${projectChangeRequests.length} change${projectChangeRequests.length === 1 ? "" : "s"}`}
                    />
                    <MiniKpi
                      testid="budget-kpi-current-envelope"
                      label="Current Budget Envelope"
                      value={fmtCurrency(currentBudgetEnvelope, { compact: false })}
                      sub="Budget + top-ups + changes"
                      accent="text-fuchsia-300"
                    />
                  </div>
                )}

                {showRndBudgetTracks ? (
                  <div className="bg-[#12121A] rounded-2xl border border-white/5 p-5" data-testid="rnd-budget-tracks">
                    <div className="mb-3">
                      <div className="font-display font-semibold text-[15px] text-white">Testing, R&amp;D, and rework budget tracks</div>
                      <div className="text-xs text-zinc-500 mt-0.5">Single-project view of submitted asks, tracked top-ups, and the current delivery target.</div>
                    </div>
                    {budgetTracks.ordered.length === 0 ? (
                      <div className="text-xs text-zinc-500 py-6 text-center">No Testing, R&amp;D, or Rework budget has been submitted yet.</div>
                    ) : (
                      <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
                        {budgetTracks.ordered.map((track) => (
                          <BudgetTrackCard
                            key={track.key}
                            track={track}
                            topupCount={projectTopups.length}
                            changeCount={projectChangeRequests.length}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="bg-[#12121A] rounded-2xl border border-white/5 p-5" data-testid="burn-per-phase-table">
                    <div className="mb-3">
                      <div className="font-display font-semibold text-[15px] text-white">{isTPM ? "Budget records by phase" : "Burn per phase"}</div>
                      <div className="text-xs text-zinc-500 mt-0.5">
                        {isTPM ? "Phase budget, logged progress, requested models, top-ups, changes, and the latest ask are connected here." : "Batch-level breakdown of tasks, burn, approval, and feedback."}
                      </div>
                    </div>
                    {(p.phases || []).length === 0 ? (
                      <div className="text-xs text-zinc-500 py-6 text-center">No phases defined yet.</div>
                    ) : (
                      <>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500 border-b border-white/5">
                                <th className="text-left py-2 px-3">Batch</th>
                                <th className="text-right py-2 px-3">Base budget</th>
                                <th className="text-right py-2 px-3">Current total</th>
                                <th className="text-right py-2 px-3">{isCFO ? "Actual" : "Logged"}</th>
                                <th className="text-left py-2 px-3">Progress</th>
                                <th className="text-left py-2 px-3">Models asked</th>
                                <th className="text-left py-2 px-3">Requests</th>
                                <th className="w-10" />
                              </tr>
                            </thead>
                            <tbody>
                              {(p.phases || []).map((ph) => {
                                const plannedTasks = Number(ph.totalTasks || ph.tasks || 0);
                                const phaseLogs = getPhaseLogs(p.id, ph.id);
                                const burn = isCFO
                                  ? Number(ph.actual || 0)
                                  : phaseLogs.reduce((sum, log) => sum + Number(log.cost || 0), 0);
                                const est = Number(ph.estimated || 0);
                                const apprPct = est > 0 ? Math.round((burn / est) * 100) : 0;
                                const isSelected = selectedPhase?.id === ph.id;
                                const phaseTopups = projectTopups.filter((request) => request.phaseId === ph.id);
                                const phaseChanges = projectChangeRequests.filter((request) => matchesPhaseLabel(request.affectedPhase, ph));
                                const phaseBudget = summarizePhaseBudget(ph, phaseTopups, phaseChanges);
                                const progress = plannedTasks > 0
                                  ? Math.min(100, Math.round((phaseLogs.reduce((sum, log) => sum + Number(log.tasksDone || 0), 0) / plannedTasks) * 100))
                                  : 0;
                                const phaseModelNames = collectResourceNames([
                                  ...phaseLogs.flatMap((log) => getLogModelNames(log)),
                                  ...phaseTopups.map((request) => request.breakdown?.models?.optionLabel).filter(Boolean),
                                  ...phaseChanges.map((request) => request.breakdown?.models?.optionLabel).filter(Boolean),
                                  ...getPhaseTasks(p.id, ph.id).map((task) => task.model).filter(Boolean),
                                ]);
                                const requestSummary = `${phaseTopups.length} top-up${phaseTopups.length === 1 ? "" : "s"} · ${phaseChanges.length} change${phaseChanges.length === 1 ? "" : "s"}`;
                                return (
                                  <tr
                                    key={ph.id}
                                    data-testid={`burn-phase-${ph.id}`}
                                    onClick={() => setSelectedPhaseId(ph.id)}
                                    className={`border-b border-white/5 last:border-0 hover:bg-white/[0.03] cursor-pointer transition-colors ${isSelected ? "bg-fuchsia-500/[0.06]" : ""}`}
                                  >
                                    <td className="py-3 px-3 text-white font-medium">{ph.name}</td>
                                    <td className="py-3 px-3 text-right tabular text-zinc-200">{fmtCurrency(phaseBudget.base, { compact: false })}</td>
                                    <td className="py-3 px-3 text-right tabular text-white font-semibold">{fmtCurrency(phaseBudget.currentTotal, { compact: false })}</td>
                                    <td className="py-3 px-3 text-right tabular text-white font-semibold">{fmtCurrency(burn, { compact: false })}</td>
                                    <td className="py-3 px-3">
                                      <div className="text-[11px] text-zinc-200">{plannedTasks > 0 ? `${progress}% · ${phaseLogs.reduce((sum, log) => sum + Number(log.tasksDone || 0), 0)}/${plannedTasks} tasks` : `${apprPct}% budget util`}</div>
                                      <div className="mt-1 h-1.5 rounded-full bg-white/[0.05] overflow-hidden">
                                        <div className={`h-full ${progress >= 100 ? "bg-emerald-500" : "bg-fuchsia-500"}`} style={{ width: `${plannedTasks > 0 ? progress : Math.min(apprPct, 100)}%` }} />
                                      </div>
                                    </td>
                                    <td className="py-3 px-3 text-[11px] text-zinc-300">
                                      {phaseModelNames.length ? phaseModelNames.slice(0, 2).join(", ") : "No model ask yet"}
                                    </td>
                                    <td className="py-3 px-3 text-[11px] text-zinc-400">
                                      {requestSummary}
                                      <div className="text-zinc-500 mt-0.5">
                                        +{fmtCurrency(phaseBudget.topupsTotal + phaseBudget.changesTotal, { compact: false })}
                                      </div>
                                    </td>
                                    <td className="py-3 px-3 text-right">
                                      <Link
                                        to={`/projects/${p.id}/phase/${ph.id}`}
                                        onClick={(event) => event.stopPropagation()}
                                        className="text-zinc-500 hover:text-fuchsia-300 inline-flex"
                                      >
                                        <ChevronRight className="w-4 h-4" />
                                      </Link>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>

                        {selectedPhase && (
                            <div className="mt-4 rounded-xl border border-fuchsia-500/20 bg-fuchsia-500/[0.04] p-4" data-testid={`phase-detail-${selectedPhase.id}`}>
                            <div className="flex items-start justify-between gap-3 flex-wrap">
                              <div>
                                <div className="text-[10px] uppercase tracking-widest font-semibold text-fuchsia-300">Phase request drill-down</div>
                                <div className="mt-1 font-display text-lg font-semibold text-white">{selectedPhase.name}</div>
                                <div className="text-xs text-zinc-500 mt-0.5">
                                  Budget requests, top-ups, changes, and logged tasks for this phase.
                                </div>
                              </div>
                              <Link to={`/projects/${p.id}/phase/${selectedPhase.id}`} className="text-xs text-fuchsia-300 hover:text-fuchsia-200 inline-flex items-center gap-1">
                                Open full phase
                                <ChevronRight className="w-3.5 h-3.5" />
                              </Link>
                            </div>

                            <div className="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-3">
                              {(() => {
                                const phaseBudget = summarizePhaseBudget(selectedPhase, selectedPhaseTopups, selectedPhaseChanges);
                                const selectedProgress = Number(selectedPhase.totalTasks || selectedPhase.tasks || 0) > 0
                                  ? Math.min(100, Math.round((selectedPhaseLogs.reduce((sum, log) => sum + Number(log.tasksDone || 0), 0) / Number(selectedPhase.totalTasks || selectedPhase.tasks || 0)) * 100))
                                  : 0;
                                return (
                                  <>
                                    <MiniKpi label="Base budget" value={fmtCurrency(phaseBudget.base, { compact: false })} sub="Submitted phase budget" />
                                    <MiniKpi label="Current total" value={fmtCurrency(phaseBudget.currentTotal, { compact: false })} sub={`Top-ups ${fmtCurrency(phaseBudget.topupsTotal, { compact: false })} · Changes ${fmtCurrency(phaseBudget.changesTotal, { compact: false })}`} accent="text-fuchsia-300" />
                                    <MiniKpi label="Progress" value={`${selectedProgress}%`} sub={`${selectedPhaseLogs.reduce((sum, log) => sum + Number(log.tasksDone || 0), 0)} of ${Number(selectedPhase.totalTasks || selectedPhase.tasks || 0) || 0} tasks`} />
                                  </>
                                );
                              })()}
                            </div>

                            <div className="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-3">
                              <RequestSummaryCard
                                title={`Budget requests (${selectedPhaseBudgetItems.length})`}
                                icon={Wallet}
                                empty="No budget requests mapped to this phase."
                                testid={`phase-budget-requests-${selectedPhase.id}`}
                              >
                                {selectedPhaseBudgetItems.map((request) => {
                                  const status = getBudgetRequestMeta(request);
                                  return (
                                    <div key={request.id} className="p-2.5 rounded-lg border border-white/5 bg-white/[0.02]">
                                      <div className="flex items-start justify-between gap-2">
                                        <div>
                                          <div className="text-[11px] text-white font-medium">{request.title}</div>
                                          <div className="text-[10px] text-zinc-500 mt-0.5">{request.scope}</div>
                                        </div>
                                        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold border ${status.cls}`}>
                                          <status.Icon className="w-2.5 h-2.5" />
                                          {status.label}
                                        </span>
                                      </div>
                                      <div className="mt-2 flex items-center justify-between text-[10px] text-zinc-500">
                                        <span>{request.when}</span>
                                        <span className="text-white font-semibold tabular">{fmtCurrency(request.amount, { compact: false })}</span>
                                      </div>
                                    </div>
                                  );
                                })}
                              </RequestSummaryCard>

                              <RequestSummaryCard
                                title={`Top-ups (${selectedPhaseTopups.length})`}
                                icon={ArrowUpRightSquare}
                                empty="No top-up requests mapped to this phase."
                                testid={`phase-topup-requests-${selectedPhase.id}`}
                              >
                                {selectedPhaseTopups.map((request) => (
                                  <TopupRequestCard key={request.id} request={request} />
                                ))}
                              </RequestSummaryCard>

                              <RequestSummaryCard
                                title={`Changes (${selectedPhaseChanges.length})`}
                                icon={Shield}
                                empty="No change requests mapped to this phase."
                                testid={`phase-change-requests-${selectedPhase.id}`}
                              >
                                {selectedPhaseChanges.map((request) => {
                                  const status = getChangeRequestMeta(request);
                                  const breakdownSelections = getChangeBreakdownSelections(request);
                                  return (
                                    <div key={request.id} className="p-2.5 rounded-lg border border-white/5 bg-white/[0.02]">
                                      <div className="flex items-start justify-between gap-2">
                                        <div>
                                          <div className="text-[11px] text-white font-medium">{request.type}</div>
                                          <div className="text-[10px] text-zinc-500 mt-0.5 line-clamp-2">{request.reason}</div>
                                          {breakdownSelections.length > 0 && (
                                            <div className="text-[10px] text-zinc-400 mt-1 line-clamp-3">{breakdownSelections.join(" · ")}</div>
                                          )}
                                        </div>
                                        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold border ${status.cls}`}>
                                          <status.Icon className="w-2.5 h-2.5" />
                                          {status.label}
                                        </span>
                                      </div>
                                      <div className="mt-2 flex items-center justify-between text-[10px] text-zinc-500">
                                        <span>{fmtDate(request.createdAt)}</span>
                                        <span className="text-white font-semibold tabular">{fmtCurrency(request.amount, { compact: false })}</span>
                                      </div>
                                    </div>
                                  );
                                })}
                              </RequestSummaryCard>
                            </div>

                            <div className="mt-4 rounded-lg border border-white/5 bg-[#12121A] overflow-hidden">
                              <div className="px-4 py-3 border-b border-white/5">
                                <div className="font-display font-semibold text-[15px] text-white">Logged tasks &amp; approval status</div>
                                <div className="text-xs text-zinc-500 mt-0.5">
                                  {selectedPhaseLogs.length} logged task{selectedPhaseLogs.length === 1 ? "" : "s"} · approvals reflect current phase delivery state
                                </div>
                              </div>
                              {selectedPhaseLogs.length === 0 ? (
                                <div className="py-8 text-center text-xs text-zinc-500">No tasks have been logged for this phase yet.</div>
                              ) : (
                                <div className="overflow-x-auto">
                                  <table className="w-full text-sm">
                                    <thead>
                                      <tr className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500 border-b border-white/5 bg-white/[0.02]">
                                        <th className="text-left py-2.5 px-3">Task</th>
                                        <th className="text-left py-2.5 px-3">Assignee</th>
                                        <th className="text-right py-2.5 px-3">Tasks</th>
                                        <th className="text-right py-2.5 px-3">Trajectories</th>
                                        <th className="text-right py-2.5 px-3">Cost</th>
                                        <th className="text-left py-2.5 px-3">Approval status</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {selectedPhaseLogs.map((log) => {
                                        const approval = getTaskApprovalState(log, selectedPhaseDelivery);
                                        return (
                                          <tr key={log.id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.03]">
                                            <td className="py-3 px-3">
                                              <div className="text-white font-medium">{log.name}</div>
                                              {log.notes && <div className="text-[11px] text-zinc-500 mt-0.5 line-clamp-1">{log.notes}</div>}
                                            </td>
                                            <td className="py-3 px-3 text-xs text-zinc-300">{log.assignee}</td>
                                            <td className="py-3 px-3 text-right tabular text-white font-semibold">{Number(log.tasksDone || 0).toLocaleString()}</td>
                                            <td className="py-3 px-3 text-right tabular text-white font-semibold">{Number(log.trajectories || 0).toLocaleString()}</td>
                                            <td className="py-3 px-3 text-right tabular text-white font-semibold">{fmtCurrency(log.cost, { compact: false })}</td>
                                            <td className="py-3 px-3">
                                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold border ${approval.cls}`}>
                                                <approval.Icon className="w-3 h-3" />
                                                {approval.label}
                                              </span>
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}

                {/* Top-up requests (kept — accessible from within the specific project) */}
                <div className="bg-[#12121A] rounded-2xl border border-white/5 p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <ArrowUpRightSquare className="w-4 h-4 text-fuchsia-300" />
                      <div className="font-display font-semibold text-[15px] text-white">Top-up requests</div>
                    </div>
                    {isTPM && (
                      <Button size="sm" onClick={() => { setTopupPhaseId(""); setTopupOpen(true); }} className="h-8 rounded-md bg-fuchsia-500/15 hover:bg-fuchsia-500/25 border border-fuchsia-500/25 text-fuchsia-300 text-xs gap-1" data-testid="btn-raise-topup-project">
                        <Plus className="w-3 h-3" /> Raise top-up
                      </Button>
                    )}
                  </div>
                  {projectTopups.length === 0 ? (
                    <div className="text-xs text-zinc-500 py-4 text-center">No top-ups raised for this project.</div>
                  ) : (
                    <div className="space-y-2">
                      {projectTopups.map((request) => (
                        <TopupRequestCard key={request.id} request={request} />
                      ))}
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
                  onClick={() => { setEditingLog(null); setTaskLogPhase(selectedPhase || p.phases[0]); }}
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
                      <th className="text-right py-2 px-3">Tasks</th>
                      <th className="text-right py-2 px-3">Trajectories</th>
                      <th className="text-right py-2 px-3">Est. cost</th>
                      <th className="text-left py-2 px-3">Approval status</th>
                      <th className="text-left py-2 px-3">Date</th>
                      {isTPM && <th className="text-right py-2 px-3">Actions</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {allLogs.map((l) => {
                      const editable = isTaskEditable(l);
                      const delivery = projectBatches.find((batch) => batch.phaseId === l.phaseId) || null;
                      const approval = getTaskApprovalState(l, delivery);
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
                          <td className="py-3 px-3 text-right tabular text-white font-semibold">{Number(l.trajectories || 0).toLocaleString()}</td>
                          <td className="py-3 px-3 text-right tabular text-white font-semibold">{fmtCurrency(l.cost, { compact: false })}</td>
                          <td className="py-3 px-3">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold border ${approval.cls}`}>
                              <approval.Icon className="w-3 h-3" />
                              {approval.label}
                            </span>
                          </td>
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
            {batchPhases.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <MiniKpi
                  label="Delivered phases"
                  value={String(batchPhases.filter((phase) => {
                    const delivery = projectBatches.find((entry) => entry.phaseId === phase.id);
                    return !!delivery && delivery.status !== "changes-requested";
                  }).length)}
                  sub={`${batchPhases.length} total`}
                />
                <MiniKpi
                  label="Recoverable total"
                  value={fmtCurrency(batchPhases.reduce((sum, phase) => {
                    const entry = projectBatches.find((delivery) => delivery.phaseId === phase.id);
                    return sum + (entry?.stage === "cfo-recovery" && entry.isRecoverable !== false ? Number(entry.proposedAmount || 0) : 0);
                  }, 0), { compact: false })}
                  sub="Consolidated across submitted phases"
                  accent="text-fuchsia-300"
                />
                <MiniKpi
                  label="Non-recoverable"
                  value={String(batchPhases.filter((phase) => {
                    const entry = projectBatches.find((delivery) => delivery.phaseId === phase.id);
                    return entry?.stage === "cfo-recovery" && entry.isRecoverable === false;
                  }).length)}
                  sub="Closed deliveries"
                />
                <MiniKpi
                  label="Active batch"
                  value={batchPhases.find((phase) => phase.id === activeBatchPhaseId)?.name || "All submitted"}
                  sub={activeBatchPhaseId ? "Only this batch can be edited now" : "No editable batch pending"}
                />
              </div>
            )}

            {batchPhases.length === 0 && (
              <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-12 text-center text-xs text-zinc-500">
                No phases defined yet. Use Budget Builder to add phases.
              </div>
            )}
            {batchPhases.map((ph) => {
              const deliveriesForPhase = projectBatches.filter((batch) => batch.phaseId === ph.id);
              const delivery = deliveriesForPhase[0] || null;
              const isRevisableDelivery = delivery?.status === "changes-requested";
              const isSubmitted = !!delivery && !isRevisableDelivery;
              const isActivePhase = activeBatchPhaseId ? activeBatchPhaseId === ph.id : (!delivery || isRevisableDelivery);
              const isLockedPhase = !isSubmitted && !isActivePhase && role !== "R&D";
              const topupsForPhase = projectTopups.filter((r) => r.phaseId === ph.id);
              const changesForPhase = projectChangeRequests.filter((request) => matchesPhaseLabel(request.affectedPhase, ph));
              const logs = getPhaseLogs(p.id, ph.id);
              const loggedCost = logs.reduce((sum, log) => sum + (Number(log.cost) || 0), 0);
              const phaseSpend = isCFO ? Number(ph.actual || 0) : loggedCost;
              const variance = Number(ph.estimated || 0) - phaseSpend;
              const util = ph.estimated ? Math.round((phaseSpend / ph.estimated) * 100) : 0;
              const hc = healthColor(ph.health);
              const seededTasks = getPhaseTasks(p.id, ph.id);
              const loggedTasks = logs.reduce((sum, log) => sum + (Number(log.tasksDone) || 0), 0);
              const loggedTrajectories = logs.reduce((sum, log) => sum + (Number(log.trajectories) || 0), 0);
              const plannedTasks = Number(ph.totalTasks || ph.tasks || 0);
              const costPerTask = loggedTasks > 0 ? Math.round((phaseSpend / loggedTasks) * 100) / 100 : null;
              const phaseBreakdown = estimatePhaseCostBreakdown(p, ph, topupsForPhase, changesForPhase);
              const modelNames = collectResourceNames([
                ...(delivery?.rnd?.models ? String(delivery.rnd.models).split(",") : []),
                ...seededTasks.map((task) => task.model).filter(Boolean),
                ...topupsForPhase.map((request) => request.breakdown?.models?.optionLabel).filter(Boolean),
                ...changesForPhase.map((request) => request.breakdown?.models?.optionLabel).filter(Boolean),
              ]);
              const infraNames = collectResourceNames([
                ...seededTasks.map((task) => task.infra).filter(Boolean),
                ...topupsForPhase.map((request) => request.breakdown?.infra?.optionLabel).filter(Boolean),
                ...changesForPhase.map((request) => request.breakdown?.infra?.optionLabel).filter(Boolean),
              ]);
              const approvalMeta = delivery ? (statusMap[delivery.status] || statusMap["pending-cfo"]) : null;
              const phaseRecoverableTotal = delivery?.isRecoverable === false ? 0 : Number(delivery?.proposedAmount || 0);
              return (
                <div
                  key={ph.id}
                  data-testid={`batch-phase-${ph.id}`}
                  className={`rounded-2xl border p-5 transition-colors ${
                    isSubmitted
                      ? "bg-[#12121A] border-white/5 opacity-65"
                      : isLockedPhase
                        ? "bg-[#12121A] border-white/5 opacity-55"
                        : "bg-[#12121A] border-white/5"
                  }`}
                >
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
                        {isLockedPhase && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold border border-white/10 bg-white/[0.03] text-zinc-400">
                            <Lock className="w-3 h-3" /> Locked until previous batch is submitted
                          </span>
                        )}
                      </div>
                      <div className="mt-2 text-xs text-zinc-500 tabular">{ph.dates}</div>
                      {isActivePhase && !isSubmitted && !isLockedPhase && (
                        <div className="mt-2 text-[11px] text-fuchsia-300">Current editable batch</div>
                      )}
                      <div className="mt-3 grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-2">
                        <PhaseMetric label="Estimated" value={fmtCurrency(ph.estimated, { compact: false })} />
                        <PhaseMetric label={isCFO ? "Actual" : "Logged"} value={fmtCurrency(phaseSpend, { compact: false })} tone="magenta" />
                        <PhaseMetric label="Variance" value={`${variance > 0 ? "+" : ""}${fmtCurrency(variance, { compact: false })}`} tone={variance >= 0 ? "emerald" : "red"} />
                        <PhaseMetric label="Utilization" value={fmtPct(util)} tone={util >= 90 ? "warning" : "emerald"} />
                        <PhaseMetric label="Tasks" value={`${loggedTasks || 0}/${plannedTasks || 0}`} />
                        <PhaseMetric label="Trajectories" value={loggedTrajectories.toLocaleString()} />
                        <PhaseMetric label="Cost / task" value={costPerTask != null ? fmtCurrency(costPerTask, { compact: false }) : "—"} />
                        <PhaseMetric label="Recoverable" value={delivery ? (delivery.isRecoverable === false ? "No" : fmtCurrency(phaseRecoverableTotal, { compact: false })) : "—"} tone={delivery?.isRecoverable === false ? "warning" : "emerald"} />
                      </div>
                    </div>
                    {isTPM && (
                      <div className="flex items-center gap-2 flex-wrap">
                        <Button
                          size="sm"
                          onClick={() => { setEditingLog(null); setTaskLogPhase(ph); }}
                          disabled={isLockedPhase || isSubmitted}
                          data-testid={`btn-log-task-${ph.id}`}
                          className="h-8 rounded-md bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-zinc-200 text-xs gap-1"
                        >
                          <Plus className="w-3 h-3" /> Log task
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => { setTopupPhaseId(ph.id); setTopupOpen(true); }}
                          disabled={isLockedPhase || isSubmitted}
                          data-testid={`btn-topup-${ph.id}`}
                          className="h-8 rounded-md bg-fuchsia-500/15 hover:bg-fuchsia-500/25 border border-fuchsia-500/25 text-fuchsia-300 text-xs gap-1"
                        >
                          <ArrowUpRightSquare className="w-3 h-3" /> Top-up
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => setDeliverPhase(ph)}
                          disabled={isLockedPhase || (!!delivery && delivery.status !== "changes-requested")}
                          data-testid={`btn-deliver-${ph.id}`}
                          className="h-8 rounded-md bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-500/25 disabled:text-emerald-200 text-white text-xs gap-1"
                        >
                          <PackageCheck className="w-3 h-3" /> {delivery?.status === "changes-requested" ? "Deliver revised sample" : isSubmitted ? "Delivered" : "Deliver batch"}
                        </Button>
                      </div>
                    )}
                  </div>

                  <div className="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-3">
                    <ResourceSummaryCard
                      title="Models"
                      value={fmtCurrency(phaseBreakdown.models, { compact: false })}
                      detail={modelNames.length ? modelNames.join(", ") : "No model attribution recorded yet."}
                      testid={`batch-models-${ph.id}`}
                    />
                    <ResourceSummaryCard
                      title="Infra"
                      value={fmtCurrency(phaseBreakdown.infra, { compact: false })}
                      detail={infraNames.length ? infraNames.join(", ") : "No infra attribution recorded yet."}
                      testid={`batch-infra-${ph.id}`}
                    />
                    <ResourceSummaryCard
                      title="Subs"
                      value={fmtCurrency(phaseBreakdown.subs, { compact: false })}
                      detail={getSubscriptionSummary(topupsForPhase, changesForPhase)}
                      testid={`batch-subs-${ph.id}`}
                    />
                  </div>

                  <div className="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-3">
                    <RequestSummaryCard
                      title={`Top-up requests (${topupsForPhase.length})`}
                      icon={ArrowUpRightSquare}
                      empty="No top-up requests for this phase."
                      testid={`sub-topups-${ph.id}`}
                    >
                      {topupsForPhase.map((request) => (
                        <TopupRequestCard key={request.id} request={request} />
                      ))}
                    </RequestSummaryCard>

                    <RequestSummaryCard
                      title={`Changes (${changesForPhase.length})`}
                      icon={Shield}
                      empty="No change requests raised for this phase."
                      testid={`sub-changes-${ph.id}`}
                    >
                      {changesForPhase.map((request) => {
                        const status = getChangeRequestMeta(request);
                        const breakdownSelections = getChangeBreakdownSelections(request);
                        return (
                          <div key={request.id} className="p-2.5 rounded-lg bg-white/[0.02] border border-white/5">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <div className="text-[11px] text-white font-medium">{request.type}</div>
                                <div className="text-[10px] text-zinc-500 mt-0.5 line-clamp-2">{request.reason}</div>
                                {breakdownSelections.length > 0 && (
                                  <div className="text-[10px] text-zinc-400 mt-1 line-clamp-3">{breakdownSelections.join(" · ")}</div>
                                )}
                              </div>
                              <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold border ${status.cls}`}>
                                <status.Icon className="w-2.5 h-2.5" />
                                {status.label}
                              </span>
                            </div>
                            <div className="mt-2 text-[10px] text-zinc-500 flex items-center justify-between">
                              <span>{fmtDate(request.createdAt)}</span>
                              <span className="text-white font-semibold tabular">{fmtCurrency(request.amount, { compact: false })}</span>
                            </div>
                          </div>
                        );
                      })}
                    </RequestSummaryCard>

                    <RequestSummaryCard
                      title="Delivery"
                      icon={PackageCheck}
                      empty="Not delivered yet."
                      testid={`sub-delivery-${ph.id}`}
                    >
                      {delivery && (
                        <div className={`p-2.5 rounded-lg border space-y-2 ${
                          delivery.stage === "rnd-review"
                            ? "bg-white/[0.02] border-white/10"
                            : "bg-emerald-500/[0.05] border-emerald-500/20"
                        }`}>
                          {approvalMeta && (
                            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold border ${approvalMeta.cls}`}>
                              <approvalMeta.Icon className="w-2.5 h-2.5" />
                              {approvalMeta.label}
                            </span>
                          )}
                          {delivery.stage === "rnd-review" && (
                            <div className="flex items-center justify-between text-[10px] text-zinc-400">
                              <span>Sample cycle</span>
                              <span className="text-[11px] text-white font-semibold tabular">Sample {delivery.sampleIteration || 1}</span>
                            </div>
                          )}
                          {delivery.stage === "cfo-recovery" && (
                            <div className="flex items-center justify-between text-[10px] text-zinc-400">
                              <span>Recovery type</span>
                              <span className={`text-[11px] font-semibold ${delivery.isRecoverable === false ? "text-zinc-300" : "text-emerald-300"}`}>
                                {delivery.isRecoverable === false ? "Non-recoverable" : "Recoverable"}
                              </span>
                            </div>
                          )}
                          {delivery.isRecoverable !== false && (
                            <div className="flex items-center justify-between text-[10px] text-zinc-400">
                              <span>Proposed</span>
                              <span className="text-[11px] text-white font-semibold tabular">{fmtCurrency(delivery.proposedAmount, { compact: false })}</span>
                            </div>
                          )}
                          {delivery.stage === "cfo-recovery" && delivery.isRecoverable !== false ? (
                            <div className="flex items-center justify-between text-[10px] text-zinc-400">
                              <span>Recovered</span>
                              <span className={`text-[11px] font-semibold tabular ${delivery.actualRecovered != null ? "text-emerald-300" : "text-zinc-500"}`}>
                                {delivery.actualRecovered != null ? fmtCurrency(delivery.actualRecovered, { compact: false }) : "Awaiting CFO"}
                              </span>
                            </div>
                          ) : delivery.stage === "cfo-recovery" ? (
                            <div className="flex items-center justify-between text-[10px] text-zinc-400">
                              <span>Recovery status</span>
                              <span className="text-[11px] font-semibold text-zinc-300">Closed on delivery</span>
                            </div>
                          ) : (
                            <div className="flex items-center justify-between text-[10px] text-zinc-400">
                              <span>Outcome</span>
                              <span className={`text-[11px] font-semibold ${
                                delivery.status === "sample-approved"
                                  ? "text-emerald-300"
                                  : delivery.status === "sample-rejected"
                                    ? "text-red-300"
                                    : "text-amber-300"
                              }`}>
                                {delivery.status === "sample-approved"
                                  ? "Accepted and moved to production"
                                  : delivery.status === "sample-rejected"
                                    ? "Rejected"
                                    : "Budget revision needed"}
                              </span>
                            </div>
                          )}
                          {delivery.rnd?.models && (
                            <div className="text-[10px] text-zinc-300 leading-relaxed pt-1 border-t border-white/5">
                              <span className="text-zinc-500">Models: </span>{delivery.rnd.models}
                            </div>
                          )}
                          {delivery.clientComment && (
                            <div className="text-[10px] text-zinc-300 leading-relaxed pt-1 border-t border-white/5">
                              <span className="text-emerald-200 font-semibold">{delivery.stage === "rnd-review" ? "Notes: " : "Client: "}</span>{delivery.clientComment}
                            </div>
                          )}
                          {delivery.stage === "rnd-review" && delivery.status === "changes-requested" && (
                            <Link
                              to={`/budget-builder?projectId=${p.id}&budgetType=Rework&phaseId=${ph.id}&sampleIteration=${Number(delivery.sampleIteration || 1) + 1}&sourceDeliveryId=${delivery.id}`}
                              className="inline-flex items-center gap-1 text-[11px] text-fuchsia-300 hover:text-fuchsia-200 font-medium pt-1"
                            >
                              Raise rework budget <ChevronRight className="w-3 h-3" />
                            </Link>
                          )}
                          {deliveriesForPhase.length > 1 && (
                            <div className="pt-2 border-t border-white/5 space-y-1">
                              <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500">Earlier logs</div>
                              {deliveriesForPhase.slice(1).map((entry) => {
                                const entryMeta = statusMap[entry.status] || statusMap["pending-cfo"];
                                return (
                                  <div key={entry.id} className="flex items-center justify-between gap-2 text-[10px] text-zinc-400">
                                    <span className="truncate">
                                      {entry.stage === "rnd-review" ? `Sample ${entry.sampleIteration || 1}` : "Batch delivery"} · {fmtDate(entry.deliveredAt)}
                                    </span>
                                    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border ${entryMeta.cls}`}>
                                      <entryMeta.Icon className="w-2.5 h-2.5" />
                                      {entryMeta.label}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </RequestSummaryCard>
                  </div>

                  <div className="mt-4 rounded-xl border border-white/5 bg-white/[0.02] overflow-hidden" data-testid={`batch-task-detail-${ph.id}`}>
                    <div className="px-4 py-3 border-b border-white/5">
                      <div className="font-display font-semibold text-[15px] text-white">Logged tasks for this phase</div>
                      <div className="text-xs text-zinc-500 mt-0.5">
                        Detailed view of task counts, trajectories, costs, and approval outcome.
                      </div>
                    </div>
                    {logs.length === 0 ? (
                      <div className="py-8 text-center text-xs text-zinc-500">No tasks logged for this phase yet.</div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500 border-b border-white/5 bg-white/[0.02]">
                              <th className="text-left py-2.5 px-3">Task</th>
                              <th className="text-left py-2.5 px-3">Assignee</th>
                              <th className="text-right py-2.5 px-3">Tasks</th>
                              <th className="text-right py-2.5 px-3">Trajectories</th>
                              <th className="text-right py-2.5 px-3">Cost / task</th>
                              <th className="text-right py-2.5 px-3">Cost</th>
                              <th className="text-left py-2.5 px-3">Approval</th>
                            </tr>
                          </thead>
                          <tbody>
                            {logs.map((log) => {
                              const approval = getTaskApprovalState(log, delivery);
                              const logCostPerTask = Number(log.tasksDone) > 0 ? Number(log.cost) / Number(log.tasksDone) : 0;
                              return (
                                <tr key={log.id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.03]">
                                  <td className="py-3 px-3">
                                    <div className="text-white font-medium">{log.name}</div>
                                    {log.notes && <div className="text-[11px] text-zinc-500 mt-0.5 line-clamp-1">{log.notes}</div>}
                                  </td>
                                  <td className="py-3 px-3 text-xs text-zinc-300">{log.assignee}</td>
                                  <td className="py-3 px-3 text-right tabular text-white font-semibold">{Number(log.tasksDone || 0).toLocaleString()}</td>
                                  <td className="py-3 px-3 text-right tabular text-white font-semibold">{Number(log.trajectories || 0).toLocaleString()}</td>
                                  <td className="py-3 px-3 text-right tabular text-white font-semibold">{Number(log.tasksDone) > 0 ? fmtCurrency(logCostPerTask, { compact: false }) : "—"}</td>
                                  <td className="py-3 px-3 text-right tabular text-white font-semibold">{fmtCurrency(log.cost, { compact: false })}</td>
                                  <td className="py-3 px-3">
                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold border ${approval.cls}`}>
                                      <approval.Icon className="w-3 h-3" />
                                      {approval.label}
                                    </span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
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

      <TopupRequestDialog open={topupOpen} onOpenChange={setTopupOpen} project={p} defaultPhaseId={topupPhaseId} />
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

const SetupCard = ({ title, icon: Icon, children, testid }) => (
  <div className="bg-[#12121A] rounded-2xl border border-white/5 p-5" data-testid={testid}>
    <div className="flex items-center gap-2 mb-3">
      <Icon className="w-4 h-4 text-fuchsia-300" />
      <div className="font-display font-semibold text-[15px] text-white">{title}</div>
    </div>
    {children}
  </div>
);

const EmptySetupState = ({ message }) => (
  <div className="rounded-lg border border-dashed border-white/10 bg-white/[0.02] px-3 py-6 text-center text-xs text-zinc-500">
    {message}
  </div>
);

const CompactSetupStat = ({ title, value, meta, icon: Icon }) => (
  <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
    <div className="flex items-center justify-between gap-2">
      <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500">{title}</div>
      <div className="w-8 h-8 rounded-lg border border-white/10 bg-white/[0.03] flex items-center justify-center">
        <Icon className="w-3.5 h-3.5 text-fuchsia-300" />
      </div>
    </div>
    <div className="mt-3 font-display text-2xl font-semibold text-white tabular">{value}</div>
    <div className="mt-1 text-[11px] text-zinc-500 leading-relaxed">{meta}</div>
  </div>
);

const sumBudgetLinesTotal = (lines = []) =>
  (Array.isArray(lines) ? lines : []).reduce((sum, line) => sum + Number(line?.estCost || line?.amount || 0), 0);

const BudgetTrackCard = ({ track, topupCount, changeCount }) => {
  const latest = track.latest || {};
  const modelTotal = sumBudgetLinesTotal(latest.items?.models);
  const infraTotal = sumBudgetLinesTotal(latest.items?.infra);
  const subsTotal = sumBudgetLinesTotal(latest.items?.subs);

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-widest font-semibold text-fuchsia-300">{track.label}</div>
          <div className="mt-1 text-lg font-display font-semibold text-white">{fmtCurrency(latest.total || 0, { compact: false })}</div>
        </div>
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold border border-white/10 bg-white/[0.03] text-zinc-300 capitalize">
          {latest.status || "submitted"}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <MiniKpi label="Tasks" value={Number(latest.totalTasks || 0).toLocaleString()} />
        <MiniKpi label="Trajectories" value={Number(latest.totalTrajectories || 0).toLocaleString()} />
        <MiniKpi label="Models" value={fmtCurrency(modelTotal, { compact: false })} />
        <MiniKpi label="Infra" value={fmtCurrency(infraTotal, { compact: false })} />
        <MiniKpi label="Subs" value={fmtCurrency(subsTotal, { compact: false })} />
        <MiniKpi label="Requests" value={`${topupCount} top-ups · ${changeCount} changes`} />
      </div>

      <div className="mt-3 pt-3 border-t border-white/5 text-[11px] text-zinc-500 flex items-center justify-between gap-3">
        <span>Latest submit</span>
        <span className="text-zinc-200 font-medium">
          {latest.submittedAt ? new Date(latest.submittedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}
        </span>
      </div>
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

const RequestSummaryCard = ({ title, icon: Icon, children, empty, testid }) => {
  const hasContent = Array.isArray(children) ? children.length > 0 : !!children;
  return (
    <div className="rounded-lg border border-white/5 bg-white/[0.02] p-3" data-testid={testid}>
      <div className="flex items-center gap-1.5 mb-2 text-[10px] uppercase tracking-widest font-semibold text-zinc-500">
        <Icon className="w-3 h-3" /> {title}
      </div>
      {!hasContent ? <div className="text-[11px] text-zinc-600 italic">{empty}</div> : <div className="space-y-1.5">{children}</div>}
    </div>
  );
};

const TopupRequestCard = ({ request }) => {
  const status = statusMap[request.status] || statusMap["pending-cto"];
  const breakdown = getTopupBreakdownAmounts(request);
  const hasBreakdown = Object.values(breakdown).some((value) => value > 0);
  const breakdownSelections = getTopupBreakdownSelections(request);

  return (
    <Link
      to={`/topup-requests/${request.id}`}
      className="block rounded-lg border border-white/5 bg-white/[0.02] p-2.5 hover:border-fuchsia-500/25"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="text-[11px] text-white font-medium">{request.phaseName}</div>
            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold border ${status.cls}`}>
              <status.Icon className="w-2.5 h-2.5" />
              {status.label}
            </span>
          </div>
          <div className="mt-1 text-[10px] text-zinc-500 line-clamp-2">{request.reason}</div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <TopupBreakdownPill label="Models" value={breakdown.models} />
            <TopupBreakdownPill label="Infra" value={breakdown.infra} />
            <TopupBreakdownPill label="Subs" value={breakdown.subs} />
          </div>
          {breakdownSelections.length > 0 && (
            <div className="mt-2 text-[10px] text-zinc-400 leading-relaxed">
              {breakdownSelections.join(" · ")}
            </div>
          )}
          {!hasBreakdown && (
            <div className="mt-2 text-[10px] text-zinc-600">
              Line-item breakdown was not captured on this request.
            </div>
          )}
        </div>
        <div className="text-right flex-shrink-0">
          <div className="text-[10px] text-zinc-500">{fmtDate(request.requestedAt)}</div>
          <div className="mt-1 text-[11px] font-semibold tabular text-white">{fmtCurrency(request.amount, { compact: false })}</div>
        </div>
      </div>
    </Link>
  );
};

const TopupBreakdownPill = ({ label, value }) => (
  <div className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] px-2 py-1 text-[10px] text-zinc-400">
    <span>{label}</span>
    <span className="font-semibold tabular text-zinc-100">{value > 0 ? fmtCurrency(value, { compact: false }) : "—"}</span>
  </div>
);

const PhaseMetric = ({ label, value, tone = "neutral" }) => {
  const tones = { emerald: "text-emerald-300", magenta: "text-fuchsia-300", warning: "text-amber-300", red: "text-red-300", neutral: "text-white" };
  return (
    <div className="rounded-lg border border-white/5 bg-white/[0.02] p-2.5">
      <div className="text-[9px] uppercase tracking-widest font-semibold text-zinc-500">{label}</div>
      <div className={`mt-0.5 text-sm font-semibold tabular ${tones[tone]}`}>{value}</div>
    </div>
  );
};

const ResourceSummaryCard = ({ title, value, detail, testid }) => (
  <div className="rounded-lg border border-white/5 bg-white/[0.02] p-3" data-testid={testid}>
    <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500">{title}</div>
    <div className="mt-2 text-lg font-display font-semibold text-white tabular">{value}</div>
    <div className="mt-1 text-[11px] text-zinc-500 leading-relaxed">{detail}</div>
  </div>
);

const budgetRequestStatusMap = {
  submitted: { label: "Submitted", cls: "bg-white/[0.04] text-zinc-300 border-white/10", Icon: Clock3 },
  resubmitted: { label: "Resubmitted", cls: "bg-sky-500/15 text-sky-300 border-sky-500/30", Icon: Clock3 },
  forwarded: { label: "Forwarded", cls: "bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/30", Icon: ChevronRight },
  "CTO Review": { label: "CTO review", cls: "bg-amber-500/15 text-amber-300 border-amber-500/30", Icon: Clock3 },
  "COO Approval": { label: "COO approval", cls: "bg-sky-500/15 text-sky-300 border-sky-500/30", Icon: Clock3 },
  approved: { label: "Approved", cls: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30", Icon: CheckCircle2 },
  partial: { label: "Partially approved", cls: "bg-emerald-500/10 text-emerald-300 border-emerald-500/25", Icon: Percent },
  rejected: { label: "Rejected", cls: "bg-red-500/15 text-red-300 border-red-500/30", Icon: XCircle },
  returned: { label: "Returned", cls: "bg-amber-500/15 text-amber-300 border-amber-500/30", Icon: Clock3 },
};

const changeRequestStatusMap = {
  "CTO Review": { label: "CTO review", cls: "bg-amber-500/15 text-amber-300 border-amber-500/30", Icon: Clock3 },
  "COO Approval": { label: "COO approval", cls: "bg-sky-500/15 text-sky-300 border-sky-500/30", Icon: Clock3 },
  approved: { label: "Approved", cls: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30", Icon: CheckCircle2 },
  rejected: { label: "Rejected", cls: "bg-red-500/15 text-red-300 border-red-500/30", Icon: XCircle },
};

const taskApprovalStatusMap = {
  logged: { label: "Logged", cls: "bg-white/[0.04] text-zinc-300 border-white/10", Icon: FileText },
  "pending-cfo": { label: "Pending approval", cls: "bg-amber-500/15 text-amber-300 border-amber-500/30", Icon: Clock3 },
  approved: { label: "Approved", cls: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30", Icon: CheckCircle2 },
  partial: { label: "Partially approved", cls: "bg-emerald-500/10 text-emerald-300 border-emerald-500/25", Icon: Percent },
  rejected: { label: "Rejected", cls: "bg-red-500/15 text-red-300 border-red-500/30", Icon: XCircle },
  "non-recoverable": { label: "Closed · non-recoverable", cls: "bg-zinc-500/15 text-zinc-300 border-zinc-500/30", Icon: Lock },
  "changes-requested": { label: "Changes requested", cls: "bg-amber-500/15 text-amber-300 border-amber-500/30", Icon: ChevronRight },
};

const normalizePhaseLabel = (value = "") => String(value).toLowerCase().replace(/\s+/g, " ").trim();

const matchesPhaseLabel = (label, phase) => {
  if (!label || !phase) return false;
  const normalizedLabel = normalizePhaseLabel(label);
  return normalizedLabel.includes(normalizePhaseLabel(phase.name)) || normalizedLabel.includes(normalizePhaseLabel(phase.id));
};

const requestMatchesPhase = (request, phase) => {
  if (!request || !phase) return false;
  if (!request.phaseIds.length && !request.phaseNames.length) return true;
  return request.phaseIds.includes(phase.id) || request.phaseNames.some((name) => matchesPhaseLabel(name, phase));
};

const buildProjectBudgetRequests = ({ projectId, submittedBudgets, liveBudgetReviews, seedBudgetReviews }) => {
  const submitted = submittedBudgets
    .filter((entry) => entry.projectId === projectId)
    .map((entry) => ({
      id: `budget-${entry.id}`,
      title: formatSubmittedBudgetTitle(entry.budgetType, entry.resubmitOfReviewId, entry.sampleIteration),
      amount: Number(entry.totals?.total || 0),
      status: entry.status || "submitted",
      phaseIds: (entry.phases || []).map((phase) => phase.id).filter(Boolean),
      phaseNames: (entry.phases || []).map((phase) => phase.name).filter(Boolean),
      scope: (entry.phases || []).length ? (entry.phases || []).map((phase) => phase.name).filter(Boolean).join(", ") : "Project-wide",
      when: fmtDate(entry.submittedAt),
    }));

  const mergedReviews = new Map();
  seedBudgetReviews.filter((review) => review.projectId === projectId).forEach((review) => mergedReviews.set(review.id, review));
  liveBudgetReviews.filter((review) => review.projectId === projectId).forEach((review) => mergedReviews.set(review.id, review));

  const reviews = Array.from(mergedReviews.values()).map((review) => ({
    id: `review-${review.id}`,
    title: review.type || "Budget review",
    amount: Number(review.modifiedTotal || review.requestedBudget || review.currentBudget || 0),
    status:
      review.status === "forwarded-cfo" ? "forwarded"
        : review.status === "rejected-by-cto" ? "rejected"
          : review.status === "returned-to-tpm" ? "returned"
            : review.status || review.stage || "submitted",
    phaseIds: (review.modifiedPhases || []).map((phase) => phase.id).filter(Boolean),
    phaseNames: (review.modifiedPhases || []).map((phase) => phase.name).filter(Boolean),
    scope: (review.modifiedPhases || []).length ? (review.modifiedPhases || []).map((phase) => phase.name).filter(Boolean).join(", ") : "Project-wide",
    when: fmtDate(review.ctoAt || review.submittedAt),
  }));

  return [...submitted, ...reviews];
};

const formatSubmittedBudgetTitle = (budgetType, resubmitOfReviewId, sampleIteration = 1) => {
  const base =
    budgetType === "Testing" ? "Testing budget"
      : budgetType === "Sample" || budgetType === "Rework" ? `Rework${sampleIteration > 1 ? ` ${sampleIteration}` : ""} budget`
        : budgetType === "RnD" ? "R&D budget"
          : budgetType === "Production" ? "Production budget"
            : "Budget request";
  return resubmitOfReviewId ? `Resubmitted ${base}` : base;
};

const getBudgetRequestMeta = (request) => budgetRequestStatusMap[request.status] || budgetRequestStatusMap.submitted;
const getChangeRequestMeta = (request) => changeRequestStatusMap[request.stage] || changeRequestStatusMap["CTO Review"];

const getTaskApprovalState = (log, delivery) => {
  if (log?.approvalStatus && taskApprovalStatusMap[log.approvalStatus]) return taskApprovalStatusMap[log.approvalStatus];
  if (!delivery) return taskApprovalStatusMap.logged;
  if (delivery.status === "non-recoverable") return taskApprovalStatusMap["non-recoverable"];
  if (delivery.actualRecovered === 0) return taskApprovalStatusMap.rejected;
  if (delivery.actualRecovered != null && delivery.actualRecovered >= delivery.proposedAmount) return taskApprovalStatusMap.approved;
  if (delivery.actualRecovered != null) return taskApprovalStatusMap.partial;
  return taskApprovalStatusMap["pending-cfo"];
};

const getTopupBreakdownAmounts = (request) => ({
  models: Number(request.breakdown?.models?.amount || 0),
  infra: Number(request.breakdown?.infra?.amount || 0),
  subs: Number(request.breakdown?.subs?.amount || 0),
});

const getChangeBreakdownAmounts = (request) => ({
  models: Number(request.breakdown?.models?.amount || 0),
  infra: Number(request.breakdown?.infra?.amount || 0),
  subs: Number(request.breakdown?.subs?.amount || 0),
});

const getResolvedTopupAmount = (request) => Number((request.cfoDecision?.amount ?? request.ctoDecision?.amount ?? request.amount) || 0);

const summarizePhaseBudget = (phase, topups = [], changes = []) => {
  const base = Number(phase?.estimated || 0);
  const topupsTotal = topups.reduce((sum, request) => sum + getResolvedTopupAmount(request), 0);
  const changesTotal = changes.reduce((sum, request) => sum + Number(request.amount || 0), 0);
  return {
    base,
    topupsTotal,
    changesTotal,
    currentTotal: base + topupsTotal + changesTotal,
  };
};

const getLogModelNames = (log) => {
  if (Array.isArray(log?.modelUsage) && log.modelUsage.length) {
    return log.modelUsage.map((entry) => entry.modelName || entry.modelId).filter(Boolean);
  }
  return [log?.modelName || log?.modelId].filter(Boolean);
};

const getTopupBreakdownSelections = (request) => (
  [
    request.breakdown?.models ? `Model: ${formatBreakdownEntry(request.breakdown.models)}` : null,
    request.breakdown?.infra ? `Infra: ${formatBreakdownEntry(request.breakdown.infra)}` : null,
    request.breakdown?.subs ? `Subs: ${formatBreakdownEntry(request.breakdown.subs)}` : null,
  ].filter(Boolean)
);

const getChangeBreakdownSelections = (request) => {
  const amounts = getChangeBreakdownAmounts(request);
  return [
    request.breakdown?.models ? `Models ${fmtCurrency(amounts.models, { compact: false })}: ${formatBreakdownEntry(request.breakdown.models)}` : null,
    request.breakdown?.infra ? `Infra ${fmtCurrency(amounts.infra, { compact: false })}: ${formatBreakdownEntry(request.breakdown.infra)}` : null,
    request.breakdown?.subs ? `Subs ${fmtCurrency(amounts.subs, { compact: false })}: ${formatBreakdownEntry(request.breakdown.subs)}` : null,
  ].filter(Boolean);
};

const estimatePhaseCostBreakdown = (project, phase, topups, changes = []) => {
  const totalEstimated = (project.phases || []).reduce((sum, item) => sum + Number(item.estimated || 0), 0) || 1;
  const share = Number(phase?.estimated || 0) / totalEstimated;
  const licenseSpend = (project.expenses || [])
    .filter((expense) => expense.category === "Licenses")
    .reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
  const topupModels = topups.reduce((sum, request) => sum + Number(request.breakdown?.models?.amount || 0), 0);
  const topupInfra = topups.reduce((sum, request) => sum + Number(request.breakdown?.infra?.amount || 0), 0);
  const topupSubs = topups.reduce((sum, request) => sum + Number(request.breakdown?.subs?.amount || 0), 0);
  const changeModels = changes.reduce((sum, request) => sum + Number(request.breakdown?.models?.amount || 0), 0);
  const changeInfra = changes.reduce((sum, request) => sum + Number(request.breakdown?.infra?.amount || 0), 0);
  const changeSubs = changes.reduce((sum, request) => sum + Number(request.breakdown?.subs?.amount || 0), 0);

  return {
    models: Math.round(((project.aiModelCost || 0) * share) + topupModels + changeModels),
    infra: Math.round(((project.infrastructureCost || 0) * share) + topupInfra + changeInfra),
    subs: Math.round((licenseSpend * share) + topupSubs + changeSubs),
  };
};

const collectResourceNames = (values) => Array.from(new Set(values.map((value) => String(value || "").trim()).filter((value) => value && value !== "—")));

const formatBreakdownEntry = (entry) => (
  [entry.optionLabel, entry.note].map((value) => String(value || "").trim()).filter(Boolean).join(" · ")
);

const getSubscriptionSummary = (topups = [], changes = []) => {
  const requested = [...topups, ...changes]
    .filter((request) => Number(request.breakdown?.subs?.amount || 0) > 0)
    .map((request) => `${fmtCurrency(request.breakdown.subs.amount, { compact: false })}${formatBreakdownEntry(request.breakdown.subs) ? ` · ${formatBreakdownEntry(request.breakdown.subs)}` : ""}`);
  return requested.length ? requested.join(" | ") : "No subscription ask raised for this phase.";
};

export default ProjectDetail;
