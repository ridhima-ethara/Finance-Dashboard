import { PROJECTS } from "../data/mockData";
import { fmtDate } from "../lib/format";
import { History } from "lucide-react";

const AuditLog = () => {
  const all = PROJECTS.flatMap((p) => p.auditLog.map((a) => ({ ...a, project: p.name })))
    .sort((a, b) => (a.ts < b.ts ? 1 : -1));
  return (
    <div className="space-y-6" data-testid="page-audit">
      <div>
        <h1 className="font-display font-semibold text-3xl tracking-tight text-slate-900">Audit log</h1>
        <p className="text-sm text-slate-500 mt-1">Every action across the portfolio · immutable ledger</p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <ol className="space-y-5">
          {all.map((a) => (
            <li key={`${a.project}-${a.id}`} className="flex items-start gap-3" data-testid={`audit-${a.id}`}>
              <div className="w-9 h-9 rounded-lg bg-violet-50 flex items-center justify-center flex-shrink-0">
                <History className="w-4 h-4 text-violet-600" />
              </div>
              <div className="flex-1">
                <div className="text-sm font-semibold text-slate-900">
                  {a.action} <span className="text-slate-400 font-normal">·</span>{" "}
                  <span className="text-slate-600">{a.project}</span>
                </div>
                <div className="text-xs text-slate-500 mt-0.5">{a.detail}</div>
                <div className="text-[11px] text-slate-400 tabular mt-1">
                  {a.actor} · {fmtDate(a.ts)}
                </div>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
};

export default AuditLog;
