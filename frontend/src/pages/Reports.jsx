import { useMemo, useState } from "react";
import { REPORTS_CATALOG } from "../data/mockTpm";
import { fmtCurrency } from "../lib/format";
import { toast } from "sonner";
import { Button } from "../components/ui/button";
import {
  FileText,
  Download,
  Calendar,
  Filter,
  Play,
  ChevronRight,
  Search,
  Clock3,
  Zap,
  BarChart3,
  AlertCircle,
  ListChecks,
  Bot,
  DollarSign,
} from "lucide-react";

const typeIcons = {
  Budget: BarChart3,
  Phase: Calendar,
  Expense: DollarSign,
  Variance: AlertCircle,
  Task: ListChecks,
  Model: Bot,
  Recovery: FileText,
  Daily: Zap,
};

const typeColors = {
  Budget: "#E619B8",
  Phase: "#3B82F6",
  Expense: "#F59E0B",
  Variance: "#EF4444",
  Task: "#10B981",
  Model: "#8B5CF6",
  Recovery: "#EC4899",
  Daily: "#06B6D4",
};

const Reports = () => {
  const [typeFilter, setTypeFilter] = useState("all");
  const [freqFilter, setFreqFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);

  const types = ["all", ...Array.from(new Set(REPORTS_CATALOG.map((r) => r.type)))];
  const freqs = ["all", ...Array.from(new Set(REPORTS_CATALOG.map((r) => r.frequency)))];

  const filtered = useMemo(() => {
    return REPORTS_CATALOG.filter((r) => {
      if (typeFilter !== "all" && r.type !== typeFilter) return false;
      if (freqFilter !== "all" && r.frequency !== freqFilter) return false;
      if (search && !r.name.toLowerCase().includes(search.toLowerCase()) && !r.description.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [typeFilter, freqFilter, search]);

  const runReport = (r) => {
    toast.success(`${r.name} generated`, {
      description: `${r.records} records · ${r.format} · download started`,
    });
  };

  const downloadReport = (r, format) => {
    toast.success(`Downloading ${r.name}`, {
      description: `Format: ${format} · ${r.records} rows`,
    });
  };

  return (
    <div className="space-y-6" data-testid="page-reports">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] font-semibold text-fuchsia-400">
            <span className="w-6 h-px bg-fuchsia-400" />
            Reports &amp; exports
          </div>
          <h1 className="mt-2 font-display font-semibold text-3xl tracking-tight text-white">Reports library</h1>
          <p className="text-sm text-zinc-400 mt-1">
            Generate, schedule, and download financial reports across your projects
          </p>
        </div>
        <Button className="h-9 rounded-lg bg-fuchsia-500 hover:bg-fuchsia-600 text-white gap-2 shadow-[0_0_20px_rgba(232,25,184,0.35)]" data-testid="btn-generate-all">
          <Play className="w-3.5 h-3.5" />
          Generate all
        </Button>
      </div>

      {/* Filters */}
      <div className="bg-[#12121A] rounded-2xl border border-white/5 p-4 flex flex-col md:flex-row items-stretch md:items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search reports by name or description..."
            data-testid="reports-search"
            className="w-full h-10 pl-10 pr-3 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40"
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500 flex items-center gap-1">
            <Filter className="w-3 h-3" />
            Type
          </div>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            data-testid="reports-filter-type"
            className="h-9 px-2 rounded-lg bg-white/[0.04] border border-white/10 text-xs text-zinc-100 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40"
          >
            {types.map((t) => (
              <option key={t} value={t}>
                {t === "all" ? "All types" : t}
              </option>
            ))}
          </select>
          <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500">Frequency</div>
          <select
            value={freqFilter}
            onChange={(e) => setFreqFilter(e.target.value)}
            data-testid="reports-filter-freq"
            className="h-9 px-2 rounded-lg bg-white/[0.04] border border-white/10 text-xs text-zinc-100 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40"
          >
            {freqs.map((f) => (
              <option key={f} value={f}>
                {f === "all" ? "All frequencies" : f}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Reports Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="reports-grid">
        {filtered.map((r) => {
          const Icon = typeIcons[r.type] || FileText;
          const color = typeColors[r.type] || "#94A3B8";
          return (
            <div
              key={r.id}
              data-testid={`report-${r.id}`}
              className={`bg-[#12121A] rounded-2xl border p-5 card-hover transition-all ${
                selected === r.id ? "border-fuchsia-500/40 shadow-[0_0_30px_rgba(232,25,184,0.15)]" : "border-white/5 hover:border-fuchsia-500/20"
              }`}
              onClick={() => setSelected(selected === r.id ? null : r.id)}
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: `${color}22`, border: `1px solid ${color}44` }}
                  >
                    <Icon className="w-4 h-4" style={{ color }} />
                  </div>
                  <div>
                    <div className="font-display font-semibold text-[15px] text-white">{r.name}</div>
                    <div className="text-[10px] uppercase tracking-widest font-semibold mt-0.5" style={{ color }}>
                      {r.type}
                    </div>
                  </div>
                </div>
              </div>

              <div className="text-xs text-zinc-400 leading-relaxed mb-4 min-h-[36px]">{r.description}</div>

              <div className="grid grid-cols-3 gap-2 mb-4">
                <MetaCell label="Frequency" value={r.frequency} />
                <MetaCell label="Records" value={r.records.toLocaleString()} />
                <MetaCell label="Format" value={r.format} />
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-white/5">
                <div className="flex items-center gap-1 text-[11px] text-zinc-500">
                  <Clock3 className="w-3 h-3" />
                  Last run{" "}
                  {new Date(r.lastRun).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      runReport(r);
                    }}
                    data-testid={`btn-run-${r.id}`}
                    className="h-7 px-2.5 rounded-md bg-fuchsia-500/15 hover:bg-fuchsia-500/25 border border-fuchsia-500/30 text-fuchsia-300 text-xs font-medium inline-flex items-center gap-1 transition-colors"
                  >
                    <Play className="w-3 h-3" />
                    Run
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      downloadReport(r, r.format.split(" · ")[0]);
                    }}
                    data-testid={`btn-download-${r.id}`}
                    className="h-7 px-2.5 rounded-md bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-zinc-300 text-xs font-medium inline-flex items-center gap-1 transition-colors"
                  >
                    <Download className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {selected === r.id && (
                <div className="mt-4 pt-4 border-t border-white/5 space-y-2 animate-fade-up">
                  <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500">Download in format:</div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {r.format.split(" · ").map((f) => (
                      <button
                        key={f}
                        onClick={(e) => {
                          e.stopPropagation();
                          downloadReport(r, f);
                        }}
                        data-testid={`btn-format-${r.id}-${f.toLowerCase()}`}
                        className="h-7 px-3 rounded-md bg-fuchsia-500 hover:bg-fuchsia-600 text-white text-xs font-medium inline-flex items-center gap-1"
                      >
                        <Download className="w-3 h-3" />
                        {f}
                      </button>
                    ))}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toast.info("Scheduled reports open in Settings", { description: "Coming soon" });
                      }}
                      className="h-7 px-3 rounded-md bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-zinc-300 text-xs font-medium inline-flex items-center gap-1"
                      data-testid={`btn-schedule-${r.id}`}
                    >
                      <Calendar className="w-3 h-3" />
                      Schedule
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="md:col-span-2 lg:col-span-3 bg-[#12121A] rounded-2xl border border-white/5 p-8 text-center">
            <FileText className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
            <div className="text-sm text-zinc-400">No reports match your filters</div>
          </div>
        )}
      </div>

      {/* Scheduled Reports section */}
      <div className="bg-[#12121A] rounded-2xl border border-white/5 p-5" data-testid="scheduled-reports">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="font-display font-semibold text-[15px] text-white">Scheduled reports</div>
            <div className="text-xs text-zinc-500 mt-0.5">Automatic runs delivered via email</div>
          </div>
          <Button size="sm" variant="outline" className="h-8 rounded-md border-white/10 bg-white/[0.03] text-zinc-200 text-xs gap-1.5" data-testid="btn-schedule-new">
            <Calendar className="w-3 h-3" />
            New schedule
          </Button>
        </div>
        <div className="space-y-2">
          {[
            { name: "Budget report", freq: "Every Monday · 9am IST", recipients: 3, next: "Jul 1, 2026" },
            { name: "Daily consumption report", freq: "Every day · 6pm IST", recipients: 5, next: "Jun 25, 2026" },
            { name: "Model usage report", freq: "Every Friday · 6pm IST", recipients: 2, next: "Jun 27, 2026" },
          ].map((s, i) => (
            <div key={i} data-testid={`schedule-${i}`} className="flex items-center gap-3 p-3 rounded-lg border border-white/5 bg-white/[0.02]">
              <div className="w-8 h-8 rounded-lg bg-fuchsia-500/15 flex items-center justify-center border border-fuchsia-500/30 flex-shrink-0">
                <Calendar className="w-4 h-4 text-fuchsia-300" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-white">{s.name}</div>
                <div className="text-[11px] text-zinc-500">{s.freq} · {s.recipients} recipients</div>
              </div>
              <div className="text-right hidden sm:block">
                <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500">Next run</div>
                <div className="text-xs text-zinc-200 tabular">{s.next}</div>
              </div>
              <ChevronRight className="w-4 h-4 text-zinc-600" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const MetaCell = ({ label, value }) => (
  <div className="rounded-md bg-white/[0.03] border border-white/5 p-2">
    <div className="text-[9px] uppercase tracking-widest font-semibold text-zinc-500">{label}</div>
    <div className="text-[11px] text-zinc-200 font-medium mt-0.5 tabular truncate">{value}</div>
  </div>
);

export default Reports;
