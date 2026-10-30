"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Siren, ShieldCheck, RefreshCw, CheckCircle2, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { useLang } from "@/lib/i18n";
import { EVENT_CATEGORIES } from "@/lib/domain";
import { Badge, Button, Card, Empty, Field, Modal, PageHeader, Spinner, fmtDateTime } from "@/components/ui";

export default function EventsSection() {
  const { t } = useLang();
  const [events, setEvents] = useState<any[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);
  const [biz, setBiz] = useState<any>(null);
  const [cat, setCat] = useState("");
  const [verFilter, setVerFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [me, setMe] = useState<any>(null);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      api(`events?category=${cat}&verified=${verFilter}`),
      api("jobs"),
      api("business"),
      api("auth"),
    ])
      .then(([e, j, b, m]) => {
        setEvents(e.events);
        setJobs(j.jobs);
        setBiz(b.business);
        setMe(m.user);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [cat, verFilter]);

  useEffect(load, [load]);

  const canVerify = me && ["owner", "manager", "supervisor"].includes(me.role);

  const verify = async (id: string) => {
    try {
      await api(`events/${id}`, { method: "PATCH", body: { verified: true } });
      load();
    } catch (e) {
      alert((e as Error).message);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this event permanently?")) return;
    try {
      await api(`events/${id}`, { method: "DELETE" });
      load();
    } catch (e) {
      alert((e as Error).message);
    }
  };
  const canDelete = me && ["owner", "manager", "supervisor"].includes(me.role);

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("nav.events")}
        desc="Fast operational reporting: machine breakdowns, shortages, power cuts, delays, quality issues. Supervisors verify events so insights stay reliable."
        actions={
          <>
            <button className="btn-ghost btn-sm" onClick={load}><RefreshCw size={14} /> {t("common.refresh")}</button>
            <button className="btn-teal btn-sm" onClick={() => setShowForm(true)}><Plus size={15} /> {t("events.report")}</button>
          </>
        }
      />

      <div className="flex flex-wrap gap-2">
        <select className="input !w-auto !py-1.5 !text-[13px]" value={cat} onChange={(e) => setCat(e.target.value)}>
          <option value="">All categories</option>
          {EVENT_CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
        <select className="input !w-auto !py-1.5 !text-[13px]" value={verFilter} onChange={(e) => setVerFilter(e.target.value)}>
          <option value="">All</option>
          <option value="false">Unverified only</option>
        </select>
      </div>

      <Card pad={false}>
        {loading ? <Spinner /> : events.length === 0 ? (
          <Empty icon={Siren} title="No events match" text="Report the first operational event — it takes less than a minute." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="th">{t("events.category")}</th><th className="th">Job</th><th className="th">Stage</th>
                  <th className="th">{t("events.duration")}</th><th className="th">{t("events.qty")}</th>
                  <th className="th">{t("events.note")}</th><th className="th">Reporter</th><th className="th">Reported</th><th className="th">{t("common.status")}</th>
                </tr>
              </thead>
              <tbody>
                {events.map((e) => (
                  <tr key={e.id} className="hover:bg-slate-50/60">
                    <td className="td font-semibold text-navy whitespace-nowrap">{t(`worker.cat.${e.category}`)}</td>
                    <td className="td font-mono text-xs font-bold">{e.jobCode ?? "—"}</td>
                    <td className="td">{e.stage ?? "—"}</td>
                    <td className="td">{e.durationMinutes ? `${e.durationMinutes} min` : "—"}</td>
                    <td className="td">{e.qtyAffected ?? "—"}</td>
                    <td className="td max-w-56"><span className="line-clamp-2">{e.description ?? "—"}</span></td>
                    <td className="td whitespace-nowrap">{e.reporterName ?? "—"}</td>
                    <td className="td whitespace-nowrap text-xs text-slate-400">{fmtDateTime(e.createdAt)}</td>
                    <td className="td">
                      {e.verified ? (
                        <Badge tone="green"><CheckCircle2 size={11} /> {t("events.verified")}</Badge>
                      ) : canVerify ? (
                        <Button size="sm" variant="ghost" onClick={() => verify(e.id)}><ShieldCheck size={13} /> {t("events.verify")}</Button>
                      ) : (
                        <Badge tone="amber">{t("events.unverified")}</Badge>
                      )}
                    </td>
                    <td className="td">{canDelete && <button className="btn-ghost btn-sm !text-red-600 hover:!bg-red-50" onClick={() => remove(e.id)}><Trash2 size={14} /></button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {showForm && <EventForm jobs={jobs} biz={biz} onClose={() => setShowForm(false)} onDone={() => { setShowForm(false); load(); }} />}
    </div>
  );
}

function EventForm({ jobs, biz, onClose, onDone }: any) {
  const { t } = useLang();
  const [category, setCategory] = useState("machine_breakdown");
  const [jobCode, setJobCode] = useState("");
  const [stage, setStage] = useState(biz?.stages?.[0] ?? "");
  const [startTime, setStartTime] = useState(new Date(Date.now() - 3600000).toISOString().slice(0, 16));
  const [endTime, setEndTime] = useState("");
  const [duration, setDuration] = useState("");
  const [qty, setQty] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const submit = async () => {
    setBusy(true);
    setErr("");
    try {
      await api("events", {
        method: "POST",
        body: {
          category,
          jobCode: jobCode || undefined,
          stage: stage || undefined,
          startTime,
          endTime: endTime || undefined,
          durationMinutes: duration ? Number(duration) : undefined,
          qtyAffected: qty ? Number(qty) : undefined,
          description,
        },
      });
      onDone();
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="Report an operational event">
      {err && <div className="mb-3 rounded-xl bg-red-50 px-3 py-2 text-xs font-medium text-red-700">{err}</div>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("events.category")} className="sm:col-span-2">
          <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
            {EVENT_CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </Field>
        <Field label="Job / batch (optional)">
          <select className="input" value={jobCode} onChange={(e) => setJobCode(e.target.value)}>
            <option value="">— no job —</option>
            {jobs.map((j: any) => <option key={j.id} value={j.code}>{j.code} — {j.title}</option>)}
          </select>
        </Field>
        <Field label="Production stage">
          <select className="input" value={stage} onChange={(e) => setStage(e.target.value)}>
            <option value="">— none —</option>
            {(biz?.stages ?? []).map((s: string) => <option key={s}>{s}</option>)}
          </select>
        </Field>
        <Field label="Start time">
          <input className="input" type="datetime-local" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
        </Field>
        <Field label="End time (optional)">
          <input className="input" type="datetime-local" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
        </Field>
        <Field label={t("events.duration")}>
          <input className="input" type="number" min={0} value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="auto from times if empty" />
        </Field>
        <Field label={t("events.qty")}>
          <input className="input" type="number" min={0} value={qty} onChange={(e) => setQty(e.target.value)} />
        </Field>
        <Field label={t("events.note")} className="sm:col-span-2">
          <textarea className="input min-h-20" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Short description — what happened, which machine/material…" />
        </Field>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="teal" disabled={busy} onClick={submit}>{busy ? "Saving…" : "Submit event"}</Button>
      </div>
    </Modal>
  );
}
