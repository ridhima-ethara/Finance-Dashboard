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
  if (h === "healthy") return { text: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/30", dot: "bg-emerald-500/100", label: "Healthy" };
  if (h === "watch") return { text: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/30", dot: "bg-amber-500/100", label: "Watch" };
  if (h === "over") return { text: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/30", dot: "bg-red-500/100", label: "Over" };
  return { text: "text-zinc-200", bg: "bg-white/5", border: "border-white/10", dot: "bg-zinc-500", label: "—" };
};

export const varianceColor = (v) =>
  v > 0 ? "text-emerald-600" : v < 0 ? "text-red-400" : "text-zinc-400";

export const utilColor = (u) => {
  if (u >= 100) return "text-red-400";
  if (u >= 80) return "text-amber-600";
  return "text-emerald-600";
};
