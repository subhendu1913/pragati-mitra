"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Sprout, QrCode, Play, Pause, CheckCircle2, AlertTriangle, Package, ArrowLeft, Send, CheckCircle2 as Done,
} from "lucide-react";
import { api } from "@/lib/api";
import { useLang } from "@/lib/i18n";
import { EVENT_CATEGORIES } from "@/lib/domain";
import { Badge, Button, Card, DemoBadge, Field, Modal, Progress, Spinner, statusTone } from "@/components/ui";

export default function WorkerApp() {
  const { t, lang, setLang } = useLang();
  const router = useRouter();
  const params = useSearchParams();
  const [me, setMe] = useState<any>(null);
  const [biz, setBiz] = useState<any>(null);
  const [jobs, setJobs] = useState<any[]>([]);
  const [job, setJob] = useState<any>(null);
  const [detail, setDetail] = useState<any>(null);
  const [codeInput, setCodeInput] = useState(params.get("job") ?? "");
  const [note, setNote] = useState("");
  const [reportCat, setReportCat] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [doneMsg, setDoneMsg] = useState("");

  const load = useCallback(() => {
    Promise.all([api("auth"), api("jobs"), api("business")])
      .then(([a, j, b]) => {
        setMe(a.user);
        setBiz(b.business);
        setJobs(j.jobs);
        const code = params.get("job");
        if (code) {
          const found = j.jobs.find((x: any) => x.code.toLowerCase() === code.toLowerCase());
          if (found) openJob(found.id);
        }
      })
      .catch(() => router.push("/login"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(load, [load]);

  const openJob = (id: string) => {
    setJob(id);
    setDetail(null);
    api(`jobs/${id}`).then((d) => { setDetail(d); setJob(d.job); }).catch(() => {});
  };

  const stageAction = async (i: number, action: string) => {
    if (!job) return;
    setBusy(true);
    try {
      await api(`jobs/${job.id}/stage`, { method: "POST", body: { stageIndex: i, action, note: note || undefined } });
      setNote("");
      setDoneMsg(action === "complete" ? `Stage completed ✓` : action === "pause" ? "Paused" : "Started");
      setTimeout(() => setDoneMsg(""), 3000);
      api(`jobs/${job.id}`).then((d) => { setDetail(d); setJob(d.job); });
      api("jobs").then((d) => setJobs(d.jobs));
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const submitEvent = async (e: any) => {
    e.preventDefault();
    if (!reportCat || !job) return;
    setBusy(true);
    try {
      const form = new FormData(e.target as HTMLFormElement);
      await api("events", {
        method: "POST",
        body: {
          category: reportCat,
          jobCode: job.code,
          stage: (form.get("stage") as string) || job.currentStage,
          durationMinutes: form.get("durationMinutes") ? Number(form.get("durationMinutes")) : undefined,
          qtyAffected: form.get("qtyAffected") ? Number(form.get("qtyAffected")) : undefined,
          description: (form.get("description") as string) || undefined,
        },
      });
      setReportCat(null);
      setDoneMsg(t("worker.success"));
      setTimeout(() => setDoneMsg(""), 3500);
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (!me) return <div className="flex min-h-screen items-center justify-center"><Spinner /></div>;

  return (
    <div className="min-h-screen bg-cream">
      <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-lg items-center gap-2 px-4 py-3">
          <Link href="/" className="flex items-center gap-2 min-w-0" aria-label="Pragati Mitra — back to home">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-teal text-white"><Sprout size={19} /></div>
            <div className="min-w-0">
              <p className="truncate text-sm font-extrabold text-navy">{biz?.name ?? "Pragati Mitra"}</p>
              <p className="text-[10px] text-slate-400">{me.name} • {me.role}</p>
            </div>
          </Link>
          <div className="ml-auto flex items-center gap-2">
            {me.isDemo && <DemoBadge />}
            <select value={lang} onChange={(e) => setLang(e.target.value as "en" | "od")} className="input !w-auto !py-1.5 !text-xs font-bold">
              <option value="en">English</option>
              <option value="od">Odia</option>
            </select>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-lg space-y-4 px-4 py-5 pb-16">
        {doneMsg && <div className="flex items-center gap-2 rounded-xl bg-green-50 px-4 py-3 text-sm font-bold text-green-700"><Done size={16} /> {doneMsg}</div>}

        {!job ? (
          <>
            <Card title={<span className="flex items-center gap-2"><QrCode size={17} className="text-teal-dark" /> {t("worker.enterCode")}</span>}>
              <div className="flex gap-2">
                <input
                  className="input flex-1 !py-3 !text-base font-mono font-bold uppercase"
                  placeholder="e.g. OMW-105"
                  value={codeInput}
                  onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
                  onKeyDown={(e) => { if (e.key === "Enter" && codeInput) { const found = jobs.find((x) => x.code.toLowerCase() === codeInput.toLowerCase()); if (found) openJob(found.id); else alert("Job not found or not assigned to you."); } }}
                />
                <Button
                  variant="teal"
                  className="!py-3"
                  onClick={() => { const found = jobs.find((x) => x.code.toLowerCase() === codeInput.toLowerCase()); if (found) openJob(found.id); else alert("Job not found or not assigned to you."); }}
                >
                  {t("worker.openJob")}
                </Button>
              </div>
              <p className="mt-2 text-[11px] text-slate-400">Tip: scan the QR code on the job sheet — it opens this page with the job pre-filled.</p>
            </Card>

            <h2 className="text-base font-extrabold text-navy">{t("worker.myJobs")} ({jobs.length})</h2>
            {jobs.length === 0 && <Card><p className="py-4 text-center text-sm text-slate-400">No jobs assigned to you yet.</p></Card>}
            <div className="space-y-3">
              {jobs.map((j) => (
                <button key={j.id} onClick={() => openJob(j.id)} className="card block w-full p-4 text-left transition hover:border-teal/50 hover:shadow-pop">
                  <div className="flex items-center gap-2">
                    <p className="font-mono text-base font-extrabold text-navy">{j.code}</p>
                    <Badge tone={statusTone(j.status)}>{j.status}</Badge>
                    {j.daysOverdue > 0 && <Badge tone="red">+{j.daysOverdue}d</Badge>}
                    <ArrowLeft size={15} className="ml-auto rotate-180 text-slate-300" />
                  </div>
                  <p className="mt-1 text-sm font-semibold text-slate-700">{j.title}</p>
                  <p className="mt-0.5 text-xs text-slate-400">{t("worker.currentStage")}: {j.currentStage}</p>
                  <div className="mt-2 flex items-center gap-2">
                    <Progress value={j.quantity ? ((j.completedQty ?? 0) / j.quantity) * 100 : 0} className="flex-1" />
                    <span className="text-[11px] font-bold text-slate-500">{j.completedQty ?? 0}/{j.quantity ?? 0}</span>
                  </div>
                </button>
              ))}
            </div>
          </>
        ) : (
          detail && (
            <>
              <button onClick={() => { setJob(null); setDetail(null); }} className="btn-ghost btn-sm"><ArrowLeft size={14} /> {t("common.back")}</button>
              <Card>
                <div className="flex items-center gap-2">
                  <p className="font-mono text-lg font-extrabold text-navy">{job.code}</p>
                  <Badge tone={statusTone(job.status)}>{job.status}</Badge>
                </div>
                <p className="mt-1 text-[15px] font-bold text-slate-800">{job.title}</p>
                <p className="text-xs text-slate-400">{job.product ?? ""}</p>
                <div className="mt-3 flex items-center gap-2">
                  <Package size={14} className="text-teal-dark" />
                  <Progress value={job.quantity ? ((job.completedQty ?? 0) / job.quantity) * 100 : 0} className="flex-1" />
                  <span className="text-xs font-bold text-slate-500">{t("worker.doneQty")} {job.completedQty ?? 0}/{job.quantity ?? 0}</span>
                </div>
              </Card>

              <h2 className="text-base font-extrabold text-navy">{t("prod.stages")}</h2>
              <div className="space-y-2.5">
                {job.stages.map((s: any, i: number) => (
                  <div key={i} className={`card !rounded-xl p-3.5 ${s.status === "completed" ? "border-green-100 bg-green-50/40" : s.status === "in_progress" ? "border-teal-300 bg-teal-light/40" : s.status === "paused" ? "border-amber-300 bg-amber-50/50" : "opacity-80"}`}>
                    <div className="flex items-center gap-2.5">
                      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${s.status === "completed" ? "bg-green-500 text-white" : s.status === "in_progress" ? "bg-teal text-white" : s.status === "paused" ? "bg-amber-400 text-white" : "bg-slate-200 text-slate-500"}`}>
                        {s.status === "completed" ? <CheckCircle2 size={16} /> : i + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[15px] font-bold text-navy">{s.name}</p>
                        <p className="text-[11px] text-slate-400">{s.status}{s.note ? ` • “${s.note}”` : ""}</p>
                      </div>
                    </div>
                    {s.status !== "completed" && (
                      <div className="mt-3 flex gap-2">
                        {(s.status === "pending" || s.status === "paused") && (
                          <Button variant="teal" className="flex-1 !py-3.5 !text-base" disabled={busy} onClick={() => stageAction(i, "start")}>
                            <Play size={18} /> {t("worker.start")}
                          </Button>
                        )}
                        {s.status === "in_progress" && (
                          <>
                            <Button variant="ghost" className="flex-1 !py-3.5 !text-base" disabled={busy} onClick={() => stageAction(i, "pause")}>
                              <Pause size={18} /> {t("worker.pause")}
                            </Button>
                            <Button variant="teal" className="flex-1 !py-3.5 !text-base" disabled={busy} onClick={() => stageAction(i, "complete")}>
                              <CheckCircle2 size={18} /> {t("worker.complete")}
                            </Button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <Field label={t("worker.note")}>
                <input className="input !py-3" placeholder={lang === "od" ? "Chhota note (optional)" : "Short note for the next action (optional)"} value={note} onChange={(e) => setNote(e.target.value)} />
              </Field>

              <Card title={<span className="flex items-center gap-2"><AlertTriangle size={17} className="text-amber-500" /> {t("worker.report")}</span>}>
                <div className="grid grid-cols-2 gap-2">
                  {EVENT_CATEGORIES.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setReportCat(c.id)}
                      className={`rounded-xl border px-3 py-4 text-center text-[13px] font-bold transition active:scale-[0.97] ${reportCat === c.id ? "border-teal bg-teal-light text-teal-dark" : "border-slate-200 bg-white text-slate-700 hover:border-teal/50"}`}
                    >
                      {t(`worker.cat.${c.id}`)}
                    </button>
                  ))}
                </div>
              </Card>
            </>
          )
        )}
      </main>

      {reportCat && job && (
        <Modal open onClose={() => setReportCat(null)} title={`${t("worker.report")}: ${t(`worker.cat.${reportCat}`)}`}>
          <form onSubmit={submitEvent} className="space-y-4">
            <p className="rounded-lg bg-cream px-3 py-2 text-xs text-slate-500">Job <span className="font-mono font-bold text-navy">{job.code}</span></p>
            <Field label="Stage">
              <select name="stage" className="input" defaultValue={job.currentStage}>
                {(detail?.job?.stages ?? []).map((s: any) => <option key={s.name}>{s.name}</option>)}
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t("events.duration")}><input name="durationMinutes" type="number" min={0} className="input" placeholder="e.g. 45" /></Field>
              <Field label={t("events.qty")}><input name="qtyAffected" type="number" min={0} className="input" placeholder="e.g. 5" /></Field>
            </div>
            <Field label={t("worker.note")}><textarea name="description" className="input min-h-20" placeholder={lang === "od" ? "Ki haila? (chhota lekha)" : "What happened? (short)"} /></Field>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" type="button" onClick={() => setReportCat(null)}>Cancel</Button>
              <Button variant="teal" type="submit" disabled={busy}><Send size={14} /> {t("worker.submit")}</Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
