"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Sprout, ArrowRight, ArrowLeft, CheckCircle2, Plus, X, Home } from "lucide-react";
import { api } from "@/lib/api";
import { INDUSTRIES, ROLES, RECORD_METHODS, PROBLEM_OPTIONS, industryTemplate, type IndustryId } from "@/lib/domain";

export default function RegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // account
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [role, setRole] = useState("owner");

  // business onboarding
  const [bizName, setBizName] = useState("");
  const [bizType, setBizType] = useState("Proprietorship");
  const [industry, setIndustry] = useState<IndustryId>("fabrication");
  const [customIndustry, setCustomIndustry] = useState("");
  const [products, setProducts] = useState("");
  const [workers, setWorkers] = useState("10");
  const [recordMethod, setRecordMethod] = useState("paper");
  const [software, setSoftware] = useState("");
  const [problems, setProblems] = useState<string[]>([]);
  const [lang, setLang] = useState("en");
  const [stages, setStages] = useState<string[]>(industryTemplate("fabrication").stages);
  const [newStage, setNewStage] = useState("");

  const pickIndustry = (id: IndustryId) => {
    setIndustry(id);
    setStages(industryTemplate(id).stages);
  };

  const submit = async () => {
    setError("");
    if (password !== confirm) return setError("Passwords do not match.");
    if (password.length < 6) return setError("Password must be at least 6 characters.");
    if (!bizName.trim()) return setError("Business name is required.");
    setBusy(true);
    try {
      const d = await api("auth", {
        method: "POST",
        body: {
          action: "register",
          name,
          email,
          password,
          role,
          business: {
            name: bizName,
            onboarding: {
              businessType: bizType,
              industry,
              customIndustry: industry === "other" ? customIndustry : undefined,
              products,
              stages,
              workersCount: Number(workers) || 0,
              recordMethod,
              existingSoftware: software,
              mainProblems: problems,
              preferredLanguage: lang,
            },
          },
        },
      });
      router.push(d.user.role === "worker" ? "/worker" : "/app");
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-cream px-4 py-10">
      <div className="mx-auto w-full max-w-2xl">
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5" aria-label="Pragati Mitra home">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-teal text-white"><Sprout size={24} /></div>
            <div>
              <p className="text-base font-extrabold tracking-tight text-navy leading-none">PRAGATI MITRA</p>
              <p className="mt-1 text-[10px] text-slate-400 leading-none">Your Smart Companion for MSME Growth</p>
            </div>
          </Link>
          <Link href="/" className="btn-ghost btn-sm"><Home size={14} /> Back to Home</Link>
        </div>
        <div className="mt-4 text-center">
          <h1 className="text-2xl font-extrabold tracking-tight text-navy">Create your Pragati Mitra account</h1>
          <p className="mt-1 text-sm text-slate-500">Step {step} of 2 — {step === 1 ? "your account & role" : "business onboarding & digital adoption plan"}</p>
        </div>

        <div className="mt-4 flex gap-2">
          {[1, 2].map((s) => (
            <div key={s} className={`h-1.5 flex-1 rounded-full ${step >= s ? "bg-teal" : "bg-slate-200"}`} />
          ))}
        </div>

        {error && <div className="card mt-4 border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</div>}

        {step === 1 && (
          <div className="card mt-4 p-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label">Your name</label>
                <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Suresh Pradhan" required />
              </div>
              <div>
                <label className="label">Email</label>
                <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@business.in" required />
              </div>
              <div>
            <label className="label">Password (min 6 characters)</label>
                <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
              </div>
              <div>
                <label className="label">Confirm password</label>
                <input className="input" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
              </div>
              <div className="sm:col-span-2">
                <label className="label">Your role</label>
                <select className="input" value={role} onChange={(e) => setRole(e.target.value)}>
                  {ROLES.filter((r) => r.id !== "cluster").map((r) => (
                    <option key={r.id} value={r.id}>{r.label} — {r.desc}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="mt-6 flex items-center justify-between">
              <Link href="/login" className="btn-ghost btn-sm">← Sign in instead</Link>
              <button className="btn-primary" onClick={() => { setError(""); if (!name || !email || !password) return setError("Please fill all fields."); setStep(2); }}>
                Continue <ArrowRight size={15} />
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="card mt-4 p-6">
            <h2 className="text-base font-bold text-navy">Business onboarding</h2>
            <p className="mt-0.5 text-xs text-slate-500">These answers generate your personalised digital adoption plan — you can change them later in Settings.</p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label">Business name</label>
                <input className="input" value={bizName} onChange={(e) => setBizName(e.target.value)} placeholder="e.g. Odisha Metal Works" required />
              </div>
              <div>
                <label className="label">Business type</label>
                <select className="input" value={bizType} onChange={(e) => setBizType(e.target.value)}>
                  {["Proprietorship", "Partnership", "Private Limited", "Cooperative society", "Self-help group"].map((t) => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Industry</label>
                <select className="input" value={industry} onChange={(e) => pickIndustry(e.target.value as IndustryId)}>
                  {INDUSTRIES.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
                </select>
              </div>
              {industry === "other" && (
                <div>
                  <label className="label">Your industry (custom)</label>
                  <input className="input" value={customIndustry} onChange={(e) => setCustomIndustry(e.target.value)} placeholder="e.g. Food processing machinery" />
                </div>
              )}
              <div className="sm:col-span-2">
                <label className="label">Main products</label>
                <input className="input" value={products} onChange={(e) => setProducts(e.target.value)} placeholder="e.g. Gates, machine frames, sheds" />
              </div>
              <div>
                <label className="label">Number of workers</label>
                <input className="input" type="number" min={1} value={workers} onChange={(e) => setWorkers(e.target.value)} />
              </div>
              <div>
                <label className="label">Preferred language</label>
                <select className="input" value={lang} onChange={(e) => setLang(e.target.value)}>
                  <option value="en">English</option>
                  <option value="od">Odia</option>
                </select>
              </div>
              <div>
                <label className="label">How do you keep records today?</label>
                <select className="input" value={recordMethod} onChange={(e) => setRecordMethod(e.target.value)}>
                  {RECORD_METHODS.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Any existing software? (optional)</label>
                <input className="input" value={software} onChange={(e) => setSoftware(e.target.value)} placeholder="e.g. Tally for accounts, WhatsApp groups" />
              </div>
              <div className="sm:col-span-2">
                <label className="label">Main operational problems (select all that apply)</label>
                <div className="flex flex-wrap gap-2">
                  {PROBLEM_OPTIONS.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setProblems((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]))}
                      className={`chip ring-1 ring-inset transition-colors ${problems.includes(p) ? "bg-teal text-white ring-teal" : "bg-white text-slate-600 ring-slate-200 hover:ring-teal/50"}`}
                    >
                      {problems.includes(p) && <CheckCircle2 size={12} />} {p}
                    </button>
                  ))}
                </div>
              </div>
              <div className="sm:col-span-2">
                <label className="label">Production stages (editable — suggested for your industry)</label>
                <div className="flex flex-wrap gap-2">
                  {stages.map((s, i) => (
                    <span key={s} className="chip bg-navy/10 text-navy ring-1 ring-inset ring-navy/20">
                      {i + 1}. {s}
                      <button type="button" onClick={() => setStages(stages.filter((_, j) => j !== i))} className="ml-1 text-slate-400 hover:text-red-500"><X size={11} /></button>
                    </span>
                  ))}
                </div>
                <div className="mt-2 flex gap-2">
                  <input className="input !py-1.5" value={newStage} onChange={(e) => setNewStage(e.target.value)} placeholder="Add a custom stage…" />
                  <button type="button" className="btn-ghost btn-sm" onClick={() => { if (newStage.trim()) { setStages([...stages, newStage.trim()]); setNewStage(""); } }}>
                    <Plus size={14} /> Add
                  </button>
                </div>
              </div>
            </div>
            <div className="mt-6 flex items-center justify-between">
              <button className="btn-ghost btn-sm" onClick={() => setStep(1)}><ArrowLeft size={14} /> Back</button>
              <button className="btn-teal" disabled={busy} onClick={submit}>
                {busy ? "Creating…" : <>Create business & open dashboard <ArrowRight size={15} /></>}
              </button>
            </div>
          </div>
        )}

        <p className="mt-4 text-center text-xs text-slate-400">
          Just looking? <Link href="/" className="font-semibold text-teal-dark hover:underline">Explore the demo without an account</Link>
        </p>
      </div>
    </div>
  );
}
