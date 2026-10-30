"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Sprout, ArrowLeft, KeyRound, AlertCircle, CheckCircle2 } from "lucide-react";
import { api } from "@/lib/api";

export default function ResetForm() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password !== confirm) return setError("Passwords do not match.");
    if (password.length < 6) return setError("Password must be at least 6 characters.");
    setBusy(true);
    try {
      const d = await api("auth", { method: "POST", body: { action: "reset", token, password } });
      setDone(true);
      setTimeout(() => router.push(d.user.role === "cluster" ? "/cluster" : d.user.role === "worker" ? "/worker" : "/app"), 1200);
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
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-teal text-white"><Sprout size={24} /></div>
            <div>
              <p className="text-base font-extrabold tracking-tight text-navy leading-none">PRAGATI MITRA</p>
              <p className="mt-1 text-[10px] text-slate-400 leading-none">Your Smart Companion for MSME Growth</p>
            </div>
          </Link>
          <Link href="/" className="btn-ghost btn-sm"><ArrowLeft size={14} /> Back to Home</Link>
        </div>

        <div className="card mt-6 p-6">
          <h1 className="text-lg font-extrabold text-navy">Set a new password</h1>
          {!token ? (
            <div className="mt-3">
              <div className="flex items-start gap-2 rounded-xl bg-red-50 px-3 py-2.5 text-xs font-medium text-red-700">
                <AlertCircle size={15} className="mt-0.5 shrink-0" /> This reset link is missing its token. Please request a new link.
              </div>
              <p className="mt-4 text-center text-xs text-slate-500">
                <Link href="/forgot-password" className="font-bold text-teal-dark hover:underline">Request a new reset link</Link>
              </p>
            </div>
          ) : done ? (
            <div className="mt-3 flex items-start gap-2 rounded-xl bg-green-50 px-3 py-2.5 text-xs font-medium text-green-700">
              <CheckCircle2 size={15} className="mt-0.5 shrink-0" /> Password updated — you are being signed in…
            </div>
          ) : (
            <>
              <p className="mt-1 text-xs text-slate-500">Choose a new password for your account (min 6 characters).</p>
              {error && (
                <div className="mt-3 flex items-start gap-2 rounded-xl bg-red-50 px-3 py-2.5 text-xs font-medium text-red-700">
                  <AlertCircle size={15} className="mt-0.5 shrink-0" /> {error}
                </div>
              )}
              <form onSubmit={submit} className="mt-4 space-y-3.5">
                <div>
                  <label className="label">New password</label>
                  <input className="input" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
                </div>
                <div>
                  <label className="label">Confirm new password</label>
                  <input className="input" type="password" required minLength={6} value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="••••••••" />
                </div>
                <button type="submit" disabled={busy} className="btn-teal w-full">
                  <KeyRound size={15} /> {busy ? "Updating…" : "Update password & sign in"}
                </button>
              </form>
              <p className="mt-4 text-center text-xs text-slate-500">
                <Link href="/login" className="font-bold text-teal-dark hover:underline">Back to sign in</Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
