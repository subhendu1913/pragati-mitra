import { db } from "@/db";
import {
  jobs,
  events,
  qualityRecords,
  actions,
  imports,
  businesses,
  users,
} from "@/db/schema";
import { and, desc, eq, gte, lte, sql, inArray, isNotNull } from "drizzle-orm";
import { eventCategoryLabel, industryTemplate } from "@/lib/domain";
import { toOdia } from "@/lib/odia";
import type { BusinessRow, EventRow, JobRow, QualityRow, ActionRow } from "@/db/schema";

export interface Insight {
  id: string;
  type: string;
  title: string;
  observation: string;
  possibleExplanation: string;
  evidence: string[];
  period: string;
  frequency: string;
  suggestedAction: string;
  reliability: "high" | "medium" | "low";
  reliabilityNote: string;
  severity: "high" | "medium" | "low";
  recordsUsed: number;
}

export interface DataCompleteness {
  score: number;
  label: string;
  counts: { jobs: number; events: number; verifiedEvents: number; quality: number; actions: number; imports: number };
  warnings: string[];
}

function fmtPeriod(start: Date, end: Date): string {
  const weeks = Math.max(1, Math.round((end.getTime() - start.getTime()) / (7 * 86400000)));
  return `last ${weeks} week${weeks > 1 ? "s" : ""} (${start.toLocaleDateString("en-IN")} – ${end.toLocaleDateString("en-IN")})`;
}

function reliabilityFor(recordsUsed: number, verifiedRatio: number, freqCount: number): Insight["reliability"] {
  if (recordsUsed < 6) return "low";
  if (freqCount >= 3 && verifiedRatio >= 0.5) return "high";
  return "medium";
}

export async function dataCompleteness(businessId: string): Promise<DataCompleteness> {
  const [j, e, q, a, im] = await Promise.all([
    db.select({ c: sql<number>`count(*)::int` }).from(jobs).where(eq(jobs.businessId, businessId)),
    db.select({ c: sql<number>`count(*)::int` }).from(events).where(eq(events.businessId, businessId)),
    db.select({ c: sql<number>`count(*)::int` }).from(qualityRecords).where(eq(qualityRecords.businessId, businessId)),
    db.select({ c: sql<number>`count(*)::int` }).from(actions).where(eq(actions.businessId, businessId)),
    db.select({ c: sql<number>`count(*)::int` }).from(imports).where(eq(imports.businessId, businessId)),
  ]);
  const evRows = await db.select({ v: events.verified }).from(events).where(eq(events.businessId, businessId));
  const counts = {
    jobs: j[0]?.c ?? 0,
    events: e[0]?.c ?? 0,
    verifiedEvents: evRows.filter((r) => r.v).length,
    quality: q[0]?.c ?? 0,
    actions: a[0]?.c ?? 0,
    imports: im[0]?.c ?? 0,
  };
  const verifiedRatio = counts.events > 0 ? counts.verifiedEvents / counts.events : 0;
  const score = Math.min(
    100,
    Math.round(
      (Math.min(counts.jobs, 10) / 10) * 30 +
        (Math.min(counts.events, 15) / 15) * 25 +
        verifiedRatio * 20 +
        (Math.min(counts.quality, 5) / 5) * 10 +
        (counts.actions > 0 ? 5 : 0) +
        (counts.imports > 0 ? 10 : 0)
    )
  );
  const warnings: string[] = [];
  if (counts.jobs < 10) warnings.push(`Only ${counts.jobs} job(s) recorded — insights become meaningful after about 10 jobs.`);
  if (counts.events > 0 && verifiedRatio < 0.5) warnings.push(`Only ${counts.verifiedEvents} of ${counts.events} events are verified by a supervisor.`);
  if (counts.quality === 0) warnings.push("No quality inspection records yet — Smart Insights cannot analyse defects.");
  if (counts.events === 0) warnings.push("No operational events recorded yet — ask workers to report problems from the Event Centre.");
  const label = score >= 70 ? "Good — enough reliable records" : score >= 40 ? "Partial — more records needed" : "Low — early stage";
  return { score, label, counts, warnings };
}

