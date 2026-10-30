"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Sprout, LogIn, AlertCircle, Play, ArrowLeft } from "lucide-react";
import { api } from "@/lib/api";
import { useLang } from "@/lib/i18n";

export default function LoginPage() {
  const router = useRouter();
  const { t } = useLang();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const d = await api("auth", { method: "POST", body: { action: "login", email, password } });
      router.push(d.user.role === "cluster" ? "/cluster" : d.user.role === "worker" ? "/worker" : "/app");
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  const demo = async (slug?: string, mode?: string) => {
    setBusy(true);
    try {
      const d = await api("auth", { method: "POST", body: slug ? { action: "demo", slug } : { action: "demo", mode } });
      router.push(d.user.role === "cluster" ? "/cluster" : d.user.role === "worker" ? "/worker" : "/app");
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-cream px-4 py-10">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5" aria-label="Pragati Mitra home">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-teal text-white">
              <Sprout size={24} />
            </div>
            <div>
              <p className="text-base font-extrabold tracking-tight text-navy leading-none">PRAGATI MITRA</p>
              <p className="mt-1 text-[10px] text-slate-400 leading-none">{t("app.tagline")}</p>
            </div>
          </Link>
          <Link href="/" className="btn-ghost btn-sm"><ArrowLeft size={14} /> Back to Home</Link>
        </div>

        <form onSubmit={submit} className="card mt-6 p-6">
          <h2 className="text-base font-bold text-navy">Sign in</h2>
          <p className="mt-0.5 text-xs text-slate-400">Use your registered email and password. A name or email alone is never treated as authentication.</p>
          {error && (
            <div className="mt-3 flex items-start gap-2 rounded-xl bg-red-50 px-3 py-2.5 text-xs font-medium text-red-700">
              <AlertCircle size={15} className="mt-0.5 shrink-0" /> {error}
            </div>
          )}
          <div className="mt-4 space-y-3.5">
            <div>
              <label className="label">Email</label>
              <input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@business.in" />
            </div>
            <div>
              <label className="label">Password</label>
              <input className="input" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
            </div>
            <div className="text-right">
              <Link href="/forgot-password" className="text-xs font-bold text-teal-dark hover:underline">Forgot password?</Link>
            </div>
          </div>
          <button type="submit" disabled={busy} className="btn-primary mt-5 w-full">
            <LogIn size={16} /> {busy ? t("common.loading") : "Sign in"}
          </button>
          <p className="mt-4 text-center text-xs text-slate-500">
            New here? <Link href="/register" className="font-bold text-teal-dark hover:underline">Register your business</Link>
          </p>
        </form>

        <div className="card mt-4 p-5">
          <p className="flex items-center gap-2 text-sm font-bold text-navy"><Play size={15} className="text-teal-dark" /> Demo mode — no login needed</p>
          <p className="mt-1 text-xs text-slate-500">Fictional sample businesses. Demo accounts (if you prefer sign-in) use password <span className="font-mono font-bold text-navy">demo1234</span>.</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {[
              ["odisha-metal-works", "Odisha Metal Works"],
              ["utkal-electrical", "Utkal Electrical"],
              ["odisha-handloom", "Odisha Handloom"],
              ["pragati-engineering", "Pragati Engineering"],
            ].map(([slug, name]) => (
              <button key={slug as string} onClick={() => demo(slug as string)} disabled={busy} className="btn-ghost btn-sm !justify-start text-left">
                {name as string}
              </button>
            ))}
            <button onClick={() => demo(undefined, "cluster")} disabled={busy} className="btn-ghost btn-sm !justify-start col-span-2 !border-teal/40 !text-teal-dark">
              Cluster Supervisor demo (aggregated view)
            </button>
          </div>
          <Link href="/" className="mt-3 block text-center text-xs font-semibold text-slate-400 hover:text-navy">← Back to home</Link>
        </div>
      </div>
    </div>
  );
}
