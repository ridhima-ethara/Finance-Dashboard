import { useState, useMemo, Fragment } from "react";
import { fmtCurrency, fmtPct } from "../../lib/format";
import { toast } from "sonner";
import { Button } from "../../components/ui/button";
import { useApp } from "../../context/AppContext";
import {
  ShieldCheck,
  Lock,
  Plus,
  Minus,
  Send,
  RotateCcw,
  AlertTriangle,
  Wallet,
  TrendingUp,
  Percent,
  ChevronDown,
  ChevronRight,
} from "lucide-react";

// Build lifecycle rows for each buffer-using project (initial → requested → approved → consumed → remaining).
const buildLifecycle = (perProject, policyPct) =>
  perProject.map((p) => {
    const projectBudget = p.approved; // project's approved budget
    const initial = Math.round(projectBudget * ((policyPct || 0) / 100));
    const additionalRequested = Math.max(0, p.allocated - initial + (p.status === "critical" ? Math.round(projectBudget * 0.03) : p.status === "using" ? Math.round(projectBudget * 0.02) : 0));
    const bufferApproved = p.allocated; // total buffer approved for the project
    const consumed = p.consumed;
    const remaining = Math.max(0, bufferApproved - consumed);
    return { ...p, projectBudget, initial, additionalRequested, bufferApproved, consumed, remaining };
  });

