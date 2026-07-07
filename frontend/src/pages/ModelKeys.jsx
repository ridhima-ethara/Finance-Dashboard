import { useState } from "react";
import { MODEL_KEYS_MASKED, LINE_CATEGORIES } from "../data/mockData";
import { fmtDate } from "../lib/format";
import { Button } from "../components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "../components/ui/dialog";
import {
  Key,
  Eye,
  EyeOff,
  Copy,
  RefreshCw,
  Trash2,
  Plus,
  Filter,
  Search,
  Tag,
  ShieldCheck,
  AlertCircle,
} from "lucide-react";
import { useApp } from "../context/AppContext";
import { toast } from "sonner";

const envChip = (env) =>
  env === "production"
    ? "bg-fuchsia-500/10 border-fuchsia-500/30 text-fuchsia-300"
    : "bg-sky-500/10 border-sky-500/30 text-sky-300";

const typeChip = (type) =>
  type === "R&D"
    ? "bg-violet-500/10 border-violet-500/30 text-violet-300"
    : "bg-emerald-500/10 border-emerald-500/30 text-emerald-300";

const providerColor = {
  Anthropic: "#E619B8",
  OpenAI: "#10B981",
  Google: "#3B82F6",
  xAI: "#F59E0B",
};

const ModelKeys = () => {
  const { role, user } = useApp();
  const [revealed, setRevealed] = useState({}); // id → true
  const [query, setQuery] = useState("");
  const [envFilter, setEnvFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [providerFilter, setProviderFilter] = useState("all");
  const [openNew, setOpenNew] = useState(false);
  const canReveal = role === "CTO" || role === "CFO"; // strict access

  const filtered = MODEL_KEYS_MASKED.filter((k) => {
    if (envFilter !== "all" && k.env !== envFilter) return false;
    if (typeFilter !== "all" && k.type !== typeFilter) return false;
    if (providerFilter !== "all" && k.provider !== providerFilter) return false;
    if (query) {
      const q = query.toLowerCase();
      if (
        !k.projectName.toLowerCase().includes(q) &&
        !k.provider.toLowerCase().includes(q) &&
        !k.model.toLowerCase().includes(q) &&
        !k.tags.some((t) => t.toLowerCase().includes(q))
      )
        return false;
    }
    return true;
  });

  const toggleReveal = (id) => {
    if (!canReveal) {
      toast.error("Access denied", { description: `Only CTO or CFO can reveal keys. You are signed in as ${role}.` });
      return;
    }
    setRevealed((r) => {
      const next = { ...r, [id]: !r[id] };
      if (next[id]) toast.info("Key revealed · audit logged", { description: `Actor: ${user.name} · ${role}` });
      return next;
    });
  };

  const copyKey = (k) => {
    if (!canReveal) {
      toast.error("Access denied");
      return;
    }
    navigator.clipboard?.writeText(k.fullKey);
    toast.success("Key copied · audit logged", { description: `${k.provider} · ${k.projectName} · ${k.env}` });
  };

  const rotate = (k) => {
    toast.success("Key rotation queued", { description: `${k.provider} · ${k.projectName} · new key generated, old revoked in 24h` });
  };

  const revoke = (k) => {
    toast.warning("Key revoked", { description: `${k.provider} · ${k.projectName} · ${k.env} · effective immediately` });
  };

  const stats = {
    total: MODEL_KEYS_MASKED.length,
    active: MODEL_KEYS_MASKED.filter((k) => k.status === "active").length,
    prod: MODEL_KEYS_MASKED.filter((k) => k.env === "production" && k.status === "active").length,
    rd: MODEL_KEYS_MASKED.filter((k) => k.type === "R&D" && k.status === "active").length,
  };

  return (
    <div className="space-y-6" data-testid="page-model-keys">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] font-semibold text-fuchsia-400">
            <ShieldCheck className="w-3 h-3" />
            Governance
          </div>
          <h1 className="mt-2 font-display font-semibold text-3xl tracking-tight text-white">Model Keys</h1>
          <p className="text-sm text-zinc-400 mt-1">
            Unique, project-allocated keys · segregated by environment &amp; R&amp;D/Ops · masked by default
          </p>
        </div>
        <Button
          onClick={() => setOpenNew(true)}
          className="h-9 rounded-lg bg-fuchsia-500 hover:bg-fuchsia-600 gap-2 text-white shadow-[0_0_20px_rgba(232,25,184,0.35)]"
          data-testid="btn-generate-key"
        >
          <Plus className="w-4 h-4" />
          Generate new key
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { l: "Total keys", v: stats.total, i: Key },
          { l: "Active", v: stats.active, i: ShieldCheck, tone: "emerald" },
          { l: "Production", v: stats.prod, i: AlertCircle, tone: "fuchsia" },
          { l: "R&D", v: stats.rd, i: Tag, tone: "sky" },
        ].map((s) => (
          <div key={s.l} className="bg-[#12121A] rounded-2xl border border-white/5 p-5">
            <div className="flex items-center justify-between">
              <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500">{s.l}</div>
              <div className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center">
                <s.i className="w-3.5 h-3.5 text-zinc-400" />
              </div>
            </div>
            <div className="mt-3 font-display font-semibold text-3xl tabular text-white">{s.v}</div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[260px] max-w-md">
          <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            data-testid="keys-search"
            placeholder="Search project, provider, tag…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full h-10 pl-9 pr-3 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40"
          />
        </div>
        <ChipGroup label="Env" value={envFilter} onChange={setEnvFilter} testidPrefix="env" options={["all", "production", "testing"]} />
        <ChipGroup label="Type" value={typeFilter} onChange={setTypeFilter} testidPrefix="type" options={["all", "R&D", "Operations"]} />
        <ChipGroup label="Provider" value={providerFilter} onChange={setProviderFilter} testidPrefix="prov" options={["all", "Anthropic", "OpenAI", "Google", "xAI"]} />
      </div>

      {/* Table */}
      <div className="bg-[#12121A] rounded-2xl border border-white/5 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="text-[10px] uppercase tracking-widest text-zinc-500 font-semibold border-b border-white/5 bg-white/[0.02]">
              <th className="text-left py-3 px-5">Project</th>
              <th className="text-left py-3 px-2">Provider · Model</th>
              <th className="text-left py-3 px-2">Type</th>
              <th className="text-left py-3 px-2">Env</th>
              <th className="text-left py-3 px-2">Key</th>
              <th className="text-left py-3 px-2">Tags</th>
              <th className="text-right py-3 px-2">Usage</th>
              <th className="text-left py-3 px-2">Last used</th>
              <th className="text-right py-3 px-5">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((k) => (
              <tr
                key={k.id}
                data-testid={`key-row-${k.id}`}
                className={`border-b border-white/5 last:border-0 hover:bg-white/[0.03] ${k.status === "revoked" ? "opacity-50" : ""}`}
              >
                <td className="py-3 px-5">
                  <div className="text-sm font-semibold text-white">{k.projectName}</div>
                  {k.status === "revoked" && <div className="text-[10px] text-red-400 font-semibold">REVOKED</div>}
                </td>
                <td className="py-3 px-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full" style={{ background: providerColor[k.provider] }} />
                    <div>
                      <div className="text-sm text-zinc-100">{k.provider}</div>
                      <div className="text-[11px] text-zinc-500">{k.model}</div>
                    </div>
                  </div>
                </td>
                <td className="py-3 px-2">
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${typeChip(k.type)}`}>{k.type}</span>
                </td>
                <td className="py-3 px-2">
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${envChip(k.env)}`}>{k.env}</span>
                </td>
                <td className="py-3 px-2 font-mono text-xs text-zinc-300 tabular">
                  <div className="flex items-center gap-1">
                    <span data-testid={`key-value-${k.id}`}>{revealed[k.id] ? k.fullKey : k.maskedKey}</span>
                    <button
                      data-testid={`btn-reveal-${k.id}`}
                      onClick={() => toggleReveal(k)}
                      className="p-1 rounded hover:bg-white/5 text-zinc-500 hover:text-fuchsia-300"
                    >
                      {revealed[k.id] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      data-testid={`btn-copy-${k.id}`}
                      onClick={() => copyKey(k)}
                      className="p-1 rounded hover:bg-white/5 text-zinc-500 hover:text-fuchsia-300"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
                <td className="py-3 px-2">
                  <div className="flex flex-wrap gap-1">
                    {k.tags.map((t) => (
                      <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 border border-white/5 text-zinc-400">
                        {t}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="py-3 px-2 text-right tabular text-sm text-zinc-200 font-medium">{k.usage.toLocaleString()}</td>
                <td className="py-3 px-2 text-[11px] text-zinc-500 tabular">{fmtDate(k.lastUsed)}</td>
                <td className="py-3 px-5 text-right space-x-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => rotate(k)}
                    disabled={k.status === "revoked"}
                    className="h-7 rounded-md border-white/10 bg-white/[0.03] hover:bg-white/[0.08] text-zinc-300 text-xs"
                    data-testid={`btn-rotate-${k.id}`}
                  >
                    <RefreshCw className="w-3 h-3 mr-1" />
                    Rotate
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => revoke(k)}
                    disabled={k.status === "revoked"}
                    className="h-7 rounded-md border-red-500/20 bg-red-500/[0.05] hover:bg-red-500/[0.12] text-red-300 text-xs"
                    data-testid={`btn-revoke-${k.id}`}
                  >
                    <Trash2 className="w-3 h-3 mr-1" />
                    Revoke
                  </Button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={9} className="py-10 text-center text-sm text-zinc-500">
                  No keys match your filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Access notice */}
      {!canReveal && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.06] p-4 flex items-start gap-3 text-xs text-amber-200">
          <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            Keys are masked. Only <span className="font-semibold">CTO</span> and <span className="font-semibold">CFO</span> can reveal or copy full keys. Every reveal is audit-logged.
          </div>
        </div>
      )}

      <GenerateKeyDialog open={openNew} onOpenChange={setOpenNew} />
    </div>
  );
};

const ChipGroup = ({ label, value, onChange, options, testidPrefix }) => (
  <div className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.03] p-1">
    <span className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500 px-2">{label}</span>
    {options.map((o) => (
      <button
        key={o}
        onClick={() => onChange(o)}
        data-testid={`filter-${testidPrefix}-${o.toLowerCase().replace(/&/g, "-").replace(/\s+/g, "")}`}
        className={`px-2 py-1 rounded-md text-[11px] font-medium transition-colors ${
          value === o ? "bg-fuchsia-500/15 text-fuchsia-300" : "text-zinc-400 hover:text-zinc-100"
        }`}
      >
        {o === "all" ? "All" : o}
      </button>
    ))}
  </div>
);

const GenerateKeyDialog = ({ open, onOpenChange }) => {
  const [form, setForm] = useState({ project: "crowley-gen", provider: "Anthropic", model: "Opus 4.8", env: "testing", type: "R&D", tag: "" });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] bg-[#12121A] border border-white/10 text-zinc-100" data-testid="generate-key-dialog">
        <DialogHeader>
          <DialogTitle className="font-display text-white">Generate new model key</DialogTitle>
          <DialogDescription className="text-xs text-zinc-400">
            Keys are unique per project × environment × R&amp;D/Ops. Generated key is shown once — copy it to your vault.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3 py-3">
          <Field label="Provider">
            <SelectPill options={["Anthropic", "OpenAI", "Google", "xAI"]} value={form.provider} onChange={(v) => setForm({ ...form, provider: v })} />
          </Field>
          <Field label="Environment">
            <SelectPill options={["testing", "production"]} value={form.env} onChange={(v) => setForm({ ...form, env: v })} />
          </Field>
          <Field label="Type">
            <SelectPill options={["R&D", "Operations"]} value={form.type} onChange={(v) => setForm({ ...form, type: v })} />
          </Field>
          <Field label="Tag (optional)">
            <input
              value={form.tag}
              onChange={(e) => setForm({ ...form, tag: e.target.value })}
              placeholder="e.g. inference"
              data-testid="gk-tag"
              className="w-full h-9 px-3 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40"
            />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="border-white/10 bg-white/[0.04] text-zinc-300 hover:bg-white/[0.08]" data-testid="gk-cancel">
            Cancel
          </Button>
          <Button
            data-testid="gk-generate"
            onClick={() => {
              toast.success("Key generated · masked in list", { description: `${form.provider} · ${form.env} · ${form.type}` });
              onOpenChange(false);
            }}
            className="bg-fuchsia-500 hover:bg-fuchsia-600 text-white"
          >
            Generate
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const Field = ({ label, children }) => (
  <div>
    <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500 mb-1.5">{label}</div>
    {children}
  </div>
);

const SelectPill = ({ options, value, onChange }) => (
  <div className="inline-flex rounded-lg border border-white/10 bg-white/[0.03] p-1 w-full">
    {options.map((o) => (
      <button
        key={o}
        onClick={() => onChange(o)}
        className={`flex-1 px-2 py-1 rounded-md text-[11px] font-medium transition-colors ${
          value === o ? "bg-fuchsia-500/15 text-fuchsia-300" : "text-zinc-400 hover:text-zinc-100"
        }`}
      >
        {o}
      </button>
    ))}
  </div>
);

export default ModelKeys;