export async function computeInsights(businessId: string, lang: "en" | "od" = "en"): Promise<{ insights: Insight[]; completeness: DataCompleteness; period: string }> {
  // Localized templates: transliteration -> Odia script at runtime. §k§ placeholders are replaced BEFORE conversion.
  const L = (en: string, odRaw: string) => (lang === "od" ? toOdia(odRaw) : en);
  const fill = (en: string, odRaw: string, vars: Record<string, string | number>) => {
    const tpl = lang === "od" ? odRaw : en;
    return tpl
      .split(/(§\w§?)/g)
      .map((part) => {
        const m = part.match(/^§(\w)§?$/);
        if (m && m[1] in vars) return String(vars[m[1]]); // values (codes, numbers) stay as-is
        return lang === "od" ? toOdia(part) : part;
      })
      .join("");
  };
  const completeness = await dataCompleteness(businessId);
  const allJobs = await db.select().from(jobs).where(eq(jobs.businessId, businessId)).orderBy(desc(jobs.createdAt));
  const allEvents = await db.select().from(events).where(eq(events.businessId, businessId)).orderBy(desc(events.createdAt));
  const allQuality = await db.select().from(qualityRecords).where(eq(qualityRecords.businessId, businessId)).orderBy(desc(qualityRecords.createdAt));
  const recentJobs = allJobs.slice(0, 12);
  const now = new Date();
  const dates = [...recentJobs.map((j) => j.createdAt), ...allEvents.map((e) => e.createdAt)].map((x) => new Date(x).getTime());
  const periodStart = dates.length ? new Date(Math.min(...dates)) : now;
  const period = fmtPeriod(periodStart, now);
  const jobById = new Map(allJobs.map((j) => [j.id, j]));

  const insights: Insight[] = [];

  // 1. Events by category
  const byCat = new Map<string, EventRow[]>();
  for (const e of allEvents) {
    const arr = byCat.get(e.category) ?? [];
    arr.push(e);
    byCat.set(e.category, arr);
  }
  const catOrder = [...byCat.entries()].sort((a, b) => b[1].length - a[1].length);
  for (const [cat, evs] of catOrder) {
    if (evs.length < 2) continue;
    const mins = evs.reduce((s, e) => s + (e.durationMinutes ?? 0), 0);
    const jobIds = new Set(evs.map((e) => e.jobId).filter(Boolean) as string[]);
    const verified = evs.filter((e) => e.verified).length;
    const label = eventCategoryLabel(cat, lang);
    let title = "";
    let observation = "";
    let suggestion = "";
    let explanation = "";
    if (cat === "machine_breakdown") {
      title = L("Repeated machine downtime", "Barambara yantra downtime");
      observation = fill(`Machine downtime was recorded in §j§ of the last §n§ jobs, totalling §m§ recorded minutes across §e§ event(s).`, "Machine downtime §n ta karyya madhya re §j§ ta karyya re record hoichhi, mot §m minit, §e ta event re.", { j: jobIds.size, n: recentJobs.length, m: mins, e: evs.length });
      suggestion = L("Review the machine maintenance schedule and inspect the affected equipment before the next production run.", "Agami production run purbe machine maintenance schedule parikshana karantu ara affected equipment inspect karantu.");
      explanation = L("Possible causes (unverified): wear and tear, missed maintenance or overloading. The records show when it happened, not why.", "Sambhabya karana (verify hoyini): wear and tear, maintenance miss, athaba overloading. Record sudhu ketebele hela seta dekhay, kene hela noy.");
    } else if (cat === "material_shortage") {
      title = L("Recurring material shortages", "Barambara kachamala abhava");
      observation = fill(`Material shortage was reported §e§ time(s) in ${period}, affecting §q§ unit(s) where known.`, "Kachamala abhava §e§ bar report hoichhi, §q§ unit prabhabita (jetebe gyan).", { e: evs.length, q: evs.reduce((s, e) => s + (e.qtyAffected ?? 0), 0) });
      suggestion = L("Check material availability before starting a job and keep a minimum stock list with the storekeeper.", "Karyya arambha purbe material availability check karantu ara storekeeper sahita eka minimum stock list rakantu.");
      explanation = L("Possible causes (unverified): late supplier delivery or no pre-production stock check.", "Sambhabya karana (verify hoyini): supplier late delivery athaba pre-production stock check nai.");
    } else if (cat === "quality_issue") {
      title = "Recurring quality issues";
      observation = `Quality issues were reported ${evs.length} time(s), linked to ${jobIds.size} job(s).`;
      suggestion = "Add an in-process check at the affected stage and record defects with a category in Quality & Rework.";
      explanation = "Possible causes (unverified): process variation or missing in-process inspection.";
    } else if (cat === "power_interruption") {
      title = "Power interruptions affecting production";
      observation = `Power interruption recorded ${evs.length} time(s), totalling ${mins} minutes.`;
      suggestion = "Plan labour and machine time around known outage hours, and record every interruption so its impact is visible.";
      explanation = "Possible causes (unverified): grid outage or local wiring issue — not confirmed by these records.";
    } else {
      title = `Repeated reports: ${label.toLowerCase()}`;
      observation = `${label} was recorded ${evs.length} time(s) in ${period}${mins ? `, totalling ${mins} minutes` : ""}.`;
      suggestion = "Review the related jobs and assign a corrective action if the pattern continues.";
      explanation = "The records show frequency and timing; the cause still needs verification on the shop floor.";
    }
    const rel = reliabilityFor(completeness.counts.events + completeness.counts.jobs, verified / evs.length, evs.length);
    insights.push({
      id: `ins-${cat}`,
      type: cat,
      title,
      observation,
      possibleExplanation: explanation,
      evidence: evs.slice(0, 8).map((e) => {
        const j = e.jobId ? jobById.get(e.jobId) : null;
        return `Event ${e.id.slice(0, 8)} on job ${j?.code ?? "—"} (${e.stage ?? "no stage"})${e.verified ? ", verified" : ", unverified"}`;
      }),
      period,
      frequency: fill(`§e§ occurrence(s) in ${period}; §v§/§e§ verified`, "§e§ bar §period§ re; §v§/§e§ verified", { e: evs.length, v: verified, period }),
      suggestedAction: suggestion,
      reliability: rel,
      reliabilityNote:
        rel === "high"
          ? "Enough verified records to treat this as a reliable pattern."
          : rel === "medium"
            ? "Pattern is visible but some events are unverified or records are few — confirm before major decisions."
            : "Very few records — treat as an early signal only, not a confirmed pattern.",
      severity: evs.length >= 4 ? "high" : evs.length >= 2 ? "medium" : "low",
      recordsUsed: evs.length + jobIds.size,
    });
  }

  // 2. Delayed jobs / frequently delayed stage
  const delayed = recentJobs.filter((j) => j.status === "delayed" || (j.status === "active" && j.expectedCompletion && new Date(j.expectedCompletion) < now));
  if (delayed.length >= 2) {
    const stageCount = new Map<string, number>();
    for (const j of delayed) {
      const cur = j.stages.find((s) => s.status !== "completed");
      const name = cur?.name ?? "Unknown";
      stageCount.set(name, (stageCount.get(name) ?? 0) + 1);
    }
    const top = [...stageCount.entries()].sort((a, b) => b[1] - a[1])[0];
    insights.push({
      id: "ins-delayed-stage",
      type: "delayed_stage",
      title: L("Frequently delayed production stage", "Barambara bilamba hochhi stage"),
      observation: fill(`§d§ of the last §n§ jobs are delayed. Most are currently held at stage "§s§" (§c§ job(s)).`, "§n ta karyya madhya re §d ta bilamba hochhi. Adhikansa §s§ stage re achhanti (§c§ ta karyya).", { d: delayed.length, n: recentJobs.length, s: top[0], c: top[1] }),
      possibleExplanation: "Possible causes (unverified): stage capacity, waiting for material, or waiting for quality clearance. Check the linked events.",
      evidence: delayed.slice(0, 8).map((j) => `Job ${j.code} — status ${j.status}, expected ${j.expectedCompletion ? new Date(j.expectedCompletion).toLocaleDateString("en-IN") : "—"}`),
      period,
      frequency: `${delayed.length} of last ${recentJobs.length} jobs delayed`,
      suggestedAction: fill(`Look at events recorded at "§s§" and agree one corrective action with the supervisor (e.g. pre-check material or add manpower at that stage).`, "§s§ re record hoichhi events dekhantu ara supervisor sahita eka sudharara karyya thik karantu.", { s: top[0] }),
      reliability: reliabilityFor(completeness.counts.jobs, 1, delayed.length),
      reliabilityNote: "Delay status is taken directly from job records.",
      severity: delayed.length >= 3 ? "high" : "medium",
      recordsUsed: delayed.length,
    });
  }

  // 3. Quality defects
  const byDefect = new Map<string, QualityRow[]>();
  for (const q of allQuality) {
    const key = q.defectCategory ?? "Uncategorised";
    const arr = byDefect.get(key) ?? [];
    arr.push(q);
    byDefect.set(key, arr);
  }
  const defectEntries = [...byDefect.entries()].sort((a, b) => b[1].reduce((s, q) => s + (q.rejected ?? 0), 0) - a[1].reduce((s, q) => s + (q.rejected ?? 0), 0));
  for (const [defect, qs] of defectEntries.slice(0, 3)) {
    const rejected = qs.reduce((s, q) => s + (q.rejected ?? 0), 0);
    const rework = qs.reduce((s, q) => s + (q.rework ?? 0), 0);
    if (rejected === 0 && rework === 0) continue;
    const jobIds = new Set(qs.map((q) => q.jobId).filter(Boolean) as string[]);
    insights.push({
      id: `ins-defect-${defect}`,
      type: "quality_defect",
      title: fill(`Recurring defect: §d§`, "Barambara defect: §d§", { d: defect }),
      observation: fill(`"§d§" accounts for §r§ rejected and §w§ rework piece(s) across §q§ inspection record(s), linked to §j§ job(s).`, "§d§ re §q ta inspection record re §r reject ara §w rework, §j ta karyya sahita.", { d: defect, r: rejected, w: rework, q: qs.length, j: jobIds.size }),
      possibleExplanation: "The records show what was rejected; the root cause (process, material or skill) still needs to be checked on the floor.",
      evidence: qs.slice(0, 8).map((q) => {
        const j = q.jobId ? jobById.get(q.jobId) : null;
        return `Inspection ${q.id.slice(0, 8)} — job ${j?.code ?? "—"}, rejected ${q.rejected}, rework ${q.rework}`;
      }),
      period,
      frequency: `${qs.length} inspection record(s) in ${period}`,
      suggestedAction: L("Discuss this defect category with the quality checker and workers, then create a corrective action and track whether rejections reduce.", "Ei defect category quality checker ara sramika sahita alochana karantu, tarpare eka sudharara karyya create karantu ara dekhantu je reject kame."),
      reliability: reliabilityFor(completeness.counts.quality + qs.length, 1, qs.length),
      reliabilityNote: completeness.counts.quality < 5 ? "Few inspection records — record every batch in Quality & Rework." : "Based on recorded inspections.",
      severity: rejected >= 4 ? "high" : "medium",
      recordsUsed: qs.length,
    });
  }

  // 4. Bottleneck stage (most events at a stage)
  const byStage = new Map<string, number>();
  for (const e of allEvents) {
    if (!e.stage) continue;
    byStage.set(e.stage, (byStage.get(e.stage) ?? 0) + 1);
  }
  const topStage = [...byStage.entries()].sort((a, b) => b[1] - a[1])[0];
  if (topStage && topStage[1] >= 3) {
    insights.push({
      id: "ins-bottleneck",
      type: "bottleneck",
      title: fill(`Production bottleneck at "§s§"`, "§s§ re production bottleneck", { s: topStage[0] }),
      observation: fill(`§c§ of §t§ recorded events happened at stage "§s§" in ${period}.`, "§t ta record hoichhi event madhya re §c ta §s§ stage re hochhi.", { c: topStage[1], t: allEvents.length, s: topStage[0] }),
      possibleExplanation: "Possible causes (unverified): limited machine capacity at this stage or frequent waiting between stages.",
      evidence: allEvents.filter((e) => e.stage === topStage[0]).slice(0, 8).map((e) => `Event ${e.id.slice(0, 8)} — ${eventCategoryLabel(e.category)} at ${e.stage}`),
      period,
      frequency: `${topStage[1]} event(s) at this stage in ${period}`,
      suggestedAction: "Review workload and machine allocation at this stage; consider shifting work or adding a shift handover checklist.",
      reliability: reliabilityFor(completeness.counts.events, (allEvents.filter((e) => e.verified).length) / Math.max(1, allEvents.length), topStage[1]),
      reliabilityNote: "Based on where events were reported; workers may under-report some stages.",
      severity: topStage[1] >= 5 ? "high" : "medium",
      recordsUsed: topStage[1],
    });
  }

  // 5. Completion trend
  const completed = recentJobs.filter((j) => j.status === "completed");
  if (completed.length >= 3) {
    const onTime = completed.filter((j) => j.expectedCompletion && j.actualCompletion && new Date(j.actualCompletion) <= new Date(j.expectedCompletion)).length;
    insights.push({
      id: "ins-completion",
      type: "completion_trend",
      title: L("Order completion trend", "Order completion trend"),
      observation: fill(`§o§ of §c§ completed jobs in ${period} finished on or before the expected date (§p§%).`, "§c ta sampurna karyya madhya re §o ta §period re expected tarikh purbe sesha hoichhi (§p§%).", { o: onTime, c: completed.length, p: Math.round((onTime / completed.length) * 100) }),
      possibleExplanation: "On-time rate depends on material readiness, machine availability and stage coordination — see the event patterns above.",
      evidence: completed.slice(0, 8).map((j) => `Job ${j.code} — expected ${j.expectedCompletion ? new Date(j.expectedCompletion).toLocaleDateString("en-IN") : "—"}, completed ${j.actualCompletion ? new Date(j.actualCompletion).toLocaleDateString("en-IN") : "—"}`),
      period,
      frequency: `${completed.length} completed jobs analysed`,
      suggestedAction: onTime < completed.length / 2 ? "Focus first on the most frequent interruption category above before adding new features." : "Keep recording — the trend will get clearer with more jobs.",
      reliability: "high",
      reliabilityNote: "Dates come directly from job records.",
      severity: onTime < completed.length / 2 ? "medium" : "low",
      recordsUsed: completed.length,
    });
  }

  const order = { high: 0, medium: 1, low: 2 };
  insights.sort((a, b) => order[a.severity] - order[b.severity] || b.recordsUsed - a.recordsUsed);
  return { insights, completeness, period };
}