const Buffer = () => {
  const { bufferOverview, applyBufferAction } = useApp();
  const [pct, setPct] = useState("5"); // percentage input
  const [selectedProject, setSelectedProject] = useState(bufferOverview.perProject[0]?.id || "");
  const [expanded, setExpanded] = useState({});
  const [lifecyclePage, setLifecyclePage] = useState(1);

  const total = bufferOverview.total;
  const available = bufferOverview.available;
  const consumed = total - available;
  const utilizationPct = total ? Math.round((consumed / total) * 100) : 0;
  const proj = bufferOverview.perProject.find((p) => p.id === selectedProject);
  const pctValue = Number(pct || 0);
  // Amount computed from % of pool for pool-level actions, and of project approved budget for project-level actions
  const amountFromPct = Math.round((total * pctValue) / 100);
  const amountFromPctProject = proj ? Math.round((proj.approved * pctValue) / 100) : 0;

  const lifecycle = useMemo(() => buildLifecycle(bufferOverview.perProject, bufferOverview.policyPct), [bufferOverview]);
  const lifecyclePageSize = 10;
  const lifecycleTotalPages = Math.max(1, Math.ceil(lifecycle.length / lifecyclePageSize));
  const currentLifecyclePage = Math.min(lifecyclePage, lifecycleTotalPages);
  const lifecyclePageStart = (currentLifecyclePage - 1) * lifecyclePageSize;
  const paginatedLifecycle = lifecycle.slice(lifecyclePageStart, lifecyclePageStart + lifecyclePageSize);

  const validPct = (v) => v > 0 && v <= 100;

  const increase = () => {
    if (!validPct(pctValue)) { toast.error("Enter a valid percentage (1-100)"); return; }
    applyBufferAction({ pct: pctValue, action: "increase-pool" });
    toast.success("Buffer pool increased", { description: `+${pctValue}% of pool · ${fmtCurrency(amountFromPct, { compact: false })} · new total ${fmtCurrency(total + amountFromPct)}` });
  };
  const reduce = () => {
    if (!validPct(pctValue)) { toast.error("Enter a valid percentage (1-100)"); return; }
    if (amountFromPct > available) { toast.error("Cannot reduce beyond available buffer"); return; }
    applyBufferAction({ pct: pctValue, action: "reduce-pool" });
    toast.success("Buffer pool reduced", { description: `−${pctValue}% · ${fmtCurrency(amountFromPct, { compact: false })}` });
  };
  const allocate = () => {
    if (!validPct(pctValue)) { toast.error("Enter a valid percentage (1-100)"); return; }
    if (!proj) { toast.error("Select a project"); return; }
    if (amountFromPctProject > available) { toast.error("Amount exceeds available pool"); return; }
    applyBufferAction({ projectId: proj.id, pct: pctValue, action: "allocate-project" });
    toast.success("Buffer allocated (hidden)", {
      description: `${proj.name} · +${pctValue}% of approved (${fmtCurrency(amountFromPctProject, { compact: false })}) · not visible to TPM/CTO`,
    });
  };
  const release = () => {
    if (!validPct(pctValue)) { toast.error("Enter a valid percentage (1-100)"); return; }
    if (!proj) { toast.error("Select a project"); return; }
    applyBufferAction({ projectId: proj.id, pct: pctValue, action: "release-project" });
    toast.success("Buffer released back to pool", { description: `${proj.name} · +${fmtCurrency(amountFromPctProject, { compact: false })} freed` });
  };

  const toggle = (id) => setExpanded((e) => ({ ...e, [id]: !e[id] }));

  return (
    <div className="space-y-5" data-testid="page-buffer">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] font-semibold text-emerald-400">
            <ShieldCheck className="w-3 h-3" /> CFO Portal
          </div>
          <h1 className="mt-1 font-display font-semibold text-3xl tracking-tight text-white flex items-center gap-2">
            Contingency buffer <Lock className="w-5 h-5 text-fuchsia-300" />
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Hidden safety cushion for overruns and emergency additional requests.
          </p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full border border-fuchsia-500/25 bg-fuchsia-500/[0.08] px-3 py-1.5 text-[10px] uppercase tracking-widest font-semibold text-fuchsia-300">
          <Lock className="w-3 h-3" /> CFO confidential
        </div>
      </div>

      {/* Buffer overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="relative overflow-hidden md:col-span-2 bg-gradient-to-br from-fuchsia-500/20 via-fuchsia-500/[0.06] to-transparent rounded-2xl border border-fuchsia-500/25 p-5" data-testid="buffer-overview">
          <div className="absolute -right-12 -top-16 w-40 h-40 rounded-full border border-fuchsia-400/10" />
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest font-semibold text-fuchsia-300 mb-2">
            <Wallet className="w-3 h-3" /> Total pool
          </div>
          <div className="font-display text-4xl font-semibold text-white tabular relative">{fmtCurrency(total)}</div>
          <div className="mt-4 h-2 rounded-full bg-white/[0.05] overflow-hidden">
            <div className="h-full bg-gradient-to-r from-fuchsia-500 to-pink-500" style={{ width: `${utilizationPct}%` }} />
          </div>
          <div className="mt-2 flex justify-between text-[11px]">
            <span className="text-zinc-400">Consumed <span className="text-white font-semibold tabular">{fmtCurrency(consumed)}</span></span>
            <span className="text-zinc-400">Available <span className="text-emerald-300 font-semibold tabular">{fmtCurrency(available)}</span></span>
          </div>
        </div>

        <Stat label="Utilization" value={fmtPct(utilizationPct)} sub={`${fmtCurrency(consumed)} used`} icon={TrendingUp} tone={utilizationPct > 75 ? "warning" : "positive"} testid="buffer-util" />
        <Stat label="Policy" value={`${bufferOverview.policyPct}%`} sub="Auto-reserved per project" icon={ShieldCheck} testid="buffer-policy" />
      </div>

      {/* Alerts */}
      {bufferOverview.alerts.length > 0 && (
        <div className="space-y-2" data-testid="buffer-alerts">
          {bufferOverview.alerts.map((a) => (
            <div
              key={a.id}
              data-testid={`alert-${a.id}`}
              className={`rounded-xl border p-3 flex items-center gap-3 ${
                a.severity === "critical" ? "border-red-500/30 bg-red-500/[0.05]" : "border-amber-500/30 bg-amber-500/[0.05]"
              }`}
            >
              <AlertTriangle className={`w-4 h-4 flex-shrink-0 ${a.severity === "critical" ? "text-red-300" : "text-amber-300"}`} />
              <div className="text-sm text-zinc-100">{a.message}</div>
              <span className={`ml-auto text-[10px] uppercase tracking-widest font-semibold ${a.severity === "critical" ? "text-red-300" : "text-amber-300"}`}>
                {a.severity}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Actions — percentage based */}
      <div className="bg-[#12121A] rounded-2xl border border-white/10 p-5 shadow-[0_18px_50px_rgba(0,0,0,0.12)]" data-testid="buffer-actions">
        <div className="flex items-baseline justify-between mb-3">
          <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
            <div className="font-display font-semibold text-[15px] text-white">Buffer actions</div>
            <div className="text-xs text-zinc-500 mt-0.5">Buffer allocation is expressed as a percentage. Pool actions use % of total pool · project actions use % of the project&apos;s approved budget.</div>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
          <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
            <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500 mb-1.5">Project (for allocate/release)</div>
            <select
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
              data-testid="buffer-project"
              className="w-full h-10 px-3 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40"
            >
              {bufferOverview.perProject.map((p) => (
                <option key={p.id} value={p.id}>{p.name} · approved {fmtCurrency(p.approved)}</option>
              ))}
            </select>
            {proj && (
              <div className="mt-2 text-[11px] text-zinc-500">
                Current buffer allocated: <span className="text-white tabular">{fmtCurrency(proj.allocated, { compact: false })}</span> ({Math.round((proj.allocated / proj.approved) * 100)}% of approved)
              </div>
            )}
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500 mb-1.5">Allocation percentage</div>
            <div className="relative">
              <Percent className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="number"
                min="0"
                max="100"
                step="0.5"
                value={pct}
                onChange={(e) => setPct(e.target.value)}
                placeholder="5"
                data-testid="buffer-pct"
                className="w-full h-10 pl-8 pr-14 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-zinc-100 tabular focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-zinc-500 tabular">%</span>
            </div>
              <input
                type="range"
                min="0"
                max="20"
                step="0.5"
                value={pctValue}
                onChange={(e) => setPct(e.target.value)}
                data-testid="buffer-pct-slider"
                className="w-full mt-2 accent-fuchsia-500"
              />
            <div className="mt-1 flex items-center justify-between text-[11px] text-zinc-500 tabular">
              <span>Pool amount: <span className="text-fuchsia-300 font-semibold">{fmtCurrency(amountFromPct, { compact: false })}</span></span>
              <span>Project amount: <span className="text-fuchsia-300 font-semibold">{fmtCurrency(amountFromPctProject, { compact: false })}</span></span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button onClick={increase} className="h-9 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white gap-2" data-testid="btn-increase">
            <Plus className="w-3.5 h-3.5" /> Increase pool by {pctValue}%
          </Button>
          <Button onClick={reduce} variant="outline" className="h-9 rounded-lg border-white/10 bg-white/[0.04] text-zinc-200 gap-2" data-testid="btn-reduce">
            <Minus className="w-3.5 h-3.5" /> Reduce pool by {pctValue}%
          </Button>
          <Button onClick={allocate} className="h-9 rounded-lg bg-fuchsia-500 hover:bg-fuchsia-600 text-white gap-2 shadow-[0_0_20px_rgba(232,25,184,0.35)]" data-testid="btn-allocate">
            <Send className="w-3.5 h-3.5" /> Allocate {pctValue}% to project
          </Button>
          <Button onClick={release} variant="outline" className="h-9 rounded-lg border-amber-500/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/15 gap-2" data-testid="btn-release">
            <RotateCcw className="w-3.5 h-3.5" /> Release {pctValue}% back
          </Button>
        </div>
      </div>

      {/* Projects using buffer — lifecycle view */}
      <div className="bg-[#12121A] rounded-2xl border border-white/10 p-6 shadow-[0_18px_50px_rgba(0,0,0,0.12)]" data-testid="buffer-projects">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <div className="font-display font-semibold text-lg text-white">Projects using buffer · lifecycle</div>
            <div className="text-xs text-zinc-500 mt-0.5">
              Initial approved → Additional requested → Buffer approved → Consumed → Remaining
            </div>
          </div>
          <span className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] font-semibold text-zinc-300 tabular">
            {lifecycle.length} projects
          </span>
        </div>
        <div className="overflow-x-auto rounded-xl border border-white/5">
          <table className="w-full min-w-[1100px] text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500 border-b border-white/5 bg-white/[0.025]">
                <th className="text-left py-2 px-3 w-8" />
                <th className="text-left py-2 px-3">Project</th>
                <th className="text-right py-2 px-3">Initial buffer</th>
                <th className="text-right py-2 px-3">Additional requested</th>
                <th className="text-right py-2 px-3">Buffer approved</th>
                <th className="text-right py-2 px-3">Consumed</th>
                <th className="text-right py-2 px-3">Remaining</th>
                <th className="text-left py-2 px-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {paginatedLifecycle.map((p) => {
                const isOpen = !!expanded[p.id];
                const consumedPct = p.bufferApproved ? Math.round((p.consumed / p.bufferApproved) * 100) : 0;
                return (
                  <Fragment key={p.id}>
                    <tr
                      data-testid={`buffer-project-${p.id}`}
                      className="border-b border-white/5 last:border-0 hover:bg-fuchsia-500/[0.035] cursor-pointer transition-colors"
                      onClick={() => toggle(p.id)}
                    >
                      <td className="py-3 px-3 text-zinc-500">
                        {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </td>
                      <td className="py-3 px-3 text-white font-medium">{p.name}</td>
                      <td className="py-3 px-3 text-right text-zinc-300 tabular">{fmtCurrency(p.initial, { compact: false })}</td>
                      <td className="py-3 px-3 text-right text-amber-300 tabular">{fmtCurrency(p.additionalRequested, { compact: false })}</td>
                      <td className="py-3 px-3 text-right text-white font-semibold tabular">{fmtCurrency(p.bufferApproved, { compact: false })}</td>
                      <td className="py-3 px-3 text-right text-fuchsia-300 tabular">{fmtCurrency(p.consumed, { compact: false })}</td>
                      <td className="py-3 px-3 text-right text-emerald-300 tabular">{fmtCurrency(p.remaining, { compact: false })}</td>
                      <td className="py-3 px-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold ${
                          p.status === "critical" ? "bg-red-500/15 text-red-300" : p.status === "using" ? "bg-amber-500/15 text-amber-300" : "bg-emerald-500/15 text-emerald-300"
                        }`}>
                          {p.status}
                        </span>
                      </td>
                    </tr>
                    {isOpen && (
                      <tr data-testid={`buffer-project-detail-${p.id}`} className="bg-white/[0.02]">
                        <td colSpan={8} className="px-4 py-5">
                          <div className="pl-8 pr-3">
                            <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500 mb-2">Lifecycle timeline</div>
                            <LifecycleBar row={p} />
                            <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2 text-[11px]">
                              <MiniField label="Approved project budget" value={fmtCurrency(p.projectBudget, { compact: false })} />
                              <MiniField label="Buffer % of project" value={`${p.projectBudget ? Math.round((p.bufferApproved / p.projectBudget) * 1000) / 10 : 0}%`} />
                              <MiniField label="Consumption" value={`${consumedPct}% of buffer`} />
                              <MiniField label="Coverage remaining" value={fmtCurrency(p.remaining, { compact: false })} tone="positive" />
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
        {lifecycle.length > lifecyclePageSize && (
          <div className="mt-4 flex items-center justify-between gap-3 border-t border-white/5 pt-4" data-testid="buffer-lifecycle-pagination">
            <div className="text-xs text-zinc-500 tabular">
              Showing {lifecyclePageStart + 1}–{Math.min(lifecyclePageStart + lifecyclePageSize, lifecycle.length)} of {lifecycle.length} projects
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={currentLifecyclePage === 1}
                onClick={() => setLifecyclePage(Math.max(1, currentLifecyclePage - 1))}
                className="h-8 rounded-lg border border-white/10 bg-white/[0.03] px-3 text-xs text-zinc-300 hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-40"
                data-testid="buffer-lifecycle-previous"
              >
                Previous
              </button>
              <span className="min-w-[76px] text-center text-xs text-zinc-400 tabular">
                Page {currentLifecyclePage} of {lifecycleTotalPages}
              </span>
              <button
                type="button"
                disabled={currentLifecyclePage === lifecycleTotalPages}
                onClick={() => setLifecyclePage(Math.min(lifecycleTotalPages, currentLifecyclePage + 1))}
                className="h-8 rounded-lg border border-white/10 bg-white/[0.03] px-3 text-xs text-zinc-300 hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-40"
                data-testid="buffer-lifecycle-next"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const LifecycleBar = ({ row }) => {
  // Visual stack: initial | additional | consumed | remaining
  const denom = Math.max(row.bufferApproved, row.initial + row.additionalRequested) || 1;
  const initialPct = Math.min(100, Math.round((row.initial / denom) * 100));
  const additionalPct = Math.min(100 - initialPct, Math.round((row.additionalRequested / denom) * 100));
  const consumedPct = Math.min(100, row.bufferApproved ? Math.round((row.consumed / row.bufferApproved) * 100) : 0);
  const remainingPct = Math.max(0, 100 - consumedPct);
  return (
    <div className="space-y-2">
      <div>
        <div className="flex items-center justify-between text-[10px] text-zinc-500 mb-1">
          <span>Requested vs approved buffer</span>
          <span className="tabular">Approved {row.initial + row.additionalRequested > 0 ? Math.round((row.bufferApproved / (row.initial + row.additionalRequested)) * 100) : 100}% of ask</span>
        </div>
        <div className="relative h-2 rounded-full bg-white/[0.04] overflow-hidden flex">
          <div className="h-full bg-zinc-500/70" style={{ width: `${initialPct}%` }} title={`Initial ${row.initial}`} />
          <div className="h-full bg-amber-500/70" style={{ width: `${additionalPct}%` }} title={`Additional requested ${row.additionalRequested}`} />
        </div>
        <div className="mt-1 flex items-center gap-3 text-[10px]">
          <Legend color="bg-zinc-500/70" label={`Initial · ${row.initial.toLocaleString()}`} />
          <Legend color="bg-amber-500/70" label={`Additional · ${row.additionalRequested.toLocaleString()}`} />
        </div>
      </div>
      <div>
        <div className="flex items-center justify-between text-[10px] text-zinc-500 mb-1">
          <span>Consumption vs remaining (of approved buffer)</span>
          <span className="tabular">{consumedPct}% consumed</span>
        </div>
        <div className="relative h-2 rounded-full bg-white/[0.04] overflow-hidden flex">
          <div className="h-full bg-fuchsia-500/80" style={{ width: `${consumedPct}%` }} title={`Consumed ${row.consumed}`} />
          <div className="h-full bg-emerald-500/70" style={{ width: `${remainingPct}%` }} title={`Remaining ${row.remaining}`} />
        </div>
        <div className="mt-1 flex items-center gap-3 text-[10px]">
          <Legend color="bg-fuchsia-500/80" label={`Consumed · ${row.consumed.toLocaleString()}`} />
          <Legend color="bg-emerald-500/70" label={`Remaining · ${row.remaining.toLocaleString()}`} />
        </div>
      </div>
    </div>
  );
};

const Legend = ({ color, label }) => (
  <span className="inline-flex items-center gap-1 text-zinc-400">
    <span className={`w-2 h-2 rounded-sm ${color}`} /> {label}
  </span>
);

const MiniField = ({ label, value, tone = "neutral" }) => {
  const tones = { positive: "text-emerald-300", negative: "text-red-300", warning: "text-amber-300", neutral: "text-white" };
  return (
    <div className="rounded-lg bg-white/[0.03] border border-white/5 p-2">
      <div className="text-[9px] uppercase tracking-widest font-semibold text-zinc-500">{label}</div>
      <div className={`text-[13px] font-semibold tabular mt-0.5 ${tones[tone]}`}>{value}</div>
    </div>
  );
};

const Stat = ({ label, value, sub, icon: Icon, tone = "neutral", testid }) => {
  const tones = { positive: "text-emerald-300", negative: "text-red-300", warning: "text-amber-300", neutral: "text-white", magenta: "text-fuchsia-300" };
  return (
    <div className="bg-[#12121A] rounded-2xl border border-white/5 p-5" data-testid={testid}>
      <div className="flex items-center justify-between">
        <div className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">{label}</div>
        {Icon && (
          <div className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center">
            <Icon className={`w-3.5 h-3.5 ${tones[tone]}`} />
          </div>
        )}
      </div>
      <div className={`mt-2 font-display font-semibold text-3xl tabular ${tones[tone]}`}>{value}</div>
      {sub && <div className="mt-1 text-[11px] text-zinc-500 tabular">{sub}</div>}
    </div>
  );
};

export default Buffer;
