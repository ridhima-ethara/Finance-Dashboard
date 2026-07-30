import { useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./ui/dialog";
import { Button } from "./ui/button";
import { toast } from "sonner";
import { Upload, FileSpreadsheet, ArrowRight, ArrowLeft, CheckCircle2, X, Info } from "lucide-react";
import { BEDROCK_MODELS, EC2_INSTANCES, SUBSCRIPTION_CATALOG } from "../data/mockCatalog";

const uid = () => Math.random().toString(36).slice(2, 8);
const IGNORE = "__ignore__";

// Target fields per category — the mapping UI will show only these fields for the
// chosen category. Each field can be mapped to any CSV column (or left unmapped).
const CATEGORY_FIELDS = {
  models: [
    { key: "provider", label: "Provider / Platform", hint: "AWS · OpenAI · GCP · Moonshot · …" },
    { key: "modelName", label: "Model name", hint: "Matched against catalog; else stored as label" },
    { key: "usageTag", label: "Usage tag", hint: "e.g. Trajectory building, Grading, Validation" },
    { key: "costPerTask", label: "Cost / task ($)", hint: "Per-trajectory cost — used for volume math" },
    { key: "estCost", label: "Estimated cost ($)", hint: "Fallback total if per-task * volume isn't computed" },
  ],
  infra: [
    { key: "provider", label: "Provider", hint: "AWS · GCP · Azure · …" },
    { key: "instance", label: "Instance code", hint: "e.g. g5.xlarge, m5.large" },
    { key: "instanceCount", label: "Instance count", hint: "Defaults to 1" },
    { key: "monthlyCost", label: "Monthly cost ($)", hint: "Baseline per-instance monthly rate" },
    { key: "storageType", label: "Storage type", hint: "Standard SSD · Provisioned IOPS · …" },
    { key: "perInstanceStorage", label: "Storage / instance (GB)", hint: "Defaults to 100 GB" },
    { key: "estCost", label: "Estimated cost ($)", hint: "Overrides computed total if provided" },
  ],
  subs: [
    { key: "subscription", label: "Subscription name", hint: "Matched against catalog; else stored as-is" },
    { key: "pricePerSeat", label: "Price / seat / month ($)" },
    { key: "seats", label: "Seats", hint: "Defaults to 1" },
    { key: "days", label: "Days", hint: "Duration in days; blank = budget span" },
    { key: "members", label: "Members (comma-separated)", hint: "Optional — emails or names" },
    { key: "estCost", label: "Estimated cost ($)", hint: "Overrides seat × price × days / 30 if provided" },
  ],
  general: [
    { key: "label", label: "Item / Label" },
    { key: "note", label: "Note / Description" },
    { key: "estCost", label: "Estimated cost ($)", hint: "Required" },
  ],
};

const CATEGORIES = [
  { id: "models", label: "Models", desc: "LLM / model spend lines" },
  { id: "infra", label: "Infrastructure", desc: "Compute / storage / GPU" },
  { id: "subs", label: "Subscriptions", desc: "Seats · SaaS · tooling" },
  { id: "general", label: "General", desc: "Anything else (freeform)" },
];

// Fuzzy header → target field auto-detection to give users a sensible starting map.
const AUTO_MAP_HINTS = {
  provider: ["provider", "platform", "vendor", "cloud"],
  modelName: ["model", "model name", "modelname", "llm"],
  usageTag: ["usage", "tag", "purpose", "use case"],
  costPerTask: ["cost per task", "per task", "cost/task", "cost per trajectory", "unit cost"],
  estCost: ["est cost", "estimated", "total", "amount", "cost", "spend", "budget", "value", "price"],
  instance: ["instance", "sku", "machine", "shape"],
  instanceCount: ["count", "instances", "qty", "quantity", "nodes"],
  monthlyCost: ["monthly", "monthly cost", "month cost", "per month"],
  storageType: ["storage type", "disk type", "volume type"],
  perInstanceStorage: ["storage", "disk", "gb", "capacity"],
  subscription: ["subscription", "tool", "service", "seat name", "software"],
  pricePerSeat: ["price per seat", "seat price", "per seat", "unit price"],
  seats: ["seats", "licenses", "users"],
  days: ["days", "duration", "term"],
  members: ["members", "assignees", "team", "users"],
  label: ["label", "item", "name", "description", "line item"],
  note: ["note", "notes", "detail", "details", "comment", "remark"],
};

const autoMapColumns = (headers, category) => {
  const targets = CATEGORY_FIELDS[category] || [];
  const mapping = {};
  const usedHeaders = new Set();
  targets.forEach((target) => {
    const hints = AUTO_MAP_HINTS[target.key] || [target.key.toLowerCase()];
    const match = headers.find((h) => {
      if (usedHeaders.has(h)) return false;
      const norm = String(h || "").trim().toLowerCase();
      if (!norm) return false;
      return hints.some((hint) => norm === hint || norm.includes(hint));
    });
    if (match) {
      mapping[target.key] = match;
      usedHeaders.add(match);
    } else {
      mapping[target.key] = IGNORE;
    }
  });
  return mapping;
};

const toNumber = (v) => {
  if (v === null || v === undefined || v === "") return 0;
  const s = String(v).replace(/[$,₹\s]/g, "");
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
};

const parseCsvOrExcel = async (file) => {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: "array" });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) throw new Error("Empty file");
  const sheet = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: "", raw: false });
  if (!rows.length) throw new Error("No data rows detected in the file");
  const headers = Object.keys(rows[0]);
  return { headers, rows };
};

