"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, BadgeCheck, RefreshCw, PlusCircle, Trash2 } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api } from "@/lib/api";
import { useLang } from "@/lib/i18n";
import { Badge, Button, Card, Empty, Field, Modal, PageHeader, Spinner, Stat, fmtDate, statusTone } from "@/components/ui";

const NAVY = "#17365D";

export default function QualitySection() {
  const { t } = useLang();
  const [records, setRecords] = useState<any[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);
  const [defects, setDefects] = useState<any[]>([]);
  const [defaults, setDefaults] = useState<string[]>([]);
  const [biz, setBiz] = useState<any>(null);
  const [me, setMe] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [newDefect, setNewDefect] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([api("quality"), api("jobs"), api("defects"), api("business"), api("auth")])
      .then(([q, j, d, b, a]) => {
        setRecords(q.records);
        setJobs(j.jobs);
        setDefects(d.defects);
        setDefaults(d.industryDefaults);
        setBiz(b.business);
        setMe(a.user);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);
  useEffect(load, [load]);

  const canDelete = me && ["owner", "manager", "quality"].includes(me.role);
  const remove = async (id: string) => {
    if (!confirm("Delete this inspection record?")) return;
    try {
      await api(`quality/${id}`, { method: "DELETE" });
      load();
    } catch (e) {
      alert((e as Error).message);
    }
  };

  const addDefect = async () => {
    if (!newDefect.trim()) return;
    try {
      await api("defects", { method: "POST", body: { name: newDefect.trim() } });
      setNewDefect("");
      load();
    } catch (e) {
      alert((e as Error).message);
    }
  };

  const inspected = records.reduce((s, r) => s + (r.inspected ?? 0), 0);
  const rejected = records.reduce((s, r) => s + (r.rejected ?? 0), 0);
  const rework = records.reduce((s, r) => s + (r.rework ?? 0), 0);
  const byDefect = new Map<string, number>();
  for (const r of records) byDefect.set(r.defectCategory ?? "Uncategorised", (byDefect.get(r.defectCategory ?? "Uncategorised") ?? 0) + (r.rejected ?? 0));
  const chartData = [...byDefect.entries()].map(([name, rejected]) => ({ name, rejected })).sort((a, b) => b.rejected - a.rejected);

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("nav.quality")}
        desc="Industry-independent quality records: inspected / accepted / rejected / rework, defect category, related job and stage."
        actions={
          <>
            <button className="btn-ghost btn-sm" onClick={load}><RefreshCw size={14} /> {t("common.refresh")}</button>
            <button className="btn-teal btn-sm" onClick={() => setShowForm(true)}><Plus size={15} /> {t("quality.record")}</button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Inspected" value={inspected} icon={BadgeCheck} tone="navy" />
        <Stat label="Accepted" value={inspected - rejected} icon={BadgeCheck} tone="teal" />
        <Stat label={t("quality.reject")} value={rejected} icon={BadgeCheck} tone="red" hint={inspected ? `${((rejected / inspected) * 100).toFixed(1)}% reject rate` : ""} />
        <Stat label={t("quality.rework")} value={rework} icon={BadgeCheck} tone="amber" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Rejected by defect category" className="lg:col-span-2">
          {chartData.length === 0 ? <Empty icon={BadgeCheck} title="No defects recorded yet" /> : (
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 10.5, fill: "#475569" }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #E2E8F0", fontSize: 12 }} />
                  <Bar dataKey="rejected" fill={NAVY} radius={[0, 6, 6, 0]} name="Rejected qty" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
        <Card title={t("quality.defect")} subtitle="Customise for your industry">
          <div className="flex flex-wrap gap-1.5">
            {defects.map((d) => <Badge key={d.id} tone="navy">{d.name}</Badge>)}
            {defects.length === 0 && defaults.map((d) => <Badge key={d} tone="grey">{d}</Badge>)}
          </div>
          <div className="mt-3 flex gap-2">
            <input className="input !py-1.5 !text-xs" placeholder="New defect category…" value={newDefect} onChange={(e) => setNewDefect(e.target.value)} />
            <Button size="sm" variant="ghost" onClick={addDefect}><PlusCircle size={14} /> {t("common.add")}</Button>
          </div>
        </Card>
      </div>

      <Card pad={false} title="Quality history">
        {loading ? <Spinner /> : records.length === 0 ? (
          <Empty icon={BadgeCheck} title="No inspections recorded" text="Record the first inspection — it feeds Smart Insights and reports." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr><th className="th">Date</th><th className="th">Job</th><th className="th">Stage</th><th className="th">Inspected</th><th className="th">Accepted</th><th className="th">{t("quality.reject")}</th><th className="th">{t("quality.rework")}</th><th className="th">{t("quality.defect")}</th><th className="th">Notes</th><th className="th"></th></tr></thead>
              <tbody>
                {records.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/60">
                    <td className="td text-xs text-slate-400 whitespace-nowrap">{fmtDate(r.createdAt)}</td>
                    <td className="td font-mono text-xs font-bold">{r.jobCode ?? "—"}</td>
                    <td className="td">{r.stage ?? "—"}</td>
                    <td className="td">{r.inspected ?? 0}</td>
                    <td className="td text-teal-dark font-bold">{r.accepted ?? 0}</td>
                    <td className="td"><Badge tone={(r.rejected ?? 0) > 0 ? "red" : "green"}>{r.rejected ?? 0}</Badge></td>
                    <td className="td"><Badge tone={(r.rework ?? 0) > 0 ? "amber" : "grey"}>{r.rework ?? 0}</Badge></td>
                    <td className="td font-semibold text-navy">{r.defectCategory ?? "—"}</td>
                    <td className="td max-w-48"><span className="line-clamp-2">{r.notes ?? "—"}</span></td>
                    <td className="td">{canDelete && <button className="btn-ghost btn-sm !text-red-600 hover:!bg-red-50" onClick={() => remove(r.id)}><Trash2 size={14} /></button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {showForm && <QualityForm jobs={jobs} biz={biz} defects={defects} onClose={() => setShowForm(false)} onDone={() => { setShowForm(false); load(); }} />}
    </div>
  );
}

function QualityForm({ jobs, biz, defects, onClose, onDone }: any) {
  const { t } = useLang();
  const [jobCode, setJobCode] = useState(jobs[0]?.code ?? "");
  const [stage, setStage] = useState(biz?.stages?.[biz.stages.length - 2] ?? "");
  const [inspected, setInspected] = useState("10");
  const [accepted, setAccepted] = useState("9");
  const [rejected, setRejected] = useState("1");
  const [rework, setRework] = useState("0");
  const [defect, setDefect] = useState(defects[0]?.name ?? "");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const submit = async () => {
    setBusy(true);
    setErr("");
    try {
      await api("quality", {
        method: "POST",
        body: { jobCode: jobCode || undefined, stage, inspected: Number(inspected), accepted: Number(accepted), rejected: Number(rejected), rework: Number(rework), defectCategory: defect, notes },
      });
      onDone();
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={t("quality.record")}>
      {err && <div className="mb-3 rounded-xl bg-red-50 px-3 py-2 text-xs font-medium text-red-700">{err}</div>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Job / batch">
          <select className="input" value={jobCode} onChange={(e) => setJobCode(e.target.value)}>
            <option value="">— none —</option>
            {jobs.map((j: any) => <option key={j.id} value={j.code}>{j.code} — {j.title}</option>)}
          </select>
        </Field>
        <Field label="Stage">
          <select className="input" value={stage} onChange={(e) => setStage(e.target.value)}>
            <option value="">— none —</option>
            {(biz?.stages ?? []).map((s: string) => <option key={s}>{s}</option>)}
          </select>
        </Field>
        <Field label="Inspected qty"><input className="input" type="number" min={0} value={inspected} onChange={(e) => setInspected(e.target.value)} /></Field>
        <Field label="Accepted qty"><input className="input" type="number" min={0} value={accepted} onChange={(e) => setAccepted(e.target.value)} /></Field>
        <Field label={t("quality.reject")}><input className="input" type="number" min={0} value={rejected} onChange={(e) => setRejected(e.target.value)} /></Field>
        <Field label={t("quality.rework")}><input className="input" type="number" min={0} value={rework} onChange={(e) => setRework(e.target.value)} /></Field>
        <Field label={t("quality.defect")} className="sm:col-span-2">
          <select className="input" value={defect} onChange={(e) => setDefect(e.target.value)}>
            {defects.map((d: any) => <option key={d.id}>{d.name}</option>)}
          </select>
        </Field>
        <Field label="Notes" className="sm:col-span-2"><textarea className="input min-h-16" value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="teal" disabled={busy} onClick={submit}>{busy ? "Saving…" : "Save inspection"}</Button>
      </div>
    </Modal>
  );
}