export interface ReadinessResult {
  score: number;
  level: string;
  breakdown: { label: string; points: number; max: number }[];
}

export async function readiness(businessId: string): Promise<ReadinessResult> {
  const biz = (await db.select().from(businesses).where(eq(businesses.id, businessId)).limit(1))[0];
  const c = await dataCompleteness(businessId);
  const onboardingDone = !!(biz?.adoptionPlan && biz.stages.length >= 3);
  const jobPts = (Math.min(c.counts.jobs, 10) / 10) * 20;
  const eventPts = (Math.min(c.counts.events, 15) / 15) * 15;
  const verifyPts = c.counts.events > 0 ? (c.counts.verifiedEvents / c.counts.events) * 10 : 0;
  const qualityPts = (Math.min(c.counts.quality, 5) / 5) * 10;
  const importPts = c.counts.imports > 0 ? 10 : 0;
  const actionPts = c.counts.actions > 0 ? 10 : 0;
  const trainPts = ((biz?.trainingCompleted ?? 0) / 100) * 10;
  const onboardPts = onboardingDone ? 5 : 0;
  const score = Math.round(onboardPts + jobPts + eventPts + verifyPts + qualityPts + importPts + actionPts + trainPts);
  const breakdown = [
    { label: "Onboarding completed", points: Math.round(onboardPts), max: 5 },
    { label: "Jobs tracked digitally", points: Math.round(jobPts), max: 20 },
    { label: "Operational events recorded", points: Math.round(eventPts), max: 15 },
    { label: "Events verified by supervisor", points: Math.round(verifyPts), max: 10 },
    { label: "Quality records", points: Math.round(qualityPts), max: 10 },
    { label: "Existing records imported (Record Bridge)", points: importPts, max: 10 },
    { label: "Corrective actions used", points: actionPts, max: 10 },
    { label: "Team training completed", points: Math.round(trainPts), max: 10 },
  ];
  const level = score >= 70 ? "Advanced digital adoption" : score >= 40 ? "Growing — keep going" : "Getting started";
  return { score: Math.min(100, score), level, breakdown };
}

