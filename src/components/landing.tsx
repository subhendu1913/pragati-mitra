"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Sprout,
  ArrowRight,
  Play,
  Bot,
  Lightbulb,
  FileSpreadsheet,
  QrCode,
  Siren,
  Gauge,
  ListChecks,
  Network,
  GraduationCap,
  Factory,
  PlugZap,
  HandCoins,
  Warehouse,
  ChevronDown,
  CheckCircle2,
  ShieldCheck,
  Smartphone,
  IndianRupee,
  Link2,
} from "lucide-react";
import { api } from "@/lib/api";
import { INDUSTRIES } from "@/lib/domain";
import { useLang } from "@/lib/i18n";

const DEMO_BIZ = [
  { slug: "odisha-metal-works", name: "Odisha Metal Works", industry: "Fabrication", icon: Factory, loc: "Cuttack, Odisha", desc: "Welding & metal fabrication workshop — paper registers, machine downtime patterns." },
  { slug: "utkal-electrical", name: "Utkal Electrical Systems", industry: "Electrical machinery", icon: PlugZap, loc: "Bhubaneswar, Odisha", desc: "Panels & pump assembly — Excel records, testing failures, component shortages." },
  { slug: "odisha-handloom", name: "Odisha Handloom Cooperative", industry: "Handloom", icon: Warehouse, loc: "Sambalpur, Odisha", desc: "Weaving cluster — yarn shortages, loom downtime, weaving defects." },
  { slug: "pragati-engineering", name: "Pragati Engineering Works", industry: "Other manufacturing", icon: HandCoins, loc: "Khordha, Odisha", desc: "Custom machinery — WhatsApp coordination, no standard process yet." },
];

const STEPS = [
  { icon: Link2, title: "Connect your existing records", text: "Import your paper register or Excel through Record Bridge — column mapping, duplicate and missing-data warnings included." },
  { icon: Factory, title: "Track production stage-by-stage", text: "Create jobs with industry-specific stages. Workers update progress by scanning a QR code — no complex menus." },
  { icon: Siren, title: "Report events in one tap", text: "Machine breakdown, material shortage, power cut… recorded with time, stage and quantity, then verified by the supervisor." },
  { icon: Lightbulb, title: "Act on explainable insights", text: "Smart Insights show recurring patterns with the exact records behind them, a suggested action and a reliability warning. Assign corrective actions and measure if the problem reduces." },
];

const FEATURES = [
  { icon: Bot, title: "Pragati AI copilot", text: "Ask \"Which jobs are delayed?\" or \"What should I improve first?\" — answers use only your authorised records, show the period and records used, and never invent figures. English & Odia." },
  { icon: Lightbulb, title: "Explainable Smart Insights", text: "Every insight shows what was observed, which records support it, the period, frequency, a suggested next step and a data-completeness warning. Facts are separated from possible causes." },
  { icon: FileSpreadsheet, title: "Record Bridge", text: "Bring Excel/CSV registers in with file preview, automatic column detection, field mapping, missing-data detection and duplicate-row warnings." },
  { icon: QrCode, title: "QR-based worker reporting", text: "Each job gets a QR code. Workers scan it and tap Start / Pause / Complete or report a problem — large buttons, minimal typing." },
  { icon: Gauge, title: "Digital Readiness Score", text: "A practical score based on real feature usage, record completeness, process coverage and training — with guided next-best-step recommendations." },
  { icon: ListChecks, title: "Action Tracker & improvement loop", text: "Record → Analyse → Verify → Assign action → Measure improvement. See whether a problem actually occurred less afterwards." },
  { icon: Network, title: "Cluster support", text: "Cluster supervisors monitor multiple MSMEs with aggregated, authorised information: readiness, training, common challenges and businesses needing help." },
  { icon: GraduationCap, title: "Learning Centre (EN / Odia)", text: "Short guides for every task — create a job, scan a QR, report a problem, read insights, use Pragati AI." },
];

