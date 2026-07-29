import { useMemo, useState } from "react";
import { CreditCard, Search, Users, FolderKanban, ChevronDown, ChevronRight } from "lucide-react";
import { SUBSCRIPTION_ALLOCATIONS } from "../data/subscriptionTracker";
import { fmtCurrency } from "../lib/format";

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
  const [projectFilter, setProjectFilter] = useState("all");
  const [subFilter, setSubFilter] = useState("all");
  const [phaseFilter, setPhaseFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState(() => new Set());

  const projectOptions = useMemo(() => uniqueSorted(SUBSCRIPTION_ALLOCATIONS.map((r) => r.project)), []);
  const subOptions = useMemo(() => uniqueSorted(SUBSCRIPTION_ALLOCATIONS.map((r) => r.sub)), []);
  const phaseOptions = useMemo(() => uniqueSorted(SUBSCRIPTION_ALLOCATIONS.map((r) => r.phase)), []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return SUBSCRIPTION_ALLOCATIONS.filter((r) =>
      (projectFilter === "all" || r.project === projectFilter) &&
      (subFilter === "all" || r.sub === subFilter) &&
      (phaseFilter === "all" || r.phase === phaseFilter) &&
      (!q || `${r.name} ${r.email} ${r.emp}`.toLowerCase().includes(q))
    );
  }, [projectFilter, subFilter, phaseFilter, search]);

  const totalMonthly = filtered.reduce((sum, r) => sum + Number(r.amount || 0), 0);
  const distinctMembers = new Set(filtered.map((r) => r.email)).size;
  const distinctProjects = new Set(filtered.map((r) => r.project)).size;

  const byProject = useMemo(() => {
    const map = new Map();
    filtered.forEach((r) => {
      if (!map.has(r.project)) map.set(r.project, []);
      map.get(r.project).push(r);
    });
    return Array.from(map.entries())
      .map(([project, rows]) => ({
        project,
        rows: [...rows].sort((a, b) => String(a.phase).localeCompare(String(b.phase)) || String(a.name).localeCompare(String(b.name))),
        total: rows.reduce((sum, r) => sum + Number(r.amount || 0), 0),
        members: new Set(rows.map((r) => r.email)).size,
        subCounts: Array.from(
          rows.reduce((m, r) => m.set(r.sub, (m.get(r.sub) || 0) + 1), new Map()).entries()
        ).sort((a, b) => b[1] - a[1]),
      }))
      .sort((a, b) => b.rows.length - a.rows.length);
  }, [filtered]);

  const toggle = (project) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(project)) next.delete(project);
      else next.add(project);
      return next;
    });

  return (
    <div className="space-y-6" data-testid="page-subscriptions">
      <div>
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] font-semibold text-fuchsia-400">
          <CreditCard className="w-3 h-3" /> Subscription Tracker
        </div>
        <h1 className="mt-1 font-display font-semibold text-3xl tracking-tight text-white">Subscriptions</h1>
        <p className="mt-1 text-sm text-zinc-400">Project- and phase-wise subscription allocations and the members assigned to each.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label="Allocations" value={filtered.length.toLocaleString()} sub={`${SUBSCRIPTION_ALLOCATIONS.length} total`} icon={CreditCard} />
        <Kpi label="Monthly spend" value={fmtCurrency(totalMonthly, { compact: false })} sub="per month" />
        <Kpi label="Projects" value={distinctProjects} sub="with subscriptions" icon={FolderKanban} />
        <Kpi label="Members" value={distinctMembers} sub="allocated" icon={Users} />
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
      </div>

      {/* Project cards */}
      {byProject.length === 0 ? (
        <div className="text-center text-sm text-zinc-500 py-10">No subscription allocations match these filters.</div>
      ) : (
        <div className="space-y-3">
          {byProject.map(({ project, rows, total, members, subCounts }) => {
            const isOpen = expanded.has(project);
            return (
              <div key={project} className="bg-[#12121A] rounded-2xl border border-white/5" data-testid={`subs-project-${project}`}>
                <button
                  type="button"
                  onClick={() => toggle(project)}
                  className="w-full p-4 flex items-center justify-between gap-3 text-left hover:bg-white/[0.02] rounded-2xl"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {isOpen ? <ChevronDown className="w-4 h-4 text-zinc-500 flex-shrink-0" /> : <ChevronRight className="w-4 h-4 text-zinc-500 flex-shrink-0" />}
                    <div className="min-w-0">
                      <div className="font-display font-semibold text-[15px] text-white truncate">{project}</div>
                      <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                        {subCounts.map(([sub, count]) => (
                          <span key={sub} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
                            {sub} · {count}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-5 flex-shrink-0 text-right">
                    <div>
                      <div className="text-[10px] uppercase tracking-widest text-zinc-500">Seats</div>
                      <div className="text-sm font-semibold text-white tabular">{rows.length}</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-widest text-zinc-500">Members</div>
                      <div className="text-sm font-semibold text-white tabular">{members}</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-widest text-zinc-500">$/mo</div>
                      <div className="text-sm font-semibold text-fuchsia-300 tabular">{fmtCurrency(total, { compact: false })}</div>
                    </div>
                  </div>
                </button>

                {isOpen && (
                  <div className="px-4 pb-4 overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-[10px] uppercase tracking-widest text-zinc-500 border-b border-white/5">
                          <th className="text-left font-semibold py-2 pr-3">Member</th>
                          <th className="text-left font-semibold py-2 px-3">Email</th>
                          <th className="text-left font-semibold py-2 px-3">Phase</th>
                          <th className="text-left font-semibold py-2 px-3">Subscription</th>
                          <th className="text-right font-semibold py-2 px-3">Amount</th>
                          <th className="text-left font-semibold py-2 px-3">Timeline</th>
                          <th className="text-left font-semibold py-2 pl-3">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((r, i) => (
                          <tr key={`${r.email}-${r.phase}-${i}`} className="border-b border-white/[0.04]">
                            <td className="py-2 pr-3 text-zinc-100">{r.name || "—"}</td>
                            <td className="py-2 px-3 text-zinc-400 text-xs">{r.email || "—"}</td>
                            <td className="py-2 px-3 text-zinc-300">{r.phase}</td>
                            <td className="py-2 px-3 text-zinc-300">{r.sub}</td>
                            <td className="py-2 px-3 text-right text-zinc-100 tabular">{fmtCurrency(Number(r.amount || 0), { compact: false })}</td>
                            <td className="py-2 px-3 text-zinc-400 tabular text-xs">{r.started || r.ended ? `${r.started || "—"} → ${r.ended || "—"}` : "—"}</td>
                            <td className="py-2 pl-3">
                              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">{r.status}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Subscriptions;
