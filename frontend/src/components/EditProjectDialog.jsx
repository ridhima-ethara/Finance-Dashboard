import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./ui/dialog";
import { Button } from "./ui/button";
import { Pencil, Save, X } from "lucide-react";
import { toast } from "sonner";
import { useApp } from "../context/AppContext";

const inputCls = "w-full h-10 px-3 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40";

const EditProjectDialog = ({ open, onOpenChange, project }) => {
  const { role, updateProjectDetails } = useApp();
  const isCFO = role === "CFO";

  const [name, setName] = useState("");
  const [goal, setGoal] = useState("");
  const [startDate, setStartDate] = useState("");
  const [estimatedEndDate, setEstimatedEndDate] = useState("");
  const [client, setClient] = useState("");

  useEffect(() => {
    if (!open || !project) return;
    setName(project.name || "");
    setGoal(project.goal || "");
    setStartDate(project.startDate || "");
    setEstimatedEndDate(project.estimatedEndDate || "");
    setClient(project.client || project.clientProjectName || "");
  }, [open, project]);

  const submit = () => {
    if (!name.trim()) return toast.error("Project name is required");
    const updates = {
      name: name.trim(),
      goal,
      startDate,
      estimatedEndDate,
    };
    if (isCFO) updates.client = client;
    updateProjectDetails(project.id, updates);
    toast.success("Project details updated", { description: name.trim() });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px] max-h-[92vh] overflow-y-auto bg-[#12121A] border border-white/10 text-zinc-100" data-testid="edit-project-dialog">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-fuchsia-500/15 flex items-center justify-center border border-fuchsia-500/30">
              <Pencil className="w-4 h-4 text-fuchsia-300" />
            </div>
            <div>
              <DialogTitle className="font-display text-lg text-white">Edit project details</DialogTitle>
              <DialogDescription className="text-xs text-zinc-400">Update the project information{isCFO ? " · client project name is editable by CFO only" : ""}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <Field label="Project name">
            <input value={name} onChange={(e) => setName(e.target.value)} data-testid="edit-project-name" className={inputCls} placeholder="Internal project name" />
          </Field>

          {isCFO && (
            <Field label="Client project name" hint="Visible to CFO only">
              <input value={client} onChange={(e) => setClient(e.target.value)} data-testid="edit-project-client" className={inputCls} placeholder="How the client refers to it" />
            </Field>
          )}

          <Field label="Goal">
            <textarea
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              rows={3}
              data-testid="edit-project-goal"
              className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40 resize-none"
              placeholder="Project goal / objective"
            />
          </Field>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="Start date">
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} data-testid="edit-project-start" className={inputCls + " tabular"} />
            </Field>
            <Field label="Estimated end date">
              <input type="date" value={estimatedEndDate} onChange={(e) => setEstimatedEndDate(e.target.value)} data-testid="edit-project-end" className={inputCls + " tabular"} />
            </Field>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="border-white/10 bg-white/[0.04] text-zinc-300 hover:bg-white/[0.08]" data-testid="edit-project-cancel">
            <X className="w-3.5 h-3.5 mr-1" /> Cancel
          </Button>
          <Button onClick={submit} className="bg-fuchsia-500 hover:bg-fuchsia-600 text-white gap-1.5" data-testid="edit-project-save">
            <Save className="w-3.5 h-3.5" /> Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const Field = ({ label, hint, children }) => (
  <div>
    <div className="flex items-baseline justify-between mb-1.5">
      <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500">{label}</div>
      {hint && <div className="text-[10px] text-zinc-600">{hint}</div>}
    </div>
    {children}
  </div>
);

export default EditProjectDialog;
