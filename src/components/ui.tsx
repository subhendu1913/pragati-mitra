"use client";

import { useEffect, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Loader2 } from "lucide-react";
import { useLang } from "@/lib/i18n";

export function Card({
  title,
  subtitle,
  actions,
  children,
  className = "",
  pad = true,
  id,
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  pad?: boolean;
  id?: string;
}) {
  return (
    <section id={id} className={`card ${className}`}>
      {(title || actions) && (
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div>
            {title && <h3 className="text-[15px] font-bold text-navy">{title}</h3>}
            {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={pad ? "p-5" : ""}>{children}</div>
    </section>
  );
}

export function Stat({
  label,
  value,
  icon: Icon,
  hint,
  tone = "navy",
}: {
  label: string;
  value: ReactNode;
  icon: LucideIcon;
  hint?: string;
  tone?: "navy" | "teal" | "red" | "amber" | "grey";
}) {
  const tones: Record<string, string> = {
    navy: "bg-navy/10 text-navy",
    teal: "bg-teal/10 text-teal-dark",
    red: "bg-red-50 text-red-600",
    amber: "bg-amber-50 text-amber-600",
    grey: "bg-slate-100 text-slate-600",
  };
  return (
    <div className="card p-4 flex items-center gap-3.5">
      <div className={`rounded-xl p-2.5 shrink-0 ${tones[tone]}`}>
        <Icon size={20} strokeWidth={2.2} />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 truncate">{label}</p>
        <p className="text-xl font-extrabold text-navy leading-tight truncate">{value}</p>
        {hint && <p className="text-[11px] text-slate-400 truncate">{hint}</p>}
      </div>
    </div>
  );
}

const badgeTones: Record<string, string> = {
  green: "bg-green-50 text-green-700 ring-green-600/20",
  amber: "bg-amber-50 text-amber-700 ring-amber-600/25",
  red: "bg-red-50 text-red-700 ring-red-600/20",
  navy: "bg-navy/10 text-navy ring-navy/20",
  teal: "bg-teal-light text-teal-dark ring-teal/25",
  grey: "bg-slate-100 text-slate-600 ring-slate-500/20",
};

export function Badge({ children, tone = "grey" }: { children: ReactNode; tone?: keyof typeof badgeTones | string }) {
  return <span className={`chip ring-1 ring-inset ${badgeTones[tone] ?? badgeTones.grey}`}>{children}</span>;
}

export function statusTone(status: string): string {
  switch (status) {
    case "completed":
    case "verified":
    case "high":
      return "green";
    case "active":
    case "in_progress":
      return "teal";
    case "delayed":
    case "rejected":
      return "red";
    case "pending":
    case "on_hold":
    case "medium":
    case "paused":
      return "amber";
    case "low":
      return "grey";
    default:
      return "grey";
  }
}

export function reliabilityTone(r: string): string {
  if (r === "high") return "green";
  if (r === "medium") return "amber";
  return "red";
}

export function Button({
  children,
  onClick,
  variant = "primary",
  size,
  disabled,
  type = "button",
  className = "",
  title,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "teal" | "ghost" | "danger";
  size?: "sm" | "md";
  disabled?: boolean;
  type?: "button" | "submit";
  className?: string;
  title?: string;
}) {
  const v = variant === "primary" ? "btn-primary" : variant === "teal" ? "btn-teal" : variant === "danger" ? "btn-danger" : "btn-ghost";
  return (
    <button type={type} onClick={onClick} disabled={disabled} title={title} className={`${v} ${size === "sm" ? "btn-sm" : ""} ${className}`}>
      {children}
    </button>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    if (open) window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6">
      <div className="absolute inset-0 bg-navy-dark/50 backdrop-blur-[2px]" onClick={onClose} />
      <div className={`relative card w-full ${wide ? "sm:max-w-3xl" : "sm:max-w-lg"} max-h-[92vh] overflow-y-auto rounded-b-none sm:rounded-b-2xl shadow-pop`}>
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-5 py-4">
          <h3 className="text-base font-bold text-navy">{title}</h3>
          <button onClick={onClose} className="btn-ghost btn-sm" aria-label="Close">
            ✕
          </button>
        </header>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export function Field({ label, children, className = "" }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label className="label">{label}</label>
      {children}
    </div>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-10 text-slate-400">
      <Loader2 className="animate-spin" size={18} />
      <span className="text-sm">{label ?? "Loading…"}</span>
    </div>
  );
}

export function Empty({ icon: Icon, title, text }: { icon?: LucideIcon; title: string; text?: string }) {
  const I = Icon ?? Loader2;
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
      <div className="rounded-2xl bg-slate-100 p-3 text-slate-400">
        <I size={22} />
      </div>
      <p className="text-sm font-semibold text-slate-600">{title}</p>
      {text && <p className="max-w-sm text-xs text-slate-400">{text}</p>}
    </div>
  );
}

export function Progress({ value, className = "" }: { value: number; className?: string }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className={`h-2 w-full overflow-hidden rounded-full bg-slate-100 ${className}`}>
      <div className="h-full rounded-full bg-teal transition-all duration-500" style={{ width: `${v}%` }} />
    </div>
  );
}

export function PageHeader({ title, desc, actions }: { title: string; desc?: string; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-navy">{title}</h1>
        {desc && <p className="mt-1 max-w-2xl text-sm text-slate-500">{desc}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function DemoBadge() {
  const { t } = useLang();
  return (
    <span className="chip bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/25 font-bold">
      🧪 {t("top.demoBadge")}
    </span>
  );
}

export function fmtDate(d: string | Date | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export function fmtDateTime(d: string | Date | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}
