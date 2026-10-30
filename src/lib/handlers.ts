import { db } from "@/db";
import crypto from "node:crypto";
import {
  businesses,
  users,
  sessions,
  passwordResets,
  jobs,
  events,
  qualityRecords,
  defectCategories,
  actions,
  imports,
  notifications,
  type UserRow,
  type BusinessRow,
} from "@/db/schema";
import { and, asc, desc, eq, gte, ilike, inArray, or, sql } from "drizzle-orm";
import {
  getSession,
  getContext,
  guestContext,
  createSession,
  setSessionCookie,
  clearSessionCookie,
  clearGuestCookie,
  setGuestCookie,
  deleteSession,
  hashPassword,
  verifyPassword,
  SESSION_COOKIE,
  type SessionContext,
} from "@/lib/auth";
import { resetDemoData } from "@/lib/seed";
import {
  computeInsights,
  dashboardStats,
  dataCompleteness,
  readiness,
  nextBestSteps,
  clusterAggregate,
} from "@/lib/analytics";
import { pragatiAnswer } from "@/lib/ai";
import {
  EVENT_CATEGORIES,
  ROLES,
  industryTemplate,
  buildAdoptionPlan,
  eventCategoryLabel,
  type JobStage,
  type OnboardingInput,
} from "@/lib/domain";
import { cookies } from "next/headers";
import QRCode from "qrcode";

function json(data: unknown, status = 200): Response {
  return Response.json(data, { status });
}
function err(message: string, status = 400): Response {
  return Response.json({ error: message }, { status });
}
function publicUser(u: UserRow) {
  const { passwordHash, ...rest } = u;
  return rest;
}
async function bodyOf(req: Request): Promise<any> {
  try {
    return await req.json();
  } catch {
    return {} as any;
  }
}
function requireBiz(ctx: SessionContext): BusinessRow {
  if (!ctx.business) throw new BizError("This action needs a business context.");
  return ctx.business;
}
class BizError extends Error {}

function currentStageOf(j: { stages: JobStage[] }): string {
  return j.stages.find((s) => s.status !== "completed")?.name ?? "Done";
}
function jobView(j: (typeof jobs.$inferSelect), origin: string) {
  const now = new Date();
  return {
    ...j,
    currentStage: currentStageOf(j),
    daysOverdue:
      j.status !== "completed" && j.expectedCompletion && new Date(j.expectedCompletion) < now
        ? Math.round((now.getTime() - new Date(j.expectedCompletion).getTime()) / 86400000)
        : 0,
    qrUrl: `${origin}/worker?job=${encodeURIComponent(j.code)}`,
  };
}

function toCsv(headers: string[], rows: (string | number | null | undefined)[][]): string {
  const esc = (v: string | number | null | undefined) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.map(esc).join(","), ...rows.map((r) => r.map(esc).join(","))].join("\n");
}

async function notify(businessId: string, excludeUserId: string, message: string, link: string | null) {
  const targets = await db
    .select()
    .from(users)
    .where(and(eq(users.businessId, businessId), inArray(users.role, ["owner", "manager", "supervisor"])));
  await db.insert(notifications).values(
    targets
      .filter((t) => t.id !== excludeUserId)
      .map((t) => ({ userId: t.id, message, link }))
  );
}