export async function nextBestSteps(businessId: string): Promise<string[]> {
  const biz = (await db.select().from(businesses).where(eq(businesses.id, businessId)).limit(1))[0];
  const c = await dataCompleteness(businessId);
  const { insights } = await computeInsights(businessId);
  const openActions = await db.select().from(actions).where(and(eq(actions.businessId, businessId), eq(actions.status, "pending")));
  const steps: string[] = [];
  if (c.counts.imports === 0 && (biz?.recordMethod === "paper" || biz?.recordMethod === "excel" || biz?.recordMethod === "mixed")) {
    steps.push("Import your existing paper/Excel register through Record Bridge so old records become organised data.");
  }
  if (c.counts.jobs < 5) steps.push("Create and track at least 5 jobs in Production & Jobs — this unlocks meaningful Smart Insights.");
  if (c.counts.events > 0 && c.counts.verifiedEvents < c.counts.events) {
    steps.push(`Verify the ${c.counts.events - c.counts.verifiedEvents} pending event(s) in the Event Centre so insights stay reliable.`);
  }
  if (insights.length > 0 && openActions.length === 0) {
    steps.push(`Create a corrective action for "${insights[0].title}" in the Action Tracker and assign an owner.`);
  }
  if (c.counts.quality === 0) steps.push("Record at least one quality inspection in Quality & Rework.");
  if (steps.length < 3) steps.push("Ask Pragati AI: \"What should I improve first?\" for a data-based suggestion.");
  if (steps.length < 4) steps.push("Open the Learning Centre and complete the 5-minute getting-started guide with your team.");
  return steps.slice(0, 4);
}

