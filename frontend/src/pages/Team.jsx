import { TEAM, PROJECTS } from "../data/mockData";
import { fmtCurrency } from "../lib/format";

const workloadFor = (name) => PROJECTS.filter((p) => p.pl === name).length;

const Team = () => (
  <div className="space-y-6" data-testid="page-team">
    <div>
      <h1 className="font-display font-semibold text-3xl tracking-tight text-slate-900">Team overview</h1>
      <p className="text-sm text-slate-500 mt-1">All contributors and their current allocation</p>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {TEAM.map((m) => {
        const owned = PROJECTS.filter((p) => p.pl === m.name);
        const owningBudget = owned.reduce((s, p) => s + p.approvedBudget, 0);
        return (
          <div key={m.id} className="bg-white rounded-2xl border border-slate-200 p-5 card-hover" data-testid={`team-card-${m.id}`}>
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-full bg-gradient-to-br from-violet-200 to-fuchsia-200 flex items-center justify-center text-sm font-semibold text-violet-700">
                {m.name.split(" ").map((n) => n[0]).slice(0, 2).join("")}
              </div>
              <div>
                <div className="text-sm font-semibold text-slate-900">{m.name}</div>
                <div className="text-xs text-slate-500">{m.role}</div>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <div className="rounded-lg bg-slate-50 p-3">
                <div className="text-[10px] uppercase tracking-widest font-semibold text-slate-500">Projects</div>
                <div className="text-lg font-display font-semibold text-slate-900 tabular">{workloadFor(m.name)}</div>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <div className="text-[10px] uppercase tracking-widest font-semibold text-slate-500">Budget under mgmt</div>
                <div className="text-lg font-display font-semibold text-slate-900 tabular">{fmtCurrency(owningBudget)}</div>
              </div>
            </div>
            {owned.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1">
                {owned.map((p) => (
                  <span key={p.id} className="text-[11px] px-2 py-0.5 rounded-full bg-violet-50 border border-violet-200 text-violet-700">
                    {p.name}
                  </span>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  </div>
);

export default Team;
