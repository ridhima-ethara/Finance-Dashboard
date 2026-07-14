import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "./ui/dialog";
import { Button } from "./ui/button";
import { Download, Upload, Copy, CheckCircle2, AlertTriangle, Info } from "lucide-react";
import { useApp } from "../context/AppContext";
import { toast } from "sonner";

// One-liner the user pastes into DevTools console on the OTHER site to dump
// every localStorage key that starts with "ethara.". Copyable so users don't
// need to type it manually.
const DUMP_SNIPPET = `copy(JSON.stringify(Object.fromEntries(Object.keys(localStorage).filter(k => k.startsWith('ethara.')).map(k => [k, localStorage.getItem(k)])), null, 2)); console.log('%c✓ Ethara backup copied to clipboard', 'color: #E619B8')`;

export const BackupDialog = ({ open, onOpenChange }) => {
  const { importWorkspaceRaw, exportWorkspaceSnapshot } = useApp();
  const [pastedText, setPastedText] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [importResult, setImportResult] = useState(null);

  const copySnippet = async () => {
    try {
      await navigator.clipboard.writeText(DUMP_SNIPPET);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success("Copied — paste it in DevTools console on the other site");
    } catch {
      toast.error("Could not copy — please copy the snippet manually");
    }
  };

  const handleImport = async () => {
    if (!pastedText.trim()) {
      toast.error("Paste the JSON backup first");
      return;
    }
    setBusy(true);
    setImportResult(null);
    try {
      let parsed;
      try {
        parsed = JSON.parse(pastedText);
      } catch (parseErr) {
        throw new Error("Invalid JSON. Make sure you pasted the full JSON output.");
      }
      const res = await importWorkspaceRaw(parsed);
      setImportResult(res);
      toast.success(`Imported ${res.count} workspace slice${res.count === 1 ? "" : "s"}`, {
        description: res.imported.join(", "),
      });
    } catch (err) {
      toast.error("Import failed", { description: err.message || String(err) });
    } finally {
      setBusy(false);
    }
  };

  const handleExport = () => {
    try {
      const snapshot = exportWorkspaceSnapshot();
      const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const ts = new Date().toISOString().replace(/[:.]/g, "-");
      const a = document.createElement("a");
      a.href = url;
      a.download = `ethara-workspace-${ts}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("Backup downloaded");
    } catch (err) {
      toast.error("Export failed", { description: err.message || String(err) });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-testid="backup-dialog"
        className="max-w-2xl bg-[#0F0F17] border border-white/10 text-zinc-100 p-0 overflow-hidden max-h-[92vh] overflow-y-auto"
      >
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-white/5">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] font-semibold text-fuchsia-400">
            <span className="w-6 h-px bg-fuchsia-400" />
            Backup &amp; Recover
          </div>
          <DialogTitle className="mt-2 text-xl font-display font-semibold text-white tracking-tight">
            Import workspace data from another browser
          </DialogTitle>
          <DialogDescription className="text-xs text-zinc-400">
            Use this to recover data you entered on the older build (before backend sync was added), or to migrate between environments.
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 py-5 space-y-5">
          {/* Step 1 — dump from the other browser */}
          <section className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
            <div className="flex items-start gap-2 mb-3">
              <div className="w-6 h-6 rounded-md bg-fuchsia-500/15 border border-fuchsia-500/40 flex items-center justify-center text-[11px] font-semibold text-fuchsia-300 tabular flex-shrink-0">
                1
              </div>
              <div>
                <div className="text-sm font-semibold text-white">Grab your data from the OTHER site</div>
                <div className="text-xs text-zinc-400 mt-0.5">
                  Open the site where you originally entered the data (e.g. the deployed URL). Press <kbd className="px-1 py-0.5 rounded bg-white/10 text-[10px]">F12</kbd> to open DevTools → go to the <b>Console</b> tab → paste the snippet below and press Enter. Your data is copied to the clipboard.
                </div>
              </div>
            </div>
            <div className="rounded-lg border border-white/10 bg-black/40 p-3 text-[11px] font-mono text-zinc-300 whitespace-pre-wrap break-all">
              {DUMP_SNIPPET}
            </div>
            <div className="mt-3 flex items-center gap-2">
              <Button
                onClick={copySnippet}
                data-testid="backup-copy-snippet"
                variant="outline"
                className="h-8 rounded-md border-fuchsia-500/40 bg-fuchsia-500/[0.06] hover:bg-fuchsia-500/[0.12] text-fuchsia-200 gap-2"
              >
                {copied ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? "Copied" : "Copy snippet"}
              </Button>
              <span className="text-[11px] text-zinc-500 flex items-center gap-1">
                <Info className="w-3 h-3" />
                If the snippet finds nothing, the localStorage on that site is empty.
              </span>
            </div>
          </section>

          {/* Step 2 — paste + import */}
          <section className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
            <div className="flex items-start gap-2 mb-3">
              <div className="w-6 h-6 rounded-md bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center text-[11px] font-semibold text-emerald-300 tabular flex-shrink-0">
                2
              </div>
              <div>
                <div className="text-sm font-semibold text-white">Paste it here &amp; import</div>
                <div className="text-xs text-zinc-400 mt-0.5">
                  Come back to this tab, paste the JSON below, and click <b>Import to backend</b>. Data will merge with what is already here and sync to the server immediately.
                </div>
              </div>
            </div>
            <textarea
              value={pastedText}
              onChange={(e) => setPastedText(e.target.value)}
              placeholder='{"ethara.customProjects.v3":"[...]","ethara.taskLogs.v3":"{...}",...}'
              spellCheck={false}
              rows={8}
              data-testid="backup-paste-textarea"
              className="w-full rounded-lg border border-white/10 bg-black/40 p-3 text-[11px] font-mono text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40 resize-y"
            />
            <div className="mt-3 flex items-center gap-2 flex-wrap">
              <Button
                onClick={handleImport}
                disabled={busy || !pastedText.trim()}
                data-testid="backup-import-button"
                className="h-9 rounded-lg bg-fuchsia-500 hover:bg-fuchsia-600 text-white gap-2 disabled:opacity-50"
              >
                <Upload className="w-3.5 h-3.5" />
                {busy ? "Importing…" : "Import to backend"}
              </Button>
              <Button
                onClick={() => { setPastedText(""); setImportResult(null); }}
                variant="outline"
                className="h-9 rounded-lg border-white/10 bg-white/[0.04] hover:bg-white/[0.08] text-zinc-200"
              >
                Clear
              </Button>
            </div>
            {importResult && (
              <div
                data-testid="backup-import-result"
                className="mt-3 flex items-start gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/[0.06] p-3 text-[11px] text-emerald-200"
              >
                <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold">Imported {importResult.count} slice{importResult.count === 1 ? "" : "s"}</div>
                  <div className="text-emerald-300/80 mt-0.5">{importResult.imported.join(", ")}</div>
                </div>
              </div>
            )}
          </section>

          {/* Extra — export */}
          <section className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <div className="text-sm font-semibold text-white">Download a backup of the current workspace</div>
                <div className="text-xs text-zinc-400 mt-0.5">
                  Saves everything currently in the app as a JSON file. Handy before big changes or for offline copies.
                </div>
              </div>
              <Button
                onClick={handleExport}
                data-testid="backup-export-button"
                variant="outline"
                className="h-9 rounded-lg border-white/10 bg-white/[0.04] hover:bg-white/[0.08] text-zinc-200 gap-2"
              >
                <Download className="w-3.5 h-3.5" />
                Download JSON
              </Button>
            </div>
          </section>

          {/* Note */}
          <div className="flex items-start gap-2 text-[11px] text-amber-300/90 rounded-lg border border-amber-500/25 bg-amber-500/[0.05] p-3">
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            <div>
              Import <b>merges</b> incoming keys with the current workspace (never wipes the whole thing).
              If a slice key exists in the imported JSON, it overwrites the current value for that slice.
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default BackupDialog;