export interface DashboardStats {
  counts: { active: number; delayed: number; completed: number; onHold: number; total: number };
  eventsLast7d: number;
  unverifiedEvents: number;
  quality: { inspected: number; rejected: number; rework: number; rejectRate: number };
  weekly: { week: string; completedQty: number }[];
  eventsByCategory: { category: string; label: string; count: number; minutes: number }[];
  stageLoad: { stage: string; count: number }[];
  recentEvents: (EventRow & { reporterName: string | null; jobCode: string | null })[];
  delayedJobs: { code: string; title: string; stage: string; daysOverdue: number }[];
  recentJobs: JobRow[];
}

export async function dashboardStats(businessId: string): Promise<DashboardStats> {
  const allJobs = await db.select().from(jobs).where(eq(jobs.businessId, businessId)).orderBy(desc(jobs.createdAt));
  const allEvents = await db.select().from(events).where(eq(events.businessId, businessId)).orderBy(desc(events.createdAt));
  const allQuality = await db.select().from(qualityRecords).where(eq(qualityRecords.businessId, businessId));
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000);
  const userIds = [...new Set(allEvents.map((e) => e.reporterId).filter(Boolean) as string[])];
  const reporters = userIds.length ? await db.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, userIds)) : [];
  const reporterMap = new Map(reporters.map((u) => [u.id, u.name]));
  const jobMap = new Map(allJobs.map((j) => [j.id, j]));

  const weekly: DashboardStats["weekly"] = [];
  for (let i = 7; i >= 0; i--) {
    const start = new Date(now.getTime() - (i + 1) * 7 * 86400000);
    const end = new Date(now.getTime() - i * 7 * 86400000);
    const qty = allJobs
      .filter((j) => {
        const ref = j.actualCompletion ?? j.createdAt;
        return ref && new Date(ref) >= start && new Date(ref) < end;
      })
      .reduce((s, j) => s + (j.completedQty ?? 0), 0);
    weekly.push({ week: start.toLocaleDateString("en-IN", { day: "numeric", month: "short" }), completedQty: qty });
  }

  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000);
  const evCat = new Map<string, { count: number; minutes: number }>();
  for (const e of allEvents.filter((e) => new Date(e.createdAt) >= thirtyDaysAgo)) {
    const cur = evCat.get(e.category) ?? { count: 0, minutes: 0 };
    cur.count += 1;
    cur.minutes += e.durationMinutes ?? 0;
    evCat.set(e.category, cur);
  }
  const stageMap = new Map<string, number>();
  for (const e of allEvents) {
    if (e.stage) stageMap.set(e.stage, (stageMap.get(e.stage) ?? 0) + 1);
  }
  const inspected = allQuality.reduce((s, q) => s + (q.inspected ?? 0), 0);
  const rejected = allQuality.reduce((s, q) => s + (q.rejected ?? 0), 0);
  const rework = allQuality.reduce((s, q) => s + (q.rework ?? 0), 0);

  return {
    counts: {
      active: allJobs.filter((j) => j.status === "active").length,
      delayed: allJobs.filter((j) => j.status === "delayed").length,
      completed: allJobs.filter((j) => j.status === "completed").length,
      onHold: allJobs.filter((j) => j.status === "on_hold").length,
      total: allJobs.length,
    },
    eventsLast7d: allEvents.filter((e) => new Date(e.createdAt) >= sevenDaysAgo).length,
    unverifiedEvents: allEvents.filter((e) => !e.verified).length,
    quality: { inspected, rejected, rework, rejectRate: inspected ? Math.round((rejected / inspected) * 1000) / 10 : 0 },
    weekly,
    eventsByCategory: [...evCat.entries()].map(([category, v]) => ({ category, label: eventCategoryLabel(category), ...v })).sort((a, b) => b.count - a.count),
    stageLoad: [...stageMap.entries()].map(([stage, count]) => ({ stage, count })).sort((a, b) => b.count - a.count).slice(0, 6),
    recentEvents: allEvents.slice(0, 6).map((e) => ({ ...e, reporterName: e.reporterId ? reporterMap.get(e.reporterId) ?? null : null, jobCode: e.jobId ? jobMap.get(e.jobId)?.code ?? null : null })),
    delayedJobs: allJobs
      .filter((j) => j.status === "delayed" || (j.status === "active" && j.expectedCompletion && new Date(j.expectedCompletion) < now))
      .slice(0, 6)
      .map((j) => ({
        code: j.code,
        title: j.title,
        stage: j.stages.find((s) => s.status !== "completed")?.name ?? "—",
        daysOverdue: j.expectedCompletion ? Math.max(1, Math.round((now.getTime() - new Date(j.expectedCompletion).getTime()) / 86400000)) : 0,
      })),
    recentJobs: allJobs.slice(0, 6),
  };
}

