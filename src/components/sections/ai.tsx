"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Bot, Send, User, Sparkles, CheckCircle2, Database, Clock, ShieldCheck, Mic, MicOff, ArrowRight } from "lucide-react";
import { api } from "@/lib/api";
import { useLang } from "@/lib/i18n";
import { useSpeechRecognition } from "@/lib/use-speech";
import { Badge, Button, PageHeader, Spinner } from "@/components/ui";

interface Msg {
  role: "user" | "ai";
  text: string;
  meta?: { recordsUsed: string; period: string; reliability: string };
  suggestedAction?: { title: string; description: string; problemRef: string };
  actionDone?: boolean;
  proposedUpdate?: { kind: string; summary: string; summaryOd: string; payload: Record<string, unknown> };
  updateApplied?: string;
  link?: string;
  linkLabel?: string;
}

const SUGGESTIONS_EN = [
  "How is my production performing?",
  "Which jobs are delayed?",
  "Which stage has the most interruptions?",
  "What are my recurring problems?",
  "Which machines have the most downtime?",
  "Summarise this month's production.",
  "What should I improve first?",
  "How do I report a problem?",
];
const SUGGESTIONS_OD = [
  "Mo utpadana kibhabe chaluchhi?",
  "Kon karyyagudika bilamba hochhi?",
  "Mo barambara samashyagudika ki ki?",
  "Yantra down kemiti report koriba?",
  "Mo karyya re ki improve koriba prathame?",
];