const FAQS = [
  { q: "Is Pragati Mitra another ERP or accounting software?", a: "No. Pragati Mitra does not ask you to replace your systems. It connects the records you already keep (paper registers, Excel), captures operational events, finds recurring problems and helps you act on them — one process at a time." },
  { q: "Do we need computers, sensors or paid tools to start?", a: "No. You can start with a single phone or computer. QR-based reporting works from any smartphone browser. There are no IoT devices, no mandatory paid services and no API keys required for the demo." },
  { q: "Who can see our business data?", a: "Only users of your own business, with role-based permissions. Cluster supervisors see aggregated, authorised summaries only — never individual factory records. In this prototype all demo data is fictional." },
  { q: "Is the AI reliable?", a: "In this prototype Pragati AI is a clearly-labelled rule-based assistant that answers from your own records and always shows the records and period used. It flags missing data instead of inventing figures, and asks for approval before creating actions. The structure is ready for a real AI API later." },
  { q: "Does it work for my industry?", a: "Yes — ready-made stage templates exist for fabrication workshops, electrical machinery units and handloom/textile units, and any other small manufacturer can configure custom stages. Defect categories are customisable too." },
  { q: "Is Pragati Mitra affiliated with the government?", a: "No. Pragati Mitra is an independent hackathon prototype. No official government partnership, approval or endorsement is claimed." },
];

function IndustryIcon({ id }: { id: string }) {
  const I = id === "fabrication" ? Factory : id === "electrical" ? PlugZap : id === "handloom" ? Warehouse : HandCoins;
  return <I size={20} />;
}

