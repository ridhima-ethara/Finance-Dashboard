import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { PROJECTS } from "../../data/mockProjects";
import { AI_COST_BY_MODEL, AI_COST_BY_PROVIDER } from "../../data/mockTpm";
import { BUFFER } from "../../data/mockCfo";
import { fmtCurrency } from "../../lib/format";
import {
  AlertTriangle,
  ShieldAlert,
  TrendingUp,
  Zap,
  Bell,
  CheckCircle2,
  ChevronRight,
  Settings2,
  Cpu,
} from "lucide-react";

// Alert generators
const buildAlerts = () => {
  const alerts = [];
  // Budget overrun alerts
  PROJECTS.filter((p) => p.utilization >= 100).forEach((p) => {
    const overBy = p.actualSpend - p.estimatedBudget;
    const pct = Math.round(((p.actualSpend - p.estimatedBudget) / p.estimatedBudget) * 100);
    alerts.push({
      id: `alert-over-${p.id}`,
      severity: "critical",
      type: "Budget overrun",
      title: `${p.name} actual spend has exceeded estimated cost by ${fmtCurrency(overBy, { compact: false })} (+${pct}%)`,
      desc: `Approved ${fmtCurrency(p.approvedBudget)} · actual ${fmtCurrency(p.actualSpend)} · TPM ${p.tpm}`,
      project: p.name,
      action: "Run Root Cause Analysis",
      actionLink: `/projects/${p.id}`,
      ts: "2 hours ago",
    });
  });
  // High-risk (>= 90%)
  const watchProjects = PROJECTS.filter((p) => p.utilization >= 90 && p.utilization < 100);
  if (watchProjects.length >= 1) {
    const combinedAtRisk = watchProjects.reduce((s, p) => s + (p.approvedBudget - p.actualSpend), 0);
    alerts.push({
      id: "alert-portfolio",
      severity: "high",
      type: "Portfolio risk",
      title: `${watchProjects.map((p) => p.name).join(", ")} trending above their estimates`,
      desc: `Combined at-risk amount: ${fmtCurrency(combinedAtRisk)} · consider pre-approving a top-up before end of sprint`,
      project: "Portfolio",
      action: "View Portfolio",
      actionLink: "/projects",
      ts: "4 hours ago",
    });
  }
  // AI cost spike
  alerts.push({
    id: "alert-ai-spike",
    severity: "critical",
    type: "AI cost spike",
    title: "Opus 4.8 spend in Crowley Generation spiked 28% in the last 48 hours",
    desc: `Investigate the volume increase or move classification workloads to Gemini 2.5 Pro to save ~$1.2k/mo`,
    project: "Crowley Generation",
    action: "Open AI Cost Analytics",
    actionLink: "/ai-cost",
    ts: "6 hours ago",
  });
  // Buffer threshold
  BUFFER.alerts.forEach((b) => {
    alerts.push({
      id: `alert-buffer-${b.id}`,
      severity: b.severity === "critical" ? "critical" : "high",
      type: "Buffer threshold",
      title: b.message,
      desc: `Confidential buffer pool utilization crossed threshold — review policy or reduce allocation`,
      project: b.project,
      action: "Review Buffer Policy",
      actionLink: "/buffer",
      ts: "8 hours ago",
    });
  });
  // Vendor price
  alerts.push({
    id: "alert-vendor",
    severity: "high",
    type: "Vendor price change",
    title: "OpenAI adjusted long-context pricing thresholds for GPT-4o",
    desc: `Estimated impact +$340/mo across Atlas Ingest and Crowley Sourcing. Re-price affected budgets.`,
    project: "OpenAI",
    action: "View Vendor Detail",
    actionLink: "/keys",
    ts: "1 day ago",
  });
  // Estimation failure
  alerts.push({
    id: "alert-estimate",
    severity: "medium",
    type: "Estimation failure",
    title: "Reimbursement estimates undercount — travel bills consistently >20% over plan",
    desc: `Consider raising the reimbursement buffer from 5% to 8% for Q3 projects`,
    project: "Portfolio",
    action: "Update Estimate",
    actionLink: "/approval-queue",
    ts: "1 day ago",
  });
  // Good news
  const under = PROJECTS.find((p) => p.utilization <= 30);
  if (under) {
    alerts.push({
      id: "alert-good",
      severity: "medium",
      type: "Info",
      title: `${under.name} actual spend is 76% below the buffered estimate`,
      desc: `Consider releasing part of the reserved buffer back to the pool`,
      project: under.name,
      action: "Release Buffer",
      actionLink: "/buffer",
      ts: "2 days ago",
    });
  }
  return alerts;
};

const sevStyle = {
  critical: { border: "border-l-red-500", pill: "bg-red-500/15 text-red-300 border-red-500/30", icon: "bg-red-500/15 text-red-300", label: "Critical" },
  high: { border: "border-l-amber-500", pill: "bg-amber-500/15 text-amber-300 border-amber-500/30", icon: "bg-amber-500/15 text-amber-300", label: "High" },
  medium: { border: "border-l-sky-500", pill: "bg-sky-500/15 text-sky-300 border-sky-500/30", icon: "bg-sky-500/15 text-sky-300", label: "Medium" },
};

