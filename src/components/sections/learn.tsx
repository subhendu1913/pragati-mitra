"use client";

import { useState } from "react";
import { GraduationCap, ChevronDown, QrCode, Factory, Siren, Lightbulb, Bot, FileSpreadsheet, ListChecks, Play } from "lucide-react";
import { useLang } from "@/lib/i18n";
import { Card, PageHeader } from "@/components/ui";
import { toOdia } from "@/lib/odia";
import { INDUSTRIES, industryTemplate } from "@/lib/domain";

const GUIDES = [
  {
    icon: Play,
    title: "Getting started (5 minutes)",
    en: "Sign in or open the demo → pick your business → the Dashboard shows readiness, delayed jobs and top insights. Your onboarding answers created a personalised adoption plan (see Settings).",
    od: "Sign in karantu athaba demo kholantu → apana vyabasaya bachenantu → Dashboard re readiness, bilamba karyya ara top insights dekhay. Apana onboarding uttara ru adoption plan (Settings re dekhantu).",
  },
  {
    icon: Factory,
    title: "How to create a job",
    en: "Production & Jobs → New Job → enter title, product, quantity → pick an industry template (stages are pre-filled and editable) → assign supervisor and workers → set start and expected completion dates. The job gets a code and a QR code.",
    od: "Production & Jobs → Naba karyya → title, product, sankhya likhantu → industry template bachenantu → supervisor ara sramika nirddharita karantu → tarikh set karantu. Karyya ta code ara QR code pay.",
  },
  {
    icon: QrCode,
    title: "How to scan a QR code / open a job as a worker",
    en: "Open the Worker view (sidebar) on any phone → tap “Enter job code” and type/scan the code on the job → tap Start / Pause / Complete on the current stage. Large buttons, minimal typing, works in English and Odia.",
    od: "Kono phone re Worker view kholantu → “Karyya code likhantu” re click karantu → code likhantu/scan karantu → current stage re Start / Pause / Complete tap karantu.",
  },
  {
    icon: Siren,
    title: "How to report a problem",
    en: "Event Centre → Report event (or the quick buttons in Worker view) → choose category (machine breakdown, material shortage, power interruption, delay, quality issue…) → pick job and stage → add duration, quantity affected and a short note. A supervisor verifies it so insights stay reliable.",
    od: "Event Centre → Ghatana report karantu → category bachenantu (yantra bikala, kachamala abhava…) → karyya ara stage bachenantu → samaya ara note add karantu. Supervisor verify karithiba.",
  },
  {
    icon: Lightbulb,
    title: "How to understand Smart Insights",
    en: "Each insight shows: what was observed, the exact records behind it, the period analysed, frequency, a suggested next step, and a reliability warning. Facts are separated from possible explanations — we never claim an unverified root cause. Low data completeness means the pattern is only an early signal.",
    od: "Pratyek insight dekhay: ki dekha haila, kon record adharare, kete dinara, kete bar, ki karyya suggestion, ara reliability warning. Fact ara sambhabya karana alada rakha hay.",
  },
  {
    icon: Bot,
    title: "How to use Pragati AI",
    en: "Open Pragati AI Assistant and ask in simple English or Odia: “Which jobs are delayed?”, “What are my recurring problems?”, “What should I improve first?”. Every answer shows the records and period used. Approve before any action is created. In this prototype the AI is a clearly-labelled rule-based simulation.",
    od: "Pragati AI Assistant kholantu ara sadharana English/Odia re jijnasa karantu. Pratyek uttara kon record use haila seta dekhay. Karyya create karibar purbe approve karantu.",
  },
  {
    icon: FileSpreadsheet,
    title: "How to import existing records (Record Bridge)",
    en: "Record Bridge → upload your Excel/CSV (or paste CSV) → columns are detected and auto-mapped → fix mappings, check the preview → missing-data and duplicate warnings are shown → confirm. Imported rows become real records and feed insights.",
    od: "Record Bridge → Excel/CSV upload karantu → column automatic detect hoy → mapping thik karantu → preview dekhantu → missing/duplicate warning dekhay → confirm karantu.",
  },
  {
    icon: ListChecks,
    title: "How to track corrective actions & improvement",
    en: "Action Tracker → create an action from an insight (or manually) → assign a person, priority and deadline → mark In Progress → when done, add completion notes and a verification result. The improvement history compares event frequency before/after — improvement is only claimed when records show it.",
    od: "Action Tracker → insight ru karyya create karantu → byakti, priority ara deadline assign karantu → sampanna hole note ara verification add karantu. Improvement history before/after compare karay.",
  },
];

export default function LearnSection() {
  const { lang, t } = useLang();
  const [open, setOpen] = useState<number | null>(0);

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("learn.title")}
        desc={lang === "od" ? "Sabu karyya re chhota step-by-step guide — English & Odia re." : "Short step-by-step guides for every task — in English and Odia."}
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-3">
          {GUIDES.map((g, i) => (
            <Card key={g.title} pad={false} className="!rounded-xl overflow-hidden">
              <button onClick={() => setOpen(open === i ? null : i)} className="flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-slate-50">
                <div className="rounded-lg bg-teal-light p-2 text-teal-dark"><g.icon size={16} /></div>
                <span className="flex-1 text-sm font-bold text-navy">{g.title}</span>
                <ChevronDown size={16} className={`text-slate-400 transition-transform ${open === i ? "rotate-180" : ""}`} />
              </button>
              {open === i && (
                <div className="border-t border-slate-100 px-4 py-3.5 text-[13px] leading-relaxed text-slate-600">
                  <p>{lang === "od" ? toOdia(g.od) : g.en}</p>
                </div>
              )}
            </Card>
          ))}
        </div>
        <div className="space-y-4">
          <Card title={<span className="flex items-center gap-2"><GraduationCap size={16} className="text-teal-dark" /> Industry-specific guides</span>}>
            <div className="space-y-3">
              {INDUSTRIES.map((ind) => (
                <div key={ind.id} className="rounded-xl border border-slate-100 p-3.5">
                  <p className="text-[13px] font-bold text-navy">{ind.name}</p>
                  <p className="mt-1 text-xs text-slate-500">Suggested stages: {industryTemplate(ind.id).stages.join(" → ")}</p>
                  <p className="mt-1 text-xs text-slate-500">Watch for: {industryTemplate(ind.id).defects.join(", ")} — record these as defect categories in Quality &amp; Rework.</p>
                </div>
              ))}
            </div>
          </Card>
          <Card title="Tips for low-digital-confidence teams">
            <ul className="list-disc space-y-1.5 pl-4 text-[13px] text-slate-600">
              <li>Start with one phone: the Worker view needs no training beyond three buttons.</li>
              <li>Switch the language to Odia anytime from the top bar.</li>
              <li>You never need to re-enter old data — import it once via Record Bridge.</li>
              <li>If data looks incomplete, the Data Completeness indicator on the Dashboard tells you what is missing.</li>
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
