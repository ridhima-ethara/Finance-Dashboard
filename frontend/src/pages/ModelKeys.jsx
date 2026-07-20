import { useEffect, useMemo, useState } from "react";
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
  Search,
  Tag,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  Settings2,
  ChevronRight,
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
  AWS: "#F59E0B",
  Azure: "#0EA5E9",
  GCP: "#3B82F6",
  OpenAI: "#10B981",
  OpenRouter: "#F97316",
  "AIML APIs": "#8B5CF6",
  Moonshot: "#22C55E",
  Google: "#3B82F6",
  xAI: "#F59E0B",
  Amazon: "#F59E0B",
  Meta: "#94A3B8",
  Mistral: "#22C55E",
  Cohere: "#38BDF8",
};

const normalizeCommaList = (value = "", fallback = "") => {
  const normalized = String(value || "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  return normalized.length ? normalized.join(", ") : fallback;
};

const formatGatewayList = (values = []) => (
  Array.isArray(values) && values.length ? values.join(", ") : "Any"
);

const todayPlusDays = (days = 45) => {
  const next = new Date();
  next.setDate(next.getDate() + days);
  return next.toISOString().slice(0, 16);
};

const buildProvisionLines = (request) =>
  (request?.requestedModels?.length ? request.requestedModels : [{ id: `${request?.id}-fallback`, label: "Project access", provider: "Anthropic" }]).map((line) => ({
    id: line.id,
    label: line.label,
    modelId: line.modelId || "",
    provider: line.provider || "Anthropic",
    env: request?.budgetType === "Production" ? "production" : "testing",
    fullKey: "",
    memberIds: (request?.members || []).map((member) => member.id),
    rateLimitPerMinute: 120,
    budgetCap: Number(line.amount || 0),
    remainingBudget: Number(line.amount || 0),
    allowedNetworks: "Corp VPN",
    allowedDevices: "Managed laptop",
    expiresAt: todayPlusDays(request?.budgetType === "Production" ? 90 : 45),
  }));

const ModelKeys = () => {
  const {
    role,
    user,
    visibleProjects,
    modelKeyRecords,
    itProvisioningRequests,
    provisionModelKeys,
  } = useApp();
  const [revealed, setRevealed] = useState({});
  const [query, setQuery] = useState("");
  const [envFilter, setEnvFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [providerFilter, setProviderFilter] = useState("all");
  const [activeProvisionRequest, setActiveProvisionRequest] = useState(null);
  const canReveal = role === "CFO" || role === "IT";
  const isPrivileged = role === "CFO" || role === "IT";

  const allowedProjects = useMemo(() => {
    if (isPrivileged) return null;
    return new Set(visibleProjects.map((project) => project.id));
  }, [isPrivileged, visibleProjects]);

  const keyRows = useMemo(() => (
    allowedProjects
      ? modelKeyRecords.filter((entry) => allowedProjects.has(entry.project))
      : modelKeyRecords
  ), [allowedProjects, modelKeyRecords]);

  const provisioningRows = useMemo(() => {
    const base = isPrivileged
      ? itProvisioningRequests
      : itProvisioningRequests.filter((request) => allowedProjects?.has(request.projectId));
    return base.sort((left, right) => new Date(right.approvedAt || 0).getTime() - new Date(left.approvedAt || 0).getTime());
  }, [allowedProjects, isPrivileged, itProvisioningRequests]);

  const filtered = keyRows.filter((entry) => {
    if (envFilter !== "all" && entry.env !== envFilter) return false;
    if (typeFilter !== "all" && entry.type !== typeFilter) return false;
    if (providerFilter !== "all" && entry.provider !== providerFilter) return false;
    if (query) {
      const needle = query.toLowerCase();
      const memberMatch = (entry.members || []).some((member) => `${member.name} ${member.email}`.toLowerCase().includes(needle));
      if (
        !entry.projectName.toLowerCase().includes(needle)
        && !entry.provider.toLowerCase().includes(needle)
        && !entry.model.toLowerCase().includes(needle)
        && !entry.tags.some((tag) => tag.toLowerCase().includes(needle))
        && !memberMatch
      ) return false;
    }
    return true;
  });

  const toggleReveal = (id) => {
    if (!canReveal) {
      toast.error("Access denied", { description: `Only CFO or IT can reveal keys. You are signed in as ${role}.` });
      return;
    }
    setRevealed((current) => {
      const next = { ...current, [id]: !current[id] };
      if (next[id]) toast.info("Key revealed · audit logged", { description: `Actor: ${user.name} · ${role}` });
      return next;
    });
  };

  const copyKey = (entry) => {
    if (!canReveal) {
      toast.error("Access denied");
      return;
    }
    navigator.clipboard?.writeText(entry.fullKey);
    toast.success("Key copied · audit logged", { description: `${entry.provider} · ${entry.projectName} · ${entry.env}` });
  };

  const rotate = (entry) => {
    toast.success("Key rotation queued", { description: `${entry.provider} · ${entry.projectName} · new key generated, old revoked in 24h` });
  };

  const revoke = (entry) => {
    toast.warning("Key revoked", { description: `${entry.provider} · ${entry.projectName} · ${entry.env} · effective immediately` });
  };

  const stats = {
    total: keyRows.length,
    active: keyRows.filter((entry) => entry.status === "active").length,
    prod: keyRows.filter((entry) => entry.env === "production" && entry.status === "active").length,
    rd: keyRows.filter((entry) => entry.type === "R&D" && entry.status === "active").length,
    pendingProvisioning: provisioningRows.filter((entry) => entry.status === "pending-it").length,
    activeTokens: keyRows.reduce((sum, entry) => sum + (entry.accessTokens?.filter((token) => token.status === "active").length || 0), 0),
  };

  if (role === "CTO") {
    return (
      <div className="space-y-6" data-testid="page-model-keys-cto-blocked">
        <div>
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] font-semibold text-fuchsia-400">
            <ShieldCheck className="w-3 h-3" />
            Governance handoff
          </div>
          <h1 className="mt-2 font-display font-semibold text-3xl tracking-tight text-white">Model Keys</h1>
          <p className="text-sm text-zinc-400 mt-1">
            CTO review no longer exposes project keys directly. IT provisions them after CFO sign-off, and TPM / R&amp;D members see the allocations once they are assigned.
          </p>
        </div>

        <div className="rounded-2xl border border-white/5 bg-[#12121A] p-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <div className="text-sm font-semibold text-white">Access is routed through IT</div>
              <div className="text-xs text-zinc-400 mt-1 leading-relaxed">
                CFO-approved budgets create IT provisioning requests. Once IT adds the model keys and assigns members, the mapped TPM / R&amp;D users can view their project allocations in the shared model-keys section.
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="page-model-keys">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] font-semibold text-fuchsia-400">
            <ShieldCheck className="w-3 h-3" />
            {role === "IT" ? "IT Access Control" : "Governance"}
          </div>
          <h1 className="mt-2 font-display font-semibold text-3xl tracking-tight text-white">Model Keys</h1>
          <p className="text-sm text-zinc-400 mt-1">
            Provider keys stay masked here while project teams receive internal platform tokens that route through the AI gateway.
          </p>
        </div>
        {role === "IT" && (
          <Button
            onClick={() => {
              const pending = provisioningRows.find((entry) => entry.status === "pending-it");
              if (pending) setActiveProvisionRequest(pending);
              else toast.info("No pending IT provisioning requests");
            }}
            className="h-9 rounded-lg bg-fuchsia-500 hover:bg-fuchsia-600 gap-2 text-white shadow-[0_0_20px_rgba(232,25,184,0.35)]"
            data-testid="btn-open-provisioning"
          >
            <Settings2 className="w-4 h-4" />
            Provision pending keys
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        {[
          { l: "Total keys", v: stats.total, i: Key },
          { l: "Active", v: stats.active, i: ShieldCheck },
          { l: "Production", v: stats.prod, i: AlertCircle },
          { l: "R&D", v: stats.rd, i: Tag },
          { l: "Pending IT", v: stats.pendingProvisioning, i: Settings2 },
          { l: "Active tokens", v: stats.activeTokens, i: ShieldCheck },
        ].map((entry) => (
          <div key={entry.l} className="bg-[#12121A] rounded-2xl border border-white/5 p-5">
            <div className="flex items-center justify-between">
              <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500">{entry.l}</div>
              <div className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center">
                <entry.i className="w-3.5 h-3.5 text-zinc-400" />
              </div>
            </div>
            <div className="mt-3 font-display font-semibold text-3xl tabular text-white">{entry.v}</div>
          </div>
        ))}
      </div>

      {provisioningRows.length > 0 && (
        <div className="bg-[#12121A] rounded-2xl border border-white/5 p-5" data-testid="provisioning-queue">
          <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
            <div>
              <div className="font-display font-semibold text-[15px] text-white">Budget approvals waiting for model access</div>
              <div className="text-xs text-zinc-500 mt-0.5">Approved budgets move here after CFO sign-off so IT can add and allocate keys.</div>
            </div>
          </div>
          <div className="space-y-3">
            {provisioningRows.map((request) => (
              <div key={request.id} className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-white">{request.projectName}</div>
                    <div className="text-[11px] text-zinc-500 mt-1">
                      {request.budgetType} · approved {new Date(request.approvedAt || Date.now()).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border ${request.status === "completed" ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" : "bg-sky-500/15 text-sky-300 border-sky-500/30"}`}>
                      {request.status === "completed" ? "Provisioned" : "Pending IT"}
                    </span>
                    {role === "IT" && request.status === "pending-it" && (
                      <Button
                        size="sm"
                        onClick={() => setActiveProvisionRequest(request)}
                        data-testid={`provision-${request.id}`}
                        className="h-8 rounded-md bg-fuchsia-500/15 hover:bg-fuchsia-500/25 border border-fuchsia-500/25 text-fuchsia-300 text-xs gap-1"
                      >
                        Provision now <ChevronRight className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-1 lg:grid-cols-4 gap-3 text-[11px]">
                  <ProvisionStat label="Approved amount" value={`$${request.approvedAmount.toLocaleString()}`} />
                  <ProvisionStat label="Models requested" value={String(request.requestedModels?.length || 0)} />
                  <ProvisionStat label="Infra lines" value={String(request.requestedInfra?.length || 0)} />
                  <ProvisionStat label="Members" value={String(request.members?.length || 0)} />
                </div>
                <div className="mt-3 text-[11px] text-zinc-500">
                  Gateway route: <span className="font-mono text-zinc-200">{request.gatewayRoute || "/api/gateway/execute"}</span>
                  {request.lines?.length ? ` · ${request.lines.reduce((sum, line) => sum + Number(line.issuedTokenCount || 0), 0)} token(s) issued` : ""}
                </div>
                <div className="mt-3 grid grid-cols-1 lg:grid-cols-3 gap-3">
                  <ProvisionList title="Models" items={(request.requestedModels || []).map((line) => line.label)} empty="No model line requested." />
                  <ProvisionList title="Infrastructure" items={(request.requestedInfra || []).map((line) => line.label)} empty="No infra line requested." />
                  <ProvisionList title="Subscriptions" items={(request.requestedSubs || []).map((line) => line.label)} empty="No subscription line requested." />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[260px] max-w-md">
          <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            data-testid="keys-search"
            placeholder="Search project, provider, model, member…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full h-10 pl-9 pr-3 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40"
          />
        </div>
        <ChipGroup label="Env" value={envFilter} onChange={setEnvFilter} testidPrefix="env" options={["all", "production", "testing"]} />
        <ChipGroup label="Type" value={typeFilter} onChange={setTypeFilter} testidPrefix="type" options={["all", "R&D", "Production"]} />
        <ChipGroup label="Provider" value={providerFilter} onChange={setProviderFilter} testidPrefix="prov" options={["all", "AWS", "Azure", "OpenAI", "OpenRouter", "AIML APIs", "GCP", "Moonshot", "Anthropic", "Amazon"]} />
      </div>

      <div className="bg-[#12121A] rounded-2xl border border-white/5 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="text-[10px] uppercase tracking-widest text-zinc-500 font-semibold border-b border-white/5 bg-white/[0.02]">
              <th className="text-left py-3 px-5">Project</th>
              <th className="text-left py-3 px-2">Provider · Model</th>
              <th className="text-left py-3 px-2">Type</th>
              <th className="text-left py-3 px-2">Env</th>
              <th className="text-left py-3 px-2">Provider Key</th>
              <th className="text-left py-3 px-2">Allocated members</th>
              <th className="text-right py-3 px-2">Usage</th>
              <th className="text-left py-3 px-2">Last used</th>
              <th className="text-right py-3 px-5">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((entry) => (
              <tr
                key={entry.id}
                data-testid={`key-row-${entry.id}`}
                className={`border-b border-white/5 last:border-0 hover:bg-white/[0.03] ${entry.status === "revoked" ? "opacity-50" : ""}`}
              >
                <td className="py-3 px-5">
                  <div className="text-sm font-semibold text-white">{entry.projectName}</div>
                  {entry.status === "revoked" && <div className="text-[10px] text-red-400 font-semibold">REVOKED</div>}
                </td>
                <td className="py-3 px-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full" style={{ background: providerColor[entry.provider] || "#E619B8" }} />
                    <div>
                      <div className="text-sm text-zinc-100">{entry.provider}</div>
                      <div className="text-[11px] text-zinc-500">{entry.model}</div>
                    </div>
                  </div>
                </td>
                <td className="py-3 px-2">
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${typeChip(entry.type)}`}>{entry.type}</span>
                </td>
                <td className="py-3 px-2">
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${envChip(entry.env)}`}>{entry.env}</span>
                </td>
                <td className="py-3 px-2 font-mono text-xs text-zinc-300 tabular">
                  <div className="flex items-center gap-1">
                    <span data-testid={`key-value-${entry.id}`}>{revealed[entry.id] ? entry.fullKey : entry.maskedKey}</span>
                    <button
                      data-testid={`btn-reveal-${entry.id}`}
                      onClick={() => toggleReveal(entry.id)}
                      className="p-1 rounded hover:bg-white/5 text-zinc-500 hover:text-fuchsia-300"
                    >
                      {revealed[entry.id] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      data-testid={`btn-copy-${entry.id}`}
                      onClick={() => copyKey(entry)}
                      className="p-1 rounded hover:bg-white/5 text-zinc-500 hover:text-fuchsia-300"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="mt-1 text-[10px] text-zinc-500">
                    {(entry.accessTokens || []).length} platform token{(entry.accessTokens || []).length === 1 ? "" : "s"} · {(entry.gatewayPolicy?.rateLimitPerMinute || 0)}/min
                  </div>
                  <div className="text-[10px] text-zinc-600">
                    {entry.gatewayRoute || "/api/gateway/execute"} · budget ${Number(entry.gatewayPolicy?.remainingBudget || 0).toLocaleString()}
                  </div>
                </td>
                <td className="py-3 px-2">
                  <div className="flex flex-wrap gap-1">
                    {(entry.members || []).length === 0 && <span className="text-[10px] text-zinc-500">No members mapped</span>}
                    {(entry.members || []).map((member) => (
                      <span key={member.id} className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 border border-white/5 text-zinc-400">
                        {member.name.split(" ")[0]}
                      </span>
                    ))}
                  </div>
                  {(entry.accessTokens || []).length > 0 && (
                    <div className="mt-2 space-y-1">
                      {entry.accessTokens.map((token) => (
                        <div key={token.id} className="text-[10px] text-zinc-500">
                          {token.memberName} · {token.maskedToken} · {token.remainingBudget.toFixed(0)} left
                        </div>
                      ))}
                    </div>
                  )}
                </td>
                <td className="py-3 px-2 text-right tabular text-sm text-zinc-200 font-medium">{entry.usage.toLocaleString()}</td>
                <td className="py-3 px-2 text-[11px] text-zinc-500 tabular">{fmtDate(entry.lastUsed)}</td>
                <td className="py-3 px-5 text-right space-x-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => rotate(entry)}
                    disabled={entry.status === "revoked"}
                    className="h-7 rounded-md border-white/10 bg-white/[0.03] hover:bg-white/[0.08] text-zinc-300 text-xs"
                    data-testid={`btn-rotate-${entry.id}`}
                  >
                    <RefreshCw className="w-3 h-3 mr-1" />
                    Rotate
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => revoke(entry)}
                    disabled={entry.status === "revoked"}
                    className="h-7 rounded-md border-red-500/20 bg-red-500/[0.05] hover:bg-red-500/[0.12] text-red-300 text-xs"
                    data-testid={`btn-revoke-${entry.id}`}
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

      {!canReveal && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.06] p-4 flex items-start gap-3 text-xs text-amber-200">
          <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            Keys are masked. Only <span className="font-semibold">CFO</span> and <span className="font-semibold">IT</span> can reveal or copy full keys. Members still see which project allocations belong to them.
          </div>
        </div>
      )}

      <ProvisionKeysDialog
        open={!!activeProvisionRequest}
        onOpenChange={(open) => !open && setActiveProvisionRequest(null)}
        request={activeProvisionRequest}
        onSubmit={(requestId, payload) => {
          provisionModelKeys(requestId, payload);
          toast.success("Keys provisioned", { description: `${activeProvisionRequest?.projectName} is now visible in model-key allocations.` });
          setActiveProvisionRequest(null);
        }}
      />
    </div>
  );
};

const ProvisionStat = ({ label, value }) => (
  <div className="rounded-lg border border-white/5 bg-white/[0.03] p-3">
    <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500">{label}</div>
    <div className="mt-1 text-sm font-semibold text-white tabular">{value}</div>
  </div>
);

const ProvisionList = ({ title, items, empty }) => (
  <div className="rounded-lg border border-white/5 bg-white/[0.03] p-3">
    <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500 mb-2">{title}</div>
    {items.length === 0 ? (
      <div className="text-[11px] text-zinc-500">{empty}</div>
    ) : (
      <div className="space-y-1">
        {items.map((item) => (
          <div key={item} className="text-[11px] text-zinc-200">{item}</div>
        ))}
      </div>
    )}
  </div>
);

const ChipGroup = ({ label, value, onChange, options, testidPrefix }) => (
  <div className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.03] p-1">
    <span className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500 px-2">{label}</span>
    {options.map((option) => (
      <button
        key={option}
        onClick={() => onChange(option)}
        data-testid={`filter-${testidPrefix}-${option.toLowerCase().replace(/&/g, "-").replace(/\s+/g, "")}`}
        className={`px-2 py-1 rounded-md text-[11px] font-medium transition-colors ${
          value === option ? "bg-fuchsia-500/15 text-fuchsia-300" : "text-zinc-400 hover:text-zinc-100"
        }`}
      >
        {option === "all" ? "All" : option}
      </button>
    ))}
  </div>
);

const ProvisionKeysDialog = ({ open, onOpenChange, request, onSubmit }) => {
  const [lines, setLines] = useState(() => buildProvisionLines(request));
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!open) return;
    setLines(buildProvisionLines(request));
    setNote("");
  }, [open, request]);

  if (!request) return null;

  const updateLine = (id, key, value) => {
    setLines((current) => current.map((line) => (
      line.id === id
        ? { ...line, [key]: value }
        : line
    )));
  };

  const toggleMember = (lineId, memberId) => {
    setLines((current) => current.map((line) => {
      if (line.id !== lineId) return line;
      const memberIds = line.memberIds.includes(memberId)
        ? line.memberIds.filter((id) => id !== memberId)
        : [...line.memberIds, memberId];
      return { ...line, memberIds };
    }));
  };

  const submit = () => {
    if (lines.some((line) => !String(line.fullKey || "").trim())) {
      toast.error("Add a key value for every requested model line");
      return;
    }
    if (lines.some((line) => line.memberIds.length === 0)) {
      toast.error("Allocate each key to at least one member");
      return;
    }
    onSubmit(request.id, { lines, note });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[900px] max-h-[92vh] overflow-y-auto bg-[#12121A] border border-white/10 text-zinc-100" data-testid="provision-keys-dialog">
        <DialogHeader>
          <DialogTitle className="font-display text-white">Provision model keys</DialogTitle>
          <DialogDescription className="text-xs text-zinc-400">
            {request.projectName} · approved {new Date(request.approvedAt || Date.now()).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} · store the provider key once, then issue internal platform tokens to the selected members.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {lines.map((line) => (
            <div key={line.id} className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <div className="text-sm font-semibold text-white">{line.label}</div>
                  <div className="text-[11px] text-zinc-500 mt-1">{line.provider}</div>
                </div>
                <select
                  value={line.env}
                  onChange={(e) => updateLine(line.id, "env", e.target.value)}
                  className="h-9 px-3 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-zinc-100"
                >
                  <option value="testing">testing</option>
                  <option value="production">production</option>
                </select>
              </div>

              <div className="mt-3">
                <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500 mb-1.5">Key value</div>
                <input
                  value={line.fullKey}
                  onChange={(e) => updateLine(line.id, "fullKey", e.target.value)}
                  placeholder="Paste the provisioned key"
                  data-testid={`provision-key-${line.id}`}
                  className="w-full h-10 px-3 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40"
                />
              </div>

              <div className="mt-3 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                <ProvisionField
                  label="Rate / min"
                  type="number"
                  min="1"
                  step="1"
                  value={line.rateLimitPerMinute}
                  onChange={(value) => updateLine(line.id, "rateLimitPerMinute", value)}
                />
                <ProvisionField
                  label="Budget cap"
                  type="number"
                  min="0"
                  step="0.01"
                  value={line.budgetCap}
                  onChange={(value) => updateLine(line.id, "budgetCap", value)}
                />
                <ProvisionField
                  label="Remaining budget"
                  type="number"
                  min="0"
                  step="0.01"
                  value={line.remainingBudget}
                  onChange={(value) => updateLine(line.id, "remainingBudget", value)}
                />
                <ProvisionField
                  label="Expires at"
                  type="datetime-local"
                  value={line.expiresAt}
                  onChange={(value) => updateLine(line.id, "expiresAt", value)}
                />
              </div>

              <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                <ProvisionField
                  label="Allowed networks"
                  value={line.allowedNetworks}
                  placeholder="Corp VPN, HQ Office"
                  onChange={(value) => updateLine(line.id, "allowedNetworks", normalizeCommaList(value, "Corp VPN"))}
                />
                <ProvisionField
                  label="Allowed devices"
                  value={line.allowedDevices}
                  placeholder="Managed laptop, Serverless app"
                  onChange={(value) => updateLine(line.id, "allowedDevices", normalizeCommaList(value, "Managed laptop"))}
                />
              </div>

              <div className="mt-3">
                <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500 mb-1.5">Allocate to members</div>
                <div className="flex flex-wrap gap-1.5">
                  {(request.members || []).map((member) => {
                    const on = line.memberIds.includes(member.id);
                    return (
                      <button
                        key={member.id}
                        type="button"
                        onClick={() => toggleMember(line.id, member.id)}
                        data-testid={`provision-member-${line.id}-${member.id}`}
                        className={`px-2 py-1 rounded-md text-[11px] font-medium border transition-colors ${
                          on ? "border-fuchsia-500/40 bg-fuchsia-500/15 text-fuchsia-200" : "border-white/10 bg-white/[0.03] text-zinc-400 hover:text-zinc-100"
                        }`}
                      >
                        {member.name} · {member.role}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="mt-3 rounded-lg border border-cyan-500/20 bg-cyan-500/[0.06] px-3 py-2 text-[11px] text-cyan-100">
                Gateway checks on every call: token status, token owner, user or app identity, allowed model, remaining budget, rate limit, expiration, and allowed network/device.
                <div className="mt-1 text-cyan-200/80">
                  Networks: {formatGatewayList(String(line.allowedNetworks || "").split(",").map((entry) => entry.trim()).filter(Boolean))} · Devices: {formatGatewayList(String(line.allowedDevices || "").split(",").map((entry) => entry.trim()).filter(Boolean))}
                </div>
              </div>
            </div>
          ))}

          <div>
            <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500 mb-1.5">IT note</div>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="Optional note about provisioning, scope, or handoff"
              className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40 resize-none"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="border-white/10 bg-white/[0.04] text-zinc-300 hover:bg-white/[0.08]">
            Cancel
          </Button>
          <Button onClick={submit} className="bg-fuchsia-500 hover:bg-fuchsia-600 text-white gap-1.5 shadow-[0_0_20px_rgba(232,25,184,0.35)]">
            <CheckCircle2 className="w-3.5 h-3.5" /> Save provisioning
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const ProvisionField = ({ label, onChange, ...props }) => (
  <div>
    <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500 mb-1.5">{label}</div>
    <input
      {...props}
      onChange={(event) => onChange(event.target.value)}
      className="w-full h-10 px-3 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40"
    />
  </div>
);

export default ModelKeys;
