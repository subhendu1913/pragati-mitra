"use client";

import { useCallback, useEffect, useState } from "react";
import { ListChecks, RefreshCw, Plus, CheckCircle2, Clock, TrendingDown, AlertTriangle, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { useLang } from "@/lib/i18n";
import { Badge, Button, Card, Empty, Field, Modal, PageHeader, Spinner, fmtDate, statusTone } from "@/components/ui";

export default function ActionsSection() {
  const { t } = useLang();
  const [actions, setActions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [completeFor, setCompleteFor] = useState<any>(null);
  const [me, setMe] = useState<any>(null);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([api("actions"), api("auth")])
      .then(([d, a]) => { setActions(d.actions); setMe(a.user); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const canManage = me && ["owner", "manager"].includes(me.role);
  const remove = async (id: string) => {
    if (!confirm("Delete this corrective action?")) return;
    try {
      await api(`actions/${id}`, { method: "DELETE" });
      load();
    } catch (e) {
      alert((e as Error).message);
    }
  };
  useEffect(load, [load]);

  const setStatus = async (id: string, status: string) => {
    try {
      await api(`actions/${id}`, { method: "PATCH", body: { status } });
      load();
    } catch (e) {
      alert((e as Error).message);
    }
  };

  const cols = [
    { id: "pending", label: "Pending", tone: "amber" },
    { id: "in_progress", label: "In Progress", tone: "teal" },
    { id: "completed", label: "Completed", tone: "green" },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("nav.actions")}
        desc="Turn recurring problems into corrective actions: Record → Analyse → Verify → Assign → Measure improvement. We never claim an action caused improvement without evidence."
        actions={
          <>
            <button className="btn-ghost btn-sm" onClick={load}><RefreshCw size={14} /> {t("common.refresh")}</button>
            <button className="btn-teal btn-sm" onClick={() => setShowForm(true)}><Plus size={15} /> {t("actions.new")}</button>
          </>
        }
      />

      {loading ? <Spinner /> : actions.length === 0 ? (
        <Empty icon={ListChecks} title="No corrective actions yet" text="Create one from Smart Insights or Pragati AI when a recurring problem appears." />
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          {cols.map((c) => (
            <Card key={c.id} title={<span className="flex items-center gap-2"><Badge tone={c.tone as never}>{c.label}</Badge><span className="text-xs text-slate-400">{actions.filter((a) => a.status === c.id).length}</span></span>} className="!bg-cream/50">
              <div className="space-y-3">
                {actions.filter((a) => a.status === c.id).map((a) => (
                  <div key={a.id} className="card !rounded-xl p-3.5">
                    <div className="flex items-start gap-2">
                      <Badge tone={statusTone(a.priority)}>{a.priority}</Badge>
                      <p className="flex-1 text-[13px] font-bold leading-snug text-navy">{a.title}</p>
                      {canManage && (
                        <button className="btn-ghost btn-sm !px-1.5 !text-red-600 hover:!bg-red-50" title="Delete action" onClick={() => remove(a.id)}>
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                    {a.description && <p className="mt-1.5 text-xs leading-relaxed text-slate-500">{a.description}</p>}
                    {a.problemRef && <p className="mt-1.5 rounded-md bg-slate-50 px-2 py-1 text-[10.5px] text-slate-400">Problem: {a.problemRef}</p>}
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-400">
                      <span>👤 {a.assigneeName ?? "Unassigned"}</span>
                      {a.deadline && <span className="flex items-center gap-1"><Clock size={11} /> {fmtDate(a.deadline)}</span>}
                    </div>
                    {a.status === "completed" && a.improvement && (
                      <div className="mt-2 rounded-lg bg-teal-light/50 px-2.5 py-2 text-[11px] text-teal-dark">
                        <span className="flex items-center gap-1 font-bold"><TrendingDown size={12} /> {t("actions.improvement")}</span>
                        {a.improvement.category.replace(/_/g, " ")}: {a.improvement.before} events in 30 days before → {a.improvement.after} after. {a.improvement.note}
                      </div>
                    )}
                    {a.status === "completed" && a.verification && <p className="mt-1.5 text-[10.5px] italic text-slate-400">Verification: {a.verification}</p>}
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      {a.status === "pending" && <Button size="sm" variant="ghost" onClick={() => setStatus(a.id, "in_progress")}>Start</Button>}
                      {a.status === "in_progress" && <Button size="sm" variant="teal" onClick={() => setCompleteFor(a)}><CheckCircle2 size={13} /> {t("actions.complete")}</Button>}
                      {a.status === "pending" && <Button size="sm" variant="ghost" onClick={() => setCompleteFor(a)}>Complete</Button>}
                    </div>
                  </div>
                ))}
                {actions.filter((a) => a.status === c.id).length === 0 && <p className="py-4 text-center text-xs text-slate-400">—</p>}
              </div>
            </Card>
          ))}
        </div>
      )}

      {showForm && <NewActionModal onClose={() => setShowForm(false)} onDone={() => { setShowForm(false); load(); }} />}
      {completeFor && (
        <CompleteModal
          action={completeFor}
          onClose={() => setCompleteFor(null)}
          onDone={() => { setCompleteFor(null); load(); }}
        />
      )}
    </div>
  );
}

function NewActionModal({ onClose, onDone }: any) {
  const [team, setTeam] = useState<any[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [problemRef, setProblemRef] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [priority, setPriority] = useState("medium");
  const [deadline, setDeadline] = useState(new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  useEffect(() => {
    api("team").then((d) => setTeam(d.members)).catch(() => {});
  }, []);
  const submit = async () => {
    setBusy(true);
    setErr("");
    try {
      await api("actions", { method: "POST", body: { title, description, problemRef, assignedTo: assignedTo || undefined, priority, deadline } });
      onDone();
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  };
  return (
    <Modal open onClose={onClose} title="New corrective action">
      {err && <div className="mb-3 rounded-xl bg-red-50 px-3 py-2 text-xs font-medium text-red-700">{err}</div>}
      <div className="space-y-3.5">
        <Field label="Action title"><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Inspect cutting machine & review maintenance schedule" /></Field>
        <Field label="Description / steps"><textarea className="input min-h-20" value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
        <Field label="Problem reference (which recurring problem?)"><input className="input" value={problemRef} onChange={(e) => setProblemRef(e.target.value)} placeholder="e.g. Machine downtime in 5 of last 12 jobs (ins-machine_breakdown)" /></Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Assign to">
            <select className="input" value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)}>
              <option value="">— unassigned —</option>
              {team.map((m: any) => <option key={m.id} value={m.id}>{m.name} ({m.role})</option>)}
            </select>
          </Field>
          <Field label="Priority">
            <select className="input" value={priority} onChange={(e) => setPriority(e.target.value)}>
              <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
            </select>
          </Field>
          <Field label="Deadline"><input className="input" type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} /></Field>
        </div>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="teal" disabled={busy || !title.trim()} onClick={submit}>{busy ? "Creating…" : "Create action"}</Button>
      </div>
    </Modal>
  );
}

function CompleteModal({ action, onClose, onDone }: any) {
  const [notes, setNotes] = useState("");
  const [verification, setVerification] = useState("Pending review");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    try {
      await api(`actions/${action.id}`, { method: "PATCH", body: { status: "completed", completionNotes: notes, verification } });
      onDone();
    } catch (e) {
      alert((e as Error).message);
      setBusy(false);
    }
  };
  return (
    <Modal open onClose={onClose} title={`Complete: ${action.title}`}>
      <div className="space-y-3.5">
        <Field label="Completion notes"><textarea className="input min-h-20" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="What was done?" /></Field>
        <Field label="Verification result">
          <select className="input" value={verification} onChange={(e) => setVerification(e.target.value)}>
            <option>Pending review — compare problem frequency in upcoming jobs</option>
            <option>Verified effective — frequency reduced in subsequent jobs</option>
            <option>Not effective — problem continued</option>
          </select>
        </Field>
        <p className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-[11.5px] text-amber-700"><AlertTriangle size={13} className="mt-0.5 shrink-0" /> We only claim improvement when the event frequency actually drops in later records — the improvement history is computed automatically below each completed action.</p>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="teal" disabled={busy} onClick={submit}>{busy ? "Saving…" : "Mark completed"}</Button>
      </div>
    </Modal>
  );
}
