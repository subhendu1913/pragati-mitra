"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Factory, AlertTriangle, Siren, ShieldAlert, Ban, RefreshCw, Lightbulb, ArrowRight, Gauge, TrendingUp,
} from "lucide-react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api } from "@/lib/api";
import { useLang } from "@/lib/i18n";
import { Badge, Card, Empty, PageHeader, Progress, Spinner, Stat, fmtDateTime, reliabilityTone, statusTone } from "@/components/ui";

const NAVY = "#17365D";
const TEAL = "#159B8C";

export default function DashboardSection() {
  const { t } = useLang();
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");
  const load = useCallback(() => {
    setError("");
    api("dashboard")
      .then(setData)
      .catch((e) => setError((e as Error).message));
  }, []);
  useEffect(load, [load]);

  if (!data) {
    return error ? (
      <div className="card p-8 text-center">
        <p className="text-sm font-semibold text-red-600">{error}</p>
        <button className="btn-primary btn-sm mt-3" onClick={load}>{t("common.retry")}</button>
      </div>
    ) : (
      <Spinner />
    );
  }
  const { stats, readiness, nextSteps, completeness, insights } = data;
  void 0;

  const ring = 2 * Math.PI * 34;
  const pct = readiness.score;

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("nav.dashboard")}
        desc="Overall view of production, problems, quality and digital adoption."
        actions={<button className="btn-ghost btn-sm" onClick={load}><RefreshCw size={14} /> {t("common.refresh")}</button>}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label={t("dash.activeJobs")} value={stats.counts.active} icon={Factory} tone="teal" hint={`${stats.counts.total} total`} />
        <Stat label={t("dash.delayed")} value={stats.counts.delayed} icon={AlertTriangle} tone={stats.counts.delayed > 0 ? "red" : "grey"} />
        <Stat label={t("dash.completed")} value={stats.counts.completed} icon={TrendingUp} tone="navy" />
        <Stat label={t("dash.events7d")} value={stats.eventsLast7d} icon={Siren} tone="amber" />
        <Stat label={t("dash.unverified")} value={stats.unverifiedEvents} icon={ShieldAlert} tone={stats.unverifiedEvents > 0 ? "red" : "grey"} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Readiness */}
        <Card title={t("dash.readiness")} subtitle={t("dash.readinessNote")}>
          <div className="flex items-center gap-4">
            <div className="relative h-24 w-24 shrink-0">
              <svg viewBox="0 0 80 80" className="h-24 w-24 -rotate-90">
                <circle cx="40" cy="40" r="34" fill="none" stroke="#E2E8F0" strokeWidth="9" />
                <circle cx="40" cy="40" r="34" fill="none" stroke={TEAL} strokeWidth="9" strokeLinecap="round" strokeDasharray={ring} strokeDashoffset={ring * (1 - pct / 100)} />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-xl font-extrabold text-navy">{pct}</span>
                <span className="text-[9px] font-bold text-slate-400">/100</span>
              </div>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-navy">{readiness.level}</p>
              <div className="mt-2 space-y-1.5">
                {readiness.breakdown.slice(0, 4).map((b: any) => (
                  <div key={b.label}>
                    <div className="flex justify-between text-[10.5px] text-slate-500"><span className="truncate">{b.label}</span><span className="font-bold">{b.points}/{b.max}</span></div>
                    <Progress value={(b.points / b.max) * 100} className="!h-1" />
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="mt-4 border-t border-slate-100 pt-3">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{t("dash.nextSteps")}</p>
            <ol className="mt-2 space-y-1.5">
              {nextSteps.map((s: string, i: number) => (
                <li key={i} className="flex gap-2 text-[13px] text-slate-600"><span className="font-bold text-teal-dark">{i + 1}.</span>{s}</li>
              ))}
            </ol>
          </div>
        </Card>

        {/* Weekly production */}
        <Card title={t("dash.weekly")} className="lg:col-span-2">
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.weekly} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="wk" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={TEAL} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={TEAL} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                <XAxis dataKey="week" tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #E2E8F0", fontSize: 12 }} />
                <Area type="monotone" dataKey="completedQty" stroke={TEAL} strokeWidth={2.5} fill="url(#wk)" name="Units completed" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 border-t border-slate-100 pt-3 text-center">
            <div><p className="text-[10px] font-bold uppercase text-slate-400">{t("dash.quality")}</p><p className="text-sm font-extrabold text-navy">{stats.quality.rejectRate}% reject</p></div>
            <div><p className="text-[10px] font-bold uppercase text-slate-400">Rejected</p><p className="text-sm font-extrabold text-red-600">{stats.quality.rejected}</p></div>
            <div><p className="text-[10px] font-bold uppercase text-slate-400">Rework</p><p className="text-sm font-extrabold text-amber-600">{stats.quality.rework}</p></div>
          </div>
        </Card>
      </div>

      {/* completeness banner */}
      <Card>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Gauge size={18} className="text-teal-dark" />
            <div>
              <p className="text-sm font-bold text-navy">{t("dash.completeness")}: {completeness.score}/100 — {completeness.label}</p>
              <p className="text-xs text-slate-500">{completeness.counts.jobs} jobs • {completeness.counts.events} events ({completeness.counts.verifiedEvents} verified) • {completeness.counts.quality} inspections • {completeness.counts.actions} actions • {completeness.counts.imports} imports</p>
            </div>
          </div>
          <div className="ml-auto w-full sm:w-64"><Progress value={completeness.score} /></div>
        </div>
        {completeness.warnings.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {completeness.warnings.map((w: string) => <Badge key={w} tone="amber">{w}</Badge>)}
          </div>
        )}
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title={t("dash.eventsCat")}>
          {stats.eventsByCategory.length === 0 ? <Empty icon={Siren} title="No events recorded in the last 30 days" /> : (
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.eventsByCategory} layout="vertical" margin={{ left: 10, right: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <YAxis type="category" dataKey="label" width={130} tick={{ fontSize: 10.5, fill: "#475569" }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #E2E8F0", fontSize: 12 }} />
                  <Bar dataKey="count" fill={NAVY} radius={[0, 6, 6, 0]} name="Events" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        <Card title={<span className="flex items-center gap-2"><Lightbulb size={16} className="text-teal-dark" /> Top insights</span>} actions={<Link href="/app/insights" className="btn-ghost btn-sm">All insights <ArrowRight size={13} /></Link>}>
          <div className="space-y-3">
            {insights.length === 0 && <Empty icon={Lightbulb} title="Not enough records yet" text="Record jobs, events and inspections — insights appear automatically." />}
            {insights.map((i: any) => (
              <div key={i.id} className="rounded-xl border border-slate-100 bg-cream/60 p-3">
                <div className="flex items-center gap-2">
                  <Badge tone={statusTone(i.severity)}>{i.severity}</Badge>
                  <p className="text-[13px] font-bold text-navy">{i.title}</p>
                  <span className="ml-auto"><Badge tone={reliabilityTone(i.reliability)}>{i.reliability}</Badge></span>
                </div>
                <p className="mt-1.5 text-xs leading-relaxed text-slate-600">{i.observation}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title={t("dash.delayedJobs")}>
          {stats.delayedJobs.length === 0 ? <Empty icon={Factory} title="No delayed jobs right now" /> : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead><tr><th className="th">Job</th><th className="th">Stage</th><th className="th">Overdue</th></tr></thead>
                <tbody>
                  {stats.delayedJobs.map((j: any) => (
                    <tr key={j.code}>
                      <td className="td"><Link href="/app/production" className="font-bold text-navy hover:underline">{j.code}</Link><div className="text-[11px] text-slate-400">{j.title}</div></td>
                      <td className="td">{j.stage}</td>
                      <td className="td"><Badge tone="red">{j.daysOverdue}d</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
        <Card title={t("dash.recentEvents")} actions={<Link href="/app/events" className="btn-ghost btn-sm">Event Centre <ArrowRight size={13} /></Link>}>
          {stats.recentEvents.length === 0 ? <Empty icon={Siren} title="No events yet" /> : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead><tr><th className="th">Category</th><th className="th">Job</th><th className="th">Stage</th><th className="th">By</th><th className="th">Status</th></tr></thead>
                <tbody>
                  {stats.recentEvents.map((e: any) => (
                    <tr key={e.id}>
                      <td className="td font-semibold text-navy">{t(`worker.cat.${e.category}`)}</td>
                      <td className="td">{e.jobCode ?? "—"}</td>
                      <td className="td">{e.stage ?? "—"}</td>
                      <td className="td">{e.reporterName ?? "—"}</td>
                      <td className="td">{e.verified ? <Badge tone="green">{t("events.verified")}</Badge> : <Badge tone="amber">{t("events.unverified")}</Badge>} <span className="ml-1 text-[11px] text-slate-400">{fmtDateTime(e.createdAt)}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
