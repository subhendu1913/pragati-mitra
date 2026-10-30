"use client";

import { useCallback, useEffect, useState } from "react";
import { Settings as SettingsIcon, Save, RefreshCw, Plus, X, RotateCcw, Gauge, FileText, AlertTriangle } from "lucide-react";
import { api } from "@/lib/api";
import { useLang } from "@/lib/i18n";
import { INDUSTRIES, RECORD_METHODS, PROBLEM_OPTIONS, industryTemplate, type IndustryId } from "@/lib/domain";
import { Badge, Button, Card, Field, PageHeader, Progress, Spinner } from "@/components/ui";
import { useLang as useLangCtx } from "@/lib/i18n";
import { toOdia } from "@/lib/odia";

export default function SettingsSection() {
  const { t } = useLang();
  const { lang, setLang } = useLangCtx();
  const [biz, setBiz] = useState<any>(null);
  const [readiness, setReadiness] = useState<any>(null);
  const [me, setMe] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [resetting, setResetting] = useState(false);

  // form state
  const [f, setF] = useState<any>(null);
  const [newStage, setNewStage] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([api("business"), api("readiness"), api("auth")])
      .then(([b, r, a]) => {
        setBiz(b.business);
        setReadiness(r.readiness);
        setMe(a.user);
        setF({
          name: b.business.name,
          location: b.business.location ?? "",
          industry: b.business.industry,
          customIndustry: b.business.customIndustry ?? "",
          businessType: b.business.businessType ?? "",
          products: b.business.products ?? "",
          workersCount: b.business.workersCount ?? 0,
          recordMethod: b.business.recordMethod ?? "paper",
          existingSoftware: b.business.existingSoftware ?? "",
          preferredLanguage: b.business.preferredLanguage ?? "en",
          stages: [...(b.business.stages ?? [])],
          mainProblems: [...(b.business.mainProblems ?? [])],
        });
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);
  useEffect(load, [load]);

  const save = async () => {
    setSaving(true);
    setSaved(false);
    try {
      await api("business", { method: "PATCH", body: f });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      load();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const resetDemo = async () => {
    if (!confirm("Reset all demo data to the original fictional sample data? Changes made in demo mode will be lost.")) return;
    setResetting(true);
    try {
      await api("demo/reset", { method: "POST" });
      window.location.reload();
    } catch (e) {
      alert((e as Error).message);
      setResetting(false);
    }
  };

  if (loading || !f) return <Spinner />;
  const canEdit = me && ["owner", "manager"].includes(me.role);

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("nav.settings")}
        desc="Business profile, industry workflow template, onboarding & adoption plan, and demo controls."
        actions={
          canEdit && (
            <Button variant="teal" disabled={saving} onClick={save}>
              <Save size={15} /> {saving ? "Saving…" : saved ? "Saved ✓" : t("common.save")}
            </Button>
          )
        }
      />

      <Card title="🌐 {t('settings.language')}" subtitle={t("settings.languageHint")} className="lg:col-span-2">
        <div className="flex flex-wrap items-center gap-3">
          <button onClick={() => setLang("en")} className={`btn ${lang === "en" ? "btn-primary" : "btn-ghost"}`}>English</button>
          <button onClick={() => setLang("od")} className={`btn ${lang === "od" ? "btn-teal" : "btn-ghost"}`}>{toOdia("Odiya")}</button>
          <span className="text-xs text-slate-400">{t("settings.languageHint")}</span>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title={<span className="flex items-center gap-2"><SettingsIcon size={16} className="text-teal-dark" /> Business profile</span>}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Business name"><input className="input" disabled={!canEdit} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
            <Field label="Location"><input className="input" disabled={!canEdit} value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} /></Field>
            <Field label="Industry">
              <select className="input" disabled={!canEdit} value={f.industry} onChange={(e) => setF({ ...f, industry: e.target.value as IndustryId, stages: industryTemplate(e.target.value as IndustryId).stages })}>
                {INDUSTRIES.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
              </select>
            </Field>
            {f.industry === "other" && (
              <Field label="Custom industry"><input className="input" disabled={!canEdit} value={f.customIndustry} onChange={(e) => setF({ ...f, customIndustry: e.target.value })} /></Field>
            )}
            <Field label="Business type"><input className="input" disabled={!canEdit} value={f.businessType} onChange={(e) => setF({ ...f, businessType: e.target.value })} /></Field>
            <Field label="Number of workers"><input className="input" type="number" disabled={!canEdit} value={f.workersCount} onChange={(e) => setF({ ...f, workersCount: Number(e.target.value) })} /></Field>
            <Field label="Products" className="sm:col-span-2"><input className="input" disabled={!canEdit} value={f.products} onChange={(e) => setF({ ...f, products: e.target.value })} /></Field>
            <Field label="Current record-keeping method">
              <select className="input" disabled={!canEdit} value={f.recordMethod} onChange={(e) => setF({ ...f, recordMethod: e.target.value })}>
                {RECORD_METHODS.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
              </select>
            </Field>
            <Field label="Existing software (if any)"><input className="input" disabled={!canEdit} value={f.existingSoftware} onChange={(e) => setF({ ...f, existingSoftware: e.target.value })} /></Field>
            <Field label="Preferred language">
              <select className="input" disabled={!canEdit} value={f.preferredLanguage} onChange={(e) => setF({ ...f, preferredLanguage: e.target.value })}>
                <option value="en">English</option><option value="od">Odia</option>
              </select>
            </Field>
            <Field label="Main operational problems" className="sm:col-span-2">
              <div className="flex flex-wrap gap-2">
                {PROBLEM_OPTIONS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    disabled={!canEdit}
                    onClick={() => setF({ ...f, mainProblems: f.mainProblems.includes(p) ? f.mainProblems.filter((x: string) => x !== p) : [...f.mainProblems, p] })}
                    className={`chip ring-1 ring-inset ${f.mainProblems.includes(p) ? "bg-teal text-white ring-teal" : "bg-white text-slate-600 ring-slate-200"}`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </Field>
          </div>
        </Card>

        <div className="space-y-4">
          <Card title={<span className="flex items-center gap-2"><Gauge size={16} className="text-teal-dark" /> Digital Readiness Score</span>} subtitle={t("dash.readinessNote")}>
            {readiness && (
              <div>
                <div className="flex items-center gap-3">
                  <p className="text-3xl font-extrabold text-navy">{readiness.score}<span className="text-sm text-slate-400">/100</span></p>
                  <Badge tone={readiness.score >= 70 ? "green" : readiness.score >= 40 ? "amber" : "red"}>{readiness.level}</Badge>
                </div>
                <Progress value={readiness.score} className="mt-3" />
                <div className="mt-3 space-y-1.5">
                  {readiness.breakdown.map((b: any) => (
                    <div key={b.label} className="flex items-center gap-2 text-[11.5px]">
                      <span className="w-44 truncate text-slate-500">{b.label}</span>
                      <Progress value={(b.points / b.max) * 100} className="!h-1 flex-1" />
                      <span className="w-10 text-right font-bold text-slate-500">{b.points}/{b.max}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>

          <Card title={<span className="flex items-center gap-2"><FileText size={16} className="text-teal-dark" /> Your digital adoption plan</span>} subtitle="Generated from your onboarding answers — progressive, one process at a time">
            <p className="whitespace-pre-line text-[13px] leading-relaxed text-slate-600">{biz?.adoptionPlan ?? "No adoption plan yet — complete onboarding."}</p>
          </Card>

          {me?.isDemo && (
            <Card title="Demo controls" className="border-amber-200 bg-amber-50/50">
              <div className="flex flex-wrap items-center gap-3">
                <Badge tone="amber">DEMO MODE</Badge>
                <p className="flex-1 text-xs text-slate-600">{t("settings.resetDemoNote")}</p>
                <Button variant="ghost" disabled={resetting} onClick={resetDemo}>
                  <RotateCcw size={14} className={resetting ? "animate-spin" : ""} /> {t("settings.resetDemo")}
                </Button>
              </div>
            </Card>
          )}
        </div>
      </div>

      <Card
        title="Production workflow template (industry-adaptive)"
        subtitle="Stages used when creating new jobs. Change industry above to load its template, or customise below."
        actions={
          canEdit && (
            <div className="flex gap-2">
              <input className="input !w-52 !py-1.5 !text-xs" placeholder="Add stage…" value={newStage} onChange={(e) => setNewStage(e.target.value)} />
              <Button size="sm" variant="ghost" onClick={() => { if (newStage.trim()) { setF({ ...f, stages: [...f.stages, newStage.trim()] }); setNewStage(""); } }}><Plus size={14} /> Add</Button>
            </div>
          )
        }
      >
        <div className="flex flex-wrap gap-2">
          {f.stages.map((s: string, i: number) => (
            <span key={s} className="chip bg-navy/10 text-navy ring-1 ring-inset ring-navy/20">
              {i + 1}. {s}
              {canEdit && <button type="button" onClick={() => setF({ ...f, stages: f.stages.filter((_: string, j: number) => j !== i) })} className="ml-1 text-slate-400 hover:text-red-500"><X size={11} /></button>}
            </span>
          ))}
        </div>
        <p className="mt-3 flex items-start gap-2 text-[11.5px] text-slate-400"><AlertTriangle size={12} className="mt-0.5 shrink-0" /> Saving settings updates the template for future jobs; existing jobs keep their own stage history.</p>
      </Card>
    </div>
  );
}
