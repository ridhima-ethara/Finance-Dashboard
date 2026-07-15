import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { useApp } from "../../context/AppContext";
import { fmtCurrency } from "../../lib/format";
import {
  AlertTriangle,
  ShieldAlert,
  CheckCircle2,
  ChevronRight,
  Settings2,
} from "lucide-react";

const formatStamp = (value) =>
  value
    ? new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : "Awaiting review";

const buildAlerts = ({ projects, topupRequests, budgetReviews, changeRequests }) => {
  const alerts = [];

  projects.filter((project) => Number(project.utilization || 0) >= 100).forEach((project) => {
    const approved = Number(project.approvedBudget || 0);
    const actual = Number(project.actualSpend || 0);
    const overBy = Math.max(actual - approved, 0);
    const pct = approved > 0 ? Math.round((overBy / approved) * 100) : 0;
    alerts.push({
      id: `alert-over-${project.id}`,
      severity: "critical",
      type: "Budget overrun",
      title: `${project.name} is over the approved budget by ${fmtCurrency(overBy, { compact: false })}${pct ? ` (+${pct}%)` : ""}`,
      desc: `Approved ${fmtCurrency(approved)} · actual ${fmtCurrency(actual)} · owner ${project.tpm || "Unassigned"}`,
      project: project.name,
      action: "Open project",
      actionLink: `/projects/${project.id}`,
      ts: formatStamp(project.updatedAt || project.createdAt),
    });
  });

  const watchProjects = projects.filter((project) => {
    const utilization = Number(project.utilization || 0);
    return utilization >= 90 && utilization < 100;
  });

  if (watchProjects.length) {
    const combinedAtRisk = watchProjects.reduce((sum, project) => (
      sum + Math.max(Number(project.approvedBudget || 0) - Number(project.actualSpend || 0), 0)
    ), 0);
    alerts.push({
      id: "alert-portfolio",
      severity: "high",
      type: "Portfolio risk",
      title: `${watchProjects.length} ${watchProjects.length === 1 ? "project is" : "projects are"} approaching budget exhaustion`,
      desc: `Combined remaining headroom: ${fmtCurrency(combinedAtRisk)} · review funding coverage before the next delivery window`,
      project: "Portfolio",
      action: "View portfolio",
      actionLink: "/projects",
      ts: "Current workspace",
    });
  }

  const pendingBudgetReviews = budgetReviews.filter((review) =>
    !["approved", "partial", "rejected", "rejected-by-cto", "returned", "returned-to-tpm"].includes(review.status)
  );
  if (pendingBudgetReviews.length) {
    const totalRequested = pendingBudgetReviews.reduce((sum, review) => sum + Number(review.requestedBudget || 0), 0);
    alerts.push({
      id: "alert-budget-queue",
      severity: "high",
      type: "Budget queue",
      title: `${pendingBudgetReviews.length} ${pendingBudgetReviews.length === 1 ? "budget review is" : "budget reviews are"} awaiting action`,
      desc: `${fmtCurrency(totalRequested)} remains pending in submitted baseline requests`,
      project: "Approval queue",
      action: "Review approvals",
      actionLink: "/approval-queue",
      ts: formatStamp(pendingBudgetReviews[0]?.submittedAt),
    });
  }

  const pendingTopups = topupRequests.filter((request) => !["approved", "partial", "rejected"].includes(request.status));
  if (pendingTopups.length) {
    const totalRequested = pendingTopups.reduce((sum, request) => sum + Number(request.amount || 0), 0);
    alerts.push({
      id: "alert-topups",
      severity: "high",
      type: "Budget change queue",
      title: `${pendingTopups.length} ${pendingTopups.length === 1 ? "budget change request is" : "budget change requests are"} awaiting approval`,
      desc: `${fmtCurrency(totalRequested)} requested across active project phases`,
      project: pendingTopups[0]?.projectName || "Projects",
      action: "Open budget changes",
      actionLink: "/approval-queue?type=Top-up",
      ts: formatStamp(pendingTopups[0]?.requestedAt),
    });
  }

  const pendingChanges = changeRequests.filter((request) => !["approved", "partial", "rejected", "returned"].includes(request.status));
  if (pendingChanges.length) {
    const totalRequested = pendingChanges.reduce((sum, request) => sum + Number(request.amount || 0), 0);
    alerts.push({
      id: "alert-change-queue",
      severity: "medium",
      type: "Change requests",
      title: `${pendingChanges.length} ${pendingChanges.length === 1 ? "change request is" : "change requests are"} open for review`,
      desc: `${fmtCurrency(totalRequested)} is tied to scope, timeline, or cost-change asks`,
      project: pendingChanges[0]?.projectName || "Projects",
      action: "Review changes",
      actionLink: "/approval-queue?type=Change%20Request",
      ts: formatStamp(pendingChanges[0]?.createdAt),
    });
  }

  const under = projects.find((project) => {
    const utilization = Number(project.utilization || 0);
    return utilization > 0 && utilization <= 30;
  });
  if (under) {
    alerts.push({
      id: "alert-good",
      severity: "medium",
      type: "Low utilization",
      title: `${under.name} is materially under plan`,
      desc: `Current utilization is ${under.utilization}% of the approved budget. Revisit whether any reserved budget can be released.`,
      project: under.name,
      action: "Open project",
      actionLink: `/projects/${under.id}`,
      ts: formatStamp(under.updatedAt || under.createdAt),
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
  const { projects, topupRequests, budgetReviews, changeRequests } = useApp();
  const alerts = useMemo(
    () => buildAlerts({ projects, topupRequests, budgetReviews, changeRequests }),
    [projects, topupRequests, budgetReviews, changeRequests]
  );
  const [filter, setFilter] = useState("all");

  const filtered = alerts.filter((alert) => (filter === "all" ? true : alert.severity === filter));
  const counts = {
    all: alerts.length,
    critical: alerts.filter((alert) => alert.severity === "critical").length,
    high: alerts.filter((alert) => alert.severity === "high").length,
    medium: alerts.filter((alert) => alert.severity === "medium").length,
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
            Proactive alerts across budget, approvals, and delivery risk
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1 border-b border-white/5 overflow-x-auto">
        {["all", "critical", "high", "medium"].map((severity) => (
          <button
            key={severity}
            onClick={() => setFilter(severity)}
            data-testid={`ew-tab-${severity}`}
            className={`px-4 py-2.5 text-xs font-semibold uppercase tracking-widest border-b-2 transition-colors ${
              filter === severity ? "border-fuchsia-400 text-fuchsia-300" : "border-transparent text-zinc-500 hover:text-zinc-200"
            }`}
          >
            {severity === "all" ? "All alerts" : severity} ({counts[severity]})
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-2">
          {filtered.map((alert) => {
            const style = sevStyle[alert.severity];
            return (
              <div
                key={alert.id}
                data-testid={`alert-${alert.id}`}
                className={`bg-[#12121A] rounded-2xl border border-white/5 border-l-4 ${style.border} p-4 flex items-start gap-3`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${style.icon}`}>
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-white">{alert.title}</div>
                  <div className="text-xs text-zinc-400 mt-1 leading-relaxed">{alert.desc}</div>
                  <div className="mt-3 flex items-center gap-2 flex-wrap">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold border ${style.pill}`}>
                      <span className="w-1.5 h-1.5 rounded-full bg-current" />
                      {alert.type}
                    </span>
                    <span className="text-[11px] text-zinc-500">{alert.project}</span>
                    <Link to={alert.actionLink} data-testid={`action-${alert.id}`} className="ml-auto inline-flex items-center gap-1 text-[11px] text-fuchsia-300 hover:text-fuchsia-200 font-medium">
                      {alert.action} <ChevronRight className="w-3 h-3" />
                    </Link>
                    <span className="text-[10px] text-zinc-600 tabular">{alert.ts}</span>
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
              {rules.map((rule) => (
                <div key={rule.name} data-testid={`rule-${rule.name.toLowerCase().replace(/\s+/g, "-")}`} className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-zinc-300 font-medium">{rule.name}</div>
                    <div className="text-[10px] text-zinc-500 truncate">{rule.value}</div>
                  </div>
                  <span className={`inline-flex items-center gap-1 text-[10px] font-semibold ${rule.on ? "text-emerald-300" : "text-zinc-500"}`}>
                    <CheckCircle2 className="w-3 h-3" /> {rule.on ? "On" : "Off"}
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
