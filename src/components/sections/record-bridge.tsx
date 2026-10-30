"use client";

import { useCallback, useEffect, useState } from "react";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { Upload, FileSpreadsheet, ArrowRight, AlertTriangle, CheckCircle2, RefreshCw, Database, X, Wand2 } from "lucide-react";
import { api } from "@/lib/api";
import { useLang } from "@/lib/i18n";
import { Badge, Button, Card, Empty, PageHeader, Spinner, fmtDateTime } from "@/components/ui";

type Row = Record<string, string>;

const TARGETS = [
  { id: "jobs", label: "Jobs / orders", fields: ["code", "title", "product", "quantity", "status", "plannedStart", "date", "expectedCompletion"] },
  { id: "events", label: "Operational events", fields: ["date", "startTime", "category", "stage", "jobCode", "description", "durationMinutes", "qtyAffected"] },
  { id: "quality", label: "Quality inspections", fields: ["date", "jobCode", "stage", "inspected", "accepted", "rejected", "rework", "defectCategory", "notes"] },
];

export default function RecordBridgeSection() {
  const { t } = useLang();
  const [step, setStep] = useState(1);
  const [fileName, setFileName] = useState("");
  const [columns, setColumns] = useState<string[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [target, setTarget] = useState("jobs");
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [result, setResult] = useState<any>(null);
  const [imports, setImports] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);

  const loadImports = useCallback(() => {
    api("imports").then((d) => setImports(d.imports)).catch(() => {});
  }, []);
  useEffect(loadImports, [loadImports]);

  const parseFile = (file: File) => {
    setError("");
    setResult(null);
    const name = file.name;
    setFileName(name);
    if (/\.xlsx?$/i.test(name)) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const wb = XLSX.read(e.target?.result, { type: "array" });
          const ws = wb.Sheets[wb.SheetNames[0]];
          const json = XLSX.utils.sheet_to_json<Row>(ws, { defval: "" });
          ingest(json);
        } catch {
          setError("Could not read this Excel file. Please export it as CSV and try again.");
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      Papa.parse<Row>(file, {
        header: true,
        skipEmptyLines: true,
        complete: (res) => ingest(res.data),
        error: () => setError("Could not parse this file as CSV."),
      });
    }
  };

  const ingest = (json: Row[]) => {
    if (!json.length) return setError("No data rows found in the file.");
    const cols = Object.keys(json[0]);
    setColumns(cols);
    setRows(json.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, String(v ?? "").trim()]))));
    setStep(2);
    // auto-map columns by fuzzy name matching
    const fields = TARGETS[0].fields;
    const auto: Record<string, string> = {};
    for (const c of cols) {
      const lc = c.toLowerCase();
      const hit = fields.find((f) => lc.includes(f.toLowerCase()) || f.toLowerCase().includes(lc)) ??
        ["date", "order", "code", "product", "qty", "quantity", "status", "title", "name"].find((f) => lc.includes(f));
      auto[c] = hit ?? "__skip";
    }
    setMapping(auto);
  };

  const useSample = () => {
    const sample: Row[] = [
      { Date: "2026-10-02", Order: "SMP-201", Product: "MS gate 3x2m", Qty: "8", Status: "active" },
      { Date: "2026-10-06", Order: "SMP-202", Product: "Window grill", Qty: "20", Status: "active" },
      { Date: "2026-10-12", Order: "SMP-203", Product: "Shed frame", Qty: "2", Status: "completed" },
      { Date: "2026-10-18", Order: "SMP-201", Product: "MS gate 3x2m", Qty: "8", Status: "active" },
      { Date: "2026-10-21", Order: "SMP-204", Product: "Machine guard", Qty: "12", Status: "" },
    ];
    setFileName("sample_register.csv");
    setError("");
    setResult(null);
    ingest(sample);
  };

  const onPaste = (text: string) => {
    if (!text.trim()) return;
    setFileName("pasted-data.csv");
    const res = Papa.parse<Row>(text, { header: true, skipEmptyLines: true });
    ingest(res.data.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, String(v ?? "").trim()]))));
  };

  // validation preview
  const fieldOf = (col: string) => mapping[col] ?? "__skip";
  const mappedRows = rows.map((r) => {
    const o: Row = {};
    for (const c of columns) if (fieldOf(c) !== "__skip") o[fieldOf(c)] = r[c] ?? "";
    return o;
  });
  const requiredForTarget = target === "jobs" ? ["title"] : target === "events" ? ["description"] : ["inspected"];
  const dupCount = target === "jobs" ? mappedRows.filter((r, i) => r.code && mappedRows.findIndex((x) => x.code === r.code) !== i).length : 0;
  const missingCount = mappedRows.filter((r) => requiredForTarget.some((f) => !r[f])).length;

  const confirmImport = async () => {
    setBusy(true);
    setError("");
    try {
      const d = await api("imports", {
        method: "POST",
        body: { fileName, target, mapping, rows: rows.map((r) => Object.fromEntries(columns.map((c) => [c, r[c] ?? ""]))) },
      });
      setResult(d);
      setStep(4);
      loadImports();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setStep(1);
    setFileName("");
    setColumns([]);
    setRows([]);
    setMapping({});
    setResult(null);
    setError("");
  };

  const targetFields = TARGETS.find((x) => x.id === target)?.fields ?? [];

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("nav.recordBridge")}
        desc="Bring your existing paper-register exports, Excel or CSV files into Pragati Mitra. Preview, map columns, catch missing data and duplicates — then confirm."
      />

      {/* steps indicator */}
      <div className="flex items-center gap-2 text-xs font-bold">
        {["1. Upload file", "2. Map columns & preview", "3. Confirm import", "4. Done"].map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <span className={`chip ring-1 ring-inset ${step > i + 1 ? "bg-green-50 text-green-700 ring-green-600/20" : step === i + 1 ? "bg-navy text-white ring-navy" : "bg-white text-slate-400 ring-slate-200"}`}>
              {step > i + 1 ? <CheckCircle2 size={11} /> : i + 1} {s}
            </span>
            {i < 3 && <ArrowRight size={12} className="text-slate-300" />}
          </div>
        ))}
      </div>

      {error && <div className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</div>}

      {step === 1 && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card title="Upload Excel (.xlsx) or CSV" subtitle="The first sheet / all columns are read automatically.">
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files?.[0]; if (f) parseFile(f); }}
              className={`flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-10 text-center transition-colors ${dragOver ? "border-teal bg-teal-light/40" : "border-slate-200 bg-cream/60"}`}
            >
              <Upload size={28} className="text-teal-dark" />
              <p className="mt-3 text-sm font-bold text-navy">Drop a file here, or</p>
              <label className="btn-teal btn-sm mt-3 cursor-pointer">
                <FileSpreadsheet size={14} /> Choose file
                <input type="file" accept=".csv,.xlsx,.xls,text/csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) parseFile(f); }} />
              </label>
              <p className="mt-3 text-[11px] text-slate-400">Tip: in Excel use File → Save As → CSV. Paper registers can be typed into a sheet first.</p>
              <button type="button" className="btn-ghost btn-sm mt-3" onClick={useSample}>
                <Wand2 size={13} /> No file handy? Use a sample CSV
              </button>
            </div>
            <div className="mt-4">
              <p className="label">…or paste CSV text directly</p>
              <Paster onPaste={onPaste} />
            </div>
          </Card>
          <Card title="What happens next">
            <ul className="space-y-2.5 text-[13px] text-slate-600">
              <li className="flex gap-2"><Wand2 size={15} className="mt-0.5 shrink-0 text-teal-dark" /> Columns are detected automatically and suggested mappings are pre-filled.</li>
              <li className="flex gap-2"><AlertTriangle size={15} className="mt-0.5 shrink-0 text-amber-500" /> Rows with missing required fields are flagged, and duplicate job codes are warned about — nothing is imported silently.</li>
              <li className="flex gap-2"><CheckCircle2 size={15} className="mt-0.5 shrink-0 text-green-600" /> After you confirm, records become real jobs / events / inspections in your business and feed Smart Insights.</li>
              <li className="flex gap-2"><Database size={15} className="mt-0.5 shrink-0 text-navy" /> Every import is logged below with its mapping, so you can audit or re-run it.</li>
            </ul>
          </Card>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <Card title={`Map columns — ${fileName} (${rows.length} rows)`} subtitle={'Choose what each column means. "Skip" ignores the column.'} actions={<Button size="sm" variant="ghost" onClick={reset}><X size={13} /> Start over</Button>}>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-slate-500">Import as:</span>
              {TARGETS.map((tg) => (
                <button key={tg.id} onClick={() => setTarget(tg.id)} className={`chip ring-1 ring-inset ${target === tg.id ? "bg-teal text-white ring-teal" : "bg-white text-slate-600 ring-slate-200"}`}>{tg.label}</button>
              ))}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead><tr><th className="th">File column</th><th className="th">Maps to</th><th className="th">Sample value</th></tr></thead>
                <tbody>
                  {columns.map((c) => (
                    <tr key={c}>
                      <td className="td font-mono text-xs font-bold text-navy">{c}</td>
                      <td className="td">
                        <select className="input !w-52 !py-1.5 !text-xs" value={fieldOf(c)} onChange={(e) => setMapping({ ...mapping, [c]: e.target.value })}>
                          <option value="__skip">— skip —</option>
                          {targetFields.map((f) => <option key={f} value={f}>{f}</option>)}
                        </select>
                      </td>
                      <td className="td max-w-40 truncate text-xs text-slate-400">{rows[0]?.[c] ?? ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Badge tone={missingCount ? "amber" : "green"}><AlertTriangle size={11} /> {missingCount} row(s) missing required field(s)</Badge>
              <Badge tone={dupCount ? "amber" : "green"}>{dupCount} duplicate code(s) will be skipped</Badge>
              <span className="ml-auto" />
              <Button variant="ghost" onClick={reset}>Back</Button>
              <Button variant="teal" onClick={() => setStep(3)}>Review &amp; confirm <ArrowRight size={14} /></Button>
            </div>
          </Card>
          <Card title="Preview (first 8 rows after mapping)">
            {rows.length === 0 ? <Spinner /> : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead><tr>{columns.slice(0, 8).map((c) => <th key={c} className="th">{c}</th>)}</tr></thead>
                  <tbody>
                    {rows.slice(0, 8).map((r, i) => (
                      <tr key={i}>{columns.slice(0, 8).map((c) => <td key={c} className="td text-xs">{r[c]}</td>)}</tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}

      {step === 3 && (
        <Card title="Confirm import" subtitle={`${fileName} → ${TARGETS.find((x) => x.id === target)?.label} • ${rows.length} rows`}>
          <div className="space-y-2 text-sm text-slate-600">
            <p>• <b>{rows.length - missingCount - dupCount}</b> rows will be imported.</p>
            <p>• <b>{missingCount}</b> row(s) skipped — missing required field ({requiredForTarget.join(", ")}).</p>
            <p>• <b>{dupCount}</b> duplicate row(s) skipped.</p>
            <p className="text-xs text-slate-400">You can fix the file and re-import; duplicates are detected against existing records.</p>
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setStep(2)}>Back</Button>
            <Button variant="teal" disabled={busy} onClick={confirmImport}>{busy ? "Importing…" : <><CheckCircle2 size={14} /> Confirm import</>}</Button>
          </div>
        </Card>
      )}

      {step === 4 && result && (
        <Card title="Import complete">
          <div className="flex flex-wrap items-center gap-3">
            <CheckCircle2 size={22} className="text-green-600" />
            <p className="text-sm font-bold text-navy">
              Imported {result.summary.imported} of {result.summary.rows} rows
              {result.summary.duplicates > 0 && ` • ${result.summary.duplicates} duplicate(s) skipped`}
              {result.summary.missing > 0 && ` • ${result.summary.missing} missing-data row(s) skipped`}
            </p>
          </div>
          <p className="mt-2 text-xs text-slate-500">The imported records are now part of your business data and will appear in Production & Jobs / Event Centre / Quality and in Smart Insights.</p>
          <div className="mt-4"><Button variant="primary" onClick={reset}>Import another file</Button></div>
        </Card>
      )}

      <Card
        title="Import history"
        actions={<button className="btn-ghost btn-sm" onClick={loadImports}><RefreshCw size={14} /> {t("common.refresh")}</button>}
      >
        {imports.length === 0 ? <Empty icon={Database} title="No imports yet" text="Upload your first register export above." /> : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr><th className="th">File</th><th className="th">Target</th><th className="th">Rows</th><th className="th">Imported</th><th className="th">Duplicates</th><th className="th">Missing</th><th className="th">Status</th><th className="th">When</th></tr></thead>
              <tbody>
                {imports.map((im) => (
                  <tr key={im.id}>
                    <td className="td font-mono text-xs font-bold text-navy">{im.fileName}</td>
                    <td className="td">{im.target}</td>
                    <td className="td">{im.rowCount}</td>
                    <td className="td font-bold text-teal-dark">{im.importedCount}</td>
                    <td className="td">{im.duplicates > 0 ? <Badge tone="amber">{im.duplicates}</Badge> : im.duplicates}</td>
                    <td className="td">{im.missing > 0 ? <Badge tone="amber">{im.missing}</Badge> : im.missing}</td>
                    <td className="td"><Badge tone={im.status === "completed" ? "green" : im.status === "partial" ? "amber" : "red"}>{im.status}</Badge></td>
                    <td className="td text-xs text-slate-400 whitespace-nowrap">{fmtDateTime(im.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function Paster({ onPaste }: { onPaste: (t: string) => void }) {
  const [text, setText] = useState("");
  return (
    <div>
      <textarea className="input min-h-24 font-mono !text-xs" placeholder={"Date,Order,Product,Qty,Status\n2026-01-05,OMW-101,Gate,20,completed"} value={text} onChange={(e) => setText(e.target.value)} />
      <Button size="sm" variant="ghost" className="mt-2" onClick={() => { onPaste(text); setText(""); }}>Parse pasted CSV</Button>
    </div>
  );
}
