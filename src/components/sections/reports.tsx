"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, BarChart3, RefreshCw } from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api } from "@/lib/api";
import { useLang } from "@/lib/i18n";
import { Badge, Card, Empty, PageHeader, Spinner, fmtDate, statusTone } from "@/components/ui";

const TEAL = "#159B8C";

const TYPES = [
  { id: "daily", label: "Daily production (14 days)" },
  { id: "weekly", label: "Weekly summary (8 weeks)" },
  { id: "monthly", label: "Monthly summary (3 months)" },
  { id: "jobs", label: "Job completion report" },
  { id: "interruptions", label: "Interruption report" },
  { id: "quality", label: "Quality report" },
  { id: "actions", label: "Corrective action report" },
];

export default function ReportsSection() {
  const { t } = useLang();
  const [type, setType] = useState("daily");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    api(`reports?type=${type}`).then((d) => { setData(d); setLoading(false); }).catch(() => setLoading(false));
  }, [type]);
  useEffect(load, [load]);

  const csv = () => window.open(`/api/reports?type=${type}&format=csv`, "_blank");

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("nav.reports")}
        desc="Simple, honest reports built from your records. Export any report as CSV."
        actions={
          <>
            <button className="btn-ghost btn-sm" onClick={load}><RefreshCw size={14} /> {t("common.refresh")}</button>
            <button className="btn-teal btn-sm" onClick={csv}><Download size={14} /> {t("common.exportCsv")}</button>
          </>
        }
      />

      <div className="flex flex-wrap gap-2">
        {TYPES.map((tp) => (
          <button
            key={tp.id}
            onClick={() => setType(tp.id)}
            className={`chip ring-1 ring-inset transition-colors ${type === tp.id ? "bg-navy text-white ring-navy" : "bg-white text-slate-600 ring-slate-200 hover:ring-teal/50"}`}
          >
            {tp.label}
          </button>
        ))}
      </div>

      <Card pad={false}>
        {loading ? <Spinner /> : !data ? <Empty icon={BarChart3} title="Could not load report" /> : <ReportBody type={type} data={data} />}
      </Card>
    </div>
  );
}

function ReportBody({ type, data }: { type: string; data: any }) {
  if (type === "daily" || type === "weekly" || type === "monthly") {
    const rows = data.rows as any[];
    return (
      <div>
        <div className="h-56 border-b border-slate-100 p-4">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={rows.map((r) => ({ label: r[0], a: Number(r[1] ?? 0), b: Number(r[2] ?? 0), c: Number(r[3] ?? 0) }))}>
              <defs>
                <linearGradient id="rg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={TEAL} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={TEAL} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 9.5, fill: "#94A3B8" }} axisLine={false} tickLine={false} interval={1} />
              <YAxis tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #E2E8F0", fontSize: 12 }} />
              <Area type="monotone" dataKey="b" stroke={TEAL} strokeWidth={2} fill="url(#rg)" name="Jobs completed" />
              <Area type="monotone" dataKey="c" stroke="#17365D" strokeWidth={2} fill="none" name="Events" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr>{(data.headers as string[]).map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>{r.map((cell: any, j: number) => <td key={j} className="td text-[13px]">{String(cell)}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }
  if (type === "jobs") {
    return (
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead><tr><th className="th">Code</th><th className="th">Title</th><th className="th">Qty</th><th className="th">Done</th><th className="th">Status</th><th className="th">Stage</th><th className="th">Expected</th><th className="th">Completed</th></tr></thead>
          <tbody>
            {data.jobs.map((j: any) => (
              <tr key={j.id}>
                <td className="td font-mono text-xs font-bold text-navy">{j.code}</td>
                <td className="td">{j.title}</td>
                <td className="td">{j.quantity ?? 0}</td>
                <td className="td">{j.completedQty ?? 0}</td>
                <td className="td"><Badge tone={statusTone(j.status)}>{j.status}</Badge></td>
                <td className="td">{j.currentStage}</td>
                <td className="td text-xs">{fmtDate(j.expectedCompletion)}</td>
                <td className="td text-xs">{fmtDate(j.actualCompletion)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  if (type === "interruptions") {
    return (
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead><tr><th className="th">Category</th><th className="th">Events</th><th className="th">Total minutes</th><th className="th">Verified</th></tr></thead>
          <tbody>
            {data.interruptions.map((i: any) => (
              <tr key={i.category}>
                <td className="td font-semibold text-navy">{i.label}</td>
                <td className="td">{i.count}</td>
                <td className="td">{i.minutes}</td>
                <td className="td">{i.verified}</td>
              </tr>
            ))}
            {data.interruptions.length === 0 && <tr><td className="td" colSpan={4}>No events recorded.</td></tr>}
          </tbody>
        </table>
      </div>
    );
  }
  if (type === "quality") {
    return (
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead><tr>{(data.headers as string[]).map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
          <tbody>
            {(data.records as any[]).map((r) => (
              <tr key={r.id}>
                <td className="td text-xs">{fmtDate(r.createdAt)}</td><td className="td font-mono text-xs">{r.jobId ? "" : ""}</td>
                <td className="td">{r.stage ?? "—"}</td><td className="td">{r.inspected}</td><td className="td">{r.accepted}</td>
                <td className="td text-red-600 font-bold">{r.rejected}</td><td className="td">{r.rework}</td><td className="td">{r.defectCategory ?? "—"}</td><td className="td">{r.notes ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  // actions
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead><tr><th className="th">Created</th><th className="th">Action</th><th className="th">Status</th><th className="th">Priority</th><th className="th">Deadline</th><th className="th">Problem reference</th></tr></thead>
        <tbody>
          {(data.actions as any[]).map((a) => (
            <tr key={a.id}>
              <td className="td text-xs">{fmtDate(a.createdAt)}</td>
              <td className="td font-semibold text-navy">{a.title}</td>
              <td className="td"><Badge tone={statusTone(a.status)}>{a.status}</Badge></td>
              <td className="td"><Badge tone={statusTone(a.priority)}>{a.priority}</Badge></td>
              <td className="td text-xs">{fmtDate(a.deadline)}</td>
              <td className="td text-xs text-slate-400 max-w-56"><span className="line-clamp-2">{a.problemRef ?? "—"}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
