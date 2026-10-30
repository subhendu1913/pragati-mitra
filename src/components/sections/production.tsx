"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Plus, QrCode, RefreshCw, Factory, Search, X, Play, Pause, CheckCircle2, RotateCcw, Package, Users, CalendarDays, AlertTriangle, Trash2, Pencil,
} from "lucide-react";
import { api } from "@/lib/api";
import { useLang } from "@/lib/i18n";
import { INDUSTRIES, industryTemplate } from "@/lib/domain";
import { Badge, Button, Card, Empty, Field, Modal, PageHeader, Progress, Spinner, fmtDate, statusTone } from "@/components/ui";

export default function ProductionSection() {
  const { t } = useLang();
  const [jobs, setJobs] = useState<any[]>([]);
  const [team, setTeam] = useState<any[]>([]);
  const [biz, setBiz] = useState<any>(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [me, setMe] = useState<any>(null);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      api(`jobs?status=${statusFilter}&q=${encodeURIComponent(search)}`),
      api("team"),
      api("business"),
      api("auth"),
    ])
      .then(([j, tm, b, a]) => {
        setJobs(j.jobs);
        setTeam(tm.members);
        setBiz(b.business);
        setMe(a.user);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [statusFilter, search]);

  const canManage = me && ["owner", "manager"].includes(me.role);

  const deleteJob = async (e: React.MouseEvent, id: string, code: string) => {
    e.stopPropagation();
    if (!confirm(`Delete job ${code} and its stage history? This cannot be undone.`)) return;
    try {
      await api(`jobs/${id}`, { method: "DELETE" });
      load();
    } catch (err) {
      alert((err as Error).message);
    }
  };

  useEffect(load, [load]);

  const openDetail = (id: string) => {
    setSelected(id);
    setDetail(null);
    api(`jobs/${id}`).then(setDetail).catch(() => {});
  };
  const reloadDetail = () => { if (selected) api(`jobs/${selected}`).then(setDetail); load(); };

  const stageAction = async (stageIndex: number, action: string, note?: string) => {
    if (!selected) return;
    setBusy(true);
    try {
      await api(`jobs/${selected}/stage`, { method: "POST", body: { stageIndex, action, note } });
      reloadDetail();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("nav.production")}
        desc="Create jobs with industry-specific stages, assign people, and track progress stage-by-stage. Each job has a QR code for workers."
        actions={
          <>
            <button className="btn-ghost btn-sm" onClick={load}><RefreshCw size={14} /> {t("common.refresh")}</button>
            <button className="btn-teal btn-sm" onClick={() => setShowCreate(true)}><Plus size={15} /> {t("prod.newJob")}</button>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input className="input !pl-8 !py-1.5 !text-[13px] w-56" placeholder={t("common.search")} value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className="input !w-auto !py-1.5 !text-[13px]" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="delayed">Delayed</option>
          <option value="completed">Completed</option>
          <option value="on_hold">On hold</option>
        </select>
      </div>

      <Card pad={false}>
        {loading ? <Spinner /> : jobs.length === 0 ? (
          <Empty icon={Factory} title="No jobs yet" text="Create your first job — pick an industry template, add product and quantity, assign workers and dates." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="th">{t("prod.jobCode")}</th><th className="th">Job</th><th className="th">Progress</th>
                  <th className="th">Stage</th><th className="th">Status</th><th className="th">{t("prod.expected")}</th><th className="th"></th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((j) => (
                  <tr key={j.id} className="hover:bg-slate-50/60 cursor-pointer" onClick={() => openDetail(j.id)}>
                    <td className="td font-mono font-bold text-navy">{j.code}</td>
                    <td className="td"><div className="font-semibold text-slate-800">{j.title}</div><div className="text-[11px] text-slate-400">{j.product ?? "—"} • qty {j.quantity ?? 0}</div></td>
                    <td className="td w-36"><div className="flex items-center gap-2"><Progress value={j.quantity ? ((j.completedQty ?? 0) / j.quantity) * 100 : 0} /><span className="text-[11px] font-bold text-slate-500">{j.completedQty ?? 0}/{j.quantity ?? 0}</span></div></td>
                    <td className="td">{j.currentStage}</td>
                    <td className="td">
                      <Badge tone={statusTone(j.status)}>{j.status}</Badge>
                      {j.daysOverdue > 0 && <span className="ml-1"><Badge tone="red">+{j.daysOverdue}d</Badge></span>}
                    </td>
                    <td className="td whitespace-nowrap">{fmtDate(j.expectedCompletion)}</td>
                    <td className="td"><QrCode size={16} className="text-teal-dark" /></td>
                    <td className="td">
                      {canManage && (
                        <button className="btn-ghost btn-sm !text-red-600 hover:!bg-red-50" title="Delete job" onClick={(e) => deleteJob(e, j.id, j.code)}>
                          <Trash2 size={14} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {showCreate && <CreateJobModal biz={biz} team={team} onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); load(); }} />}

      {selected && (
        <JobDetail
          detail={detail}
          onClose={() => { setSelected(null); setDetail(null); }}
          onStage={stageAction}
          busy={busy}
          reloadDetail={reloadDetail}
          canManage={canManage}
          setBusy={setBusy}
          t={t}
        />
      )}
    </div>
  );
}

function CreateJobModal({ biz, team, onClose, onCreated }: any) {
  const [title, setTitle] = useState("");
  const [product, setProduct] = useState("");
  const [quantity, setQuantity] = useState("10");
  const [industry, setIndustry] = useState(biz?.industry ?? "fabrication");
  const [stagesText, setStagesText] = useState(industryTemplate(biz?.industry ?? "fabrication").stages.join(", "));
  const [supervisorId, setSupervisorId] = useState("");
  const [workerIds, setWorkerIds] = useState<string[]>([]);
  const [start, setStart] = useState(new Date().toISOString().slice(0, 10));
  const [end, setEnd] = useState(new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const pickIndustry = (id: string) => {
    setIndustry(id);
    setStagesText(industryTemplate(id).stages.join(", "));
  };

  const submit = async () => {
    setBusy(true);
    setErr("");
    try {
      await api("jobs", {
        method: "POST",
        body: {
          title,
          product,
          quantity: Number(quantity),
          industry,
          stages: stagesText.split(",").map((s) => s.trim()).filter(Boolean),
          supervisorId: supervisorId || undefined,
          workerIds,
          plannedStart: start,
          expectedCompletion: end,
        },
      });
      onCreated();
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  };

  const people = team.filter((m: any) => ["supervisor", "worker", "manager"].includes(m.role));

  return (
    <Modal open onClose={onClose} title="New production job / batch" wide>
      {err && <div className="mb-3 rounded-xl bg-red-50 px-3 py-2 text-xs font-medium text-red-700">{err}</div>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Job title / order name" className="sm:col-span-2">
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Gate order for Sharma Constructions" />
        </Field>
        <Field label="Product">
          <input className="input" value={product} onChange={(e) => setProduct(e.target.value)} placeholder="e.g. MS gate 3x2m" />
        </Field>
        <Field label="Planned quantity">
          <input className="input" type="number" min={1} value={quantity} onChange={(e) => setQuantity(e.target.value)} />
        </Field>
        <Field label="Industry template">
          <select className="input" value={industry} onChange={(e) => pickIndustry(e.target.value)}>
            {INDUSTRIES.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
          </select>
        </Field>
        <Field label="Supervisor">
          <select className="input" value={supervisorId} onChange={(e) => setSupervisorId(e.target.value)}>
            <option value="">— none —</option>
            {team.filter((m: any) => ["supervisor", "manager", "owner"].includes(m.role)).map((m: any) => <option key={m.id} value={m.id}>{m.name} ({m.role})</option>)}
          </select>
        </Field>
        <Field label="Start date">
          <input className="input" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
        </Field>
        <Field label="Expected completion">
          <input className="input" type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
        </Field>
        <Field label="Production stages (comma separated — editable)" className="sm:col-span-2">
          <textarea className="input min-h-20" value={stagesText} onChange={(e) => setStagesText(e.target.value)} />
        </Field>
        <Field label="Assign workers" className="sm:col-span-2">
          <div className="flex flex-wrap gap-2">
            {people.filter((m: any) => m.role === "worker").map((m: any) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setWorkerIds((prev) => (prev.includes(m.id) ? prev.filter((x) => x !== m.id) : [...prev, m.id]))}
                className={`chip ring-1 ring-inset ${workerIds.includes(m.id) ? "bg-teal text-white ring-teal" : "bg-white text-slate-600 ring-slate-200"}`}
              >
                {m.name}
              </button>
            ))}
            {people.filter((m: any) => m.role === "worker").length === 0 && <span className="text-xs text-slate-400">No workers in team yet — add them in Team & Permissions.</span>}
          </div>
        </Field>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="teal" disabled={busy || !title} onClick={submit}>{busy ? "Creating…" : "Create job"}</Button>
      </div>
    </Modal>
  );
}

function JobDetail({ detail, onClose, onStage, busy, setBusy, reloadDetail, canManage, t }: any) {
  const [note, setNote] = useState("");
  const [showEdit, setShowEdit] = useState(false);
  const [qty, setQty] = useState<string>("");
  if (!detail) return (
    <Modal open onClose={onClose} title="Job details" wide>
      <Spinner />
    </Modal>
  );
  const { job, qrDataUrl, events, quality, people } = detail;
  const pmap = new Map<string, any>(people.map((p: any) => [p.id, p] as [string, any]));
  const stageButtons = (s: any, i: number) => {
    if (s.status === "pending") return <Button size="sm" variant="teal" disabled={busy} onClick={() => onStage(i, "start")}><Play size={13} /> {t("prod.start")}</Button>;
    if (s.status === "in_progress") return (
      <div className="flex gap-1.5">
        <Button size="sm" variant="ghost" disabled={busy} onClick={() => onStage(i, "pause")}><Pause size={13} /> {t("prod.pause")}</Button>
        <Button size="sm" variant="teal" disabled={busy} onClick={() => onStage(i, "complete", note || undefined)}><CheckCircle2 size={13} /> {t("prod.complete")}</Button>
      </div>
    );
    if (s.status === "paused") return (
      <div className="flex gap-1.5">
        <Button size="sm" variant="teal" disabled={busy} onClick={() => onStage(i, "start")}><Play size={13} /> Resume</Button>
        <Button size="sm" variant="ghost" disabled={busy} onClick={() => onStage(i, "complete", note || undefined)}><CheckCircle2 size={13} /> {t("prod.complete")}</Button>
      </div>
    );
    return <Button size="sm" variant="ghost" disabled={busy} onClick={() => onStage(i, "reopen")}><RotateCcw size={13} /> {t("prod.reopen")}</Button>;
  };

  const saveQty = async () => {
    try {
      await api(`jobs/${job.id}`, { method: "PATCH", body: { completedQty: Number(qty) } });
      setQty("");
      reloadDetail();
    } catch (e) { alert((e as Error).message); }
  };

  return (
    <Modal open onClose={onClose} title={`Job ${job.code}`} wide>
      <div className="grid gap-5 lg:grid-cols-5">
        <div className="space-y-4 lg:col-span-3">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-extrabold text-navy">{job.title}</h3>
            <Badge tone={statusTone(job.status)}>{job.status}</Badge>
            {job.daysOverdue > 0 && <Badge tone="red"><AlertTriangle size={11} /> {job.daysOverdue} days overdue</Badge>}
            {canManage && (
              <>
                <Button size="sm" variant="ghost" onClick={() => setShowEdit(true)}><Pencil size={13} /> Edit</Button>
                {job.status !== "completed" && (
                  <Button
                    size="sm"
                    variant="teal"
                    disabled={busy}
                    onClick={async () => {
                      if (!confirm(`Mark ${job.code} as completed now?`)) return;
                      setBusy(true);
                      try {
                        await api(`jobs/${job.id}`, { method: "PATCH", body: { status: "completed" } });
                        reloadDetail();
                      } catch (e) {
                        alert((e as Error).message);
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    <CheckCircle2 size={13} /> {t("prod.markCompleted")}
                  </Button>
                )}
              </>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2 text-[13px] sm:grid-cols-4">
            <div className="rounded-xl bg-cream p-2.5"><p className="text-[10px] font-bold uppercase text-slate-400">Product</p><p className="font-bold text-navy">{job.product ?? "—"}</p></div>
            <div className="rounded-xl bg-cream p-2.5"><p className="text-[10px] font-bold uppercase text-slate-400">{t("worker.plannedQty")}</p><p className="font-bold text-navy">{job.quantity ?? 0}</p></div>
            <div className="rounded-xl bg-cream p-2.5"><p className="text-[10px] font-bold uppercase text-slate-400">{t("worker.doneQty")}</p>
              <div className="flex items-center gap-1.5">
                <p className="font-bold text-navy">{job.completedQty ?? 0}</p>
                <input className="input !w-16 !py-0.5 !text-xs" placeholder="set" value={qty} onChange={(e) => setQty(e.target.value)} />
                <button className="btn-ghost btn-sm !px-1.5 !py-0.5 text-[10px]" onClick={saveQty}>OK</button>
              </div>
            </div>
            <div className="rounded-xl bg-cream p-2.5"><p className="text-[10px] font-bold uppercase text-slate-400">{t("prod.expected")}</p><p className="font-bold text-navy">{fmtDate(job.expectedCompletion)}</p></div>
          </div>

          <div>
            <p className="label flex items-center gap-1.5"><Package size={12} /> {t("prod.stages")}</p>
            <input className="input mb-2 !py-1.5 !text-xs" placeholder="Add a note for the next stage action (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
            <ol className="space-y-2">
              {job.stages.map((s: any, i: number) => (
                <li key={i} className={`flex items-center gap-3 rounded-xl border p-3 ${s.status === "completed" ? "border-green-100 bg-green-50/50" : s.status === "in_progress" ? "border-teal-200 bg-teal-light/40" : s.status === "paused" ? "border-amber-200 bg-amber-50/60" : "border-slate-100 bg-white"}`}>
                  <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${s.status === "completed" ? "bg-green-500 text-white" : s.status === "in_progress" ? "bg-teal text-white" : s.status === "paused" ? "bg-amber-400 text-white" : "bg-slate-200 text-slate-500"}`}>
                    {s.status === "completed" ? <CheckCircle2 size={14} /> : i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-bold text-navy">{s.name}</p>
                    <p className="text-[10.5px] text-slate-400">
                      {s.status} {s.startedAt && `• started ${fmtDate(s.startedAt)}`} {s.completedAt && `• done ${fmtDate(s.completedAt)}`} {s.note && `• “${s.note}”`}
                    </p>
                  </div>
                  {stageButtons(s, i)}
                </li>
              ))}
            </ol>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="label">Reported events on this job</p>
              {events.length === 0 ? <p className="text-xs text-slate-400">None yet.</p> : (
                <ul className="space-y-1.5">
                  {events.map((e: any) => (
                    <li key={e.id} className="rounded-lg border border-slate-100 px-2.5 py-2 text-xs">
                      <span className="font-bold text-navy">{e.category.replace(/_/g, " ")}</span> • {e.stage ?? "—"} • {e.durationMinutes ? `${e.durationMinutes} min` : "—"}
                      {e.verified ? <Badge tone="green">✓</Badge> : <Badge tone="amber">unverified</Badge>}
                      <span className="block text-slate-400">{e.description}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <p className="label">Quality records on this job</p>
              {quality.length === 0 ? <p className="text-xs text-slate-400">None yet.</p> : (
                <ul className="space-y-1.5">
                  {quality.map((q: any) => (
                    <li key={q.id} className="rounded-lg border border-slate-100 px-2.5 py-2 text-xs">
                      inspected {q.inspected} • accepted {q.accepted} • <span className="text-red-600 font-bold">rejected {q.rejected}</span> • rework {q.rework} • {q.defectCategory ?? "—"}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div>
            <p className="label flex items-center gap-1.5"><Users size={12} /> {t("prod.assigned")}</p>
            <div className="flex flex-wrap gap-1.5 text-xs">
              {job.supervisorId && <Badge tone="navy">Supervisor: {pmap.get(job.supervisorId)?.name ?? "—"}</Badge>}
              {(job.workerIds ?? []).map((id: string) => <Badge key={id} tone="teal">{pmap.get(id)?.name ?? id.slice(0, 6)}</Badge>)}
              {!job.supervisorId && (job.workerIds ?? []).length === 0 && <span className="text-slate-400">No one assigned yet.</span>}
            </div>
          </div>
        </div>

        <div className="lg:col-span-2">
          <Card title={<span className="flex items-center gap-2"><QrCode size={15} className="text-teal-dark" /> QR</span>} subtitle={t("prod.qr")}>
            <div className="flex flex-col items-center gap-3">
              {qrDataUrl && <img src={qrDataUrl} alt="Job QR" className="w-44 rounded-xl border border-slate-200" />}
              <p className="font-mono text-xs font-bold text-navy">{job.code}</p>
              <a href={`/worker?job=${encodeURIComponent(job.code)}`} target="_blank" className="btn-ghost btn-sm w-full">Open worker view for this job</a>
            </div>
          </Card>
          <Card className="mt-4" title={t("prod.history")}>
            <ul className="space-y-1.5 text-xs text-slate-600">
              <li>Created {fmtDate(job.createdAt)}</li>
              <li>Planned start {fmtDate(job.plannedStart)}</li>
              <li>Expected {fmtDate(job.expectedCompletion)}</li>
              {job.actualCompletion && <li>Completed {fmtDate(job.actualCompletion)}</li>}
              {job.stages.filter((s: any) => s.completedAt).map((s: any) => (
                <li key={s.name}>✓ {s.name} completed {fmtDate(s.completedAt)}</li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
      <div className="mt-4 flex justify-end"><Button variant="ghost" onClick={onClose}><X size={14} /> {t("common.close")}</Button></div>
      {showEdit && <EditJobModal job={job} onClose={() => setShowEdit(false)} onSaved={() => { setShowEdit(false); reloadDetail(); }} />}
    </Modal>
  );
}

function EditJobModal({ job, onClose, onSaved }: any) {
  const [title, setTitle] = useState(job.title);
  const [product, setProduct] = useState(job.product ?? "");
  const [quantity, setQuantity] = useState(String(job.quantity ?? 0));
  const [expected, setExpected] = useState(job.expectedCompletion ? new Date(job.expectedCompletion).toISOString().slice(0, 10) : "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const save = async () => {
    setBusy(true);
    setErr("");
    try {
      await api(`jobs/${job.id}`, { method: "PATCH", body: { title, product, quantity: Number(quantity), expectedCompletion: expected || null } });
      onSaved();
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  };
  return (
    <Modal open onClose={onClose} title={`Edit ${job.code}`}>
      {err && <div className="mb-3 rounded-xl bg-red-50 px-3 py-2 text-xs font-medium text-red-700">{err}</div>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Title" className="sm:col-span-2"><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
        <Field label="Product"><input className="input" value={product} onChange={(e) => setProduct(e.target.value)} /></Field>
        <Field label="Planned quantity"><input className="input" type="number" min={0} value={quantity} onChange={(e) => setQuantity(e.target.value)} /></Field>
        <Field label="Expected completion"><input className="input" type="date" value={expected} onChange={(e) => setExpected(e.target.value)} /></Field>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="teal" disabled={busy || !title.trim()} onClick={save}>{busy ? "Saving…" : "Save changes"}</Button>
      </div>
    </Modal>
  );
}
