export const fmtCurrency = (v, opts = {}) => {
  const { compact = true, sign = false } = opts;
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  const abs = Math.abs(v);
  const s = sign && v > 0 ? "+" : v < 0 ? "-" : "";
  if (compact) {
    if (abs >= 1_000_000) return `${s}$${(abs / 1_000_000).toFixed(2)}M`;
    if (abs >= 1_000) return `${s}$${(abs / 1_000).toFixed(1)}k`;
  }
  return `${s}$${abs.toLocaleString()}`;
};

export const fmtPct = (v, digits = 0) => {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  return `${v.toFixed(digits)}%`;
};

export const fmtDate = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

export const fmtDateShort = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

export const initials = (name = "") =>
  name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

export const healthColor = (h) => {
  if (h === "healthy") return { text: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200", dot: "bg-emerald-500", label: "Healthy" };
  if (h === "watch") return { text: "text-amber-700", bg: "bg-amber-50", border: "border-amber-200", dot: "bg-amber-500", label: "Watch" };
  if (h === "over") return { text: "text-red-700", bg: "bg-red-50", border: "border-red-200", dot: "bg-red-500", label: "Over" };
  return { text: "text-slate-700", bg: "bg-slate-50", border: "border-slate-200", dot: "bg-slate-400", label: "—" };
};

export const varianceColor = (v) =>
  v > 0 ? "text-emerald-600" : v < 0 ? "text-red-600" : "text-slate-600";

export const utilColor = (u) => {
  if (u >= 100) return "text-red-600";
  if (u >= 80) return "text-amber-600";
  return "text-emerald-600";
};
