"use client";

import { useCallback, useEffect, useState } from "react";
import { Users, Plus, RefreshCw, ShieldCheck, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { useLang } from "@/lib/i18n";
import { Badge, Button, Card, Empty, Field, Modal, PageHeader, Spinner, fmtDate } from "@/components/ui";
import { ROLES } from "@/lib/domain";

const CAPABILITIES: Record<string, string[]> = {
  owner: ["Everything: insights, actions, reports", "Manage team & roles", "Business settings & onboarding plan"],
  manager: ["Monitor orders, production, materials", "Review problems & reports", "Verify events"],
  supervisor: ["Update job/batch progress", "Verify reported events", "Assign & follow up tasks"],
  worker: ["View assigned work (QR)", "Start / pause / complete stages", "Report problems"],
  storekeeper: ["Record material availability", "Report shortages", "Update material readiness"],
  quality: ["Record inspections", "Record defects & rework", "Track rework"],
};

export default function TeamSection() {
  const { t } = useLang();
  const [members, setMembers] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [me, setMe] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([api("team"), api("auth")])
      .then(([tm, a]) => {
        setMembers(tm.members);
        setRoles(tm.roles);
        setMe(a.user);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);
  useEffect(load, [load]);

  const canManage = me && ["owner", "manager"].includes(me.role);

  const remove = async (m: any) => {
    if (!confirm(`Remove ${m.name} from the team?`)) return;
    try {
      await api(`team/${m.id}`, { method: "DELETE" });
      load();
    } catch (e) {
      alert((e as Error).message);
    }
  };

  const changeRole = async (id: string, role: string) => {
    try {
      await api(`team/${id}`, { method: "PATCH", body: { role } });
      load();
    } catch (e) {
      alert((e as Error).message);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("nav.team")}
        desc="Role-based access. Each role sees and can do only what it needs — workers get the simple QR view."
        actions={
          <>
            <button className="btn-ghost btn-sm" onClick={load}><RefreshCw size={14} /> {t("common.refresh")}</button>
            {canManage && <button className="btn-teal btn-sm" onClick={() => setShowInvite(true)}><Plus size={15} /> {t("team.invite")}</button>}
          </>
        }
      />

      <Card pad={false} title="Team members">
        {loading ? <Spinner /> : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr><th className="th">Name</th><th className="th">Email</th><th className="th">Role</th><th className="th">Phone</th><th className="th">Joined</th><th className="th">Change role</th><th className="th"></th></tr></thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-50/60">
                    <td className="td">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-navy text-[10px] font-bold text-white">{m.name.slice(0, 2).toUpperCase()}</div>
                        <span className="font-bold text-navy">{m.name}</span>
                        {m.isDemo && <Badge tone="amber">demo</Badge>}
                      </div>
                    </td>
                    <td className="td text-xs text-slate-500">{m.email}</td>
                    <td className="td"><Badge tone="teal">{ROLES.find((r) => r.id === m.role)?.label ?? m.role}</Badge></td>
                    <td className="td text-xs">{m.phone ?? "—"}</td>
                    <td className="td text-xs text-slate-400">{fmtDate(m.createdAt)}</td>
                    <td className="td">
                      {canManage && m.role !== "owner" ? (
                        <select className="input !w-40 !py-1 !text-xs" value={m.role} onChange={(e) => changeRole(m.id, e.target.value)}>
                          {roles.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
                        </select>
                      ) : (
                        <span className="text-xs text-slate-300">—</span>
                      )}
                    </td>
                    <td className="td">
                      {canManage && m.role !== "owner" && m.id !== me?.id && (
                        <button className="btn-ghost btn-sm !text-red-600 hover:!bg-red-50" title="Remove member" onClick={() => remove(m)}>
                          <Trash2 size={14} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title={<span className="flex items-center gap-2"><ShieldCheck size={16} className="text-teal-dark" /> Role permissions</span>} subtitle="What each role can do in Pragati Mitra">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {roles.map((r) => (
            <div key={r.id} className="rounded-xl border border-slate-100 p-4">
              <p className="text-sm font-bold text-navy">{r.label}</p>
              <p className="mt-0.5 text-[11px] text-slate-400">{r.desc}</p>
              <ul className="mt-2 list-disc space-y-1 pl-4 text-[11.5px] text-slate-500">
                {(CAPABILITIES[r.id] ?? []).map((c) => <li key={c}>{c}</li>)}
              </ul>
            </div>
          ))}
        </div>
      </Card>

      {showInvite && <InviteModal roles={roles} onClose={() => setShowInvite(false)} onDone={() => { setShowInvite(false); load(); }} />}
    </div>
  );
}

function InviteModal({ roles, onClose, onDone }: any) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("worker");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const submit = async () => {
    setBusy(true);
    setErr("");
    try {
      await api("team", { method: "POST", body: { name, email, role, password, phone } });
      onDone();
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  };
  return (
    <Modal open onClose={onClose} title="Invite team member">
      {err && <div className="mb-3 rounded-xl bg-red-50 px-3 py-2 text-xs font-medium text-red-700">{err}</div>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name"><input className="input" value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <Field label="Email"><input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
        <Field label="Role">
          <select className="input" value={role} onChange={(e) => setRole(e.target.value)}>
            {roles.map((r: any) => <option key={r.id} value={r.id}>{r.label}</option>)}
          </select>
        </Field>
        <Field label="Phone (optional)"><input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} /></Field>
        <Field label="Initial password (min 6 chars)" className="sm:col-span-2"><input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
      </div>
      <p className="mt-3 text-[11px] text-slate-400">The member signs in with this email + password. Passwords are stored hashed — a name or email alone is never treated as authentication.</p>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="teal" disabled={busy || !name || !email || password.length < 6} onClick={submit}>{busy ? "Adding…" : "Add member"}</Button>
      </div>
    </Modal>
  );
}