const buildLinesForCategory = ({ category, rows, mapping, modelCatalog, defaultDays }) => {
  const pick = (row, key) => {
    const src = mapping[key];
    if (!src || src === IGNORE) return "";
    return row[src] ?? "";
  };
  if (category === "models") {
    return rows.map((row) => {
      const providerRaw = String(pick(row, "provider") || "").trim();
      const modelName = String(pick(row, "modelName") || "").trim();
      const meta = modelCatalog.find((m) => (
        m.name?.toLowerCase() === modelName.toLowerCase() ||
        m.id?.toLowerCase() === modelName.toLowerCase()
      )) || modelCatalog[0] || BEDROCK_MODELS[0];
      const provider = providerRaw || meta.provider || "OpenAI";
      const costPerTask = toNumber(pick(row, "costPerTask"));
      const estCost = toNumber(pick(row, "estCost"));
      return {
        id: `csv-${uid()}`,
        modelId: meta.id,
        provider,
        usageTag: String(pick(row, "usageTag") || "Trajectory building").trim() || "Trajectory building",
        costPerTask: costPerTask || 0,
        estCost: estCost || costPerTask || 0,
        _csvLabel: modelName || meta.name,
      };
    });
  }
  if (category === "infra") {
    return rows.map((row) => {
      const instanceCode = String(pick(row, "instance") || "").trim();
      const meta = EC2_INSTANCES.find((e) => (
        e.code?.toLowerCase() === instanceCode.toLowerCase()
      )) || EC2_INSTANCES[0];
      const provider = String(pick(row, "provider") || meta?.provider || "AWS").trim() || "AWS";
      const monthlyCost = toNumber(pick(row, "monthlyCost"));
      const instanceCount = Math.max(1, toNumber(pick(row, "instanceCount")) || 1);
      const perInstanceStorage = toNumber(pick(row, "perInstanceStorage")) || 100;
      const storageType = String(pick(row, "storageType") || "Standard SSD").trim() || "Standard SSD";
      const estCost = toNumber(pick(row, "estCost"));
      return {
        id: `csv-${uid()}`,
        provider,
        instance: meta?.code || instanceCode || "m5.large",
        instanceCount,
        monthlyCost: monthlyCost || (meta?.hourly ? Math.round(meta.hourly * 730 * 100) / 100 : 0),
        storageType,
        perInstanceStorage,
        estCost: estCost || 0,
        _csvLabel: instanceCode || meta?.code,
      };
    });
  }
  if (category === "subs") {
    return rows.map((row) => {
      const subName = String(pick(row, "subscription") || "").trim();
      const meta = SUBSCRIPTION_CATALOG.find((s) => (
        s.name?.toLowerCase() === subName.toLowerCase()
      )) || SUBSCRIPTION_CATALOG[0];
      const pricePerSeat = toNumber(pick(row, "pricePerSeat")) || meta?.monthly || 0;
      const seats = Math.max(1, toNumber(pick(row, "seats")) || 1);
      const daysVal = pick(row, "days");
      const days = daysVal === "" || daysVal === null ? null : Math.max(1, toNumber(daysVal));
      const membersRaw = String(pick(row, "members") || "");
      const members = membersRaw
        ? membersRaw.split(/[,;]/).map((s) => s.trim()).filter(Boolean)
        : [];
      const estCostRaw = toNumber(pick(row, "estCost"));
      const effDays = days ?? defaultDays ?? 30;
      const estCost = estCostRaw || Math.round((pricePerSeat * seats * effDays / 30) * 100) / 100;
      return {
        id: `csv-${uid()}`,
        subscription: subName || meta?.name || "Subscription",
        pricePerSeat,
        seats,
        days,
        members,
        estCost,
      };
    });
  }
  // general
  return rows.map((row) => ({
    id: `csv-${uid()}`,
    label: String(pick(row, "label") || "").trim() || "Imported line",
    note: String(pick(row, "note") || "").trim(),
    estCost: toNumber(pick(row, "estCost")),
  }));
};

