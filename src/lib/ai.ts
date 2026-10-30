import { db } from "@/db";
import { jobs, events, qualityRecords, actions, businesses } from "@/db/schema";
import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { eventCategoryLabel } from "@/lib/domain";
import { toOdia } from "@/lib/odia";
import { computeInsights, dashboardStats, dataCompleteness, readiness, clusterAggregate, nextBestSteps } from "@/lib/analytics";

export interface AiAnswer {
  text: string;
  meta: { recordsUsed: string; period: string; reliability: string };
  simulated: true;
  followUps: string[];
  suggestedAction?: { title: string; description: string; problemRef: string };
  proposedUpdate?: ProposedUpdate;
  link?: string;
  linkLabel?: string;
}

const FOLLOWUPS_EN = [
  "How is my production performing?",
  "Which jobs are delayed?",
  "What are my recurring problems?",
  "Which machines have the most downtime?",
  "Summarise this month's production.",
  "What should I improve first?",
];

const FOLLOWUPS_OD = [
  "Mo utpadana kibhabe chaluchhi?",
  "Kon karyyagudika bilamba hochhi?",
  "Mo barambara samashyagudika ki ki?",
  "Mo karyya re ki improve koriba prathame?",
];

function odiaGreeting(): string {
  return toOdia("Namaskar! Mo Pragati Mitra — apanananka vyabasayara buddhimana sahayakari.|Mo apanananka utpadana, samashya ara sudharara karyya samparkare katha kahibi. Udaharanare: 'Mo utpadana kibhabe chaluchhi?' athaba 'Mo barambara samashyagudika ki ki?' jijnasa karantu.".replace(/\|/g, "\n"));
}


// ---------- Instruction parsing: turn "update my data" messages into proposed updates ----------
export interface ProposedUpdate {
  kind: "production_qty" | "job_completed" | "event";
  summary: string;
  summaryOd: string;
  payload: Record<string, unknown>;
}

const OD = (x: string) => toOdia(x);
const odFill = (tpl: string, vars: Record<string, string | number>) =>
  tpl
    .split(/(§\w§?)/g)
    .map((part) => {
      const m = part.match(/^§(\w)§?$/);
      if (m && m[1] in vars) return String(vars[m[1]]); // values (e.g. job codes) stay as-is
      return toOdia(part);
    })
    .join("");
const KW = {
  made: [OD("tauri karichu"), OD("tayara karichu"), OD("utpadana haila"), OD("karichu")],
  done: [OD("sampurna"), OD("sesha haila"), OD("sampanna")],
  stopped: [OD("bandhila"), OD("bikala haila"), OD("kam karuni"), OD("bandhile")],
  shortage: [OD("abhava"), OD("sesha nai"), OD("shortage")],
  rejected: [OD("reject haila"), OD("bikala haila"), OD("kharap haila")],
};

function asciiDigits(x: string): string {
  return x.replace(/[\u0B66-\u0B6F]/g, (c) => String(c.charCodeAt(0) - 0x0b66));
}