export default function AiSection() {
  const { t, lang } = useLang();
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "ai",
      text: "Namaskar! I am Pragati AI — your business copilot. Ask me anything about your production, delays, recurring problems, machines, quality or what to improve first. In English or Odia.\n\nIn this prototype my answers are rule-based simulations computed from your own records — every answer shows the records and period used, and missing data is flagged instead of invented.",
      meta: { recordsUsed: "—", period: "—", reliability: "—" },
    },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const speech = useSpeechRecognition(lang);
  const baseInputRef = useRef("");

  const toggleMic = () => {
    if (speech.listening) {
      speech.stop();
      return;
    }
    baseInputRef.current = input;
    const ok = speech.start((text, isFinal) => {
      // Live, editable transcription in the input box.
      setInput((baseInputRef.current ? baseInputRef.current + " " : "") + text);
      if (isFinal) baseInputRef.current = (baseInputRef.current ? baseInputRef.current + " " : "") + text;
    });
    if (!ok) baseInputRef.current = input;
  };

  const applyUpdate = async (msg: Msg, idx: number) => {
    if (!msg.proposedUpdate) return;
    setBusy(true);
    try {
      const d = await api("ai/apply", { method: "POST", body: { update: msg.proposedUpdate } });
      setMessages((m) => m.map((x, i) => (i === idx ? { ...x, updateApplied: d.message } : x)));
      setMessages((m) => [...m, { role: "ai", text: `${t("ai.applied")} ${d.message}`, meta: { recordsUsed: "1 record updated", period: "now", reliability: "applied after your confirmation" }, link: d.job ? "/app/production" : "/app/events", linkLabel: d.job ? "Open Production & Jobs" : "Open Event Centre" }]);
    } catch (e) {
      setMessages((m) => [...m, { role: "ai", text: `Error: ${(e as Error).message}` }]);
    } finally {
      setBusy(false);
    }
  };

  const ask = async (q: string) => {
    const question = q.trim();
    if (!question || busy) return;
    setMessages((m) => [...m, { role: "user", text: question }]);
    setInput("");
    setBusy(true);
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    try {
      const d = await api("ai", { method: "POST", body: { question, lang } });
      setMessages((m) => [...m, { role: "ai", text: d.answer.text, meta: d.answer.meta, suggestedAction: d.answer.suggestedAction, proposedUpdate: d.answer.proposedUpdate, link: d.answer.link, linkLabel: d.answer.linkLabel }]);
    } catch (e) {
      setMessages((m) => [...m, { role: "ai", text: `Sorry, something went wrong: ${(e as Error).message}` }]);
    } finally {
      setBusy(false);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    }
  };

  const approveAction = async (msg: Msg, idx: number) => {
    if (!msg.suggestedAction) return;
    try {
      await api("actions", { method: "POST", body: msg.suggestedAction });
      setMessages((m) => m.map((x, i) => (i === idx ? { ...x, actionDone: true } : x)));
    } catch (e) {
      alert((e as Error).message);
    }
  };

  const suggestions = lang === "od"
    ? ["M කළේJetzt kiba koriba?", ...SUGGESTIONS_OD, "Aaji ame 25 ti tauri karichu", "Job OHC-105 sampurna kar"]
    : [...SUGGESTIONS_EN, "Today we completed 25 units", "Two machines stopped for one hour", "Mark job OMW-105 as completed"];

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("nav.ai")}
        desc="Ask your business anything. Answers are computed from your authorised records only — the period and records used are always shown."
      />
      <div className="card flex h-[62vh] min-h-[420px] flex-col overflow-hidden">
        <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-2.5">
          <span className="chip bg-teal-light text-teal-dark ring-1 ring-inset ring-teal/25 font-bold"><Sparkles size={12} /> {t("common.simulatedAi")}</span>
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          {messages.map((m, i) => (
            <div key={i} className={`flex gap-2.5 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
              <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${m.role === "user" ? "bg-navy text-white" : "bg-teal text-white"}`}>
                {m.role === "user" ? <User size={15} /> : <Bot size={15} />}
              </div>
              <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-[13.5px] leading-relaxed ${m.role === "user" ? "bg-navy text-white rounded-tr-sm" : "bg-cream border border-slate-100 text-slate-700 rounded-tl-sm"}`}>
                <p className="whitespace-pre-line">{m.text.replace(/\*\*/g, "")}</p>
                {m.meta && (
                  <div className="mt-2.5 flex flex-wrap gap-1.5 border-t border-slate-200/70 pt-2">
                    <span className="chip bg-white text-slate-500 ring-1 ring-inset ring-slate-200"><Database size={10} /> {m.meta.recordsUsed}</span>
                    <span className="chip bg-white text-slate-500 ring-1 ring-inset ring-slate-200"><Clock size={10} /> {m.meta.period}</span>
                    <span className="chip bg-white text-slate-500 ring-1 ring-inset ring-slate-200"><ShieldCheck size={10} /> {m.meta.reliability}</span>
                  </div>
                )}
                {m.proposedUpdate && (
                  <div className="mt-2.5 rounded-xl border border-teal/40 bg-teal-light/60 p-3">
                    <p className="text-xs font-bold text-teal-dark">{t("ai.confirmUpdate")}</p>
                    <p className="mt-1 text-xs text-slate-700">{lang === "od" ? m.proposedUpdate.summaryOd : m.proposedUpdate.summary}</p>
                    {m.updateApplied ? (
                      <p className="mt-2 flex items-center gap-1 text-xs font-bold text-green-700"><CheckCircle2 size={13} /> {m.updateApplied}</p>
                    ) : (
                      <div className="mt-2 flex gap-2">
                        <Button size="sm" variant="teal" disabled={busy} onClick={() => applyUpdate(m, i)}>{t("ai.approve")}</Button>
                        <Button size="sm" variant="ghost" disabled={busy} onClick={() => setMessages((mm) => mm.map((x, j) => (j === i ? { ...x, updateApplied: "—" } : x)))}>{t("ai.reject")}</Button>
                      </div>
                    )}
                  </div>
                )}
                {m.link && (
                  <div className="mt-2.5">
                    <Link href={m.link} className="btn-ghost btn-sm">{t("ai.goTo")}: {m.linkLabel ?? m.link} <ArrowRight size={12} /></Link>
                  </div>
                )}
                {m.suggestedAction && (
                  <div className="mt-2.5 rounded-xl border border-teal/30 bg-teal-light/50 p-3">
                    <p className="text-xs font-bold text-teal-dark">Suggested corrective action (needs your approval):</p>
                    <p className="mt-1 text-xs text-slate-600">{m.suggestedAction.title}</p>
                    {m.actionDone ? (
                      <p className="mt-2 flex items-center gap-1 text-xs font-bold text-green-700"><CheckCircle2 size={13} /> Created in Action Tracker</p>
                    ) : (
                      <Button size="sm" variant="teal" className="mt-2" onClick={() => approveAction(m, i)}>Approve &amp; create action</Button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
          {busy && (
            <div className="flex gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-teal text-white"><Bot size={15} /></div>
              <div className="rounded-2xl rounded-tl-sm border border-slate-100 bg-cream px-4 py-3"><Spinner label="Analysing your records…" /></div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
        <div className="border-t border-slate-100 p-3">
          <div className="mb-2 flex flex-wrap gap-1.5">
            {suggestions.map((s) => (
              <button key={s} onClick={() => ask(s)} disabled={busy} className="chip bg-white text-slate-600 ring-1 ring-inset ring-slate-200 hover:ring-teal/50 hover:text-teal-dark transition">
                {s}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              className="input flex-1"
              placeholder={lang === "od" ? "Pragati AI ku jijnasa karantu… athaba update lekhantu: 'Aaji ame 25 ti karichu'" : "Ask Pragati AI… or update data: 'Today we completed 25 units' / 'Mark job OMW-105 as completed'"}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && ask(input)}
            />
            {speech.supported ? (
              <Button
                variant={speech.listening ? "danger" : "ghost"}
                className="!px-3"
                title={t("ai.voice")}
                onClick={toggleMic}
              >
                {speech.listening ? <MicOff size={17} /> : <Mic size={17} />}
              </Button>
            ) : null}
            <Button variant="teal" disabled={busy || !input.trim()} onClick={() => ask(input)}><Send size={15} /></Button>
          </div>
          {speech.supported ? (
            <p className="mt-1 text-[10.5px] text-slate-400">
              {speech.listening ? t("ai.listening") : t("ai.voiceHint")} {lang === "od" ? t("ai.voiceOdNote") : ""}
              {speech.error === "permission-denied" && <span className="text-red-500"> Microphone access was denied — type instead.</span>}
            </p>
          ) : (
            <p className="mt-1 text-[10.5px] text-slate-400">{t("ai.voiceUnsupported")}</p>
          )}
          <p className="mt-1.5 flex items-center gap-1.5"><Badge tone="amber">SIMULATED</Badge> <span className="text-[11px] text-slate-400">Rule-based prototype over your own data — structured for future real AI API integration. No data leaves your business.</span></p>
        </div>
      </div>
    </div>
  );
}