export async function handleApi(slug: string[], method: string, req: Request): Promise<Response> {
  const url = new URL(req.url);
  const q = url.searchParams;
  const body = method === "GET" || method === "HEAD" ? {} : await bodyOf(req);
  const origin = url.origin;

  try {
    // ---------------- AUTH ----------------
    if (slug[0] === "auth") {
      if (method === "GET") {
        const sess = await getSession();
        if (!sess) {
          // Open demo: no sign-in required — fall back to the guest demo context.
          const g = await guestContext();
          return json({ user: publicUser(g.user), business: g.business, isDemo: true, guest: true });
        }
        return json({ user: publicUser(sess.user), business: sess.business, isDemo: sess.isDemo, guest: false });
      }
      const action = (body as { action?: string }).action;
      if (action === "login") {
        const { email, password } = body as { email: string; password: string };
        if (!email || !password) return err("Email and password are required.", 422);
        const u = await db.select().from(users).where(eq(users.email, email.toLowerCase().trim())).limit(1);
        if (!u[0] || !verifyPassword(password, u[0].passwordHash)) return err("Incorrect email or password.", 401);
        const token = await createSession(u[0].id);
        await setSessionCookie(token);
        const biz = u[0].businessId ? (await db.select().from(businesses).where(eq(businesses.id, u[0].businessId)).limit(1))[0] : null;
        return json({ user: publicUser(u[0]), business: biz ?? null, isDemo: u[0].isDemo });
      }
      if (action === "register") {
        const b = body as {
          name: string; email: string; password: string; role?: string;
          business?: { name: string; onboarding: OnboardingInput };
        };
        if (!b.name || !b.email || !b.password || b.password.length < 6) return err("Name, a valid email and a password of at least 6 characters are required.", 422);
        const existing = await db.select().from(users).where(eq(users.email, b.email.toLowerCase().trim())).limit(1);
        if (existing[0]) return err("An account with this email already exists.", 409);
        let biz: BusinessRow | null = null;
        if (b.business?.name) {
          const onb = b.business.onboarding;
          const baseSlug = b.business.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "business";
          let slug = baseSlug;
          while ((await db.select().from(businesses).where(eq(businesses.slug, slug)).limit(1)).length) {
            slug = `${baseSlug}-${Math.floor(Math.random() * 10000)}`;
          }
          biz = (
            await db
              .insert(businesses)
              .values({
                name: b.business.name,
                slug,
                industry: onb.industry,
                customIndustry: onb.customIndustry ?? null,
                businessType: onb.businessType,
                products: onb.products,
                workersCount: onb.workersCount,
                recordMethod: onb.recordMethod,
                existingSoftware: onb.existingSoftware,
                mainProblems: onb.mainProblems,
                preferredLanguage: onb.preferredLanguage,
                stages: onb.stages.length ? onb.stages : industryTemplate(onb.industry).stages,
                adoptionPlan: buildAdoptionPlan(onb),
                isDemo: false,
              })
              .returning()
          )[0];
        }
        const role = b.role && ROLES.some((r) => r.id === b.role) && b.role !== "cluster" ? b.role : "owner";
        const u = (
          await db
            .insert(users)
            .values({
              businessId: biz?.id ?? null,
              name: b.name,
              email: b.email.toLowerCase().trim(),
              passwordHash: hashPassword(b.password),
              role: role as UserRow["role"],
              isDemo: false,
            })
            .returning()
        )[0];
        const token = await createSession(u.id);
        await setSessionCookie(token);
        return json({ user: publicUser(u), business: biz, isDemo: false }, 201);
      }
      if (action === "demo") {
        const { slug: demoSlug, mode } = body as { slug?: string; mode?: string };
        if (mode === "cluster") {
          const u = await db.select().from(users).where(and(eq(users.role, "cluster"), eq(users.isDemo, true))).limit(1);
          if (!u[0]) return err("Demo cluster supervisor not found.", 404);
          const token = await createSession(u[0].id);
          await setSessionCookie(token);
          return json({ user: publicUser(u[0]), business: null, isDemo: true });
        }
        if (!demoSlug) return err("Demo business slug is required.", 422);
        const biz = await db.select().from(businesses).where(and(eq(businesses.slug, demoSlug), eq(businesses.isDemo, true))).limit(1);
        if (!biz[0]) return err("Demo business not found.", 404);
        const u = await db
          .select()
          .from(users)
          .where(and(eq(users.businessId, biz[0].id), eq(users.role, "owner"), eq(users.isDemo, true)))
          .limit(1);
        if (!u[0]) return err("Demo user not found.", 404);
        const token = await createSession(u[0].id);
        await setSessionCookie(token);
        return json({ user: publicUser(u[0]), business: biz[0], isDemo: true });
      }
      if (action === "forgot") {
        const { email } = body as { email: string };
        if (!email) return err("Email is required.", 422);
        const u = await db.select().from(users).where(eq(users.email, email.toLowerCase().trim())).limit(1);
        // Always respond ok so the page does not reveal whether an email exists.
        let demoResetUrl: string | null = null;
        if (u[0]) {
          const token = crypto.randomBytes(32).toString("hex");
          await db.insert(passwordResets).values({
            token,
            userId: u[0].id,
            expiresAt: new Date(Date.now() + 3600 * 1000),
          });
          demoResetUrl = `${origin}/reset-password?token=${token}`;
        }
        return json({
          ok: true,
          message: "If this email is registered, a reset link has been created.",
          // Prototype: no mail server is configured, so the link is shown directly (labelled in the UI).
          demoResetUrl,
        });
      }
      if (action === "reset") {
        const { token, password } = body as { token: string; password: string };
        if (!token || !password || password.length < 6) return err("A reset token and a new password of at least 6 characters are required.", 422);
        const rows = await db
          .select()
          .from(passwordResets)
          .where(and(eq(passwordResets.token, token), eq(passwordResets.used, false)))
          .limit(1);
        const pr = rows[0];
        if (!pr || new Date(pr.expiresAt) < new Date()) return err("This reset link is invalid or has expired. Please request a new one.", 400);
        await db.update(users).set({ passwordHash: hashPassword(password) }).where(eq(users.id, pr.userId));
        await db.update(passwordResets).set({ used: true }).where(eq(passwordResets.token, token));
        await db.delete(sessions).where(eq(sessions.userId, pr.userId)); // sign out other sessions
        const u = (await db.select().from(users).where(eq(users.id, pr.userId)).limit(1))[0];
        const sessionToken = await createSession(u.id);
        await setSessionCookie(sessionToken);
        const biz = u.businessId ? (await db.select().from(businesses).where(eq(businesses.id, u.businessId)).limit(1))[0] : null;
        return json({ user: publicUser(u), business: biz ?? null, isDemo: u.isDemo, message: "Password updated. You are now signed in." });
      }
      if (action === "role") {
        // Demo mode: switch to another fictional role without losing demo access.
        const { role, mode } = body as { role?: string; mode?: string };
        if (mode === "cluster") {
          await setGuestCookie("cluster");
          const cu = await db.select().from(users).where(and(eq(users.role, "cluster"), eq(users.isDemo, true))).limit(1);
          if (cu[0]) {
            const token = await createSession(cu[0].id);
            await setSessionCookie(token);
          }
          return json({ ok: true, role: "cluster" });
        }
        const sess = await getSession();
        const base = sess?.business ?? (await guestContext()).business;
        if (!base) return err("No business context.", 403);
        const target = await db
          .select()
          .from(users)
          .where(and(eq(users.businessId, base.id), eq(users.role, String(role)), eq(users.isDemo, true)))
          .limit(1);
        if (!target[0]) return err("No demo user with that role in this business.", 404);
        const token = await createSession(target[0].id);
        await setSessionCookie(token);
        return json({ user: publicUser(target[0]), business: base, isDemo: true, ok: true });
      }
      if (action === "guest") {
        const { slug: gslug, mode } = body as { slug?: string; mode?: string };
        if (mode === "cluster") {
          await setGuestCookie("cluster");
          return json({ ok: true, guest: "cluster" });
        }
        if (!gslug) return err("Demo business slug is required.", 422);
        const biz = await db.select().from(businesses).where(and(eq(businesses.slug, gslug), eq(businesses.isDemo, true))).limit(1);
        if (!biz[0]) return err("Demo business not found.", 404);
        await setGuestCookie(gslug);
        return json({ ok: true, guest: gslug });
      }
      if (action === "logout") {
        const store = await cookies();
        const token = store.get(SESSION_COOKIE)?.value;
        if (token) await deleteSession(token);
        await clearSessionCookie();
        await clearGuestCookie();
        return json({ ok: true });
      }
      return err("Unknown auth action.", 422);
    }

    // ---------------- open demo: session if present, guest demo context otherwise ----------------
    const ctx = await getContext();

    if (slug[0] === "demo" && slug[1] === "reset") {
      if (!ctx.isDemo) return err("Reset Demo is available only in demo mode.", 403);
      if (method !== "POST") return err("Method not allowed.", 405);
      await resetDemoData();
      return json({ ok: true, message: "Demo data reset to fictional sample data." });
    }

    // ---------------- CLUSTER ----------------
    if (slug[0] === "cluster") {
      if (method !== "GET") return err("Method not allowed.", 405);
      let clusterId = ctx.user.clusterId;
      if (ctx.user.role !== "cluster" || !clusterId) {
        const cu = await db.select().from(users).where(and(eq(users.role, "cluster"), eq(users.isDemo, true))).limit(1);
        if (!cu[0] || !cu[0].clusterId) return err("No cluster configured.", 404);
        clusterId = cu[0].clusterId;
      }
      const agg = await clusterAggregate(clusterId);
      return json({ cluster: { id: clusterId, name: "Authorised MSME Cluster" }, ...agg, guest: ctx.user.role !== "cluster" });
    }

    // ---------------- BUSINESS / SETTINGS ----------------
    if (slug[0] === "business") {
      const biz = requireBiz(ctx);
      if (method === "GET") {
        const r = await readiness(biz.id);
        return json({ business: biz, readiness: r, industryTemplate: industryTemplate(biz.industry) });
      }
      if (method === "PATCH") {
        const b = body as Partial<BusinessRow> & { stages?: string[]; mainProblems?: string[] };
        const allowed: Record<string, unknown> = {};
        for (const k of ["name", "location", "products", "businessType", "customIndustry", "industry", "workersCount", "recordMethod", "existingSoftware", "preferredLanguage", "stages", "mainProblems"] as const) {
          if (b[k] !== undefined) allowed[k] = b[k];
        }
        if (allowed.industry && !["fabrication", "electrical", "handloom", "other"].includes(String(allowed.industry))) return err("Invalid industry.");
        const updated = (await db.update(businesses).set(allowed).where(eq(businesses.id, biz.id)).returning())[0];
        return json({ business: updated });
      }
      return err("Method not allowed.", 405);
    }

    // ---------------- DASHBOARD ----------------
    if (slug[0] === "dashboard" && method === "GET") {
      const biz = requireBiz(ctx);
      const [stats, ins, ready, steps, comp] = await Promise.all([
        dashboardStats(biz.id),
        computeInsights(biz.id),
        readiness(biz.id),
        nextBestSteps(biz.id),
        dataCompleteness(biz.id),
      ]);
      return json({ stats, insights: ins.insights.slice(0, 4), readiness: ready, nextSteps: steps, completeness: comp, period: ins.period });
    }

    // ---------------- JOBS ----------------
    if (slug[0] === "jobs") {
      const biz = requireBiz(ctx);
      if (method === "GET" && slug.length === 1) {
        let list = await db.select().from(jobs).where(eq(jobs.businessId, biz.id)).orderBy(desc(jobs.createdAt));
        if (ctx.user.role === "worker") list = list.filter((j) => (j.workerIds ?? []).includes(ctx.user.id));
        const status = q.get("status");
        if (status) list = list.filter((j) => j.status === status);
        const search = q.get("q")?.toLowerCase();
        if (search) list = list.filter((j) => (j.code + j.title + (j.product ?? "")).toLowerCase().includes(search));
        return json({ jobs: list.map((j) => jobView(j, origin)) });
      }
      if (method === "POST" && slug.length === 1) {
        const b = body as {
          title: string; product?: string; quantity: number; industry?: string;
          stages?: string[]; supervisorId?: string; workerIds?: string[];
          plannedStart?: string; expectedCompletion?: string;
        };
        if (!b.title || !b.quantity) return err("Job title and quantity are required.", 422);
        const industry = b.industry ?? biz.industry;
        const stageNames = b.stages?.length ? b.stages : biz.stages?.length ? biz.stages : industryTemplate(industry).stages;
        const prefix = biz.name.split(/\s+/).map((w) => w[0]).join("").slice(0, 3).toUpperCase() || "JOB";
        const count = (await db.select({ c: sql<number>`count(*)::int` }).from(jobs).where(eq(jobs.businessId, biz.id)))[0]?.c ?? 0;
        let code = `${prefix}-${101 + count}`;
        while ((await db.select().from(jobs).where(and(eq(jobs.businessId, biz.id), eq(jobs.code, code))).limit(1)).length) {
          code = `${prefix}-${101 + count + Math.floor(Math.random() * 900)}`;
        }
        const stages: JobStage[] = stageNames.map((name, i) => ({ name, order: i, status: "pending" as const }));
        const job = (
          await db
            .insert(jobs)
            .values({
              businessId: biz.id,
              code,
              title: b.title,
              product: b.product ?? null,
              quantity: Number(b.quantity) || 0,
              completedQty: 0,
              industry,
              stages,
              status: "active",
              supervisorId: b.supervisorId ?? null,
              workerIds: b.workerIds ?? [],
              plannedStart: b.plannedStart ? new Date(b.plannedStart) : new Date(),
              expectedCompletion: b.expectedCompletion ? new Date(b.expectedCompletion) : null,
              qrToken: `qr_${code.toLowerCase()}`,
            })
            .returning()
        )[0];
        await notify(biz.id, ctx.user.id, `New job ${code} created by ${ctx.user.name}.`, "/app/production");
        return json({ job: jobView(job, origin) }, 201);
      }
      if (slug.length >= 2 && slug[1]) {
        const jobId = slug[1];
        const jobRows = await db.select().from(jobs).where(and(eq(jobs.id, jobId), eq(jobs.businessId, biz.id))).limit(1);
        if (!jobRows[0]) return err("Job not found.", 404);
        const job = jobRows[0];
        if (ctx.user.role === "worker" && !(job.workerIds ?? []).includes(ctx.user.id) && job.supervisorId !== ctx.user.id) {
          return err("This job is not assigned to you.", 403);
        }
        if (method === "GET" && slug.length === 2) {
          const qrDataUrl = await QRCode.toDataURL(`${origin}/worker?job=${encodeURIComponent(job.code)}`, { margin: 1, width: 320 });
          const jobEvents = await db.select().from(events).where(eq(events.jobId, job.id)).orderBy(desc(events.createdAt));
          const jobQuality = await db.select().from(qualityRecords).where(eq(qualityRecords.jobId, job.id)).orderBy(desc(qualityRecords.createdAt));
          const people = await db.select({ id: users.id, name: users.name, role: users.role }).from(users).where(eq(users.businessId, biz.id));
          return json({ job: jobView(job, origin), qrDataUrl, events: jobEvents, quality: jobQuality, people });
        }
        if (method === "PATCH" && slug.length === 2) {
          const b = body as { completedQty?: number; status?: string; expectedCompletion?: string; title?: string; product?: string; quantity?: number; supervisorId?: string; workerIds?: string[] };
          const set: Record<string, unknown> = {};
          for (const k of ["completedQty", "title", "product", "quantity", "supervisorId", "workerIds", "expectedCompletion"] as const) {
            if (b[k] !== undefined) set[k] = k === "expectedCompletion" ? (b[k] ? new Date(b[k] as string) : null) : b[k];
          }
          if (b.status && ["active", "delayed", "completed", "on_hold"].includes(b.status)) {
            set.status = b.status;
            if (b.status === "completed") {
              if (!job.actualCompletion) set.actualCompletion = new Date();
              set.stages = job.stages.map((st) => (st.status === "completed" ? st : { ...st, status: "completed", completedAt: new Date().toISOString() }));
            }
          }
          const updated = (await db.update(jobs).set(set).where(eq(jobs.id, job.id)).returning())[0];
          return json({ job: jobView(updated, origin) });
        }
        if (method === "DELETE" && slug.length === 2) {
          if (!["owner", "manager"].includes(ctx.user.role)) return err("Only owner or manager can delete a job.", 403);
          await db.delete(jobs).where(and(eq(jobs.id, jobId), eq(jobs.businessId, biz.id)));
          return json({ ok: true });
        }
        if (method === "POST" && slug[2] === "stage") {
          const b = body as { stageIndex: number; action: "start" | "pause" | "complete" | "reopen"; note?: string };
          const stages = job.stages.map((s) => ({ ...s }));
          const s = stages[b.stageIndex];
          if (!s) return err("Stage not found.", 404);
          const now = new Date().toISOString();
          if (b.action === "start" && (s.status === "pending" || s.status === "paused")) {
            s.status = "in_progress";
            s.startedAt = s.startedAt ?? now;
            s.pausedAt = null;
            if (b.note) s.note = b.note;
          } else if (b.action === "pause" && s.status === "in_progress") {
            s.status = "paused";
            s.pausedAt = now;
          } else if (b.action === "complete" && (s.status === "in_progress" || s.status === "paused")) {
            s.status = "completed";
            s.completedAt = now;
            if (b.note) s.note = b.note;
          } else if (b.action === "reopen" && s.status === "completed") {
            s.status = "pending";
            s.completedAt = null;
          } else {
            return err(`Cannot ${b.action} a stage that is ${s.status}.`, 422);
          }
          const allDone = stages.every((x) => x.status === "completed");
          const set: Record<string, unknown> = { stages };
          if (allDone) {
            set.status = "completed";
            set.actualCompletion = new Date();
          } else if (job.expectedCompletion && new Date(job.expectedCompletion) < new Date()) {
            set.status = "delayed";
          } else {
            set.status = "active";
          }
          const updated = (await db.update(jobs).set(set).where(eq(jobs.id, job.id)).returning())[0];
          if (b.action === "complete") {
            await notify(biz.id, ctx.user.id, `${ctx.user.name} completed stage "${s.name}" on job ${job.code}.`, "/app/production");
          }
          return json({ job: jobView(updated, origin) });
        }
      }
      return err("Method not allowed.", 405);
    }

    // ---------------- EVENTS ----------------
    if (slug[0] === "events") {
      const biz = requireBiz(ctx);
      if (method === "GET" && slug.length === 1) {
        let list = await db.select().from(events).where(eq(events.businessId, biz.id)).orderBy(desc(events.createdAt));
        const cat = q.get("category");
        if (cat) list = list.filter((e) => e.category === cat);
        if (q.get("verified") === "false") list = list.filter((e) => !e.verified);
        const jobCode = q.get("job");
        const reporterIds = [...new Set(list.map((e) => e.reporterId).filter(Boolean) as string[])];
        const reporters = reporterIds.length ? await db.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, reporterIds)) : [];
        const rmap = new Map(reporters.map((r) => [r.id, r.name]));
        const jobIds = [...new Set(list.map((e) => e.jobId).filter(Boolean) as string[])];
        const jrows = jobIds.length ? await db.select({ id: jobs.id, code: jobs.code }).from(jobs).where(inArray(jobs.id, jobIds)) : [];
        const jmap = new Map(jrows.map((j) => [j.id, j.code]));
        let out = list.map((e) => ({ ...e, reporterName: e.reporterId ? rmap.get(e.reporterId) ?? null : null, jobCode: e.jobId ? jmap.get(e.jobId) ?? null : null }));
        if (jobCode) out = out.filter((e) => e.jobCode === jobCode);
        return json({ events: out, categories: EVENT_CATEGORIES });
      }
      if (method === "POST" && slug.length === 1) {
        const b = body as {
          jobCode?: string; jobId?: string; stage?: string; category: string;
          description?: string; startTime?: string; endTime?: string;
          durationMinutes?: number; qtyAffected?: number;
        };
        if (!b.category || !EVENT_CATEGORIES.some((c) => c.id === b.category)) return err("A valid event category is required.", 422);
        let jobId = b.jobId ?? null;
        if (!jobId && b.jobCode) {
          const j = await db.select().from(jobs).where(and(eq(jobs.businessId, biz.id), eq(jobs.code, b.jobCode))).limit(1);
          if (j[0]) jobId = j[0].id;
        }
        const start = b.startTime ? new Date(b.startTime) : new Date();
        const end = b.endTime ? new Date(b.endTime) : null;
        let dur = b.durationMinutes ?? null;
        if (dur == null && end) dur = Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000));
        const ev = (
          await db
            .insert(events)
            .values({
              businessId: biz.id,
              jobId,
              stage: b.stage ?? null,
              category: b.category,
              description: b.description ?? null,
              startTime: start,
              endTime: end,
              durationMinutes: dur,
              qtyAffected: b.qtyAffected ?? null,
              reporterId: ctx.user.id,
              verified: ctx.user.role === "supervisor" || ctx.user.role === "manager" || ctx.user.role === "owner" ? true : false,
              verifiedBy: ctx.user.role === "supervisor" || ctx.user.role === "manager" || ctx.user.role === "owner" ? ctx.user.id : null,
              verifiedAt: ctx.user.role === "supervisor" || ctx.user.role === "manager" || ctx.user.role === "owner" ? new Date() : null,
            })
            .returning()
        )[0];
        await notify(biz.id, ctx.user.id, `${ctx.user.name} reported "${eventCategoryLabel(b.category)}"${jobId ? " on a job" : ""}.`, "/app/events");
        return json({ event: ev }, 201);
      }
      if (method === "DELETE" && slug[1]) {
        if (!["owner", "manager", "supervisor"].includes(ctx.user.role)) return err("Only owner, manager or supervisor can delete events.", 403);
        await db.delete(events).where(and(eq(events.id, slug[1]), eq(events.businessId, biz.id)));
        return json({ ok: true });
      }
      if (method === "PATCH" && slug[1]) {
        if (!["owner", "manager", "supervisor"].includes(ctx.user.role)) return err("Only owner, manager or supervisor can verify events.", 403);
        const b = body as { verified?: boolean };
        const updated = (
          await db
            .update(events)
            .set({ verified: b.verified ?? true, verifiedBy: ctx.user.id, verifiedAt: new Date() })
            .where(and(eq(events.id, slug[1]), eq(events.businessId, biz.id)))
            .returning()
        )[0];
        if (!updated) return err("Event not found.", 404);
        return json({ event: updated });
      }
      return err("Method not allowed.", 405);
    }

    // ---------------- QUALITY ----------------
    if (slug[0] === "quality") {
      const biz = requireBiz(ctx);
      if (method === "GET" && slug.length === 1) {
        const list = await db.select().from(qualityRecords).where(eq(qualityRecords.businessId, biz.id)).orderBy(desc(qualityRecords.createdAt));
        const jobIds = [...new Set(list.map((x) => x.jobId).filter(Boolean) as string[])];
        const jrows = jobIds.length ? await db.select({ id: jobs.id, code: jobs.code }).from(jobs).where(inArray(jobs.id, jobIds)) : [];
        const jmap = new Map(jrows.map((j) => [j.id, j.code]));
        return json({ records: list.map((r) => ({ ...r, jobCode: r.jobId ? jmap.get(r.jobId) ?? null : null })) });
      }
      if (method === "DELETE" && slug[1]) {
        if (!["owner", "manager", "quality"].includes(ctx.user.role)) return err("Only owner, manager or quality checker can delete records.", 403);
        await db.delete(qualityRecords).where(and(eq(qualityRecords.id, slug[1]), eq(qualityRecords.businessId, biz.id)));
        return json({ ok: true });
      }
      if (method === "POST" && slug.length === 1) {
        const b = body as { jobCode?: string; stage?: string; inspected: number; accepted: number; rejected: number; rework: number; defectCategory?: string; notes?: string };
        if (b.inspected == null) return err("Inspected quantity is required.", 422);
        let jobId = null as string | null;
        if (b.jobCode) {
          const j = await db.select().from(jobs).where(and(eq(jobs.businessId, biz.id), eq(jobs.code, b.jobCode))).limit(1);
          if (j[0]) jobId = j[0].id;
        }
        const rec = (
          await db
            .insert(qualityRecords)
            .values({
              businessId: biz.id,
              jobId,
              stage: b.stage ?? null,
              inspected: Number(b.inspected) || 0,
              accepted: Number(b.accepted) || 0,
              rejected: Number(b.rejected) || 0,
              rework: Number(b.rework) || 0,
              defectCategory: b.defectCategory ?? null,
              notes: b.notes ?? null,
              inspectorId: ctx.user.id,
            })
            .returning()
        )[0];
        return json({ record: rec }, 201);
      }
      return err("Method not allowed.", 405);
    }

    if (slug[0] === "defects") {
      const biz = requireBiz(ctx);
      if (method === "GET") {
        const list = await db.select().from(defectCategories).where(eq(defectCategories.businessId, biz.id));
        return json({ defects: list, industryDefaults: industryTemplate(biz.industry).defects });
      }
      if (method === "DELETE" && slug[1]) {
        if (!["owner", "manager", "quality"].includes(ctx.user.role)) return err("Not allowed.", 403);
        await db.delete(defectCategories).where(and(eq(defectCategories.id, slug[1]), eq(defectCategories.businessId, biz.id)));
        return json({ ok: true });
      }
      if (method === "POST") {
        const b = body as { name: string };
        if (!b.name?.trim()) return err("Defect name is required.", 422);
        const row = (await db.insert(defectCategories).values({ businessId: biz.id, name: b.name.trim(), industry: biz.industry }).returning())[0];
        return json({ defect: row }, 201);
      }
      return err("Method not allowed.", 405);
    }

    // ---------------- ACTIONS ----------------
    if (slug[0] === "actions") {
      const biz = requireBiz(ctx);
      if (method === "GET" && slug.length === 1) {
        const list = await db.select().from(actions).where(eq(actions.businessId, biz.id)).orderBy(desc(actions.createdAt));
        const uids = [...new Set([...list.map((a) => a.assignedTo), ...list.map((a) => a.createdBy)].filter(Boolean) as string[])];
        const urows = uids.length ? await db.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, uids)) : [];
        const umap = new Map(urows.map((u) => [u.id, u.name]));
        const allEvents = await db.select().from(events).where(eq(events.businessId, biz.id));
        const withImprovement = list.map((a) => {
          let improvement = null as null | { category: string; before: number; after: number; note: string };
          if (a.status === "completed" && a.completedAt) {
            const cat = EVENT_CATEGORIES.find((c) => (a.problemRef ?? "").toLowerCase().includes(c.id.replace(/_/g, " ")) || (a.problemRef ?? "").toLowerCase().includes(c.id))?.id;
            if (cat) {
              const before = allEvents.filter((e) => e.category === cat && new Date(e.createdAt) <= new Date(a.completedAt!) && new Date(e.createdAt) >= new Date(new Date(a.completedAt!).getTime() - 30 * 86400000)).length;
              const after = allEvents.filter((e) => e.category === cat && new Date(e.createdAt) > new Date(a.completedAt!)).length;
              improvement = {
                category: cat,
                before,
                after,
                note: after < before ? "Fewer events recorded after the action — encouraging, but keep monitoring before claiming the action caused it." : "No reduction observed yet — the action may need more time or a different approach.",
              };
            }
          }
          return { ...a, assigneeName: a.assignedTo ? umap.get(a.assignedTo) ?? null : null, creatorName: a.createdBy ? umap.get(a.createdBy) ?? null : null, improvement };
        });
        return json({ actions: withImprovement });
      }
      if (method === "POST" && slug.length === 1) {
        const b = body as { title: string; description?: string; problemRef?: string; insightId?: string; assignedTo?: string; priority?: string; deadline?: string };
        if (!b.title?.trim()) return err("Action title is required.", 422);
        const row = (
          await db
            .insert(actions)
            .values({
              businessId: biz.id,
              title: b.title.trim(),
              description: b.description ?? null,
              problemRef: b.problemRef ?? null,
              insightId: b.insightId ?? null,
              assignedTo: b.assignedTo ?? null,
              priority: ["low", "medium", "high"].includes(b.priority ?? "") ? b.priority : "medium",
              deadline: b.deadline ? new Date(b.deadline) : null,
              status: "pending",
              createdBy: ctx.user.id,
            })
            .returning()
        )[0];
        await notify(biz.id, ctx.user.id, `New corrective action: ${row.title}`, "/app/actions");
        return json({ action: row }, 201);
      }
      if (method === "DELETE" && slug[1]) {
        if (!["owner", "manager"].includes(ctx.user.role)) return err("Only owner or manager can delete actions.", 403);
        await db.delete(actions).where(and(eq(actions.id, slug[1]), eq(actions.businessId, biz.id)));
        return json({ ok: true });
      }
      if (method === "PATCH" && slug[1]) {
        const b = body as { status?: string; completionNotes?: string; verification?: string; assignedTo?: string; priority?: string; deadline?: string };
        const set: Record<string, unknown> = {};
        if (b.status && ["pending", "in_progress", "completed"].includes(b.status)) {
          set.status = b.status;
          if (b.status === "completed") set.completedAt = new Date();
        }
        for (const k of ["completionNotes", "verification", "assignedTo", "priority"] as const) if (b[k] !== undefined) set[k] = b[k];
        if (b.deadline !== undefined) set.deadline = b.deadline ? new Date(b.deadline) : null;
        const updated = (await db.update(actions).set(set).where(and(eq(actions.id, slug[1]), eq(actions.businessId, biz.id))).returning())[0];
        if (!updated) return err("Action not found.", 404);
        return json({ action: updated });
      }
      return err("Method not allowed.", 405);
    }

    // ---------------- INSIGHTS / READINESS ----------------
    if (slug[0] === "insights" && method === "GET") {
      const biz = requireBiz(ctx);
      return json(await computeInsights(biz.id, q.get("lang") === "od" ? "od" : "en"));
    }
    if (slug[0] === "readiness" && method === "GET") {
      const biz = requireBiz(ctx);
      const [r, steps, comp] = await Promise.all([readiness(biz.id), nextBestSteps(biz.id), dataCompleteness(biz.id)]);
      return json({ readiness: r, nextSteps: steps, completeness: comp });
    }

    // ---------------- AI: apply a confirmed proposed update ----------------
    if (slug[0] === "ai" && slug[1] === "apply" && method === "POST") {
      const biz = requireBiz(ctx);
      const update = (body as { update?: { kind: string; payload: Record<string, any> } }).update;
      if (!update?.kind || !update.payload) return err("No update provided.", 422);
      if (update.kind === "production_qty") {
        const { jobId, newQty, willComplete } = update.payload;
        const rows = await db.select().from(jobs).where(and(eq(jobs.id, String(jobId)), eq(jobs.businessId, biz.id))).limit(1);
        if (!rows[0]) return err("Job not found.", 404);
        const job = rows[0];
        const set: Record<string, unknown> = {
          completedQty: Number(newQty),
          stages: (job.stages ?? []).map((st) => (willComplete ? { ...st, status: "completed", completedAt: st.completedAt ?? new Date().toISOString() } : st)),
        };
        if (willComplete) {
          set.status = "completed";
          set.actualCompletion = new Date();
        } else if (job.expectedCompletion && new Date(job.expectedCompletion) < new Date()) {
          set.status = "delayed";
        }
        const updated = (await db.update(jobs).set(set).where(eq(jobs.id, job.id)).returning())[0];
        await notify(biz.id, ctx.user.id, `Job ${updated.code} updated via Pragati AI: ${newQty} completed${willComplete ? " — marked completed" : ""}.`, "/app/production");
        return json({ ok: true, message: `Job ${updated.code}: completed quantity set to ${newQty}${willComplete ? " and the job is now marked completed (completion date = today)." : "."}`, job: jobView(updated, origin) });
      }
      if (update.kind === "job_completed") {
        const { jobId } = update.payload;
        const rows = await db.select().from(jobs).where(and(eq(jobs.id, String(jobId)), eq(jobs.businessId, biz.id))).limit(1);
        if (!rows[0]) return err("Job not found.", 404);
        const job = rows[0];
        const now = new Date();
        const updated = (
          await db
            .update(jobs)
            .set({
              status: "completed",
              actualCompletion: now,
              stages: (job.stages ?? []).map((st) => ({ ...st, status: "completed", completedAt: st.completedAt ?? now.toISOString() })),
            })
            .where(eq(jobs.id, job.id))
            .returning()
        )[0];
        await notify(biz.id, ctx.user.id, `Job ${updated.code} marked completed via Pragati AI.`, "/app/production");
        return json({ ok: true, message: `Job ${updated.code} is now completed (all stages completed, completion date = today). It will no longer appear as pending/delayed.`, job: jobView(updated, origin) });
      }
      if (update.kind === "event") {
        const pl = update.payload;
        let jobId: string | null = null;
        if (pl.jobCode) {
          const j = await db.select().from(jobs).where(and(eq(jobs.businessId, biz.id), eq(jobs.code, String(pl.jobCode)))).limit(1);
          if (j[0]) jobId = j[0].id;
        }
        const privileged = ["owner", "manager", "supervisor"].includes(ctx.user.role);
        const ev = (
          await db
            .insert(events)
            .values({
              businessId: biz.id,
              jobId,
              stage: null,
              category: String(pl.category),
              description: String(pl.description ?? "Reported via Pragati AI"),
              startTime: new Date(),
              durationMinutes: pl.durationMinutes ? Number(pl.durationMinutes) : null,
              qtyAffected: pl.qtyAffected ? Number(pl.qtyAffected) : null,
              reporterId: ctx.user.id,
              verified: privileged,
              verifiedBy: privileged ? ctx.user.id : null,
              verifiedAt: privileged ? new Date() : null,
            })
            .returning()
        )[0];
        await notify(biz.id, ctx.user.id, `New event via Pragati AI: ${eventCategoryLabel(ev.category)}${jobId ? ` on a job` : ""}.`, "/app/events");
        return json({ ok: true, message: `Event recorded in the Event Centre: ${eventCategoryLabel(ev.category)}${pl.durationMinutes ? `, ${pl.durationMinutes} min` : ""}${pl.qtyAffected ? `, ${pl.qtyAffected} affected` : ""}. It now feeds Smart Insights and Reports.`, event: ev });
      }
      return err("Unknown update kind.", 422);
    }

    // ---------------- AI ----------------
    if (slug[0] === "ai" && method === "POST") {
      const b = body as { question: string; lang?: "en" | "od" };
      if (!b.question?.trim()) return err("Question is required.", 422);
      const answer = await pragatiAnswer(b.question, ctx.business?.id ?? null, ctx.user.clusterId ?? null, b.lang === "od" ? "od" : "en");
      return json({ answer });
    }

    // ---------------- RECORD BRIDGE / IMPORTS ----------------
    if (slug[0] === "imports") {
      const biz = requireBiz(ctx);
      if (method === "GET" && slug.length === 1) {
        const list = await db.select().from(imports).where(eq(imports.businessId, biz.id)).orderBy(desc(imports.createdAt));
        return json({ imports: list });
      }
      if (method === "POST" && slug.length === 1) {
        const b = body as { fileName: string; target: "jobs" | "events" | "quality"; mapping: Record<string, string>; rows: Record<string, string>[] };
        if (!b.fileName || !b.target || !Array.isArray(b.rows) || !b.mapping) return err("fileName, target, mapping and rows are required.", 422);
        const cols = b.rows.length ? Object.keys(b.rows[0]) : [];
        let imported = 0, duplicates = 0, missing = 0;
        const mapRow = (r: Record<string, string>) => {
          const o: Record<string, string> = {};
          for (const [col, field] of Object.entries(b.mapping)) if (field && field !== "__skip") o[field] = (r[col] ?? "").trim();
          return o;
        };
        const existingCodes = new Set((await db.select({ code: jobs.code }).from(jobs).where(eq(jobs.businessId, biz.id))).map((j) => j.code));
        for (const row of b.rows) {
          const m = mapRow(row);
          if (b.target === "jobs") {
            const code = m.code || m.title;
            if (!code || !m.title && !m.product) { missing++; continue; }
            if (m.code && existingCodes.has(m.code)) { duplicates++; continue; }
            const prefix = biz.name.split(/\s+/).map((w) => w[0]).join("").slice(0, 3).toUpperCase() || "JOB";
            const code2 = m.code || `${prefix}-${Math.floor(100 + Math.random() * 900)}`;
            existingCodes.add(code2);
            const stageNames = biz.stages?.length ? biz.stages : industryTemplate(biz.industry).stages;
            await db.insert(jobs).values({
              businessId: biz.id,
              code: code2,
              title: m.title || m.product || code2,
              product: m.product ?? null,
              quantity: Number(m.quantity ?? m.qty) || 0,
              completedQty: 0,
              industry: biz.industry,
              stages: stageNames.map((name, i) => ({ name, order: i, status: (m.status ?? "").toLowerCase() === "completed" && i === 0 ? "completed" : "pending" as const, completedAt: (m.status ?? "").toLowerCase() === "completed" && i === 0 ? new Date().toISOString() : null })),
              status: (m.status ?? "active").toLowerCase() === "completed" ? "completed" : "active",
              plannedStart: m.plannedStart || m.date ? new Date(m.plannedStart || m.date!) : new Date(),
              expectedCompletion: m.expectedCompletion ? new Date(m.expectedCompletion) : null,
              actualCompletion: (m.status ?? "").toLowerCase() === "completed" ? new Date() : null,
              qrToken: `qr_${code2.toLowerCase()}`,
            });
            imported++;
          } else if (b.target === "events") {
            const cat = EVENT_CATEGORIES.some((c) => c.id === m.category) ? m.category : "other";
            if (!m.description && !m.category) { missing++; continue; }
            let jobId = null as string | null;
            if (m.jobCode) {
              const j = await db.select().from(jobs).where(and(eq(jobs.businessId, biz.id), eq(jobs.code, m.jobCode))).limit(1);
              if (j[0]) jobId = j[0].id; else duplicates++;
            }
            await db.insert(events).values({
              businessId: biz.id,
              jobId,
              stage: m.stage ?? null,
              category: cat,
              description: m.description ?? null,
              startTime: m.date || m.startTime ? new Date(m.date || m.startTime!) : new Date(),
              durationMinutes: m.durationMinutes ? Number(m.durationMinutes) : null,
              qtyAffected: m.qtyAffected || m.qty ? Number(m.qtyAffected || m.qty) : null,
              reporterId: ctx.user.id,
            });
            imported++;
          } else if (b.target === "quality") {
            if (m.inspected == null || m.inspected === "") { missing++; continue; }
            let jobId = null as string | null;
            if (m.jobCode) {
              const j = await db.select().from(jobs).where(and(eq(jobs.businessId, biz.id), eq(jobs.code, m.jobCode))).limit(1);
              if (j[0]) jobId = j[0].id;
            }
            await db.insert(qualityRecords).values({
              businessId: biz.id,
              jobId,
              stage: m.stage ?? null,
              inspected: Number(m.inspected) || 0,
              accepted: Number(m.accepted) || 0,
              rejected: Number(m.rejected) || 0,
              rework: Number(m.rework) || 0,
              defectCategory: m.defectCategory ?? null,
              notes: m.notes ?? null,
              inspectorId: ctx.user.id,
            });
            imported++;
          }
        }
        const rec = (
          await db
            .insert(imports)
            .values({
              businessId: biz.id,
              fileName: b.fileName,
              target: b.target,
              rowCount: b.rows.length,
              importedCount: imported,
              duplicates,
              missing,
              columns: cols,
              mapping: b.mapping,
              status: imported > 0 ? (duplicates + missing > 0 ? "partial" : "completed") : "failed",
            })
            .returning()
        )[0];
        return json({ import: rec, summary: { rows: b.rows.length, imported, duplicates, missing } }, 201);
      }
      return err("Method not allowed.", 405);
    }

    // ---------------- REPORTS ----------------
    if (slug[0] === "reports" && method === "GET") {
      const type = q.get("type") ?? "daily";
      const format = q.get("format") ?? "json";
      if (ctx.user.role === "cluster" && ctx.user.clusterId) {
        const agg = await clusterAggregate(ctx.user.clusterId);
        if (format === "csv") {
          const csv = toCsv(
            ["Business", "Industry", "Readiness", "Training %", "Jobs", "Active", "Top challenge", "Needs assistance"],
            agg.businesses.map((b) => [b.name, b.customIndustry ?? b.industry, b.readiness, b.training, b.jobs, b.active ? "yes" : "no", b.topChallenge ? `${b.topChallenge.label} (${b.topChallenge.count})` : "—", b.needsAssistance ? "yes" : "no"])
          );
          return new Response(csv, { headers: { "content-type": "text/csv", "content-disposition": `attachment; filename="cluster-report.csv"` } });
        }
        return json({ type, cluster: agg });
      }
      const biz = requireBiz(ctx);
      const allJobs = await db.select().from(jobs).where(eq(jobs.businessId, biz.id)).orderBy(asc(jobs.createdAt));
      const allEvents = await db.select().from(events).where(eq(events.businessId, biz.id)).orderBy(asc(events.createdAt));
      const allQuality = await db.select().from(qualityRecords).where(eq(qualityRecords.businessId, biz.id)).orderBy(asc(qualityRecords.createdAt));
      const allActions = await db.select().from(actions).where(eq(actions.businessId, biz.id)).orderBy(asc(actions.createdAt));
      const now = new Date();
      const iso = (d: Date | null) => (d ? new Date(d).toISOString().slice(0, 10) : "");
      let headers: string[] = [];
      let rows: (string | number | null)[][] = [];
      let payload: unknown = null;

      if (type === "daily") {
        headers = ["Date", "Jobs created", "Jobs completed", "Events", "Unverified events"];
        for (let i = 13; i >= 0; i--) {
          const day = new Date(now.getTime() - i * 86400000);
          const key = iso(day);
          const dayStart = new Date(day); dayStart.setHours(0, 0, 0, 0);
          const dayEnd = new Date(dayStart.getTime() + 86400000);
          rows.push([
            key,
            allJobs.filter((j) => new Date(j.createdAt) >= dayStart && new Date(j.createdAt) < dayEnd).length,
            allJobs.filter((j) => j.actualCompletion && new Date(j.actualCompletion) >= dayStart && new Date(j.actualCompletion) < dayEnd).length,
            allEvents.filter((e) => new Date(e.createdAt) >= dayStart && new Date(e.createdAt) < dayEnd).length,
            allEvents.filter((e) => !e.verified && new Date(e.createdAt) >= dayStart && new Date(e.createdAt) < dayEnd).length,
          ]);
        }
        payload = { type, rows };
      } else if (type === "weekly" || type === "monthly") {
        const buckets = type === "weekly" ? 8 : 3;
        const span = type === "weekly" ? 7 : 30;
        headers = [type === "weekly" ? "Week" : "Month", "Qty completed", "Jobs completed", "Events", "Rejected qty"];
        for (let i = buckets - 1; i >= 0; i--) {
          const end = new Date(now.getTime() - i * span * 86400000);
          const start = new Date(end.getTime() - span * 86400000);
          rows.push([
            iso(start),
            allJobs.filter((j) => j.actualCompletion && new Date(j.actualCompletion) >= start && new Date(j.actualCompletion) < end).reduce((s, j) => s + (j.completedQty ?? 0), 0),
            allJobs.filter((j) => j.actualCompletion && new Date(j.actualCompletion) >= start && new Date(j.actualCompletion) < end).length,
            allEvents.filter((e) => new Date(e.createdAt) >= start && new Date(e.createdAt) < end).length,
            allQuality.filter((x) => new Date(x.createdAt) >= start && new Date(x.createdAt) < end).reduce((s, x) => s + (x.rejected ?? 0), 0),
          ]);
        }
        payload = { type, rows };
      } else if (type === "jobs") {
        headers = ["Code", "Title", "Product", "Planned qty", "Completed qty", "Status", "Expected", "Actual", "Current stage"];
        rows = allJobs.map((j) => [j.code, j.title, j.product ?? "", j.quantity ?? 0, j.completedQty ?? 0, j.status, iso(j.expectedCompletion), iso(j.actualCompletion), currentStageOf(j)]);
        payload = { type, jobs: allJobs.map((j) => jobView(j, origin)) };
      } else if (type === "interruptions") {
        headers = ["Category", "Events", "Total minutes", "Verified", "Jobs affected"];
        const groups = new Map<string, typeof allEvents>();
        for (const e of allEvents) {
          const arr = groups.get(e.category) ?? [];
          arr.push(e);
          groups.set(e.category, arr);
        }
        rows = [...groups.entries()].map(([cat, evs]) => [
          eventCategoryLabel(cat), evs.length, evs.reduce((s, e) => s + (e.durationMinutes ?? 0), 0),
          evs.filter((e) => e.verified).length, new Set(evs.map((e) => e.jobId).filter(Boolean)).size,
        ]);
        payload = { type, interruptions: [...groups.entries()].map(([category, evs]) => ({ category, label: eventCategoryLabel(category), count: evs.length, minutes: evs.reduce((s, e) => s + (e.durationMinutes ?? 0), 0), verified: evs.filter((e) => e.verified).length })) };
      } else if (type === "quality") {
        headers = ["Date", "Job", "Stage", "Inspected", "Accepted", "Rejected", "Rework", "Defect", "Notes"];
        const jmap = new Map(allJobs.map((j) => [j.id, j.code]));
        rows = allQuality.map((r) => [iso(r.createdAt), r.jobId ? jmap.get(r.jobId) ?? "" : "", r.stage ?? "", r.inspected ?? 0, r.accepted ?? 0, r.rejected ?? 0, r.rework ?? 0, r.defectCategory ?? "", r.notes ?? ""]);
        payload = { type, records: allQuality };
      } else if (type === "actions") {
        headers = ["Created", "Title", "Status", "Priority", "Deadline", "Problem reference"];
        rows = allActions.map((a) => [iso(a.createdAt), a.title, a.status, a.priority ?? "", iso(a.deadline), a.problemRef ?? ""]);
        payload = { type, actions: allActions };
      } else {
        return err("Unknown report type.", 422);
      }
      if (format === "csv") {
        return new Response(toCsv(headers, rows), { headers: { "content-type": "text/csv", "content-disposition": `attachment; filename="pragati-${type}-report.csv"` } });
      }
      return json({ type, headers, ...((payload as object) ?? {}) });
    }

    // ---------------- TEAM ----------------
    if (slug[0] === "team") {
      const biz = requireBiz(ctx);
      if (method === "GET" && slug.length === 1) {
        const list = await db.select().from(users).where(eq(users.businessId, biz.id)).orderBy(asc(users.createdAt));
        return json({ members: list.map(publicUser), roles: ROLES.filter((r) => r.id !== "cluster") });
      }
      if (method === "POST" && slug.length === 1) {
        if (!["owner", "manager"].includes(ctx.user.role)) return err("Only owner or manager can add team members.", 403);
        const b = body as { name: string; email: string; role: string; password: string; phone?: string };
        if (!b.name || !b.email || !b.password || b.password.length < 6) return err("Name, email and a password of 6+ characters are required.", 422);
        if (!ROLES.some((r) => r.id === b.role) || b.role === "cluster") return err("Invalid role.", 422);
        const existing = await db.select().from(users).where(eq(users.email, b.email.toLowerCase().trim())).limit(1);
        if (existing[0]) return err("Email already registered.", 409);
        const u = (
          await db.insert(users).values({
            businessId: biz.id,
            name: b.name,
            email: b.email.toLowerCase().trim(),
            passwordHash: hashPassword(b.password),
            role: b.role as UserRow["role"],
            phone: b.phone ?? null,
            isDemo: false,
          }).returning()
        )[0];
        return json({ member: publicUser(u) }, 201);
      }
      if (method === "DELETE" && slug[1]) {
        if (!["owner", "manager"].includes(ctx.user.role)) return err("Only owner or manager can remove members.", 403);
        const target = (await db.select().from(users).where(and(eq(users.id, slug[1]), eq(users.businessId, biz.id))).limit(1))[0];
        if (!target) return err("Member not found.", 404);
        if (target.role === "owner") return err("The business owner cannot be removed.", 422);
        if (target.id === ctx.user.id) return err("You cannot remove yourself.", 422);
        await db.delete(users).where(eq(users.id, target.id));
        return json({ ok: true });
      }
      if (method === "PATCH" && slug[1]) {
        if (!["owner", "manager"].includes(ctx.user.role)) return err("Only owner or manager can change roles.", 403);
        const b = body as { role?: string };
        const target = (await db.select().from(users).where(and(eq(users.id, slug[1]), eq(users.businessId, biz.id))).limit(1))[0];
        if (!target) return err("Member not found.", 404);
        if (target.role === "owner" && b.role && b.role !== "owner") return err("The business owner role cannot be removed.", 422);
        if (b.role && ROLES.some((r) => r.id === b.role) && b.role !== "cluster") {
          const updated = (await db.update(users).set({ role: b.role as UserRow["role"] }).where(eq(users.id, target.id)).returning())[0];
          return json({ member: publicUser(updated) });
        }
        return err("Invalid role.", 422);
      }
      return err("Method not allowed.", 405);
    }

    // ---------------- NOTIFICATIONS ----------------
    if (slug[0] === "notifications") {
      if (method === "GET") {
        const list = await db.select().from(notifications).where(eq(notifications.userId, ctx.user.id)).orderBy(desc(notifications.createdAt)).limit(25);
        const unread = list.filter((n) => !n.read).length;
        return json({ notifications: list, unread });
      }
      if (method === "POST") {
        const b = body as { id?: string };
        if (b.id) {
          await db.update(notifications).set({ read: true }).where(and(eq(notifications.id, b.id), eq(notifications.userId, ctx.user.id)));
        } else {
          await db.update(notifications).set({ read: true }).where(eq(notifications.userId, ctx.user.id));
        }
        return json({ ok: true });
      }
      return err("Method not allowed.", 405);
    }

    // ---------------- SEARCH ----------------
    if (slug[0] === "search" && method === "GET") {
      const term = (q.get("q") ?? "").trim();
      if (!term) return json({ jobs: [], events: [], actions: [] });
      if (ctx.user.role === "cluster") return json({ jobs: [], events: [], actions: [], note: "Cluster role sees aggregated data only." });
      const biz = requireBiz(ctx);
      const like = `%${term}%`;
      const [j, e, a, ql, im] = await Promise.all([
        db.select().from(jobs).where(and(eq(jobs.businessId, biz.id), or(ilike(jobs.code, like), ilike(jobs.title, like), ilike(jobs.product, like)))).limit(8),
        db.select().from(events).where(and(eq(events.businessId, biz.id), or(ilike(events.description, like), ilike(events.category, like)))).limit(8),
        db.select().from(actions).where(and(eq(actions.businessId, biz.id), or(ilike(actions.title, like), ilike(actions.description, like), ilike(actions.problemRef, like)))).limit(8),
        db.select().from(qualityRecords).where(and(eq(qualityRecords.businessId, biz.id), or(ilike(qualityRecords.notes, like), ilike(qualityRecords.defectCategory, like)))).limit(8),
        db.select().from(imports).where(and(eq(imports.businessId, biz.id), ilike(imports.fileName, like))).limit(8),
      ]);
      return json({
        jobs: j.map((x) => ({ code: x.code, title: x.title, status: x.status, link: "/app/production" })),
        events: e.map((x) => ({ id: x.id.slice(0, 8), category: eventCategoryLabel(x.category, q.get("lang") === "od" ? "od" : "en"), description: x.description, link: "/app/events" })),
        actions: a.map((x) => ({ id: x.id.slice(0, 8), title: x.title, status: x.status, link: "/app/actions" })),
        quality: ql.map((x) => ({ id: x.id.slice(0, 8), category: x.defectCategory ?? "quality", description: x.notes ?? `${x.inspected} inspected / ${x.rejected} rejected`, link: "/app/quality" })),
        imports: im.map((x) => ({ id: x.id.slice(0, 8), category: x.fileName, description: `${x.importedCount}/${x.rowCount} rows imported (${x.target})`, link: "/app/record-bridge" })),
      });
    }

    return err("Unknown API endpoint.", 404);
  } catch (e) {
    if (e instanceof BizError) return err(e.message, 403);
    console.error("API error", slug, method, e);
    return err("Something went wrong. Please try again.", 500);
  }
}
