"use client";

import { useState } from "react";
import Link from "next/link";
import { Sprout, ArrowLeft, Mail, Copy, CheckCircle2, AlertCircle } from "lucide-react";
import { api } from "@/lib/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<{ message: string; demoResetUrl: string | null } | null>(null);
  const [copied, setCopied] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    setDone(null);
    try {
      const d = await api("auth", { method: "POST", body: { action: "forgot", email } });
      setDone(d);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-cream px-4 py-10">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5" aria-label="Pragati Mitra home">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-teal text-white"><Sprout size={24} /></div>
            <div>
              <p className="text-base font-extrabold tracking-tight text-navy leading-none">PRAGATI MITRA</p>
              <p className="mt-1 text-[10px] text-slate-400 leading-none">Your Smart Companion for MSME Growth</p>
            </div>
          </Link>
          <Link href="/" className="btn-ghost btn-sm"><ArrowLeft size={14} /> Back to Home</Link>
        </div>

        <div className="card mt-6 p-6">
          <h1 className="text-lg font-extrabold text-navy">Forgot password?</h1>
          <p className="mt-1 text-xs text-slate-500">Enter your account email and we will create a password reset link.</p>
          {error && (
            <div className="mt-3 flex items-start gap-2 rounded-xl bg-red-50 px-3 py-2.5 text-xs font-medium text-red-700">
              <AlertCircle size={15} className="mt-0.5 shrink-0" /> {error}
            </div>
          )}
          {done && (
            <div className="mt-3 rounded-xl bg-green-50 px-3 py-2.5 text-xs font-medium text-green-700">
              {done.message}
            </div>
          )}
          <form onSubmit={submit} className="mt-4 space-y-3.5">
            <div>
              <label className="label">Email</label>
              <input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@business.in" />
            </div>
            <button type="submit" disabled={busy} className="btn-primary w-full">
              <Mail size={15} /> {busy ? "Creating link…" : "Send reset link"}
            </button>
          </form>
          {done?.demoResetUrl && (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3">
              <p className="text-[11px] font-bold text-amber-700">DEMO: no mail server is configured in this prototype, so the reset link is shown here instead of being emailed (valid 1 hour, single use):</p>
              <div className="mt-2 flex items-center gap-2">
                <Link href={done.demoResetUrl} className="flex-1 truncate rounded-lg bg-white px-2.5 py-2 font-mono text-[11px] text-teal-dark ring-1 ring-inset ring-amber-200 hover:underline">
                  {done.demoResetUrl}
                </Link>
                <button
                  type="button"
                  className="btn-ghost btn-sm"
                  onClick={() => { navigator.clipboard?.writeText(done.demoResetUrl ?? ""); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
                >
                  {copied ? <CheckCircle2 size={14} className="text-green-600" /> : <Copy size={14} />}
                </button>
              </div>
            </div>
          )}
          <p className="mt-4 text-center text-xs text-slate-500">
            Remembered it? <Link href="/login" className="font-bold text-teal-dark hover:underline">Back to sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