export async function parseUpdateInstruction(
  rawQ: string,
  businessId: string,
  lang: "en" | "od"
): Promise<{ proposed: ProposedUpdate | null; clarify: string | null }> {
  const q = asciiDigits(rawQ).toLowerCase();
  const qOd = rawQ; // original (may contain Odia script)
  const jobCodeMatch = q.match(/\b([a-z]{2,5}-\d{2,4})\b/);
  const code = jobCodeMatch ? jobCodeMatch[1].toUpperCase() : null;

  const bizJobs = await db.select().from(jobs).where(eq(jobs.businessId, businessId)).orderBy(desc(jobs.createdAt));
  const findJob = async (c: string | null) => {
    if (c) {
      const j = bizJobs.find((x: (typeof bizJobs)[number]) => x.code.toUpperCase() === c);
      if (j) return j;
      return null;
    }
    return bizJobs.find((x: (typeof bizJobs)[number]) => x.status === "active" || x.status === "delayed") ?? bizJobs[0] ?? null;
  };

  const hasOd = (keys: string[]) => keys.some((k) => qOd.includes(k));

  // 1. Mark a job completed
  const markCompleted =
    /(?:mark\s+)?(?:job|batch|order)\s*#?\s*[a-z]{2,5}-?\d{2,4}\s*(?:as\s+)?complet|complet\w*\s+(?:job|order|batch)\s*#?\s*[a-z]{2,5}-?\d{2,4}/.test(q) ||
    (hasOd(KW.done) && (code || /job|karyya/i.test(q)));
  if (markCompleted && code) {
    const job = await findJob(code);
    if (!job) return { proposed: null, clarify: lang === "od" ? odFill("Job §C§ milila nai. Sahi code lekhantu.", { C: code ?? "" }) : `I could not find job ${code}. Please check the job code.` };
    if (job.status === "completed") return { proposed: null, clarify: lang === "od" ? odFill("Job §C§ already sampurna (completed) achhi.", { C: job.code }) : `Job ${job.code} is already marked completed.` };
    return {
      proposed: {
        kind: "job_completed",
        summary: `Mark job ${job.code} (“${job.title}”) as completed: status → completed, completion date → today, all stages → completed.`,
        summaryOd: odFill("Job §C§ ku sampurna (completed) mark kariba: status → sampurna, tarikh → aaji, sabu stage → sampurna.", { C: job.code }),
        payload: { jobId: job.id, code: job.code },
      },
      clarify: null,
    };
  }

  // 2. Production quantity completed: "today we completed 25 units" / "aaji 25 ti karichu"
  const qtyMatch = q.match(/(\d+)\s*(?:units?|pieces?|pcs?|items?|ta\b|unit)?/) ?? (hasOd(KW.made) ? q.match(/(\d+)/) : null);
  const qtyIntent = /(complet|produc|mad|finish|karichu|tauri)/.test(q) || hasOd(KW.made);
  if (qtyIntent && qtyMatch) {
    const addQty = Number(qtyMatch[1]);
    const job = await findJob(code);
    if (!job) return { proposed: null, clarify: lang === "od" ? toOdia("Kono active karyya milila nai — prathame eka karyya create karantu.") : "No active job found — create a job first in Production & Jobs." };
    const cur = job.completedQty ?? 0;
    const total = job.quantity ?? 0;
    const newQty = total > 0 ? Math.min(total, cur + addQty) : cur + addQty;
    const willComplete = total > 0 && newQty >= total;
    return {
      proposed: {
        kind: "production_qty",
        summary: `Add ${addQty} completed unit(s) to job ${job.code} (${cur} → ${newQty}${total ? ` of ${total}` : ""})${willComplete ? ". The job will be marked completed." : ""}.`,
        summaryOd: odFill("Job §C§ re §1§ ti sampurna unit add kariba (§2§ → §3§)" + (willComplete ? ". Karyya sampurna hobe." : "") + ".", { C: job.code, "1": addQty, "2": cur, "3": String(newQty) + (total ? " / " + total : "") }),
        payload: { jobId: job.id, code: job.code, addQty, newQty, willComplete },
      },
      clarify: null,
    };
  }

  // 3. Machine stopped / breakdown
  const machineIntent = /machines?\s+(?:stopped|down|broke|failed)|machine\s+(?:stopped|down|broke)|breakdown/.test(q) || hasOd(KW.stopped);
  if (machineIntent) {
    const countMatch = q.match(/(\d+)\s+machines?/);
    const hourMatch = q.match(/(\d+)\s*(?:hours?|hrs?|ghanta|ghantare)/);
    const minMatch = q.match(/(\d+)\s*(?:minutes?|mins?|minit|minite)/);
    let durationMinutes: number | null = null;
    if (hourMatch) durationMinutes = Number(hourMatch[1]) * 60;
    else if (minMatch) durationMinutes = Number(minMatch[1]);
    const job = await findJob(code);
    const desc = lang === "od" ? toOdia("Yantra bandhila/bikala — user lekha ru report") : `Machine stopped/breakdown reported via Pragati AI${countMatch ? ` (${countMatch[1]} machines)` : ""}${job ? ` on job ${job.code}` : ""}.`;
    return {
      proposed: {
        kind: "event",
        summary: `Record a machine breakdown event${durationMinutes ? ` lasting ${durationMinutes} min` : ""}${job ? ` on job ${job.code}` : ""} (stage: current stage if known). It will appear in Event Centre, Insights and Reports.`,
        summaryOd: toOdia("Eka yantra bikala ghatana record kariba" + (durationMinutes ? " (" + durationMinutes + " minit)" : "") + (job ? " job " + job.code + " re" : "") + ". Eha Event Centre, Insights ara Reports re dekhay."),
        payload: { category: "machine_breakdown", jobCode: job?.code ?? null, durationMinutes, qtyAffected: countMatch ? Number(countMatch[1]) : null, description: desc },
      },
      clarify: null,
    };
  }

  // 4. Material shortage
  if (/material\s+shortage|shortage|running out|stock\s+out/.test(q) || hasOd(KW.shortage)) {
    const job = await findJob(code);
    const desc = lang === "od" ? toOdia("Kachamala abhava — store ru report") : "Material shortage reported via Pragati AI.";
    return {
      proposed: {
        kind: "event",
        summary: `Record a material shortage event${job ? ` on job ${job.code}` : ""}.`,
        summaryOd: odFill("Eka kachamala abhava ghatana record kariba" + (job ? " job §C§ re" : "") + ".", { C: job?.code ?? "" }),
        payload: { category: "material_shortage", jobCode: job?.code ?? null, description: desc },
      },
      clarify: null,
    };
  }

  // 5. Rejected / quality issue
  const rejMatch = q.match(/(?:rejected|defect|rework)\s+(\d+)/) ?? (hasOd(KW.rejected) ? q.match(/(\d+)/) : null);
  if ((/reject|defect|rework|quality/.test(q) || hasOd(KW.rejected)) && rejMatch) {
    const job = await findJob(code);
    return {
      proposed: {
        kind: "event",
        summary: `Record a quality issue event: ${rejMatch[1]} piece(s) rejected${job ? ` on job ${job.code}` : ""}.`,
        summaryOd: odFill("Eka pariksha samashya record kariba: §5§ ti reject" + (job ? " job §C§ re" : "") + ".", { C: job?.code ?? "", "5": rejMatch[1] }),
        payload: { category: "quality_issue", jobCode: job?.code ?? null, qtyAffected: Number(rejMatch[1]), description: lang === "od" ? toOdia("Reject/Rework — Pragati AI ru report") : "Rejected/defect reported via Pragati AI." },
      },
      clarify: null,
    };
  }

  return { proposed: null, clarify: null };
}

