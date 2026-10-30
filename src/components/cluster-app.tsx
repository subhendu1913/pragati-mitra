"use client";

import { useCallback, useEffect, useState } from "react";
import { Network, Building2, Gauge, GraduationCap, AlertTriangle, Activity, Download, LifeBuoy, BarChart3, Siren } from "lucide-react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api } from "@/lib/api";
import { useLang } from "@/lib/i18n";
import { Badge, Card, Empty, PageHeader, Progress, Spinner, Stat } from "@/components/ui";
import { AppShell } from "@/components/shell";

const NAVY = "#17365D";
const TEAL = "#159B8C";

export default function ClusterApp() {
  const { t } = useLang();
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    api("cluster").then(setData).catch((e) => setError((e as Error).message));
  }, []);
  useEffect(load, [load]);

  if (!data) return error ? <Empty title={error} /> : <Spinner />;
  const { totals, businesses, challenges, weekly, byIndustry } = data;
  const needHelp = businesses.filter((b: any) => b.needsAssistance);

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("cluster.title")}
        desc={t("cluster.note")}
        actions={<a className="btn-teal btn-sm" href="/api/reports?type=cluster&format=csv"><Download size={14} /> {t("common.exportCsv")}</a>}
      />

      <Card className="border-teal/20 bg-teal-light/40">
        <p className="flex items-start gap-2 text-[13px] text-teal-dark"><Siren size={16} className="mt-0.5 shrink-0" /> {t("cluster.note")}</p>
      </Card>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label={t("cluster.members")} value={totals.businesses} icon={Building2} tone="navy" hint={`${totals.active} active`} />
        <Stat label="Avg readiness" value={`${totals.avgReadiness}/100`} icon={Gauge} tone="teal" hint={`${totals.onboarded} onboarded`} />
        <Stat label={t("cluster.training")} value={`${totals.avgTraining}%`} icon={GraduationCap} tone="navy" />
        <Stat label={t("cluster.needsHelp")} value={totals.needingAssistance} icon={AlertTriangle} tone={totals.needingAssistance > 0 ? "red" : "grey"} />
        <Stat label="Industries" value={Object.keys(byIndustry).length} icon={Network} tone="grey" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title={<span className="flex items-center gap-2"><Siren size={16} className="text-teal-dark" /> {t("cluster.challenges")}</span>} subtitle="Aggregated event counts across participating MSMEs (no individual factory records)">
          {challenges.length === 0 ? <Empty icon={Siren} title="No challenges reported yet" /> : (
            <>
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={challenges} layout="vertical" margin={{ left: 10, right: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <YAxis type="category" dataKey="label" width={140} tick={{ fontSize: 10.5, fill: "#475569" }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #E2E8F0", fontSize: 12 }} />
                    <Bar dataKey="count" fill={NAVY} radius={[0, 6, 6, 0]} name="Reports across cluster" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              {challenges[0] && (
                <p className="mt-3 rounded-xl bg-amber-50 px-3.5 py-2.5 text-[13px] text-amber-800">
                  <b>Cluster radar:</b> “{challenges[0].label}” is the most frequently reported challenge across participating businesses ({challenges[0].count} reports) — consider a shared training or bulk-purchase support session.
                </p>
              )}
            </>
          )}
        </Card>

        <Card title={<span className="flex items-center gap-2"><BarChart3 size={16} className="text-teal-dark" /> {t("cluster.trend")}</span>} subtitle="Sum of completed quantity across the cluster, per week">
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={weekly} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="cw" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={TEAL} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={TEAL} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                <XAxis dataKey="week" tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #E2E8F0", fontSize: 12 }} />
                <Area type="monotone" dataKey="completedQty" stroke={TEAL} strokeWidth={2.5} fill="url(#cw)" name="Units completed (cluster)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {Object.entries(byIndustry).map(([k, v]) => <Badge key={k} tone="navy">{k}: {v as number}</Badge>)}
          </div>
        </Card>
      </div>

      <Card pad={false} title={t("cluster.members")} subtitle="Authorised per-business summaries — click nothing into raw records; only aggregates are shared">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="th">Business</th><th className="th">Industry</th><th className="th">Location</th>
                <th className="th">Status</th><th className="th">Readiness</th><th className="th">Training</th>
                <th className="th">Jobs</th><th className="th">Top challenge</th><th className="th">Onboarding</th><th className="th">Needs help</th>
              </tr>
            </thead>
            <tbody>
              {businesses.map((b: any) => (
                <tr key={b.id} className="hover:bg-slate-50/60">
                  <td className="td font-bold text-navy">{b.name}{b.isDemo && <Badge tone="amber">demo</Badge>}</td>
                  <td className="td text-xs">{b.industry === "other" ? b.customIndustry ?? "Other" : b.industry}</td>
                  <td className="td text-xs text-slate-400">{b.location ?? "—"}</td>
                  <td className="td">{b.active ? <Badge tone="green">active</Badge> : <Badge tone="grey">inactive</Badge>}</td>
                  <td className="td w-36"><div className="flex items-center gap-2"><Progress value={b.readiness} /><span className="text-xs font-bold">{b.readiness}</span></div></td>
                  <td className="td w-28"><Progress value={b.training ?? 0} /><span className="text-xs font-bold">{b.training ?? 0}%</span></td>
                  <td className="td">{b.jobs} <span className="text-[10px] text-slate-400">({b.activeJobs} open)</span></td>
                  <td className="td text-xs">{b.topChallenge ? `${b.topChallenge.label} (${b.topChallenge.count})` : "—"}</td>
                  <td className="td">{b.onboardingDone ? <Badge tone="green">done</Badge> : <Badge tone="amber">pending</Badge>}</td>
                  <td className="td">{b.needsAssistance ? <Badge tone="red">yes</Badge> : <Badge tone="grey">no</Badge>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div id="support" className="grid gap-4 lg:grid-cols-2">
        <Card title={<span className="flex items-center gap-2"><LifeBuoy size={16} className="text-teal-dark" /> {t("cluster.needsHelp")}</span>} subtitle="Low readiness or many unverified events → suggest training / onboarding help">
          {needHelp.length === 0 ? <Empty icon={LifeBuoy} title="All businesses look on track" text="Keep monitoring weekly." /> : (
            <div className="space-y-2.5">
              {needHelp.map((b: any) => (
                <div key={b.id} className="rounded-xl border border-amber-100 bg-amber-50/50 p-3.5">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-navy">{b.name}</p>
                    <Badge tone="red">readiness {b.readiness}/100</Badge>
                    <Badge tone="amber">training {b.training}%</Badge>
                    {b.unverified > 0 && <Badge tone="amber">{b.unverified} unverified events</Badge>}
                  </div>
                  <p className="mt-1.5 text-xs text-slate-600">
                    Suggested support: run the 5-minute getting-started guide (Learning Centre), help import existing records via Record Bridge, and have a supervisor verify pending events.
                  </p>
                </div>
              ))}
            </div>
          )}
        </Card>
        <Card id="reports" title="Cluster-level reports" subtitle="Aggregated only — CSV export for reviews and support planning">
          <div className="space-y-2.5 text-[13px] text-slate-600">
            <p>• Participating MSMEs and active/inactive status — table above.</p>
            <p>• Digital adoption (readiness) and training completion — above.</p>
            <p>• Common operational challenges — Challenge Radar above.</p>
            <p>• Aggregated productivity trend — weekly chart above.</p>
            <p>• Onboarding progress — {totals.onboarded}/{totals.businesses} businesses completed.</p>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <a className="btn-primary btn-sm" href="/api/reports?type=cluster&format=csv"><Download size={14} /> Cluster summary (CSV)</a>
            <a className="btn-ghost btn-sm" href="/api/reports?type=weekly&format=csv"><Download size={14} /> Weekly summary (CSV)</a>
            <a className="btn-ghost btn-sm" href="/api/reports?type=interruptions&format=csv"><Download size={14} /> Interruption report (CSV)</a>
          </div>
          <p className="mt-3 text-[11px] text-slate-400">Ask the Pragati AI (in the app) cluster questions like “Which businesses need training?” — answers use aggregated data only.</p>
        </Card>
      </div>
    </div>
  );
}

export function ClusterPage() {
  return (
    <AppShell>
      <ClusterApp />
    </AppShell>
  );
}
