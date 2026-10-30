"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Factory,
  FileSpreadsheet,
  Siren,
  Lightbulb,
  Bot,
  BadgeCheck,
  ListChecks,
  BarChart3,
  GraduationCap,
  Users,
  Settings as SettingsIcon,
  Menu,
  X,
  Bell,
  Search,
  LogOut,
  QrCode,
  Sprout,
  Building2,
  ShieldCheck,
  ChevronDown,
  RefreshCw,
  type LucideIcon,
} from "lucide-react";
import { api } from "@/lib/api";
import { useLang } from "@/lib/i18n";
import { ROLES } from "@/lib/domain";
import { Badge, DemoBadge, fmtDateTime } from "@/components/ui";

const NAV: { slug: string; icon: LucideIcon; key: string }[] = [
  { slug: "dashboard", icon: LayoutDashboard, key: "nav.dashboard" },
  { slug: "production", icon: Factory, key: "nav.production" },
  { slug: "record-bridge", icon: FileSpreadsheet, key: "nav.recordBridge" },
  { slug: "events", icon: Siren, key: "nav.events" },
  { slug: "insights", icon: Lightbulb, key: "nav.insights" },
  { slug: "ai", icon: Bot, key: "nav.ai" },
  { slug: "quality", icon: BadgeCheck, key: "nav.quality" },
  { slug: "actions", icon: ListChecks, key: "nav.actions" },
  { slug: "reports", icon: BarChart3, key: "nav.reports" },
  { slug: "learn", icon: GraduationCap, key: "nav.learn" },
  { slug: "team", icon: Users, key: "nav.team" },
  { slug: "settings", icon: SettingsIcon, key: "nav.settings" },
];

const CLUSTER_NAV: { href: string; icon: LucideIcon; key: string }[] = [
  { href: "/cluster", icon: LayoutDashboard, key: "nav.cluster" },
  { href: "/cluster#challenges", icon: Siren, key: "nav.clusterReports" },
  { href: "/cluster#support", icon: GraduationCap, key: "nav.clusterSupport" },
];

interface Me {
  user: { id: string; name: string; email: string; role: string; isDemo: boolean } | null;
  business: { id: string; name: string; industry: string; isDemo: boolean } | null;
  isDemo: boolean;
  guest?: boolean;
}