export async function pragatiAnswer(question: string, businessId: string | null, clusterId: string | null, lang: "en" | "od"): Promise<AiAnswer> {
  const q = question.toLowerCase().trim();

  // ---------- Cluster supervisor mode ----------
  if (clusterId && !businessId) {
    const agg = await clusterAggregate(clusterId);
    const t = agg.totals;
    const topChallenges = agg.challenges.slice(0, 3).map((c) => `${c.label.toLowerCase()} (${c.count} reports across the cluster)`).join(", ");
    const needHelp = agg.businesses.filter((b) => b.needsAssistance).map((b) => b.name).join(", ");
    if (q.includes("cluster") || q.includes("businesses") || q.includes("training") || q.includes("challenge") || q.includes("support") || q.includes("aggregate") || q.length < 4) {
      const text = [
        `Cluster summary (aggregated, authorised information only — individual factory records are not shared):`,
        `• ${t.businesses} MSMEs in the cluster, ${t.active} currently active, ${t.onboarded} completed onboarding.`,
        `• Average digital readiness score: ${t.avgReadiness}/100. Average training completion: ${t.avgTraining}%.`,
        `• Most common challenges across the cluster: ${topChallenges || "no events recorded yet"}.`,
        needHelp ? `• Businesses that may need support/training: ${needHelp}.` : "• No business currently flagged as needing urgent assistance.",
        `Suggested next step: run a short digital-training session with the businesses flagged above, starting with Event Centre reporting and QR-based job updates.`,
      ].join("\n");
      return {
        text,
        meta: {
          recordsUsed: `${t.businesses} business summaries, aggregated event counts (no confidential factory data)` ,
          period: "last 8 weeks",
          reliability: "Aggregated counts only; individual records are protected",
        },
        simulated: true,
        followUps: ["Which businesses need training?", "What are the common challenges?", "Show aggregated productivity trend."],
      };
    }
    if (q.includes("train") || q.includes("need")) {
      const text = needHelp
        ? `Businesses that may need digital training or support right now:\n${agg.businesses.filter((b) => b.needsAssistance).map((b) => `• ${b.name} — readiness ${b.readiness}/100, training ${b.training}%`).join("\n")}\nRecommendation: start with the 5-minute getting-started guide in the Learning Centre, then Record Bridge import.`
        : "All participating businesses currently look on track. Keep monitoring readiness scores weekly.";
      return { text, meta: { recordsUsed: "aggregated per-business summaries", period: "current", reliability: "Aggregated view" }, simulated: true, followUps: FOLLOWUPS_EN };
    }
    const text = `I can help with aggregated cluster information: participating MSMEs, readiness and training progress, common challenges, businesses needing support and cluster-level productivity trends. Individual business records are protected and not shared.\n\nCluster now: ${t.businesses} businesses, avg readiness ${t.avgReadiness}/100, top challenges: ${topChallenges || "none recorded"}.`;
    return { text, meta: { recordsUsed: "cluster aggregate", period: "last 8 weeks", reliability: "Aggregated view" }, simulated: true, followUps: FOLLOWUPS_EN };
  }

  if (!businessId) {
    return {
      text: "I am Pragati AI, your business copilot. Please sign in to a business (or demo business) so I can use only your authorised records to answer.",
      meta: { recordsUsed: "none", period: "—", reliability: "—" },
      simulated: true,
      followUps: FOLLOWUPS_EN,
    };
  }

  const biz = (await db.select().from(businesses).where(eq(businesses.id, businessId)).limit(1))[0];
  const [stats, ins, comp, ready] = await Promise.all([
    dashboardStats(businessId),
    computeInsights(businessId),
    dataCompleteness(businessId),
    readiness(businessId),
  ]);
  const allJobs = await db.select().from(jobs).where(eq(jobs.businessId, businessId)).orderBy(desc(jobs.createdAt));
  const allEvents = await db.select().from(events).where(eq(events.businessId, businessId)).orderBy(desc(events.createdAt));
  const allQuality = await db.select().from(qualityRecords).where(eq(qualityRecords.businessId, businessId));
  const allActions = await db.select().from(actions).where(eq(actions.businessId, businessId)).orderBy(desc(actions.createdAt));
  const recentJobs = allJobs.slice(0, 12);
  const monthAgo = new Date(Date.now() - 30 * 86400000);
  const monthJobs = allJobs.filter((j) => new Date(j.createdAt) >= monthAgo);
  const monthEvents = allEvents.filter((e) => new Date(e.createdAt) >= monthAgo);
  const monthCompleted = monthJobs.filter((j) => j.status === "completed");
  const monthQty = monthCompleted.reduce((s, j) => s + (j.completedQty ?? 0), 0);

  const meta = {
    recordsUsed: `${comp.counts.jobs} jobs, ${comp.counts.events} events (${comp.counts.verifiedEvents} verified), ${comp.counts.quality} inspections, ${comp.counts.actions} actions`,
    period: ins.period,
    reliability: `${comp.label}${comp.warnings.length ? " — " + comp.warnings[0] : ""}`,
  };
  const isOd = lang === "od" || [...q].some((c) => { const code = c.charCodeAt(0); return code >= 0x0b00 && code <= 0x0b7f; }) || q.includes("utpadana") || q.includes("samashya") || q.includes("namaskar") || q.includes("yantra") || q.includes("karyya") || q.includes("vyabasaya");

  // Data-update instructions (English or Odia): propose first, apply only after user confirms.
  const parsed = await parseUpdateInstruction(question, businessId, lang);
  if (parsed.clarify) {
    return { text: parsed.clarify, meta, simulated: true, followUps: FOLLOWUPS_EN };
  }
  if (parsed.proposed) {
    const p = parsed.proposed;
    const text = (isOd ? p.summaryOd : p.summary) + "\n\n" + (isOd ? toOdia("Dayakari confirm karile mo save karibi. Cancel karile kono change h Regulation nei."): "Confirm to save this update. Cancel to discard — nothing is changed yet.");
    return { text, meta, simulated: true, followUps: FOLLOWUPS_EN, proposedUpdate: p };
  }

  const delayedJobs = stats.delayedJobs;
  const topInsights = ins.insights.slice(0, 3);
  const machineEvs = allEvents.filter((e) => e.category === "machine_breakdown");
  const machineMins = machineEvs.reduce((s, e) => s + (e.durationMinutes ?? 0), 0);
  const machineJobs = new Set(machineEvs.map((e) => e.jobId).filter(Boolean)).size;

  // ----- Odia responses -----
  if (isOd && (q.includes("namaskar") || q.includes("hello") || q.includes("hi") || q.length < 4)) return { text: odiaGreeting(), meta, simulated: true, followUps: FOLLOWUPS_OD };
  if (isOd && (q.includes("utpadana") || q.includes("production"))) {
    const text = `Mo utpadana samparkare (apana kara record adharare):\n• Chaluchhi karyya: ${stats.counts.active}, bilamba hochhi: ${stats.counts.delayed}, sesha hoichhi: ${stats.counts.completed}.\n• Eka mahina re ${monthCompleted.length} ta karyya sesha hoichhi, ${monthQty} unit utpadita hoichhi.\n• Reject rate: ${stats.quality.rejectRate}%.\nEha sabu apana kara record ruveçana — kono kalpita sankhya noy.`;
    return { text, meta, simulated: true, followUps: FOLLOWUPS_OD };
  }
  if (isOd && q.includes("samashya")) {
    const body = topInsights.length
      ? topInsights.map((i, n) => `${n + 1}. ${i.title} — ${i.observation}`).join("\n")
      : "";
    const text = topInsights.length
      ? toOdia(`Mo barambara samashyagudika (record adharare):\n${body}\nPrathame sudharara karyya: ${topInsights[0]?.suggestedAction ?? "—"}`)
      : toOdia("Ebe parjyanta kono barambara samashya dhara padini. Event Centre re samashya report karantu.");
    return { text, meta, simulated: true, followUps: FOLLOWUPS_OD };
  }
  if (isOd && (q.includes("yantra") || q.includes("machine"))) {
    const text = machineEvs.length
      ? toOdia(`Yantra down: @a bar report hoichhi, @b ta karyyare, mot @c minitabadhe down thila.|Suggested karyya: maintenance schedule parikshana karantu.`)
          .replace("@a", String(machineEvs.length)).replace("@b", String(machineJobs)).replace("@c", String(machineMins))
      : toOdia("Kono yantra breakdown record nei.");
    return { text, meta, simulated: true, followUps: FOLLOWUPS_OD };
  }

  // ----- English intents -----
  if (/\b(hi|hello|hey|namaste|namaskar)\b/.test(q) || q.length < 4) {
    const text = `Hello! I am **Pragati AI**, your MSME business copilot for ${biz?.name ?? "your business"}.\nI answer using only your authorised records — ${meta.recordsUsed}.\nYou can ask me things like:\n• How is my production performing?\n• Which jobs are delayed?\n• What are my recurring problems?\n• Which machines have the most downtime?\n• What should I improve first?\nNote: in this prototype my answers are rule-based simulations over your sample data, clearly labelled — no figures are invented.`;
    return { text, meta, simulated: true, followUps: FOLLOWUPS_EN };
  }

  if (q.includes("how to") || q.includes("how do") || q.includes("guide") || q.includes("learn") || q.includes("use") || q.includes("qr") || q.includes("scan")) {
    const guides: Record<string, string> = {
      job: "To create a job: open Production & Jobs → \"New Job\" → choose product, quantity, workers and dates. The job gets a QR code; workers scan it to update stages.",
      qr: "Each job has a QR code in its detail view. Workers open the Worker view (/worker), tap \"Enter job code\", type or scan the code, then Start / Pause / Complete stages and report problems — no complex menus.",
      report: "To report a problem: Event Centre → \"Report Event\" (or the quick buttons in Worker view). Pick a category (machine breakdown, material shortage…), the job/stage, duration and a short note. A supervisor verifies it.",
      insight: "Smart Insights analyses your jobs, verified events and quality records and shows each pattern with the exact records behind it, the period, frequency, a suggested next step and a reliability warning.",
      ai: "Ask me anything about your business in simple English or Odia — e.g. \"Which jobs are delayed?\" or \"What should I improve first?\". I always show which records I used.",
      import: "Record Bridge: upload a CSV/Excel export of your register, map the columns, check the preview for missing data and duplicates, then confirm the import.",
    };
    const key = q.includes("qr") || q.includes("scan") ? "qr" : q.includes("report") || q.includes("problem") ? "report" : q.includes("insight") ? "insight" : q.includes("import") || q.includes("excel") || q.includes("csv") || q.includes("register") ? "import" : q.includes("job") || q.includes("create") ? "job" : q.includes("ai") || q.includes("you") ? "ai" : "job";
    const links: Record<string, [string, string]> = {
      job: ["/app/production", "Production & Jobs"],
      qr: ["/worker", "Worker view (QR)"],
      report: ["/app/events", "Event Centre"],
      insight: ["/app/insights", "Smart Insights"],
      ai: ["/app/ai", "Pragati AI"],
      import: ["/app/record-bridge", "Record Bridge"],
    };
    const [link, linkLabel] = links[key] ?? ["/app/learn", "Learning Centre"];
    return { text: guides[key] + "\n\nMore step-by-step guides (English & Odia) are in the Learning Centre.", meta, simulated: true, followUps: FOLLOWUPS_EN, link, linkLabel };
  }

  if (q.includes("improve") || q.includes("first") || q.includes("priority") || q.includes("next") || q.includes("recommend") || question.includes(toOdia("kiba koriba"))) {
    const steps = await nextBestSteps(businessId);
    const top = ins.insights[0];
    const text = [
      top
        ? `Based on your records, the first thing to address is: **${top.title}**.`
        : "Your records do not show a strong recurring problem yet — keep recording events and inspections.",
      top ? `What was observed: ${top.observation}` : "",
      top ? `Suggested action: ${top.suggestedAction}` : "",
      "",
      "Your guided next steps:",
      ...steps.map((s, i) => `${i + 1}. ${s}`),
      "",
      "I can create this corrective action in the Action Tracker for you — just ask me to \"create the action\" and approve it.",
    ].filter(Boolean).join("\n");
    return {
      text,
      meta,
      simulated: true,
      followUps: FOLLOWUPS_EN,
      link: "/app/insights",
      linkLabel: "Open Smart Insights",
      suggestedAction: top
        ? { title: top.suggestedAction.slice(0, 80), description: top.suggestedAction, problemRef: `${top.title} — ${top.frequency} (${top.id})` }
        : undefined,
    };
  }

  if (q.includes("create") && (q.includes("action") || q.includes("task"))) {
    const top = ins.insights[0];
    if (!top) return { text: "There is no recurring problem in your records yet, so there is nothing to convert into an action. Record more events first.", meta, simulated: true, followUps: FOLLOWUPS_EN };
    return {
      text: `I suggest creating this corrective action based on your records:\n\n• Problem: ${top.title}\n• Evidence: ${top.observation}\n• Action: ${top.suggestedAction}\n\nApprove below and I will add it to the Action Tracker (pending, so a supervisor can assign it).`,
      meta,
      simulated: true,
      followUps: FOLLOWUPS_EN,
      suggestedAction: { title: top.suggestedAction.slice(0, 90), description: top.suggestedAction, problemRef: `${top.title} — ${top.frequency} (${top.id})` },
    };
  }

  if (q.includes("delay") || q.includes("late") || q.includes("overdue")) {
    const text = delayedJobs.length
      ? `Delayed jobs right now (from job records):\n${delayedJobs.map((j) => `• ${j.code} — ${j.title}; currently at "${j.stage}", ${j.daysOverdue} day(s) overdue`).join("\n")}\nCheck the events recorded on these jobs in the Event Centre to see what is holding them up.`
      : `Good news — no jobs are currently delayed. ${stats.counts.active} job(s) are active and on schedule.`;
    return { text, meta, simulated: true, followUps: ["Which stage has the most interruptions?", "What are my recurring problems?"] };
  }

  if (q.includes("interruption") || q.includes("stage") || q.includes("bottleneck") || q.includes("stuck")) {
    const top = stats.stageLoad[0];
    const text = top
      ? `Stage with the most reported interruptions: **${top.stage}** — ${top.count} event(s) recorded there in total.\nFull stage-wise load:\n${stats.stageLoad.map((s) => `• ${s.stage}: ${s.count}`).join("\n") || "—"}\nCross-check with Smart Insights for the verified pattern.`
      : "No events recorded at stages yet — interruptions will appear here once workers report them.";
    return { text, meta, simulated: true, followUps: FOLLOWUPS_EN };
  }

  if (q.includes("recurring") || q.includes("problem") || q.includes("pattern") || q.includes("repeat")) {
    const text = topInsights.length
      ? `Recurring patterns found in your records (${ins.period}):\n\n${topInsights.map((i, n) => `${n + 1}. **${i.title}** (${i.severity} severity, reliability: ${i.reliability})\n   ${i.observation}\n   Suggested: ${i.suggestedAction}`).join("\n\n")}\n\nEach pattern above lists the exact records it is based on in Smart Insights. Causes shown there are possibilities, not verified root causes.`
      : `No recurring pattern yet — only ${comp.counts.events} event(s) recorded. Once you have ~10 jobs and 15 verified events, patterns appear automatically.`;
    return { text, meta, simulated: true, followUps: FOLLOWUPS_EN };
  }

  if (q.includes("machine") || q.includes("downtime") || q.includes("breakdown")) {
    const text = machineEvs.length
      ? `Machine downtime in your records: **${machineEvs.length} breakdown event(s)** across ${machineJobs} job(s), totalling **${machineMins} minutes**.\nRecent breakdowns:\n${machineEvs.slice(0, 5).map((e) => `• ${new Date(e.createdAt).toLocaleDateString("en-IN")} — ${e.stage ?? "—"}: ${e.description ?? eventCategoryLabel(e.category)}${e.durationMinutes ? ` (${e.durationMinutes} min)` : ""}${e.verified ? " ✓ verified" : " (unverified)"}`).join("\n")}\nSuggested next step: review the maintenance schedule and inspect the affected machine before the next production run. I can create this as a corrective action — ask "create the action".`
      : "No machine breakdown events recorded yet. When one happens, report it in the Event Centre or via the job QR code.";
    return {
      text,
      meta,
      simulated: true,
      followUps: FOLLOWUPS_EN,
      suggestedAction: machineEvs.length >= 2 ? { title: "Inspect machines with repeated breakdowns & review maintenance schedule", description: `Machine downtime recorded ${machineEvs.length} times (${machineMins} min) across ${machineJobs} jobs. Inspect affected machines and keep a weekly maintenance log.`, problemRef: `machine_breakdown — ${machineEvs.length} events, ${machineMins} min (ins-machine_breakdown)` } : undefined,
    };
  }

  if (q.includes("material") || q.includes("shortage") || q.includes("stock") || q.includes("inventory")) {
    const m = allEvents.filter((e) => e.category === "material_shortage");
    const text = m.length
      ? `Material shortages recorded: ${m.length} event(s), quantity affected where known: ${m.reduce((s, e) => s + (e.qtyAffected ?? 0), 0)} units.\n${m.slice(0, 5).map((e) => `• ${new Date(e.createdAt).toLocaleDateString("en-IN")} — job stage ${e.stage ?? "—"}: ${e.description ?? "material shortage"}`).join("\n")}\nSuggested: keep a minimum stock list with the storekeeper and check material readiness before starting a job.`
      : "No material shortages recorded. When stock runs low, the storekeeper can report it in the Event Centre.";
    return { text, meta, simulated: true, followUps: FOLLOWUPS_EN };
  }

  if (q.includes("quality") || q.includes("defect") || q.includes("rework") || q.includes("reject")) {
    const byDefect = new Map<string, { rejected: number; rework: number; n: number }>();
    for (const qq of allQuality) {
      const k = qq.defectCategory ?? "Uncategorised";
      const cur = byDefect.get(k) ?? { rejected: 0, rework: 0, n: 0 };
      cur.rejected += qq.rejected ?? 0;
      cur.rework += qq.rework ?? 0;
      cur.n += 1;
      byDefect.set(k, cur);
    }
    const top = [...byDefect.entries()].sort((a, b) => b[1].rejected - a[1].rejected).slice(0, 4);
    const text = `Quality summary from ${allQuality.length} inspection record(s): ${stats.quality.inspected} inspected, ${stats.quality.rejected} rejected (${stats.quality.rejectRate}%), ${stats.quality.rework} rework.\nBy defect category:\n${top.map(([k, v]) => `• ${k}: ${v.rejected} rejected, ${v.rework} rework (${v.n} record(s))`).join("\n") || "No defects recorded."}\nSuggested: agree one corrective action with the quality checker for the top defect and track whether rejections reduce afterwards.`;
    return { text, meta, simulated: true, followUps: FOLLOWUPS_EN };
  }

  if (q.includes("month") || q.includes("summar") || q.includes("summary") || q.includes("report") || q.includes("performance") || q.includes("performing") || q.includes("production")) {
    const text = `Production summary for ${biz?.name ?? "your business"} (last 30 days, from ${monthJobs.length} job record(s) and ${monthEvents.length} event(s)):\n• Jobs started: ${monthJobs.length} | completed: ${monthCompleted.length} | currently active: ${stats.counts.active} | delayed: ${stats.counts.delayed}\n• Quantity completed: ${monthQty} units\n• Events this month: ${monthEvents.length} (${monthEvents.filter((e) => e.verified).length} verified)\n• Quality: reject rate ${stats.quality.rejectRate}% (${stats.quality.rejected}/${stats.quality.inspected} inspected)\n• Digital readiness score: ${ready.score}/100 — ${ready.level}\nWeekly output trend: ${stats.weekly.map((w) => `${w.week}: ${w.completedQty}`).join(", ")}\nTop interruption category (last 30 days): ${stats.eventsByCategory[0] ? `${stats.eventsByCategory[0].label} (${stats.eventsByCategory[0].count})` : "none"}\nFull explainable detail is in Smart Insights; a downloadable report is in Reports.`;
    return { text, meta, simulated: true, followUps: FOLLOWUPS_EN };
  }

  if (q.includes("action") || q.includes("corrective") || q.includes("task")) {
    const byStatus = (s: string) => allActions.filter((a) => a.status === s).length;
    const text = `Corrective actions: ${byStatus("pending")} pending, ${byStatus("in_progress")} in progress, ${byStatus("completed")} completed.\n${allActions.slice(0, 6).map((a) => `• [${a.status}] ${a.title}${a.priority === "high" ? " (HIGH)" : ""}`).join("\n") || "No actions yet."}\nImprovement history (whether problems reduced after actions) is shown in the Action Tracker.`;
    return { text, meta, simulated: true, followUps: FOLLOWUPS_EN };
  }

  if (q.includes("readiness") || q.includes("score") || q.includes("adoption")) {
    const text = `Your MSME Digital Readiness Score is **${ready.score}/100 — ${ready.level}**.\nBreakdown (based on actual feature usage, not an official rating):\n${ready.breakdown.map((b) => `• ${b.label}: ${b.points}/${b.max}`).join("\n")}\nNext best steps:\n${(await nextBestSteps(businessId)).map((s, i) => `${i + 1}. ${s}`).join("\n")}`;
    return { text, meta, simulated: true, followUps: FOLLOWUPS_EN };
  }

  // Fallback
  const text = `I could not match that to a specific question, but here is what I can do with your records (${meta.recordsUsed}):\n• Summarise production / this month\n• List delayed jobs and the stage with most interruptions\n• Explain recurring problems (machines, materials, quality) with the exact records used\n• Suggest what to improve first and create a corrective action (with your approval)\n• Explain how to use any feature (jobs, QR codes, event reporting, insights)\nTry: "What should I improve first?"\nNote: answers in this prototype are rule-based simulations over your data — every answer shows the records and period used, and missing data is flagged rather than invented.`;
  return { text, meta, simulated: true, followUps: FOLLOWUPS_EN };
}
