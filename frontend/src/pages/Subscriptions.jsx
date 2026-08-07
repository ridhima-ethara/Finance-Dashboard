import { useEffect, useMemo, useState } from "react";
import { CreditCard, Search, Users, FolderKanban, ChevronDown, ChevronRight, ClipboardList, Plus, Pencil, Send, Trash2, CheckCircle2, Clock3, FileText, PackageCheck, AlertTriangle, Gauge } from "lucide-react";
import { SUBSCRIPTION_ALLOCATIONS } from "../data/subscriptionTracker";
import { fmtCurrency } from "../lib/format";
import { useApp } from "../context/AppContext";
import { Button } from "../components/ui/button";
import SubscriptionRequestDialog from "../components/SubscriptionRequestDialog";
import SubscriptionFulfilmentDialog from "../components/SubscriptionFulfilmentDialog";
import SubscriptionReviewDialog from "../components/SubscriptionReviewDialog";
import SubscriptionTrackerView from "./SubscriptionTracker";
import SubscriptionDuplicateAlerts from "../components/SubscriptionDuplicateAlerts";
import { useLocation } from "react-router-dom";
import { toast } from "sonner";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "";
const apiHeaders = () => { const token = localStorage.getItem("ethara.jwt.v1"); return { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }; };
const apiJson = async (path, options = {}) => { const response = await fetch(`${BACKEND_URL}${path}`, { ...options, headers: { ...apiHeaders(), ...(options.headers || {}) } }); const payload = await response.json().catch(() => ({})); if (!response.ok) throw new Error(Array.isArray(payload.detail) ? payload.detail.join(" · ") : payload.detail || "Request failed"); return payload; };

const uniqueSorted = (values) => Array.from(new Set(values.filter(Boolean))).sort((a, b) => String(a).localeCompare(String(b)));

const selectCls = "h-9 px-3 rounded-lg bg-white/[0.04] border border-white/10 text-xs text-zinc-100 focus:outline-none focus:ring-1 focus:ring-fuchsia-500/40";

const Kpi = ({ label, value, sub, icon: Icon }) => (
  <div className="bg-[#12121A] rounded-2xl border border-white/5 p-4">
    <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest font-semibold text-zinc-500">
      {Icon && <Icon className="w-3.5 h-3.5" />} {label}
    </div>
    <div className="mt-2 font-display font-semibold text-2xl text-white tabular">{value}</div>
    {sub && <div className="mt-0.5 text-[11px] text-zinc-500">{sub}</div>}
  </div>
);

