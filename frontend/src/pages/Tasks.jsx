import { PROJECTS } from "../data/mockData";
import { fmtCurrency, fmtDate } from "../lib/format";
import { Link } from "react-router-dom";
import { ListChecks, Circle, CheckCircle2 } from "lucide-react";

const Tasks = () => {
  // Derive tasks from phases + pending approvals for a lightweight list
  const items = PROJECTS.flatMap((p) =>
    p.phases.map((ph) => ({
      id: `${p.id}-${ph.id}`,
      title: `${ph.name}`,
      project: p.name,
      projectId: p.id,
      due: ph.dates,
      done: ph.health === "healthy",
      health: ph.health,
    }))
  );

  return (
    <div className="space-y-6" data-testid="page-tasks">
      <div>
        <h1 className="font-display font-semibold text-3xl tracking-tight text-slate-900">All tasks</h1>
        <p className="text-sm text-slate-500 mt-1">Every phase &amp; deliverable across the portfolio</p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100">
        {items.map((t) => (
          <div key={t.id} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50/60 transition-colors" data-testid={`task-${t.id}`}>
            {t.done ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            ) : (
              <Circle className="w-4 h-4 text-slate-300" />
            )}
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-slate-900 truncate">{t.title}</div>
              <div className="text-xs text-slate-500">
                <Link to={`/projects/${t.projectId}`} className="hover:text-violet-700">{t.project}</Link>
                <span className="ml-2 text-slate-400 tabular">· {t.due}</span>
              </div>
            </div>
            <span
              className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${
                t.health === "over"
                  ? "bg-red-50 text-red-700 border-red-200"
                  : t.health === "watch"
                  ? "bg-amber-50 text-amber-700 border-amber-200"
                  : "bg-emerald-50 text-emerald-700 border-emerald-200"
              }`}
            >
              {t.health}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Tasks;