const CsvBudgetImportDialog = ({ open, onOpenChange, onImport, modelCatalog = [], defaultDays = 30 }) => {
  const inputRef = useRef(null);
  const [step, setStep] = useState(1); // 1=upload, 2=map, 3=preview
  const [file, setFile] = useState(null);
  const [headers, setHeaders] = useState([]);
  const [rows, setRows] = useState([]);
  const [category, setCategory] = useState("general");
  const [mapping, setMapping] = useState({});

  useEffect(() => {
    if (!open) {
      setStep(1);
      setFile(null);
      setHeaders([]);
      setRows([]);
      setCategory("general");
      setMapping({});
      if (inputRef.current) inputRef.current.value = "";
    }
  }, [open]);

  useEffect(() => {
    if (step === 2 && headers.length) {
      setMapping(autoMapColumns(headers, category));
    }
  }, [step, category, headers]);

  const targetFields = CATEGORY_FIELDS[category] || [];

  const generatedLines = useMemo(() => {
    if (step !== 3) return [];
    return buildLinesForCategory({ category, rows, mapping, modelCatalog, defaultDays });
  }, [step, category, rows, mapping, modelCatalog, defaultDays]);

  const handleFile = async (f) => {
    if (!f) return;
    try {
      const { headers: h, rows: r } = await parseCsvOrExcel(f);
      setFile(f);
      setHeaders(h);
      setRows(r);
      setMapping(autoMapColumns(h, category));
      setStep(2);
      toast.success("File parsed", { description: `${r.length} row${r.length === 1 ? "" : "s"} · ${h.length} column${h.length === 1 ? "" : "s"}` });
    } catch (err) {
      toast.error("Could not parse the file", { description: err.message || "Ensure it's a valid CSV / XLSX with headers." });
    }
  };

  const doApply = () => {
    if (!generatedLines.length) {
      toast.error("Nothing to import");
      return;
    }
    onImport?.({ category, lines: generatedLines });
    onOpenChange?.(false);
  };

  const previewRows = rows.slice(0, 5);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-3xl w-[95vw] max-h-[85vh] overflow-hidden flex flex-col bg-[#0F0F17] border-white/10 text-zinc-100"
        data-testid="csv-import-dialog"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <FileSpreadsheet className="w-4 h-4 text-fuchsia-300" />
            Import budget lines from CSV / Excel
          </DialogTitle>
          <DialogDescription className="text-zinc-400 text-xs">
            Upload a spreadsheet, map columns to budget fields, then review before adding them to this budget.
          </DialogDescription>
        </DialogHeader>

        {/* Stepper */}
        <div className="flex items-center gap-3 flex-wrap text-[11px] uppercase tracking-widest">
          {["Upload", "Map columns", "Preview & apply"].map((label, i) => {
            const n = i + 1;
            const active = step === n;
            const done = step > n;
            return (
              <div key={label} className="flex items-center gap-2">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold border ${done ? "bg-emerald-500/20 border-emerald-500 text-emerald-300" : active ? "bg-fuchsia-500/20 border-fuchsia-500 text-fuchsia-300" : "bg-white/[0.04] border-white/10 text-zinc-500"}`}>
                  {done ? <CheckCircle2 className="w-3 h-3" /> : n}
                </div>
                <span className={done ? "text-emerald-300" : active ? "text-fuchsia-300" : "text-zinc-500"}>
                  {label}
                </span>
                {n < 3 && <div className="w-6 h-px bg-white/10" />}
              </div>
            );
          })}
        </div>

        <div className="flex-1 overflow-y-auto -mx-1 px-1">
          {step === 1 && (
            <div className="mt-2 space-y-4" data-testid="csv-step-upload">
              <div className="rounded-xl border border-dashed border-white/15 bg-white/[0.02] p-8 text-center">
                <Upload className="w-6 h-6 mx-auto text-fuchsia-300" />
                <div className="mt-3 text-sm text-white font-medium">Drop or pick a CSV / XLSX file</div>
                <div className="mt-1 text-xs text-zinc-500">First row must contain column headers.</div>
                <input
                  ref={inputRef}
                  type="file"
                  accept=".csv,.tsv,.xlsx,.xls"
                  onChange={(e) => handleFile(e.target.files?.[0])}
                  className="hidden"
                  data-testid="csv-import-file-input"
                />
                <Button
                  className="mt-4 h-9 rounded-lg bg-fuchsia-500 hover:bg-fuchsia-600 text-white gap-2"
                  onClick={() => inputRef.current?.click()}
                  data-testid="csv-import-pick-file"
                >
                  <Upload className="w-4 h-4" /> Choose file
                </Button>
              </div>
              <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3 flex items-start gap-2">
                <Info className="w-4 h-4 text-sky-300 flex-shrink-0 mt-0.5" />
                <div className="text-[11px] text-zinc-400 leading-relaxed">
                  Any column layout works — the next step lets you map your columns to budget fields
                  (item name, provider, unit cost, quantity, estimated cost, …). Numeric formatting like
                  <span className="text-zinc-300 font-mono">{'"$1,200"'}</span> is handled automatically.
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="mt-2 space-y-4" data-testid="csv-step-map">
              <div>
                <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500 mb-2">
                  1 · Pick target budget category
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => setCategory(cat.id)}
                      data-testid={`csv-cat-${cat.id}`}
                      className={`text-left p-3 rounded-lg border transition-colors ${category === cat.id ? "border-fuchsia-500/60 bg-fuchsia-500/10 text-fuchsia-100" : "border-white/10 bg-white/[0.02] text-zinc-300 hover:border-white/20"}`}
                    >
                      <div className="text-xs font-semibold">{cat.label}</div>
                      <div className="text-[10px] text-zinc-500 mt-0.5">{cat.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500 mb-2">
                  2 · Map spreadsheet columns → budget fields
                </div>
                <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3 space-y-2">
                  {targetFields.map((tf) => (
                    <div key={tf.key} className="grid grid-cols-[1fr_auto_1fr] gap-2 items-center">
                      <div>
                        <div className="text-xs font-medium text-zinc-100">{tf.label}</div>
                        {tf.hint && <div className="text-[10px] text-zinc-500">{tf.hint}</div>}
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 text-zinc-600" />
                      <select
                        value={mapping[tf.key] || IGNORE}
                        onChange={(e) => setMapping((m) => ({ ...m, [tf.key]: e.target.value }))}
                        data-testid={`csv-map-${tf.key}`}
                        className="w-full h-8 px-2 rounded-md bg-white/[0.04] border border-white/10 text-xs text-zinc-100 focus:outline-none focus:ring-1 focus:ring-fuchsia-500/40"
                      >
                        <option value={IGNORE}>— Not mapped —</option>
                        {headers.map((h) => (
                          <option key={h} value={h}>{h}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
                <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500 mb-2">
                  File preview · first {Math.min(rows.length, 5)} of {rows.length} row{rows.length === 1 ? "" : "s"}
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-[11px]">
                    <thead>
                      <tr className="text-left text-zinc-500">
                        {headers.map((h) => (
                          <th key={h} className="pr-4 pb-1 whitespace-nowrap font-medium">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {previewRows.map((r, i) => (
                        <tr key={i} className="border-t border-white/5">
                          {headers.map((h) => (
                            <td key={h} className="pr-4 py-1 text-zinc-300 whitespace-nowrap max-w-[180px] overflow-hidden text-ellipsis">
                              {String(r[h] ?? "")}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="mt-2 space-y-3" data-testid="csv-step-preview">
              <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500">
                {generatedLines.length} line{generatedLines.length === 1 ? "" : "s"} ready · target · {CATEGORIES.find((c) => c.id === category)?.label}
              </div>
              <div className="rounded-xl border border-white/5 bg-white/[0.02] overflow-x-auto">
                <table className="w-full text-[11px]">
                  <thead>
                    <tr className="text-left text-zinc-500">
                      {category === "models" && <>
                        <th className="p-2 font-medium">Provider</th>
                        <th className="p-2 font-medium">Model</th>
                        <th className="p-2 font-medium">Usage</th>
                        <th className="p-2 font-medium text-right">Cost/task</th>
                        <th className="p-2 font-medium text-right">Est cost</th>
                      </>}
                      {category === "infra" && <>
                        <th className="p-2 font-medium">Provider</th>
                        <th className="p-2 font-medium">Instance</th>
                        <th className="p-2 font-medium text-right">Count</th>
                        <th className="p-2 font-medium text-right">Monthly</th>
                        <th className="p-2 font-medium text-right">Est cost</th>
                      </>}
                      {category === "subs" && <>
                        <th className="p-2 font-medium">Subscription</th>
                        <th className="p-2 font-medium text-right">Price/seat</th>
                        <th className="p-2 font-medium text-right">Seats</th>
                        <th className="p-2 font-medium text-right">Days</th>
                        <th className="p-2 font-medium text-right">Est cost</th>
                      </>}
                      {category === "general" && <>
                        <th className="p-2 font-medium">Label</th>
                        <th className="p-2 font-medium">Note</th>
                        <th className="p-2 font-medium text-right">Est cost</th>
                      </>}
                    </tr>
                  </thead>
                  <tbody>
                    {generatedLines.slice(0, 30).map((line) => (
                      <tr key={line.id} className="border-t border-white/5 text-zinc-300">
                        {category === "models" && <>
                          <td className="p-2">{line.provider}</td>
                          <td className="p-2">{line._csvLabel || line.modelId}</td>
                          <td className="p-2">{line.usageTag}</td>
                          <td className="p-2 text-right tabular">${line.costPerTask}</td>
                          <td className="p-2 text-right tabular text-fuchsia-300">${line.estCost.toLocaleString()}</td>
                        </>}
                        {category === "infra" && <>
                          <td className="p-2">{line.provider}</td>
                          <td className="p-2">{line._csvLabel || line.instance}</td>
                          <td className="p-2 text-right tabular">{line.instanceCount}</td>
                          <td className="p-2 text-right tabular">${line.monthlyCost.toLocaleString()}</td>
                          <td className="p-2 text-right tabular text-fuchsia-300">${line.estCost.toLocaleString()}</td>
                        </>}
                        {category === "subs" && <>
                          <td className="p-2">{line.subscription}</td>
                          <td className="p-2 text-right tabular">${line.pricePerSeat}</td>
                          <td className="p-2 text-right tabular">{line.seats}</td>
                          <td className="p-2 text-right tabular">{line.days ?? "—"}</td>
                          <td className="p-2 text-right tabular text-fuchsia-300">${line.estCost.toLocaleString()}</td>
                        </>}
                        {category === "general" && <>
                          <td className="p-2">{line.label}</td>
                          <td className="p-2 text-zinc-500">{line.note}</td>
                          <td className="p-2 text-right tabular text-fuchsia-300">${line.estCost.toLocaleString()}</td>
                        </>}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {generatedLines.length > 30 && (
                  <div className="p-2 text-[10px] text-zinc-500 border-t border-white/5">
                    …and {generatedLines.length - 30} more row{generatedLines.length - 30 === 1 ? "" : "s"}
                  </div>
                )}
              </div>
              <div className="rounded-xl border border-fuchsia-500/20 bg-fuchsia-500/[0.06] p-3 text-[11px] text-zinc-300 flex items-start gap-2">
                <Info className="w-3.5 h-3.5 text-fuchsia-300 mt-0.5 flex-shrink-0" />
                <div>
                  These lines will be <strong className="text-fuchsia-200">appended</strong> to the selected budget category.
                  You can edit any value on step 2 (Budget Items) and review totals on step 3 (Preview & Submit) before submitting.
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="mt-2 flex items-center justify-between gap-2">
          <Button
            variant="ghost"
            onClick={() => onOpenChange?.(false)}
            className="h-9 text-zinc-400 hover:text-zinc-100 gap-1"
            data-testid="csv-import-cancel"
          >
            <X className="w-3.5 h-3.5" /> Cancel
          </Button>
          <div className="flex items-center gap-2">
            {step > 1 && (
              <Button
                variant="outline"
                onClick={() => setStep((s) => Math.max(1, s - 1))}
                className="h-9 rounded-lg border-white/10 bg-white/[0.04] text-zinc-200 gap-1.5"
                data-testid="csv-import-back"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Back
              </Button>
            )}
            {step === 2 && (
              <Button
                onClick={() => setStep(3)}
                className="h-9 rounded-lg bg-fuchsia-500 hover:bg-fuchsia-600 text-white gap-1.5"
                data-testid="csv-import-next"
              >
                Preview <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            )}
            {step === 3 && (
              <Button
                onClick={doApply}
                className="h-9 rounded-lg bg-fuchsia-500 hover:bg-fuchsia-600 text-white gap-1.5"
                data-testid="csv-import-apply"
              >
                <CheckCircle2 className="w-3.5 h-3.5" /> Apply {generatedLines.length} line{generatedLines.length === 1 ? "" : "s"}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CsvBudgetImportDialog;