const Subscriptions = () => {
  const { user } = useApp();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState(location.state?.tab || "allocations");
  const [requests, setRequests] = useState([]);
  const [requestLoading, setRequestLoading] = useState(false);
  const [requestError, setRequestError] = useState("");
  const [requestOpen, setRequestOpen] = useState(false);
  const [editingRequest, setEditingRequest] = useState(null);
  const [fulfilOpen, setFulfilOpen] = useState(false);
  const [fulfilRequest, setFulfilRequest] = useState(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewRequest, setReviewRequest] = useState(null);
  const [projectFilter, setProjectFilter] = useState("all");
  const [subFilter, setSubFilter] = useState("all");
  const [phaseFilter, setPhaseFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState(() => new Set());
  const [sortBy, setSortBy] = useState("spend");
  const canCreateRequest = ["TPM", "R&D", "PL"].includes(user?.role);

  const loadRequests = async () => {
    setRequestLoading(true);
    setRequestError("");
    try { setRequests(await apiJson("/api/subscription-requests")); }
    catch (error) { setRequestError(error.message); }
    finally { setRequestLoading(false); }
  };
  useEffect(() => { loadRequests(); }, []);

  const requestAllocations = useMemo(() => requests.filter((request) => request.status === "active").flatMap((request) => (request.lines || []).flatMap((line) => {
    const allocatedMembers = line.members?.length ? line.members : Array.from({ length: Number(line.seats || 0) }, (_, index) => ({ id: `${line.id}-seat-${index + 1}`, name: `Unassigned seat ${index + 1}`, email: "" }));
    const perSeatAmount = Number(line.total || 0) / Math.max(Number(line.seats || 0), 1);
    return allocatedMembers.map((member) => ({ project: request.project_name, projectId: request.project_id, phase: request.phase_name, phaseId: request.phase_id, sub: line.subscription, provider: line.provider, name: member.name, email: member.email, emp: member.id, amount: perSeatAmount, started: line.start_date, ended: line.end_date, status: "Active", source: "Approved subscription request", requestId: request.id }));
  })), [requests]);
  const allocationRows = useMemo(() => [...SUBSCRIPTION_ALLOCATIONS, ...requestAllocations], [requestAllocations]);

  const openNewRequest = () => { setEditingRequest(null); setRequestOpen(true); };
  const openEditRequest = (request) => { setEditingRequest(request); setRequestOpen(true); };
  const openFulfilment = (request) => { setFulfilRequest(request); setFulfilOpen(true); };
  const openReview = (request) => { setReviewRequest(request); setReviewOpen(true); };
  const submitDraft = async (request) => { try { await apiJson(`/api/subscription-requests/${request.id}/submit`, { method: "POST" }); toast.success("Subscription request submitted to CTO"); loadRequests(); } catch (error) { toast.error("Request was not submitted", { description: error.message }); } };
  const deleteDraft = async (request) => { if (!window.confirm(`Delete draft ${request.request_number}?`)) return; try { await apiJson(`/api/subscription-requests/${request.id}`, { method: "DELETE" }); toast.success("Draft deleted"); loadRequests(); } catch (error) { toast.error("Draft was not deleted", { description: error.message }); } };
  const decide = async (request, decision) => {
    const role = user?.role;
    let approvedAmount;
    if (role === "CFO" && decision === "partial") {
      const value = window.prompt("Approved subscription amount", String(request.requested_amount || 0));
      if (value === null) return;
      approvedAmount = Number(value);
      if (!Number.isFinite(approvedAmount) || approvedAmount < 0) { toast.error("Enter a valid approved amount"); return; }
    }
    const comment = decision === "approve" || decision === "activate" ? "" : window.prompt("Add decision comment", "") ?? null;
    if (comment === null) return;
    try { await apiJson(`/api/subscription-requests/${request.id}/decision`, { method: "POST", body: JSON.stringify({ role, decision, approved_amount: approvedAmount, comment, actor: { name: user?.name, email: user?.email, role } }) }); toast.success("Subscription request updated"); loadRequests(); } catch (error) { toast.error("Decision was not saved", { description: error.message }); }
  };

  const projectOptions = useMemo(() => uniqueSorted(allocationRows.map((r) => r.project)), [allocationRows]);
  const subOptions = useMemo(() => uniqueSorted(allocationRows.map((r) => r.sub)), [allocationRows]);
  const phaseOptions = useMemo(() => uniqueSorted(allocationRows.map((r) => r.phase)), [allocationRows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allocationRows.filter((r) =>
      (projectFilter === "all" || r.project === projectFilter) &&
      (subFilter === "all" || r.sub === subFilter) &&
      (phaseFilter === "all" || r.phase === phaseFilter) &&
      (!q || `${r.name} ${r.email} ${r.emp}`.toLowerCase().includes(q))
    );
  }, [allocationRows, projectFilter, subFilter, phaseFilter, search]);

  const totalMonthly = filtered.reduce((sum, r) => sum + Number(r.amount || 0), 0);
  const distinctMembers = new Set(filtered.map((r) => r.email)).size;
  const distinctProjects = new Set(filtered.map((r) => r.project)).size;

  const isMember = (r) => r.email && !/unassigned/i.test(String(r.name || ""));

  const byProject = useMemo(() => {
    const map = new Map();
    filtered.forEach((r) => {
      if (!map.has(r.project)) map.set(r.project, []);
      map.get(r.project).push(r);
    });
    const list = Array.from(map.entries()).map(([project, rows]) => {
      const total = rows.reduce((sum, r) => sum + Number(r.amount || 0), 0);
      const seats = rows.length;
      const members = new Set(rows.filter(isMember).map((r) => r.email.toLowerCase())).size;
      const unused = Math.max(seats - members, 0);
      const memberMap = new Map();
      rows.forEach((r) => {
        const key = String(r.email || r.name || "unassigned").toLowerCase();
        if (!memberMap.has(key)) memberMap.set(key, { name: r.name || "Unassigned seat", email: r.email, phase: r.phase, subs: [], amount: 0, started: r.started, ended: r.ended });
        const entry = memberMap.get(key);
        if (r.sub && !entry.subs.includes(r.sub)) entry.subs.push(r.sub);
        entry.amount += Number(r.amount || 0);
      });
      return {
        project,
        rows: [...rows].sort((a, b) => String(a.phase).localeCompare(String(b.phase)) || String(a.name).localeCompare(String(b.name))),
        total,
        seats,
        members,
        unused,
        memberRows: Array.from(memberMap.values()).sort((a, b) => b.amount - a.amount),
        subCounts: Array.from(rows.reduce((m, r) => m.set(r.sub, (m.get(r.sub) || 0) + 1), new Map()).entries()).sort((a, b) => b[1] - a[1]),
      };
    });
    if (sortBy === "name") list.sort((a, b) => a.project.localeCompare(b.project));
    else if (sortBy === "util") list.sort((a, b) => (a.members / Math.max(a.seats, 1)) - (b.members / Math.max(b.seats, 1)));
    else list.sort((a, b) => b.total - a.total);
    return list;
  }, [filtered, sortBy]);

  const allocInsights = useMemo(() => {
    const seats = filtered.length;
    const members = new Set(filtered.filter(isMember).map((r) => r.email.toLowerCase())).size;
    const unusedSeats = Math.max(seats - members, 0);
    const avgPerSeat = seats ? totalMonthly / seats : 0;
    return {
      seats,
      members,
      utilization: seats ? Math.round((members / seats) * 100) : 0,
      unusedSeats,
      estWaste: unusedSeats * avgPerSeat,
      gaps: byProject.filter((p) => p.unused > 0).sort((a, b) => b.unused - a.unused).slice(0, 4),
    };
  }, [filtered, totalMonthly, byProject]);

  const toggle = (project) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(project)) next.delete(project);
      else next.add(project);
      return next;
    });

  return (
    <div className="mx-auto max-w-[1180px] space-y-4" data-testid="page-subscriptions">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] font-semibold text-fuchsia-400">
            <CreditCard className="w-3 h-3" /> Subscription management
          </div>
          <h1 className="mt-1 font-display font-semibold text-3xl tracking-tight text-white">Subscriptions</h1>
          <p className="mt-1 text-sm text-zinc-400">Project allocations and subscription requests with catalogue pricing, seats, members, and approval status.</p>
        </div>
        {canCreateRequest && <Button onClick={openNewRequest} className="h-9 gap-1.5 bg-fuchsia-500 text-white hover:bg-fuchsia-600" data-testid="btn-new-subscription-request"><Plus className="h-3.5 w-3.5" />New subscription request</Button>}
      </div>

      <SubscriptionDuplicateAlerts requests={requests} />

      <div className="inline-flex rounded-xl border border-white/5 bg-[#12121A] p-1">
        <button type="button" onClick={() => setActiveTab("allocations")} className={`rounded-lg px-3 py-2 text-xs font-semibold ${activeTab === "allocations" ? "bg-fuchsia-500/15 text-fuchsia-300" : "text-zinc-500 hover:text-zinc-300"}`}><CreditCard className="mr-1.5 inline h-3.5 w-3.5" />Allocations</button>
        <button type="button" onClick={() => setActiveTab("requests")} className={`rounded-lg px-3 py-2 text-xs font-semibold ${activeTab === "requests" ? "bg-fuchsia-500/15 text-fuchsia-300" : "text-zinc-500 hover:text-zinc-300"}`}><ClipboardList className="mr-1.5 inline h-3.5 w-3.5" />Requests <span className="ml-1 rounded-full bg-white/[0.06] px-1.5 py-0.5 text-[9px]">{requests.length}</span></button>
        <button type="button" onClick={() => setActiveTab("tracker")} className={`rounded-lg px-3 py-2 text-xs font-semibold ${activeTab === "tracker" ? "bg-fuchsia-500/15 text-fuchsia-300" : "text-zinc-500 hover:text-zinc-300"}`}><PackageCheck className="mr-1.5 inline h-3.5 w-3.5" />Tracker</button>
      </div>

      {activeTab === "tracker" ? (
        <SubscriptionTrackerView requests={requests} user={user} onEdit={openFulfilment} />
      ) : activeTab === "requests" ? (
        <SubscriptionRequestsView requests={requests} loading={requestLoading} error={requestError} user={user} onRetry={loadRequests} onEdit={openEditRequest} onSubmit={submitDraft} onDelete={deleteDraft} onDecision={decide} onFulfil={openFulfilment} onReview={openReview} />
      ) : <>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Kpi label="Allocations" value={filtered.length.toLocaleString()} sub={`${allocationRows.length} total`} icon={CreditCard} />
        <Kpi label="Monthly spend" value={fmtCurrency(totalMonthly, { compact: false })} sub="per month · all projects" />
        <Kpi label="Projects" value={distinctProjects} sub="with subscriptions" icon={FolderKanban} />
        <Kpi label="Members" value={distinctMembers} sub="allocated" icon={Users} />
        <Kpi label="Seat utilization" value={`${allocInsights.utilization}%`} sub={`${allocInsights.unusedSeats} unused`} icon={Gauge} />
      </div>

      {allocInsights.unusedSeats > 0 && (
        <div className="flex flex-wrap items-start gap-3 rounded-2xl border border-amber-500/25 bg-amber-500/[0.06] p-4" data-testid="subs-unused-alert">
          <div className="flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-amber-500/15 text-amber-300"><AlertTriangle className="h-4 w-4" /></div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-amber-100">{fmtCurrency(allocInsights.estWaste, { compact: false })} / mo on {allocInsights.unusedSeats} unused seat{allocInsights.unusedSeats > 1 ? "s" : ""}</div>
            <div className="mt-0.5 text-xs text-amber-200/70">Seats allocated to a project but not yet assigned to a member. Reassign or release them to recover spend.</div>
            {allocInsights.gaps.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">{allocInsights.gaps.map((g) => <span key={g.project} className="rounded-md bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-200">{g.project} · {g.unused}</span>)}</div>
            )}
          </div>
        </div>
      )}

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="rounded-2xl border border-white/5 bg-[#12121A]">
          <div className="flex items-center justify-between border-b border-white/5 px-4 py-3"><h2 className="text-sm font-semibold text-white">Monthly spend by project</h2><span className="text-[10px] text-zinc-500">top {Math.min(byProject.length, 11)} of {byProject.length}</span></div>
          <div className="space-y-1 p-4">
            {(() => { const top = [...byProject].sort((a, b) => b.total - a.total).slice(0, 11); const max = Math.max(...top.map((t) => t.total), 1); return top.map((t) => (
              <div key={t.project} className="grid grid-cols-[110px_1fr_auto] items-center gap-3 py-0.5"><span className="truncate text-xs font-medium text-zinc-300" title={t.project}>{t.project}</span><div className="h-2.5 overflow-hidden rounded-full bg-white/[0.06]"><div className="h-full rounded-full bg-fuchsia-500" style={{ width: `${Math.max((t.total / max) * 100, 1.5)}%` }} /></div><span className="text-right text-[11px] tabular text-zinc-400">{fmtCurrency(t.total, { compact: false })}</span></div>
            )); })()}
            {byProject.length === 0 && <div className="py-6 text-center text-xs text-zinc-600">No data</div>}
          </div>
        </div>
        <div className="rounded-2xl border border-white/5 bg-[#12121A]">
          <div className="flex items-center justify-between border-b border-white/5 px-4 py-3"><h2 className="text-sm font-semibold text-white">Seats vs members</h2><div className="flex items-center gap-3 text-[10px] text-zinc-500"><span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-sky-400" />Seats</span><span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-fuchsia-500" />Members</span></div></div>
          <div className="space-y-1.5 p-4">
            {(() => { const top = [...byProject].sort((a, b) => b.seats - a.seats).slice(0, 11); const max = Math.max(...top.map((t) => t.seats), 1); return top.map((t) => (
              <div key={t.project} className="grid grid-cols-[110px_1fr_auto] items-center gap-3 py-0.5"><span className="truncate text-xs font-medium text-zinc-300" title={t.project}>{t.project}</span><div className="flex flex-col gap-1"><div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]"><div className="h-full rounded-full bg-sky-400" style={{ width: `${(t.seats / max) * 100}%` }} /></div><div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]"><div className="h-full rounded-full bg-fuchsia-500" style={{ width: `${(t.members / max) * 100}%` }} /></div></div><span className="text-right text-[11px] tabular text-zinc-400">{t.members}/{t.seats}</span></div>
            )); })()}
            {byProject.length === 0 && <div className="py-6 text-center text-xs text-zinc-600">No data</div>}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search member / email / code…"
            data-testid="subs-search"
            className={`${selectCls} pl-8 w-64`}
          />
        </div>
        <select value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)} data-testid="subs-filter-project" className={selectCls}>
          <option value="all">All projects</option>
          {projectOptions.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <select value={subFilter} onChange={(e) => setSubFilter(e.target.value)} data-testid="subs-filter-sub" className={selectCls}>
          <option value="all">All subscriptions</option>
          {subOptions.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={phaseFilter} onChange={(e) => setPhaseFilter(e.target.value)} data-testid="subs-filter-phase" className={selectCls}>
          <option value="all">All phases</option>
          {phaseOptions.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} data-testid="subs-sort" className={selectCls}>
          <option value="spend">Sort: highest spend</option>
          <option value="util">Sort: lowest utilization</option>
          <option value="name">Sort: name A–Z</option>
        </select>
      </div>

      {/* Project accordion */}
      {byProject.length === 0 ? (
        <div className="text-center text-sm text-zinc-500 py-10">No subscription allocations match these filters.</div>
      ) : (
        <div className="space-y-2.5">
          {byProject.map((p) => {
            const isOpen = expanded.has(p.project);
            const util = Math.round((p.members / Math.max(p.seats, 1)) * 100);
            const utilCls = util >= 90 ? "bg-emerald-500" : util >= 60 ? "bg-amber-500" : "bg-red-500";
            const avgPerSeat = p.seats ? p.total / p.seats : 0;
            return (
              <div key={p.project} className="rounded-2xl border border-white/5 bg-[#12121A]" data-testid={`subs-project-${p.project}`}>
                <button type="button" onClick={() => toggle(p.project)} className="grid w-full grid-cols-[16px_1fr] items-center gap-3 rounded-2xl p-4 text-left hover:bg-white/[0.02] lg:grid-cols-[16px_minmax(0,1fr)_150px_64px_70px_100px]">
                  {isOpen ? <ChevronDown className="h-4 w-4 text-zinc-500" /> : <ChevronRight className="h-4 w-4 text-zinc-500" />}
                  <div className="min-w-0">
                    <div className="truncate font-display text-[15px] font-semibold text-white">{p.project}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">{p.subCounts.map(([sub, count]) => <span key={sub} className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">{sub} · {count}</span>)}</div>
                  </div>
                  <div className="hidden lg:block">
                    <div className="text-[10px] uppercase tracking-widest text-zinc-500">Seat utilization</div>
                    <div className="mt-1 flex items-center gap-2"><div className="h-1.5 w-[86px] overflow-hidden rounded-full bg-white/[0.06]"><div className={`h-full rounded-full ${utilCls}`} style={{ width: `${util}%` }} /></div><span className="text-[11px] text-zinc-400">{util}%</span></div>
                  </div>
                  <div className="hidden text-right lg:block"><div className="text-[10px] uppercase tracking-widest text-zinc-500">Seats</div><div className="text-sm font-semibold tabular text-white">{p.seats}</div></div>
                  <div className="hidden text-right lg:block"><div className="text-[10px] uppercase tracking-widest text-zinc-500">Members</div><div className="text-sm font-semibold tabular text-white">{p.members}</div></div>
                  <div className="hidden text-right lg:block"><div className="text-[10px] uppercase tracking-widest text-zinc-500">$/mo</div><div className="text-sm font-semibold tabular text-fuchsia-300">{fmtCurrency(p.total, { compact: false })}</div></div>
                </button>

                {isOpen && (
                  <div className="border-t border-white/5 bg-white/[0.02] p-4">
                    <div className="flex flex-wrap gap-2">
                      {p.subCounts.map(([sub, count]) => <div key={sub} className="min-w-[130px] rounded-lg border border-white/5 bg-[#12121A] p-2.5"><div className="text-[10px] font-semibold text-zinc-500">{sub}</div><div className="mt-0.5 text-sm font-semibold text-white">{count} seat{count > 1 ? "s" : ""}</div></div>)}
                      <div className="min-w-[130px] rounded-lg border border-white/5 bg-[#12121A] p-2.5"><div className="text-[10px] font-semibold text-zinc-500">Unused seats</div><div className={`mt-0.5 text-sm font-semibold ${p.unused ? "text-amber-300" : "text-emerald-300"}`}>{p.unused}</div></div>
                      <div className="min-w-[130px] rounded-lg border border-white/5 bg-[#12121A] p-2.5"><div className="text-[10px] font-semibold text-zinc-500">Est. waste / mo</div><div className={`mt-0.5 text-sm font-semibold ${p.unused ? "text-amber-300" : "text-emerald-300"}`}>{fmtCurrency(p.unused * avgPerSeat, { compact: false })}</div></div>
                    </div>
                    <div className="mt-3 overflow-x-auto">
                      <table className="w-full min-w-[640px] text-sm">
                        <thead>
                          <tr className="border-b border-white/5 text-[10px] uppercase tracking-widest text-zinc-500">
                            <th className="py-2 pr-3 text-left font-semibold">Member</th>
                            <th className="px-3 py-2 text-left font-semibold">Subscriptions</th>
                            <th className="px-3 py-2 text-left font-semibold">Phase</th>
                            <th className="px-3 py-2 text-left font-semibold">Timeline</th>
                            <th className="py-2 pl-3 text-right font-semibold">$ / mo</th>
                          </tr>
                        </thead>
                        <tbody>
                          {p.memberRows.map((m, i) => (
                            <tr key={`${m.email || m.name}-${i}`} className="border-b border-white/[0.04]">
                              <td className="py-2 pr-3"><div className="text-zinc-100">{m.name}</div>{m.email && <div className="text-[11px] text-zinc-500">{m.email}</div>}</td>
                              <td className="px-3 py-2">{m.subs.map((s) => <span key={s} className="mr-1 inline-block rounded-md border border-white/10 bg-white/[0.03] px-1.5 py-0.5 text-[10px] text-zinc-300">{s}</span>)}</td>
                              <td className="px-3 py-2 text-zinc-400">{m.phase || "—"}</td>
                              <td className="px-3 py-2 text-[11px] tabular text-zinc-400">{m.started || m.ended ? `${m.started || "—"} → ${m.ended || "—"}` : "—"}</td>
                              <td className="py-2 pl-3 text-right tabular text-zinc-100">{fmtCurrency(m.amount, { compact: false })}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      </>}

      <SubscriptionRequestDialog open={requestOpen} onOpenChange={setRequestOpen} editingRequest={editingRequest} requests={requests} onSaved={() => { setEditingRequest(null); setActiveTab("requests"); loadRequests(); }} />
      <SubscriptionFulfilmentDialog open={fulfilOpen} onOpenChange={setFulfilOpen} request={fulfilRequest} onSaved={() => { setFulfilRequest(null); loadRequests(); }} />
      <SubscriptionReviewDialog open={reviewOpen} onOpenChange={setReviewOpen} request={reviewRequest} role={user?.role} user={user} onSaved={() => { setReviewRequest(null); loadRequests(); }} />
    </div>
  );
};

const statusMeta = {
  draft: ["Draft", "bg-white/[0.05] text-zinc-400"],
  "cto-review": ["CTO review", "bg-sky-500/10 text-sky-300"],
  "cfo-review": ["CFO review", "bg-amber-500/10 text-amber-300"],
  "returned-to-requester": ["Returned", "bg-orange-500/10 text-orange-300"],
  rejected: ["Rejected", "bg-red-500/10 text-red-300"],
  "fulfilment-pending": ["Fulfilment pending", "bg-violet-500/10 text-violet-300"],
  active: ["Active", "bg-emerald-500/10 text-emerald-300"],
};
const SubscriptionRequestsView = ({ requests, loading, error, user, onRetry, onEdit, onSubmit, onDelete, onDecision, onFulfil, onReview }) => {
  if (loading) return <div className="rounded-2xl border border-white/5 bg-[#12121A] py-14 text-center text-sm text-zinc-500">Loading subscription requests…</div>;
  if (error) return <div className="rounded-2xl border border-red-500/20 bg-red-500/[0.04] p-6 text-center"><div className="text-sm font-semibold text-red-300">Subscription requests are unavailable</div><div className="mt-1 text-xs text-zinc-500">{error}</div><Button variant="outline" size="sm" className="mt-3" onClick={onRetry}>Try again</Button></div>;
  return <div className="space-y-3">
    {requests.map((request) => {
      const [label, tone] = statusMeta[request.status] || [request.status, "bg-white/[0.05] text-zinc-400"];
      const isRequester = String(request.requester?.email || "").toLowerCase() === String(user?.email || "").toLowerCase() || request.requester?.name === user?.name;
      return <div key={request.id} className="rounded-2xl border border-white/5 bg-[#12121A] p-4" data-testid={`subscription-request-${request.id}`}>
        <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex items-center gap-2"><span className="text-sm font-semibold text-white">{request.request_number}</span><span className={`rounded-full px-2 py-0.5 text-[9px] font-semibold ${tone}`}>{label}</span></div><div className="mt-1 text-xs text-zinc-500">{request.project_name} · {request.phase_name} · {String(request.request_type || "initial").replaceAll("-", " ")}</div></div><div className="text-right"><div className="text-lg font-semibold tabular text-fuchsia-300">{fmtCurrency(request.approved_amount ?? request.requested_amount, { compact: false })}</div><div className="text-[10px] text-zinc-500">{request.approved_amount != null ? "Approved amount" : "Requested amount"}</div></div></div>
        <div className="mt-3 grid gap-2 sm:grid-cols-3"><RequestMetric label="Subscriptions" value={String(request.lines?.length || 0)} /><RequestMetric label="Seats" value={String((request.lines || []).reduce((sum, line) => sum + Number(line.seats || 0), 0))} /><RequestMetric label="Members" value={String(new Set((request.lines || []).flatMap((line) => line.members || []).map((member) => member.email || member.id || member.name)).size)} /></div>
        <div className="mt-3 flex flex-wrap gap-1.5">{(request.lines || []).map((line) => <span key={line.id} className="rounded-md border border-emerald-500/20 bg-emerald-500/[0.06] px-2 py-1 text-[10px] text-emerald-300">{line.subscription} · {line.seats} seats · {fmtCurrency(line.total, { compact: false })}</span>)}</div>
        <div className="mt-3 border-t border-white/5 pt-3"><div className="mb-2 flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-widest text-zinc-500"><Clock3 className="h-3 w-3" />Status timeline</div><div className="flex flex-wrap gap-2">{(request.history || []).map((entry, index) => <span key={`${entry.at}-${index}`} className="rounded-lg bg-white/[0.025] px-2.5 py-1.5 text-[10px] text-zinc-400"><b className="text-zinc-300">{entry.action}</b> · {new Date(entry.at).toLocaleString()}</span>)}</div></div>
        {(request.documents || []).length > 0 && <div className="mt-3 flex flex-wrap gap-2">{request.documents.map((document) => <a key={document.id} href={`${BACKEND_URL}/api/subscription-requests/${request.id}/documents/${document.id}`} className="inline-flex items-center gap-1 rounded-md border border-white/10 px-2 py-1 text-[10px] text-zinc-400 hover:text-fuchsia-300"><FileText className="h-3 w-3" />{document.name}</a>)}</div>}
        <div className="mt-3 flex flex-wrap justify-end gap-2">
          {isRequester && ["draft", "returned-to-requester"].includes(request.status) && <Button variant="outline" size="sm" onClick={() => onEdit(request)}><Pencil className="mr-1 h-3.5 w-3.5" />Edit</Button>}
          {isRequester && request.status === "draft" && <><Button variant="outline" size="sm" onClick={() => onDelete(request)} className="text-red-300"><Trash2 className="mr-1 h-3.5 w-3.5" />Delete</Button><Button size="sm" onClick={() => onSubmit(request)} className="bg-fuchsia-500 text-white"><Send className="mr-1 h-3.5 w-3.5" />Submit</Button></>}
          {user?.role === "CTO" && request.status === "cto-review" && <Button size="sm" onClick={() => onReview(request)} className="bg-fuchsia-500 text-white"><Pencil className="mr-1 h-3.5 w-3.5" />Review &amp; edit</Button>}
          {user?.role === "CFO" && request.status === "cfo-review" && <Button size="sm" onClick={() => onReview(request)} className="bg-fuchsia-500 text-white"><CheckCircle2 className="mr-1 h-3.5 w-3.5" />Review &amp; approve</Button>}
          {isRequester && request.status === "fulfilment-pending" && <Button size="sm" onClick={() => onFulfil(request)} className="bg-fuchsia-500 text-white"><PackageCheck className="mr-1 h-3.5 w-3.5" />Complete fulfilment</Button>}
          {isRequester && request.status === "active" && <Button variant="outline" size="sm" onClick={() => onFulfil(request)}><PackageCheck className="mr-1 h-3.5 w-3.5" />Edit fulfilment details</Button>}
          {user?.role === "IT" && request.status === "fulfilment-pending" && <Button size="sm" onClick={() => onDecision(request, "activate")} className="bg-emerald-500 text-white">Mark active</Button>}
        </div>
      </div>;
    })}
    {!requests.length && <div className="rounded-2xl border border-dashed border-white/10 bg-[#12121A] py-14 text-center"><ClipboardList className="mx-auto h-7 w-7 text-zinc-600" /><div className="mt-2 text-sm font-semibold text-zinc-300">No subscription requests yet</div><div className="mt-1 text-xs text-zinc-500">Create a request to start the CTO and CFO approval flow.</div></div>}
  </div>;
};
const RequestMetric = ({ label, value }) => <div className="rounded-lg border border-white/5 bg-white/[0.02] p-2.5"><div className="text-[9px] font-semibold uppercase tracking-widest text-zinc-500">{label}</div><div className="mt-1 text-sm font-semibold tabular text-zinc-200">{value}</div></div>;

export default Subscriptions;
