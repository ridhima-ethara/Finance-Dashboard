import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import { fmtCurrency, fmtPct } from "../../lib/format";
import { PORTFOLIO } from "../../data/mockData";

const KpiCard = ({ label, value, sublabel, delta, tone = "neutral", testid }) => {
  const toneMap = {
    positive: "text-emerald-600 bg-emerald-50",
    negative: "text-red-600 bg-red-50",
    warning: "text-amber-600 bg-amber-50",
    neutral: "text-slate-600 bg-slate-100",
  };
  return (
    <div
      data-testid={testid}
      className="bg-white rounded-2xl border border-slate-200 p-5 card-hover cursor-pointer"
    >
      <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
        {label}
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <div className="font-display font-semibold text-3xl tabular text-slate-900">
          {value}
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between">
        <div className="text-xs text-slate-500 tabular">{sublabel}</div>
        {delta && (
          <div className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${toneMap[tone]}`}>
            {tone === "positive" ? (
              <ArrowUpRight className="w-3 h-3" />
            ) : tone === "negative" ? (
              <ArrowDownRight className="w-3 h-3" />
            ) : null}
            {delta}
          </div>
        )}
      </div>
    </div>
  );
};

const KpiGrid = () => {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
      <KpiCard
        testid="kpi-portfolio-budget"
        label="Portfolio Budget"
        value={fmtCurrency(PORTFOLIO.portfolioBudget)}
        sublabel={`${PORTFOLIO.activeProjects} active projects`}
      />
      <KpiCard
        testid="kpi-estimated-cost"
        label="Estimated Cost"
        value={fmtCurrency(PORTFOLIO.estimatedBudget)}
        sublabel="Rolled-up from projects"
        delta="+12.4% vs original"
        tone="warning"
      />
      <KpiCard
        testid="kpi-actual-spend"
        label="Actual Spend"
        value={fmtCurrency(PORTFOLIO.actualSpend)}
        sublabel={`vs est. ${fmtCurrency(PORTFOLIO.estimatedBudget)}`}
        delta="19.5% over est."
        tone="negative"
      />
      <KpiCard
        testid="kpi-active-projects"
        label="Active Projects"
        value={String(PORTFOLIO.activeProjects)}
        sublabel="2 high · 1 critical"
      />
      <KpiCard
        testid="kpi-over-budget"
        label="Over Budget"
        value={String(PORTFOLIO.projectsOverBudget)}
        sublabel="1 new this week"
        delta="+1"
        tone="negative"
      />
      <KpiCard
        testid="kpi-accuracy"
        label="Estimation Accuracy"
        value={fmtPct(PORTFOLIO.accuracy)}
        sublabel="+4pts vs last sprint"
        delta="+4 pts"
        tone="positive"
      />
    </div>
  );
};

export default KpiGrid;
