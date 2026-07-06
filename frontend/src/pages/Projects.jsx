import { useState } from "react";
import { Link } from "react-router-dom";
import { PROJECTS } from "../data/mockData";
import { fmtCurrency, fmtPct, healthColor, utilColor, varianceColor } from "../lib/format";
import { Search, Filter, Plus, ChevronRight } from "lucide-react";
import { Button } from "../components/ui/button";

const Projects = () => {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all");

  const filtered = PROJECTS.filter((p) => {
    if (filter === "over" && p.utilization < 100) return false;
    if (filter === "watch" && !(p.utilization >= 85 && p.utilization < 100)) return false;
    if (filter === "healthy" && p.utilization >= 85) return false;
    return (
      p.name.toLowerCase().includes(q.toLowerCase()) ||
      p.client.toLowerCase().includes(q.toLowerCase()) ||
      p.pl.toLowerCase().includes(q.toLowerCase())
    );
  });

  return (
    <div className="space-y-6" data-testid="page-projects">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display font-semibold text-3xl tracking-tight text-slate-900">Projects</h1>
          <p className="text-sm text-slate-500 mt-1">All active engagements · click a project to drill in</p>
        </div>
        <Button className="h-9 rounded-lg bg-violet-600 hover:bg-violet-700 gap-2" data-testid="btn-new-project">
          <Plus className="w-4 h-4" />
          New project
        </Button>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[260px] max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            data-testid="projects-search"
            placeholder="Search project, client, PL…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="w-full h-10 pl-9 pr-3 rounded-lg bg-white border border-slate-200 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500/40"
          />
        </div>
        {["all", "healthy", "watch", "over"].map((f) => (
          <button
            key={f}
            data-testid={`filter-${f}`}
            onClick={() => setFilter(f)}
            className={`h-10 px-3 rounded-lg border text-xs font-medium capitalize transition-colors ${
              filter === f
                ? "bg-violet-50 border-violet-300 text-violet-700"
                : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}
          >
            {f === "all" ? "All projects" : f}
          </button>
        ))}
        <button className="h-10 px-3 rounded-lg border border-slate-200 bg-white text-slate-600 text-xs font-medium inline-flex items-center gap-1.5 hover:bg-slate-50">
          <Filter className="w-3.5 h-3.5" />
          More filters
        </button>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map((p) => {
          const c = healthColor(p.health);
          return (
            <Link
              to={`/projects/${p.id}`}
              key={p.id}
              data-testid={`project-card-${p.id}`}
              className="group bg-white rounded-2xl border border-slate-200 p-5 card-hover"
            >
              <div className="flex items-start justify-between">
                <div className="min-w-0">
                  <div className="text-xs text-slate-500">{p.client}</div>
                  <div className="mt-0.5 font-display font-semibold text-lg text-slate-900 truncate">
                    {p.name}
                  </div>
                </div>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${c.bg} ${c.border} ${c.text}`}>
                  {c.label}
                </span>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-3">
                <div>
                  <div className="text-[10px] uppercase text-slate-400 font-semibold tracking-widest">Approved</div>
                  <div className="text-sm font-semibold text-slate-900 tabular">{fmtCurrency(p.approvedBudget)}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase text-slate-400 font-semibold tracking-widest">Actual</div>
                  <div className="text-sm font-semibold text-slate-900 tabular">{fmtCurrency(p.actualSpend)}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase text-slate-400 font-semibold tracking-widest">Variance</div>
                  <div className={`text-sm font-semibold tabular ${varianceColor(p.variance)}`}>
                    {p.variance > 0 ? "+" : ""}
                    {fmtCurrency(p.variance)}
                  </div>
                </div>
              </div>

              <div className="mt-4">
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="text-slate-600">Utilization</span>
                  <span className={`font-semibold ${utilColor(p.utilization)}`}>{fmtPct(p.utilization)}</span>
                </div>
                <div className="h-1.5 rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.min(p.utilization, 100)}%`,
                      background: p.utilization >= 100 ? "#EF4444" : p.utilization >= 85 ? "#F59E0B" : "#10B981",
                    }}
                  />
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between text-xs">
                <span className="text-slate-500">PL · {p.pl}</span>
                <span className="text-violet-600 font-medium inline-flex items-center gap-1 group-hover:gap-1.5 transition-all">
                  Open <ChevronRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
};

export default Projects;
