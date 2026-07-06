import { Fragment, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight, ChevronDown } from "lucide-react";
import { PROJECTS } from "../../data/mockData";
import { fmtCurrency, fmtPct, healthColor, varianceColor, utilColor } from "../../lib/format";

const HealthBadge = ({ h }) => {
  const c = healthColor(h);
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border ${c.text} ${c.bg} ${c.border}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {c.label}
    </span>
  );
};

const ProjectsTable = () => {
  const [expanded, setExpanded] = useState({ "crowley-gen": true });
  const nav = useNavigate();

  const toggle = (id) => setExpanded((e) => ({ ...e, [id]: !e[id] }));

  const totals = PROJECTS.reduce(
    (a, p) => ({
      approved: a.approved + p.approvedBudget,
      est: a.est + p.estimatedBudget,
      actual: a.actual + p.actualSpend,
      variance: a.variance + p.variance,
      remaining: a.remaining + p.remaining,
    }),
    { approved: 0, est: 0, actual: 0, variance: 0, remaining: 0 }
  );
  const totalUtil = Math.round((totals.actual / totals.approved) * 100);

  return (
    <div className="bg-[#12121A] rounded-2xl border border-white/10 overflow-hidden" data-testid="projects-table">
      <div className="flex items-start justify-between p-5 pb-3">
        <div>
          <div className="font-display font-semibold text-[15px] text-white">
            Projects — budget by project
          </div>
          <div className="text-xs text-zinc-500 mt-0.5">
            {PROJECTS.length} projects · {fmtCurrency(totals.actual)} of {fmtCurrency(totals.approved)} · expand a row for phases
          </div>
        </div>
        <div className="text-xs px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-zinc-400 tabular">
          Jun 1 – Jun 30, 2026
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="text-[10px] uppercase tracking-widest text-zinc-500 font-semibold border-t border-b border-white/5 bg-white/5">
              <th className="text-left py-2.5 pl-6 pr-2">Project</th>
              <th className="text-right py-2.5 px-2">Budget</th>
              <th className="text-right py-2.5 px-2">Estimated</th>
              <th className="text-right py-2.5 px-2">Actual</th>
              <th className="text-right py-2.5 px-2">Variance</th>
              <th className="text-right py-2.5 px-2">Remaining</th>
              <th className="text-right py-2.5 px-2">Util %</th>
              <th className="text-right py-2.5 px-2">Run rate</th>
              <th className="text-left py-2.5 px-2">Health</th>
              <th className="text-left py-2.5 px-2">PL</th>
              <th className="text-right py-2.5 pr-6 pl-2">Top model</th>
            </tr>
          </thead>
          <tbody>
            {PROJECTS.map((p) => {
              const isOpen = !!expanded[p.id];
              return (
                <Fragment key={p.id}>
                  <tr
                    data-testid={`project-row-${p.id}`}
                    className="border-b border-white/5 hover:bg-white/5 transition-colors group"
                  >
                    <td className="py-3 pl-6 pr-2">
                      <button
                        onClick={() => toggle(p.id)}
                        data-testid={`row-toggle-${p.id}`}
                        className="flex items-center gap-2 text-left"
                      >
                        {isOpen ? (
                          <ChevronDown className="w-4 h-4 text-zinc-500" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-zinc-500 group-hover:text-zinc-400" />
                        )}
                        <div>
                          <div className="text-sm font-medium text-white">{p.name}</div>
                          <div className="text-[11px] text-zinc-500">{p.client}</div>
                        </div>
                      </button>
                    </td>
                    <td className="py-3 px-2 text-right tabular text-sm text-zinc-100">{fmtCurrency(p.approvedBudget)}</td>
                    <td className="py-3 px-2 text-right tabular text-sm text-zinc-400">{fmtCurrency(p.estimatedBudget)}</td>
                    <td className="py-3 px-2 text-right tabular text-sm font-medium text-white">{fmtCurrency(p.actualSpend)}</td>
                    <td className={`py-3 px-2 text-right tabular text-sm font-semibold ${varianceColor(p.variance)}`}>
                      {p.variance > 0 ? "+" : ""}{fmtCurrency(p.variance)}
                    </td>
                    <td className="py-3 px-2 text-right tabular text-sm text-zinc-100">{fmtCurrency(p.remaining)}</td>
                    <td className={`py-3 px-2 text-right tabular text-sm font-semibold ${utilColor(p.utilization)}`}>
                      {fmtPct(p.utilization)}
                    </td>
                    <td className="py-3 px-2 text-right tabular text-sm text-zinc-400">
                      ${p.burnRate.toFixed(1)}k/day
                    </td>
                    <td className="py-3 px-2"><HealthBadge h={p.health} /></td>
                    <td className="py-3 px-2 text-xs text-zinc-400">{p.pl}</td>
                    <td className="py-3 pr-6 pl-2 text-right">
                      <button
                        onClick={() => nav(`/projects/${p.id}`)}
                        data-testid={`project-open-${p.id}`}
                        className="inline-flex items-center gap-1 text-xs text-fuchsia-400 hover:text-fuchsia-300 font-medium"
                      >
                        {p.topModel} <ChevronRight className="w-3 h-3" />
                      </button>
                    </td>
                  </tr>
                  {isOpen && (
                    <tr className="bg-white/[2.5%] border-b border-white/5" data-testid={`project-expand-${p.id}`}>
                      <td colSpan={11} className="px-6 py-5">
                        <div className="text-[10px] uppercase tracking-widest text-zinc-500 font-semibold mb-3">
                          Phases
                        </div>
                        <div className="bg-[#12121A] rounded-xl border border-white/10 overflow-hidden">
                          <table className="w-full">
                            <thead>
                              <tr className="text-[10px] uppercase tracking-widest text-zinc-500 font-semibold border-b border-white/5">
                                <th className="text-left py-2 px-4">Phase</th>
                                <th className="text-left py-2 px-4">Dates</th>
                                <th className="text-right py-2 px-4">Estimated</th>
                                <th className="text-right py-2 px-4">Actual</th>
                                <th className="text-right py-2 px-4">Variance</th>
                                <th className="text-left py-2 px-4">Health</th>
                                <th className="text-right py-2 px-4"></th>
                              </tr>
                            </thead>
                            <tbody>
                              {p.phases.map((ph) => {
                                const variance = ph.estimated - ph.actual;
                                return (
                                  <tr key={ph.id} className="border-b border-white/5 last:border-0">
                                    <td className="py-2.5 px-4 text-sm text-zinc-100 font-medium">{ph.name}</td>
                                    <td className="py-2.5 px-4 text-xs text-zinc-400 tabular">{ph.dates}</td>
                                    <td className="py-2.5 px-4 text-right tabular text-sm text-zinc-100">{fmtCurrency(ph.estimated)}</td>
                                    <td className="py-2.5 px-4 text-right tabular text-sm font-medium text-white">{fmtCurrency(ph.actual)}</td>
                                    <td className={`py-2.5 px-4 text-right tabular text-sm font-semibold ${varianceColor(variance)}`}>
                                      {variance > 0 ? "+" : ""}{fmtCurrency(variance)}
                                    </td>
                                    <td className="py-2.5 px-4"><HealthBadge h={ph.health} /></td>
                                    <td className="py-2.5 px-4 text-right">
                                      <button
                                        onClick={() => nav(`/projects/${p.id}`)}
                                        className="text-xs text-fuchsia-400 hover:text-fuchsia-300 font-medium"
                                        data-testid={`phase-view-${p.id}-${ph.id}`}
                                      >
                                        View details →
                                      </button>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}

            {/* Totals */}
            <tr className="bg-white/5">
              <td className="py-3 pl-6 pr-2 text-sm font-semibold text-white">Portfolio total</td>
              <td className="py-3 px-2 text-right tabular text-sm font-semibold text-white">{fmtCurrency(totals.approved)}</td>
              <td className="py-3 px-2 text-right tabular text-sm font-semibold text-zinc-200">{fmtCurrency(totals.est)}</td>
              <td className="py-3 px-2 text-right tabular text-sm font-semibold text-white">{fmtCurrency(totals.actual)}</td>
              <td className={`py-3 px-2 text-right tabular text-sm font-semibold ${varianceColor(totals.variance)}`}>
                {totals.variance > 0 ? "+" : ""}{fmtCurrency(totals.variance)}
              </td>
              <td className="py-3 px-2 text-right tabular text-sm font-semibold text-white">{fmtCurrency(totals.remaining)}</td>
              <td className={`py-3 px-2 text-right tabular text-sm font-semibold ${utilColor(totalUtil)}`}>{fmtPct(totalUtil)}</td>
              <td className="py-3 px-2 text-right tabular text-sm text-zinc-400">$5.4k/day</td>
              <td className="py-3 px-2" />
              <td className="py-3 px-2" />
              <td className="py-3 pr-6 pl-2" />
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ProjectsTable;
