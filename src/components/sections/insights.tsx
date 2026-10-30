"use client";

import { useCallback, useEffect, useState } from "react";
import { Lightbulb, RefreshCw, Plus, Database, AlertTriangle, ChevronDown, ChevronUp, CheckCircle2 } from "lucide-react";
import { api } from "@/lib/api";
import { useLang } from "@/lib/i18n";
import { Badge, Button, Card, Empty, Modal, PageHeader, Progress, Spinner, reliabilityTone, statusTone, Field } from "@/components/ui";

export default function InsightsSection() {
  const { t, lang } = useLang();
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [actionFor, setActionFor] = useState<any>(null);
  const [toast, setToast] = useState("");

  const load = useCallback(() => {
    setError("");
    api(`insights?lang=${lang}`).then(setData).catch((e) => setError((e as Error).message));
  }, [lang]);
  useEffect(load, [load]);

  const createAction = async (insight: any, form: any) => {
    try {
      await api("actions", {
        method: "POST",
        body: {
          title: form.title,
          description: form.description,
          problemRef: `${insight.title} — ${insight.frequency} (${insight.id})`,
          insightId: insight.id,
          assignedTo: form.assignedTo || undefined,
          priority: form.priority,
          deadline: form.deadline || undefined,
        },
      });
      setActionFor(null);
      setToast(`Corrective action created for “${insight.title}”. See it in the Action Tracker.`);
      setTimeout(() => setToast(""), 5000);
    } catch (e) {
      alert((e as Error).message);
    }
  };

  if (!data) return error ? <Empty title={error} /> : <Spinner />;
  const { insights, completeness, period } = data;

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("nav.insights")}
        desc="Explainable patterns from your jobs, verified events and quality records. Facts and possible causes are always separated; nothing is claimed without records."
        actions={<button className="btn-ghost btn-sm" onClick={load}><RefreshCw size={14} /> {t("common.refresh")}</button>}
      />

      {toast && <div className="rounded-xl bg-green-50 px-4 py-3 text-sm font-semibold text-green-700 flex items-center gap-2"><CheckCircle2 size={16} /> {toast}</div>}

      <Card>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Database size={18} className="text-teal-dark" />
            <div>
              <p className="text-sm font-bold text-navy">{t("dash.completeness")}: {completeness.score}/100 — {completeness.label}</p>
              <p className="text-xs text-slate-500">Analysed period: {period} • {completeness.counts.jobs} jobs, {completeness.counts.events} events ({completeness.counts.verifiedEvents} verified), {completeness.counts.quality} inspections</p>
            </div>
          </div>
          <div className="ml-auto w-full sm:w-64"><Progress value={completeness.score} /></div>
        </div>
        {completeness.warnings.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {completeness.warnings.map((w: string) => <Badge key={w} tone="amber"><AlertTriangle size={11} /> {w}</Badge>)}
          </div>
        )}
      </Card>

      {insights.length === 0 ? (
        <Empty
          icon={Lightbulb}
          title="Not enough records to detect patterns yet"
          text="Record at least ~10 jobs and 15 verified events. Meanwhile, keep using Production & Jobs, Event Centre and Quality & Rework."
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {insights.map((i: any) => (
            <Card key={i.id} className="flex flex-col">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={statusTone(i.severity)}>{i.severity}</Badge>
                <h3 className="text-[15px] font-bold text-navy">{i.title}</h3>
                <span className="ml-auto"><Badge tone={reliabilityTone(i.reliability)}>{t("common.reliability")}: {i.reliability}</Badge></span>
              </div>
              <div className="mt-3 space-y-2.5 text-[13px] leading-relaxed">
                <p><span className="font-bold text-slate-500">Observed: </span><span className="text-slate-700">{i.observation}</span></p>
                <p className="rounded-lg bg-slate-50 px-3 py-2 text-slate-500"><span className="font-bold">Possible explanation (unverified): </span>{i.possibleExplanation}</p>
                <div className="grid gap-1.5 sm:grid-cols-3 text-[11.5px]">
                  <div className="rounded-lg bg-cream px-2.5 py-2"><p className="font-bold uppercase text-[9.5px] text-slate-400">{t("common.period")}</p><p className="text-slate-600">{i.period}</p></div>
                  <div className="rounded-lg bg-cream px-2.5 py-2"><p className="font-bold uppercase text-[9.5px] text-slate-400">{t("common.frequency")}</p><p className="text-slate-600">{i.frequency}</p></div>
                  <div className="rounded-lg bg-cream px-2.5 py-2"><p className="font-bold uppercase text-[9.5px] text-slate-400">{t("common.recordsUsed")}</p><p className="text-slate-600">{i.recordsUsed} records</p></div>
                </div>
                <button className="flex items-center gap-1 text-[11.5px] font-bold text-teal-dark hover:underline" onClick={() => setOpenId(openId === i.id ? null : i.id)}>
                  {openId === i.id ? <ChevronUp size={13} /> : <ChevronDown size={13} />} {t("common.evidence")} ({i.evidence.length})
                </button>
                {openId === i.id && (
                  <ul className="max-h-32 space-y-1 overflow-y-auto rounded-lg border border-slate-100 bg-white p-2 text-[11.5px] text-slate-500">
                    {i.evidence.map((e: string, k: number) => <li key={k}>• {e}</li>)}
                  </ul>
                )}
                <p className="rounded-lg bg-teal-light/60 px-3 py-2 text-teal-dark"><span className="font-bold">{t("common.suggestedAction")}: </span>{i.suggestedAction}</p>
                <p className="text-[11px] italic text-slate-400">{i.reliabilityNote}</p>
              </div>
              <div className="mt-4 flex justify-end border-t border-slate-100 pt-3">
                <Button size="sm" variant="primary" onClick={() => setActionFor(i)}><Plus size={14} /> Create corrective action</Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {actionFor && <ActionModal insight={actionFor} onClose={() => setActionFor(null)} onCreate={createAction} />}
    </div>
  );
}

function ActionModal({ insight, onClose, onCreate }: any) {
  const { t } = useLang();
  const [team, setTeam] = useState<any[]>([]);
  const [title, setTitle] = useState(insight.suggestedAction.slice(0, 90));
  const [description, setDescription] = useState(insight.suggestedAction);
  const [assignedTo, setAssignedTo] = useState("");
  const [priority, setPriority] = useState("medium");
  const [deadline, setDeadline] = useState(new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    api("team").then((d) => setTeam(d.members)).catch(() => {});
  }, []);
  return (
    <Modal open onClose={onClose} title="Create corrective action">
      <p className="mb-3 rounded-lg bg-cream px-3 py-2 text-xs text-slate-500">
        Problem reference: <span className="font-bold text-navy">{insight.title}</span> — {insight.frequency}
      </p>
      <div className="space-y-3.5">
        <Field label="Action title">
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <Field label="Description / steps">
          <textarea className="input min-h-20" value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Assign to">
            <select className="input" value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)}>
              <option value="">— unassigned —</option>
              {team.map((m: any) => <option key={m.id} value={m.id}>{m.name} ({m.role})</option>)}
            </select>
          </Field>
          <Field label={t("actions.priority")}>
            <select className="input" value={priority} onChange={(e) => setPriority(e.target.value)}>
              <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
            </select>
          </Field>
          <Field label={t("actions.deadline")}>
            <input className="input" type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
          </Field>
        </div>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button
          variant="teal"
          disabled={busy || !title.trim()}
          onClick={async () => {
            setBusy(true);
            await onCreate(insight, { title, description, assignedTo, priority, deadline });
            setBusy(false);
          }}
        >
          {busy ? "Creating…" : "Create action"}
        </Button>
      </div>
    </Modal>
  );
}