const DEMO_SWITCH = [
  { slug: "odisha-metal-works", name: "Odisha Metal Works — Fabrication" },
  { slug: "utkal-electrical", name: "Utkal Electrical Systems — Electrical" },
  { slug: "odisha-handloom", name: "Odisha Handloom Cooperative — Handloom" },
  { slug: "pragati-engineering", name: "Pragati Engineering Works — Other" },
  { slug: "cluster", name: "Cluster Supervisor view (aggregated)" },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { t, lang, setLang } = useLang();
  const pathname = usePathname();
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [searchRes, setSearchRes] = useState<any>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [notes, setNotes] = useState<any[]>([]);
  const [unread, setUnread] = useState(0);
  const [showNotes, setShowNotes] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [resetting, setResetting] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const notesRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api<Me>("auth")
      .then((d) => {
        if (!d.user) return; // open demo: guest context always provides a demo user
        setMe(d);
        if (d.user.role === "worker") router.push("/worker");
        if (d.user.role === "cluster" && !pathname.startsWith("/cluster")) router.push("/cluster");
      })
      .catch(() => router.push("/login"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!me?.user) return;
    api("notifications").then((d) => {
      setNotes(d.notifications);
      setUnread(d.unread);
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me?.user?.id]);

  useEffect(() => {
    if (!search.trim()) {
      setSearchRes(null);
      return;
    }
    const h = setTimeout(() => {
      api(`search?q=${encodeURIComponent(search)}&lang=${lang}`)
        .then((d) => {
          setSearchRes(d);
          setShowSearch(true);
        })
        .catch(() => {});
    }, 250);
    return () => clearTimeout(h);
  }, [search]);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setShowSearch(false);
      if (notesRef.current && !notesRef.current.contains(e.target as Node)) setShowNotes(false);
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setShowProfile(false);
    };
    window.addEventListener("mousedown", close);
    return () => window.removeEventListener("mousedown", close);
  }, []);

  if (!me || !me.user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-cream text-slate-400 text-sm">
        {t("common.loading")}
      </div>
    );
  }
  const user = me.user;

  const isCluster = user.role === "cluster";
  const roleLabel = ROLES.find((r) => r.id === user.role)?.label ?? user.role;

  const logout = async () => {
    await api("auth", { method: "POST", body: { action: "logout" } });
    router.push("/");
  };
  const resetDemo = async () => {
    if (!confirm("Reset demo data to the original fictional sample data? Your demo changes will be lost.")) return;
    setResetting(true);
    try {
      await api("demo/reset", { method: "POST" });
      window.location.reload();
    } catch (e) {
      alert((e as Error).message);
      setResetting(false);
    }
  };

  const sidebar = (
    <div className="flex h-full flex-col">
      <Link href="/" className="flex items-center gap-2.5 px-5 pb-5 pt-6" aria-label="Pragati Mitra — back to home">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal text-white shadow-sm">
          <Sprout size={22} />
        </div>
        <div>
          <p className="text-[15px] font-extrabold tracking-tight text-navy leading-none">{t("app.name")}</p>
          <p className="mt-1 text-[10px] font-medium text-slate-400 leading-none">{t("app.tagline")}</p>
        </div>
      </Link>
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 pb-3">
        {isCluster
          ? CLUSTER_NAV.map((n) => (
              <Link key={n.href} href={n.href} onClick={() => setOpen(false)} className={`navlink ${pathname.startsWith("/cluster") ? "navlink-active" : ""}`}>
                <n.icon size={18} />
                {t(n.key)}
              </Link>
            ))
          : NAV.map((n) => (
              <Link key={n.slug} href={`/app/${n.slug}`} onClick={() => setOpen(false)} className={`navlink ${pathname === `/app/${n.slug}` ? "navlink-active" : ""}`}>
                <n.icon size={18} />
                {t(n.key)}
              </Link>
            ))}
      </nav>
      {!isCluster && (
        <div className="px-3 pb-3">
          <Link href="/worker" className="card flex items-center gap-3 !rounded-xl p-3 hover:border-teal/40 transition-colors">
            <div className="rounded-lg bg-teal-light p-2 text-teal-dark">
              <QrCode size={18} />
            </div>
            <div>
              <p className="text-sm font-bold text-navy">{t("top.workerView")}</p>
              <p className="text-[11px] text-slate-400">QR-based simple reporting</p>
            </div>
          </Link>
        </div>
      )}
      <div className="border-t border-slate-100 p-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-navy text-white text-xs font-bold">
            {user.name.slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-navy">{user.name}</p>
            <Badge tone="teal">{roleLabel}</Badge>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen lg:pl-64">
      {/* Sidebar desktop */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-slate-200/70 bg-white lg:block">
        {sidebar}
      </aside>
      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-navy-dark/50" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 max-w-[85vw] bg-white shadow-pop">{sidebar}</aside>
        </div>
      )}

      {/* Topbar */}
      <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/90 backdrop-blur">
        <div className="flex items-center gap-2 px-3 sm:px-5 py-2.5">
          <button className="btn-ghost btn-sm lg:hidden" onClick={() => setOpen(true)} aria-label="Menu">
            <Menu size={18} />
          </button>
          <div className="hidden min-w-0 sm:flex sm:items-center sm:gap-2">
            <Building2 size={17} className="shrink-0 text-teal-dark" />
            <span className="truncate text-sm font-bold text-navy">{isCluster ? "Authorised MSME Cluster" : me.business?.name}</span>
            {!isCluster && me.business && <Badge tone="grey">{me.business.industry}</Badge>}
            {me.guest && <Badge tone="amber">GUEST</Badge>}
          </div>
          {me.isDemo && <div className="hidden md:block"><DemoBadge /></div>}

          <div className="flex-1" />

          {/* Search */}
          <div ref={searchRef} className="relative block w-28 xs:w-36 sm:w-56 lg:w-72">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onFocus={() => searchRes && setShowSearch(true)}
              placeholder={t("top.search")}
              className="input !pl-9 !py-1.5 !text-[13px]"
            />
            {showSearch && searchRes && (
              <div className="absolute right-0 top-full z-50 mt-2 w-96 max-w-[90vw] card !rounded-xl shadow-pop overflow-hidden">
                {["jobs", "events", "actions", "quality", "imports"].map((k) =>
                  (searchRes[k]?.length ?? 0) > 0 ? (
                    <div key={k}>
                      <p className="bg-slate-50 px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">{t(`search.${k}` as never) !== `search.${k}` ? t(`search.${k}` as never) : k}</p>
                      {searchRes[k].map((r: any, i: number) => (
                        <Link
                          key={i}
                          href={r.link}
                          onClick={() => {
                            setShowSearch(false);
                            setSearch("");
                          }}
                          className="block px-4 py-2 text-[13px] hover:bg-teal-light/50"
                        >
                          <span className="font-semibold text-navy">{r.code ?? r.title ?? r.category}</span>{" "}
                          <span className="text-slate-500">{r.title ?? r.description ?? r.status}</span>
                        </Link>
                      ))}
                    </div>
                  ) : null
                )}
                {["jobs", "events", "actions", "quality", "imports"].every((k) => !(searchRes[k]?.length > 0)) && (
                  <p className="px-4 py-3 text-[13px] text-slate-400">{t("top.noResults")}</p>
                )}
              </div>
            )}
          </div>

          {/* Language */}
          <div className="relative">
            <select
              value={lang}
              onChange={(e) => setLang(e.target.value as "en" | "od")}
              className="input !w-auto !py-1.5 !text-[13px] !pr-7 cursor-pointer appearance-none font-semibold"
              aria-label={t("top.language")}
            >
              <option value="en">English</option>
              <option value="od">Odia</option>
            </select>
            <ChevronDown size={13} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-slate-400" />
          </div>

          {/* Notifications */}
          <div ref={notesRef} className="relative">
            <button className="btn-ghost btn-sm relative" onClick={() => setShowNotes((v) => !v)} aria-label={t("top.notifications")}>
              <Bell size={17} />
              {unread > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                  {unread}
                </span>
              )}
            </button>
            {showNotes && (
              <div className="absolute right-0 top-full z-50 mt-2 w-80 card !rounded-xl shadow-pop overflow-hidden">
                <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
                  <p className="text-xs font-bold text-navy">{t("top.notifications")}</p>
                  <button
                    className="text-[11px] font-semibold text-teal-dark hover:underline"
                    onClick={async () => {
                      await api("notifications", { method: "POST", body: {} });
                      setUnread(0);
                      setNotes((n) => n.map((x) => ({ ...x, read: true })));
                    }}
                  >
                    {t("top.markRead")}
                  </button>
                </div>
                <div className="max-h-72 overflow-y-auto">
                  {notes.length === 0 && <p className="px-4 py-6 text-center text-xs text-slate-400">—</p>}
                  {notes.map((n) => (
                    <Link key={n.id} href={n.link ?? "#"} onClick={() => setShowNotes(false)} className={`block border-b border-slate-50 px-4 py-2.5 hover:bg-slate-50 ${n.read ? "" : "bg-teal-light/40"}`}>
                      <p className="text-[13px] text-slate-700">{n.message}</p>
                      <p className="mt-0.5 text-[10px] text-slate-400">{fmtDateTime(n.createdAt)}</p>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Profile */}
          <div ref={profileRef} className="relative">
            <button className="btn-ghost btn-sm !px-2" onClick={() => setShowProfile((v) => !v)}>
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-navy text-[10px] font-bold text-white">
                {user.name.slice(0, 2).toUpperCase()}
              </div>
              <ChevronDown size={13} className="text-slate-400" />
            </button>
            {showProfile && (
              <div className="absolute right-0 top-full z-50 mt-2 w-64 card !rounded-xl shadow-pop overflow-hidden">
                <div className="border-b border-slate-100 px-4 py-3">
                  <p className="text-sm font-bold text-navy">{me.guest ? "Guest — Demo Explorer" : user.name}</p>
                  <p className="truncate text-xs text-slate-400">{me.guest ? "No account needed — fictional sample data" : user.email}</p>
                  <div className="mt-1.5"><Badge tone="teal">{roleLabel}</Badge> {me.isDemo && <Badge tone="amber">DEMO</Badge>} {me.guest && <Badge tone="amber">GUEST</Badge>}</div>
                </div>
                <div className="p-1.5 text-[13px]">
                  {!isCluster && (
                    <Link href="/worker" onClick={() => setShowProfile(false)} className="flex items-center gap-2 rounded-lg px-3 py-2 hover:bg-slate-50 text-slate-700">
                      <QrCode size={15} className="text-teal-dark" /> {t("top.workerView")}
                    </Link>
                  )}
                  {(me.isDemo) && (
                    <>
                      <div className="px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">{t("role.switch")} — {t("role.current")}: {roleLabel}</div>
                      {ROLES.map((r) => (
                        <button
                          key={r.id}
                          onClick={async () => {
                            try {
                              if (r.id === "cluster") {
                                await api("auth", { method: "POST", body: { action: "role", mode: "cluster" } });
                                window.location.href = "/cluster";
                              } else {
                                await api("auth", { method: "POST", body: { action: "role", role: r.id } });
                                window.location.href = r.id === "worker" ? "/worker" : "/app/dashboard";
                              }
                            } catch (e) {
                              alert((e as Error).message);
                            }
                          }}
                          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 hover:bg-teal-light/60 text-slate-700 text-left"
                        >
                          <ShieldCheck size={14} className="text-teal-dark shrink-0" /> {r.label}
                        </button>
                      ))}
                      <div className="my-1 border-t border-slate-100" />
                    </>
                  )}
                  {me.guest && (
                    <>
                      <div className="px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">Switch demo view</div>
                      {DEMO_SWITCH.map((d) => (
                        <button
                          key={d.slug}
                          onClick={async () => {
                            await api("auth", { method: "POST", body: d.slug === "cluster" ? { action: "guest", mode: "cluster" } : { action: "guest", slug: d.slug } });
                            window.location.href = d.slug === "cluster" ? "/cluster" : "/app/dashboard";
                          }}
                          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 hover:bg-teal-light/60 text-slate-700 text-left"
                        >
                          <Building2 size={14} className="text-teal-dark shrink-0" /> {d.name}
                        </button>
                      ))}
                      <div className="my-1 border-t border-slate-100" />
                      <Link href="/login" onClick={() => setShowProfile(false)} className="flex items-center gap-2 rounded-lg px-3 py-2 hover:bg-slate-50 text-slate-700">
                        <LogOut size={15} className="rotate-180 text-teal-dark" /> Sign in (optional)
                      </Link>
                      <Link href="/register" onClick={() => setShowProfile(false)} className="flex items-center gap-2 rounded-lg px-3 py-2 hover:bg-slate-50 text-slate-700">
                        <Users size={15} className="text-teal-dark" /> Create free account
                      </Link>
                    </>
                  )}
                  {me.isDemo && (
                    <button
                      disabled={resetting}
                      onClick={resetDemo}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 hover:bg-amber-50 text-amber-700"
                    >
                      <RefreshCw size={15} className={resetting ? "animate-spin" : ""} /> {t("settings.resetDemo")}
                    </button>
                  )}
                  {!me.guest && (
                    <button onClick={logout} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 hover:bg-red-50 text-red-600">
                      <LogOut size={15} /> {t("top.logout")}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
        {me.isDemo && (
          <div className="bg-amber-50 border-t border-amber-100 px-5 py-1 text-center text-[11px] font-bold tracking-wide text-amber-700 md:hidden">
            {t("top.demoBadge")}
          </div>
        )}
      </header>

      <main className="p-3 sm:p-5 lg:p-6">{children}</main>
    </div>
  );
}