const EarlyWarning = () => {
  const alerts = useMemo(() => buildAlerts(), []);
  const [filter, setFilter] = useState("all");

  const filtered = alerts.filter((a) => (filter === "all" ? true : a.severity === filter));
  const counts = {
    all: alerts.length,
    critical: alerts.filter((a) => a.severity === "critical").length,
    high: alerts.filter((a) => a.severity === "high").length,
    medium: alerts.filter((a) => a.severity === "medium").length,
  };

  const rules = [
    { name: "Budget threshold", value: "Actual > estimated ×1.10", on: true },
    { name: "Cost spike detection", value: "> 20% in 48h window", on: true },
    { name: "Portfolio risk", value: "3+ projects trending over", on: true },
    { name: "Vendor price change", value: "any adjustment", on: true },
    { name: "Buffer threshold", value: "consumed ≥ 90%", on: true },
    { name: "Auto-refill", value: "$1k @ ~12/mo cadence", on: true },
  ];

  return (
    <div className="space-y-6" data-testid="page-early-warning">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] font-semibold text-red-400">
            <ShieldAlert className="w-3 h-3" /> CFO Portal
          </div>
          <h1 className="mt-1 font-display font-semibold text-3xl tracking-tight text-white">Early warning center</h1>
          <p className="text-sm text-zinc-400 mt-1">
            Proactive alerts across budget, AI cost, vendor pricing, and buffer thresholds
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-white/5 overflow-x-auto">
        {["all", "critical", "high", "medium"].map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            data-testid={`ew-tab-${s}`}
            className={`px-4 py-2.5 text-xs font-semibold uppercase tracking-widest border-b-2 transition-colors ${
              filter === s ? "border-fuchsia-400 text-fuchsia-300" : "border-transparent text-zinc-500 hover:text-zinc-200"
            }`}
          >
            {s === "all" ? "All alerts" : s} ({counts[s]})
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Alerts list */}
        <div className="lg:col-span-2 space-y-2">
          {filtered.map((a) => {
            const s = sevStyle[a.severity];
            return (
              <div
                key={a.id}
                data-testid={`alert-${a.id}`}
                className={`bg-[#12121A] rounded-2xl border border-white/5 border-l-4 ${s.border} p-4 flex items-start gap-3`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${s.icon}`}>
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-white">{a.title}</div>
                  <div className="text-xs text-zinc-400 mt-1 leading-relaxed">{a.desc}</div>
                  <div className="mt-3 flex items-center gap-2 flex-wrap">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold border ${s.pill}`}>
                      <span className="w-1.5 h-1.5 rounded-full bg-current" />
                      {a.type}
                    </span>
                    <span className="text-[11px] text-zinc-500">{a.project}</span>
                    <Link to={a.actionLink} data-testid={`action-${a.id}`} className="ml-auto inline-flex items-center gap-1 text-[11px] text-fuchsia-300 hover:text-fuchsia-200 font-medium">
                      {a.action} <ChevronRight className="w-3 h-3" />
                    </Link>
                    <span className="text-[10px] text-zinc-600 tabular">{a.ts}</span>
                  </div>
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div className="bg-[#12121A] rounded-2xl border border-white/5 p-8 text-center">
              <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
              <div className="text-sm text-zinc-400">No alerts in this severity level</div>
            </div>
          )}
        </div>

        {/* Summary + Rules */}
        <div className="space-y-4">
          <div className="bg-[#12121A] rounded-2xl border border-white/5 p-5" data-testid="alert-summary">
            <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500 mb-1">Active alerts</div>
            <div className="font-display text-4xl font-semibold text-red-400 tabular">{counts.all}</div>
            <div className="my-4 h-px bg-white/5" />
            <div className="space-y-2 text-xs">
              <RuleRow label="Critical" value={counts.critical} color="text-red-300" />
              <RuleRow label="High" value={counts.high} color="text-amber-300" />
              <RuleRow label="Medium" value={counts.medium} color="text-sky-300" />
            </div>
          </div>

          <div className="bg-[#12121A] rounded-2xl border border-white/5 p-5" data-testid="alert-rules">
            <div className="flex items-center gap-2 mb-3">
              <Settings2 className="w-3.5 h-3.5 text-fuchsia-300" />
              <div className="font-display font-semibold text-[13px] text-white">Alert rules active</div>
            </div>
            <div className="space-y-2 text-xs">
              {rules.map((r) => (
                <div key={r.name} data-testid={`rule-${r.name.toLowerCase().replace(/\s+/g, "-")}`} className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-zinc-300 font-medium">{r.name}</div>
                    <div className="text-[10px] text-zinc-500 truncate">{r.value}</div>
                  </div>
                  <span className={`inline-flex items-center gap-1 text-[10px] font-semibold ${r.on ? "text-emerald-300" : "text-zinc-500"}`}>
                    <CheckCircle2 className="w-3 h-3" /> {r.on ? "On" : "Off"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const RuleRow = ({ label, value, color }) => (
  <div className="flex items-center justify-between">
    <span className="text-zinc-400">{label}</span>
    <span className={`font-semibold tabular ${color}`}>{value}</span>
  </div>
);

export default EarlyWarning;