export default function Landing() {
  const router = useRouter();
  const { lang, setLang, t } = useLang();
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [busy, setBusy] = useState<string | null>(null);

  const openDemo = async (slug?: string, mode?: string) => {
    setBusy(slug ?? mode ?? "");
    try {
      // Guest mode: no account, no password — just a demo cookie pointing at fictional data.
      await api("auth", { method: "POST", body: mode === "cluster" ? { action: "guest", mode: "cluster" } : { action: "guest", slug } });
      router.push(mode === "cluster" ? "/cluster" : "/app/dashboard");
    } catch (e) {
      alert((e as Error).message);
      setBusy(null);
    }
  };

  return (
    <div className="min-h-screen bg-cream">
      {/* Nav */}
      <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 sm:px-6 py-3">
          <Link href="/" className="flex items-center gap-2.5" aria-label="Pragati Mitra home">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal text-white">
              <Sprout size={20} />
            </div>
            <div>
              <p className="text-sm font-extrabold tracking-tight text-navy leading-none">{t("app.name")}</p>
              <p className="text-[10px] text-slate-400 leading-none mt-0.5">{t("app.tagline")}</p>
            </div>
          </Link>
          <nav className="ml-auto hidden items-center gap-5 text-[13px] font-semibold text-slate-600 md:flex">
            <a href="#about" className="hover:text-navy">About</a>
            <a href="#how" className="hover:text-navy">How It Works</a>
            <a href="#industries" className="hover:text-navy">Industries</a>
            <a href="#features" className="hover:text-navy">Features</a>
            <a href="#demo" className="hover:text-navy">Demo</a>
            <a href="#faq" className="hover:text-navy">FAQ</a>
          </nav>
          <select value={lang} onChange={(e) => setLang(e.target.value as "en" | "od")} className="input !w-auto !py-1.5 !text-xs font-semibold ml-auto md:ml-2">
            <option value="en">English</option>
            <option value="od">Odia</option>
          </select>
          <Link href="/login" className="btn-ghost btn-sm">Sign in</Link>
          <Link href="/app/dashboard" className="btn-teal btn-sm"><Play size={14} /> Explore Demo – Continue as Guest</Link>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6 pt-12 sm:pt-20 pb-14">
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <div>
            <span className="chip bg-teal-light text-teal-dark ring-1 ring-inset ring-teal/25 font-bold">
              Made for small manufacturers in Odisha &amp; beyond
            </span>
            <h1 className="mt-4 text-4xl sm:text-5xl font-extrabold tracking-tight text-navy leading-[1.08]">
              Make Your Business Smarter. <span className="text-teal">One Process at a Time.</span>
            </h1>
            <p className="mt-5 max-w-xl text-base sm:text-lg leading-relaxed text-slate-600">
              Pragati Mitra helps small manufacturers digitise everyday operations, identify recurring problems and improve productivity through simple tools and intelligent insights.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link href="/app/dashboard" className="btn-teal !px-6 !py-3 !text-base"><Play size={18} /> Explore Demo – Continue as Guest</Link>
              <Link href="/register" className="btn-primary !px-6 !py-3">Get Started <ArrowRight size={17} /></Link>
            </div>
            <p className="mt-3 text-[13px] font-medium text-slate-500">No account or password needed — the full demo opens instantly as a guest. <a href="#demo" className="font-bold text-teal-dark hover:underline">Or pick a specific sample business ↓</a></p>
            <div className="mt-7 flex flex-wrap gap-x-6 gap-y-2 text-[13px] font-medium text-slate-500">
              <span className="flex items-center gap-1.5"><CheckCircle2 size={15} className="text-teal" /> No paid tools or sensors needed</span>
              <span className="flex items-center gap-1.5"><Smartphone size={15} className="text-teal" /> Works on any phone browser</span>
              <span className="flex items-center gap-1.5"><ShieldCheck size={15} className="text-teal" /> Your data stays with your business</span>
            </div>
          </div>
          {/* CSS product mock */}
          <div className="card p-5 shadow-pop">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-navy flex items-center justify-center text-white text-xs font-bold">OM</div>
                <div>
                  <p className="text-[13px] font-bold text-navy">Odisha Metal Works</p>
                  <p className="text-[10px] text-slate-400">Fabrication • Demo dashboard</p>
                </div>
              </div>
              <span className="chip bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/25 text-[10px] font-bold">DEMO</span>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2.5">
              {[
                ["Active jobs", "4"],
                ["Delayed", "2"],
                ["Readiness", "68/100"],
              ].map(([l, v]) => (
                <div key={l as string} className="rounded-xl bg-cream p-3">
                  <p className="text-[10px] font-bold uppercase text-slate-400">{l as string}</p>
                  <p className="text-lg font-extrabold text-navy">{v as string}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-xl border border-slate-100 p-3">
              <p className="text-[11px] font-bold text-navy">Weekly production output</p>
              <div className="mt-2 flex h-24 items-end gap-1.5">
                {[35, 55, 40, 70, 62, 85, 78, 95].map((h, i) => (
                  <div key={i} className={`flex-1 rounded-t ${i === 7 ? "bg-teal" : "bg-navy/25"}`} style={{ height: `${h}%` }} />
                ))}
              </div>
            </div>
            <div className="mt-3 rounded-xl border border-amber-100 bg-amber-50/60 p-3">
              <p className="flex items-center gap-1.5 text-[11px] font-bold text-amber-700"><Lightbulb size={13} /> Smart Insight</p>
              <p className="mt-1 text-[12px] text-slate-600">Machine downtime recorded in 5 of the last 12 jobs, totalling 210 minutes. <span className="font-semibold text-navy">Suggested: review the maintenance schedule.</span></p>
            </div>
          </div>
        </div>
      </section>

      {/* About / benefits */}
      <section id="about" className="border-y border-slate-200/70 bg-white">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-14">
          <div className="max-w-2xl">
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-navy">What is Pragati Mitra?</h2>
            <p className="mt-3 text-[15px] leading-relaxed text-slate-600">
              Pragati Mitra is a digital adoption companion for small manufacturing MSMEs. It does <b>not</b> replace your paper registers or Excel sheets — it connects them, tracks production and problems digitally, and turns your own records into clear, explainable insights and corrective actions.
            </p>
          </div>
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {[
              [Link2, "Digitise without changing your system", "Import existing registers via Record Bridge; start tracking one process at a time. Your current way of working stays intact."],
              [Lightbulb, "See problems before they repeat", "Events and inspections are analysed into explainable patterns — with the records, period and reliability shown for each."],
              [Gauge, "Grow with guided next steps", "A Digital Readiness Score based on real usage tells you exactly what to adopt next — no guesswork, no forced big-bang change."],
            ].map(([I, h, p]) => (
              <div key={h as string} className="card p-5">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-light text-teal-dark"><I size={19} /></div>
                <h3 className="mt-3 text-[15px] font-bold text-navy">{h as string}</h3>
                <p className="mt-1.5 text-[13px] leading-relaxed text-slate-500">{p as string}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Demo businesses */}
      <section id="demo" className="border-y border-slate-200/70 bg-white">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-14">
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-navy">Explore the live demo — pick a sample business</h2>
          <p className="mt-2 max-w-2xl text-sm text-slate-500">
            Four fictional MSMEs from Odisha, each with realistic jobs, events, quality records and actions. Everything opens instantly as a guest — no sign-up. The app is clearly labelled <b>DEMO MODE — FICTIONAL SAMPLE DATA</b>, and “Reset Demo” (top-right menu) restores the original sample data.
          </p>
          <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {DEMO_BIZ.map((b) => (
              <div key={b.slug} className="card flex flex-col p-5 hover:shadow-pop transition-shadow">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-navy/10 text-navy">
                  <b.icon size={20} />
                </div>
                <h3 className="mt-3 text-[15px] font-bold text-navy">{b.name}</h3>
                <p className="text-[11px] font-bold uppercase tracking-wide text-teal-dark">{b.industry} • {b.loc}</p>
                <p className="mt-2 flex-1 text-[13px] text-slate-500">{b.desc}</p>
                <button onClick={() => openDemo(b.slug)} disabled={busy !== null} className="btn-teal btn-sm mt-4 w-full">
                  {busy === b.slug ? "Opening…" : <>Open demo <ArrowRight size={14} /></>}
                </button>
              </div>
            ))}
          </div>
          <div className="card mt-4 flex flex-wrap items-center justify-between gap-3 !rounded-xl border-teal/20 bg-teal-light/40 p-4">
            <div className="flex items-center gap-2.5">
              <Network size={20} className="text-teal-dark" />
              <p className="text-sm text-slate-700"><span className="font-bold text-navy">Cluster Supervisor demo:</span> see all four MSMEs together — aggregated readiness, training, challenge radar and businesses needing support.</p>
            </div>
            <button onClick={() => openDemo(undefined, "cluster")} disabled={busy !== null} className="btn-primary btn-sm">
              {busy === "cluster" ? "Opening…" : "Open cluster demo"}
            </button>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="mx-auto max-w-6xl px-4 sm:px-6 py-14">
        <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-navy">How It Works</h2>
        <p className="mt-2 max-w-2xl text-sm text-slate-500">A simple loop: record → analyse → act → verify. You do not need to change your whole business system.</p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s, i) => (
            <div key={s.title} className="card relative p-5">
              <span className="absolute right-4 top-4 text-2xl font-extrabold text-slate-100">{i + 1}</span>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal text-white"><s.icon size={19} /></div>
              <h3 className="mt-3 text-[15px] font-bold text-navy">{s.title}</h3>
              <p className="mt-1.5 text-[13px] leading-relaxed text-slate-500">{s.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Industries */}
      <section id="industries" className="border-y border-slate-200/70 bg-white">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-14">
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-navy">Industry Solutions</h2>
          <p className="mt-2 max-w-2xl text-sm text-slate-500">Industry-adaptive workflow templates — not one forced process. Customise stages and defect categories for your unit.</p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {INDUSTRIES.map((ind) => (
              <div key={ind.id} className="card p-5">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-navy/10 text-navy"><IndustryIcon id={ind.id} /></div>
                <h3 className="mt-3 text-[15px] font-bold text-navy">{ind.name}</h3>
                <p className="mt-1 text-[12.5px] text-slate-500">{ind.description}</p>
                <p className="mt-3 text-[11px] font-bold uppercase tracking-wide text-slate-400">Stages</p>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {ind.stages.slice(0, 4).map((s) => (
                    <span key={s} className="chip bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-200">{s}</span>
                  ))}
                  {ind.stages.length > 4 && <span className="chip bg-slate-100 text-slate-500 ring-1 ring-inset ring-slate-200">+{ind.stages.length - 4}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-6xl px-4 sm:px-6 py-14">
        <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-navy">Key Features</h2>
        <p className="mt-2 max-w-2xl text-sm text-slate-500">Practical, connected features — built around how small MSMEs actually work.</p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <div key={f.title} className="card p-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-light text-teal-dark"><f.icon size={19} /></div>
              <h3 className="mt-3 text-[14.5px] font-bold text-navy">{f.title}</h3>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-slate-500">{f.text}</p>
            </div>
          ))}
        </div>
        <div className="card mt-6 grid gap-4 !rounded-2xl bg-navy p-6 text-white sm:grid-cols-3">
          {[
            [IndianRupee, "Affordable by design", "Free prototype; no paid services, API keys or hardware required."],
            [Smartphone, "Worker-friendly mobile UI", "Large buttons, minimal typing, QR scanning, English & Odia."],
            [ShieldCheck, "Privacy by default", "Role-based access; cluster role sees aggregates only, never factory records."],
          ].map(([I, h, p]) => (
            <div key={h as string} className="flex gap-3">
              <div className="rounded-xl bg-white/10 p-2.5 h-fit"><I size={20} /></div>
              <div>
                <p className="text-sm font-bold">{h as string}</p>
                <p className="mt-1 text-[12.5px] text-white/70">{p as string}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="border-t border-slate-200/70 bg-white">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 py-14">
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-navy">Frequently Asked Questions</h2>
          <div className="mt-7 space-y-3">
            {FAQS.map((f, i) => (
              <div key={f.q} className="card !rounded-xl overflow-hidden">
                <button onClick={() => setOpenFaq(openFaq === i ? null : i)} className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left">
                  <span className="text-sm font-bold text-navy">{f.q}</span>
                  <ChevronDown size={17} className={`shrink-0 text-slate-400 transition-transform ${openFaq === i ? "rotate-180" : ""}`} />
                </button>
                {openFaq === i && <p className="border-t border-slate-100 px-5 py-4 text-[13.5px] leading-relaxed text-slate-600">{f.a}</p>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6 py-14">
        <div className="card !rounded-3xl bg-navy p-8 sm:p-12 text-center text-white shadow-pop">
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Start your digital adoption journey today</h2>
          <p className="mx-auto mt-3 max-w-xl text-sm text-white/70">
            Create your business profile in two minutes, get a personalised adoption plan, and let Pragati Mitra show you what to digitise first.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link href="/app/dashboard" className="btn-teal !px-6 !py-3 !text-base"><Play size={16} /> Explore Demo – Continue as Guest</Link>
            <Link href="/register" className="btn !px-6 !py-3 bg-white/10 text-white hover:bg-white/20">Get Started (create account) <ArrowRight size={16} /></Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200/70 bg-white">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-10 grid gap-8 sm:grid-cols-4">
          <div className="sm:col-span-2">
            <Link href="/" className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal text-white"><Sprout size={20} /></div>
              <p className="text-sm font-extrabold tracking-tight text-navy">PRAGATI MITRA</p>
            </Link>
            <p className="mt-3 max-w-sm text-[13px] leading-relaxed text-slate-500">
              Your Smart Companion for MSME Growth. A digital adoption and decision-support platform for small manufacturers — not another ERP.
            </p>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Product</p>
            <div className="mt-3 space-y-2 text-[13px] font-medium text-slate-600">
              <a href="#how" className="block hover:text-navy">How It Works</a>
              <a href="#industries" className="block hover:text-navy">Industry Solutions</a>
              <a href="#features" className="block hover:text-navy">Key Features</a>
              <a href="#demo" className="block hover:text-navy">Live Demo</a>
              <Link href="/login" className="block hover:text-navy">Sign in</Link>
            </div>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">For</p>
            <div className="mt-3 space-y-2 text-[13px] font-medium text-slate-600">
              <p>MSME owners & managers</p>
              <p>Supervisors & workers</p>
              <p>Storekeepers & quality checkers</p>
              <p>Cluster supervisors</p>
            </div>
          </div>
        </div>
        <div className="border-t border-slate-100">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-2">
            <p className="text-[11.5px] text-slate-400">© {new Date().getFullYear()} Pragati Mitra — hackathon prototype. All demo businesses and data are fictional.</p>
            <p className="text-[11.5px] text-slate-400 font-medium">No government partnership, approval or endorsement is claimed.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