// ---------- Cluster aggregation (aggregated/authorised info only) ----------
export async function clusterAggregate(clusterId: string) {
  const bizRows = await db.select().from(businesses).where(eq(businesses.clusterId, clusterId));
  const summaries = [];
  const catTotals = new Map<string, number>();
  const weekly: { week: string; completedQty: number }[] = [];
  const now = new Date();
  for (const b of bizRows) {
    const r = await readiness(b.id);
    const bizJobs = await db.select().from(jobs).where(eq(jobs.businessId, b.id));
    const bizEvents = await db.select().from(events).where(eq(events.businessId, b.id));
    const fourteen = new Date(now.getTime() - 14 * 86400000);
    const recentEvents = bizEvents.filter((e) => new Date(e.createdAt) >= fourteen);
    const unverified = bizEvents.filter((e) => !e.verified).length;
    const catCount = new Map<string, number>();
    for (const e of bizEvents) {
      catCount.set(e.category, (catCount.get(e.category) ?? 0) + 1);
      catTotals.set(e.category, (catTotals.get(e.category) ?? 0) + 1);
    }
    const top = [...catCount.entries()].sort((a, b) => b[1] - a[1])[0];
    summaries.push({
      id: b.id,
      name: b.name,
      industry: b.industry,
      customIndustry: b.customIndustry,
      location: b.location,
      isDemo: b.isDemo,
      readiness: r.score,
      readinessLevel: r.level,
      training: b.trainingCompleted,
      jobs: bizJobs.length,
      activeJobs: bizJobs.filter((j) => j.status === "active" || j.status === "delayed").length,
      events: bizEvents.length,
      active: recentEvents.length > 0 || bizJobs.some((j) => j.status === "active" || j.status === "delayed"),
      unverified,
      onboardingDone: !!b.adoptionPlan,
      topChallenge: top ? { label: eventCategoryLabel(top[0]), count: top[1] } : null,
      needsAssistance: r.score < 50 || (bizEvents.length > 0 && unverified / bizEvents.length > 0.4),
    });
  }
  for (let i = 7; i >= 0; i--) {
    const start = new Date(now.getTime() - (i + 1) * 7 * 86400000);
    const end = new Date(now.getTime() - i * 7 * 86400000);
    let qty = 0;
    for (const b of bizRows) {
      const bizJobs = await db.select().from(jobs).where(eq(jobs.businessId, b.id));
      qty += bizJobs
        .filter((j) => {
          const ref = j.actualCompletion ?? j.createdAt;
          return ref && new Date(ref) >= start && new Date(ref) < end;
        })
        .reduce((s, j) => s + (j.completedQty ?? 0), 0);
    }
    weekly.push({ week: start.toLocaleDateString("en-IN", { day: "numeric", month: "short" }), completedQty: qty });
  }
  const challenges = [...catTotals.entries()]
    .map(([category, count]) => ({ category, label: eventCategoryLabel(category), count }))
    .sort((a, b) => b.count - a.count);
  return {
    businesses: summaries,
    totals: {
      businesses: bizRows.length,
      active: summaries.filter((s) => s.active).length,
      avgReadiness: bizRows.length ? Math.round(summaries.reduce((s, x) => s + x.readiness, 0) / bizRows.length) : 0,
      avgTraining: bizRows.length ? Math.round(summaries.reduce((s, x) => s + (x.training ?? 0), 0) / bizRows.length) : 0,
      onboarded: summaries.filter((s) => s.onboardingDone).length,
      needingAssistance: summaries.filter((s) => s.needsAssistance).length,
    },
    challenges,
    weekly,
    byIndustry: summaries.reduce<Record<string, number>>((acc, s) => {
      const key = s.industry === "other" ? s.customIndustry ?? "Other" : industryTemplate(s.industry).name;
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {}),
  };
}
