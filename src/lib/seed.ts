import { eq, inArray, isNotNull, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  businesses,
  users,
  jobs,
  events,
  qualityRecords,
  defectCategories,
  actions,
  imports,
  notifications,
  clusters,
  type JobRow,
} from "@/db/schema";
import { hashPassword } from "@/lib/auth";
import {
  DEMO_PASSWORD,
  industryTemplate,
  buildAdoptionPlan,
  type IndustryId,
  type JobStage,
} from "@/lib/domain";

function d(daysAgo: number, hour = 10): Date {
  const t = new Date();
  t.setDate(t.getDate() - daysAgo);
  t.setHours(hour, 15, 0, 0);
  return t;
}

interface BizSpec {
  name: string;
  slug: string;
  industry: IndustryId;
  customIndustry?: string;
  location: string;
  businessType: string;
  products: string;
  workersCount: number;
  recordMethod: string;
  existingSoftware: string;
  mainProblems: string[];
  training: number;
  prefix: string;
  people: { owner: string; manager: string; supervisor: string; w1: string; w2: string; store: string; qc: string };
}

const BIZ_SPECS: BizSpec[] = [
  {
    name: "Odisha Metal Works",
    slug: "odisha-metal-works",
    industry: "fabrication",
    location: "Cuttack, Odisha",
    businessType: "Proprietorship",
    products: "Gates, grills, machine frames, shed structures",
    workersCount: 12,
    recordMethod: "paper",
    existingSoftware: "None — paper registers",
    mainProblems: ["Machine breakdowns", "Production delays", "Quality / rework"],
    training: 75,
    prefix: "OMW",
    people: { owner: "Suresh Pradhan", manager: "Anita Mohanty", supervisor: "Bijay Das", w1: "Ravi Nayak", w2: "Mina Barik", store: "Gopal Senapati", qc: "Lata Patra" },
  },
  {
    name: "Utkal Electrical Systems",
    slug: "utkal-electrical",
    industry: "electrical",
    location: "Bhubaneswar, Odisha",
    businessType: "Partnership",
    products: "Electrical panels, pump sets, motor rewinding",
    workersCount: 18,
    recordMethod: "excel",
    existingSoftware: "Tally for accounts only",
    mainProblems: ["Material shortages", "Quality / rework"],
    training: 60,
    prefix: "UES",
    people: { owner: "Harish Mohapatra", manager: "Sunita Ray", supervisor: "Prakash Behera", w1: "Dipti Das", w2: "Sanjay Sahoo", store: "Bhagaban Jena", qc: "Rekha Nayak" },
  },
  {
    name: "Odisha Handloom Cooperative",
    slug: "odisha-handloom",
    industry: "handloom",
    location: "Sambalpur, Odisha",
    businessType: "Cooperative society",
    products: "Sambalpuri sarees, cotton cloth, towels",
    workersCount: 24,
    recordMethod: "paper",
    existingSoftware: "None",
    mainProblems: ["Material shortages", "Machine breakdowns", "Worker coordination"],
    training: 40,
    prefix: "OHC",
    people: { owner: "Mamata Devi", manager: "Sudarsan Patra", supervisor: "Kishore Tanti", w1: "Radha Tanti", w2: "Jhuma Majhi", store: "Bhola Sahoo", qc: "Sabita Dei" },
  },
  {
    name: "Pragati Engineering Works",
    slug: "pragati-engineering",
    industry: "other",
    customIndustry: "Food processing machinery",
    location: "Khordha, Odisha",
    businessType: "Proprietorship",
    products: "Custom machinery parts, conveyors",
    workersCount: 9,
    recordMethod: "mixed",
    existingSoftware: "WhatsApp groups for coordination",
    mainProblems: ["Hard to find recurring problems", "No standard process"],
    training: 55,
    prefix: "PEW",
    people: { owner: "Ajay Kumar Sahoo", manager: "Nibedita Panda", supervisor: "Manoranjan Das", w1: "Chinmay Behera", w2: "Puja Rath", store: "Sisir Nayak", qc: "Gayatri Mohanty" },
  },
];

function makeStages(names: string[], base: Date, completedUpTo: number, inProgressIdx: number | null, pausedIdx: number | null = null): JobStage[] {
  return names.map((name, i) => {
    const s: JobStage = { name, order: i, status: "pending" };
    if (i < completedUpTo) {
      s.status = "completed";
      s.startedAt = new Date(base.getTime() + i * 86400000).toISOString();
      s.completedAt = new Date(base.getTime() + (i + 1) * 86400000).toISOString();
    } else if (i === inProgressIdx) {
      s.status = "in_progress";
      s.startedAt = new Date(base.getTime() + i * 86400000).toISOString();
    } else if (i === pausedIdx) {
      s.status = "paused";
      s.startedAt = new Date(base.getTime() + i * 86400000).toISOString();
      s.pausedAt = new Date(base.getTime() + (i * 86400000 + 3600000)).toISOString();
    }
    return s;
  });
}

export async function resetDemoData(): Promise<void> {
  // Keep demo users (and their sessions) alive; only business data is rebuilt.
  const demoUsers = await db
    .select({ id: users.id, email: users.email, role: users.role })
    .from(users)
    .where(eq(users.isDemo, true));
  const demoBiz = await db.select({ id: businesses.id }).from(businesses).where(eq(businesses.isDemo, true));
  const bizIds = demoBiz.map((b) => b.id);
  const userIds = demoUsers.map((u) => u.id);
  if (userIds.length) {
    await db.delete(notifications).where(inArray(notifications.userId, userIds));
  }
  if (bizIds.length) {
    await db.delete(actions).where(inArray(actions.businessId, bizIds));
    await db.delete(qualityRecords).where(inArray(qualityRecords.businessId, bizIds));
    await db.delete(events).where(inArray(events.businessId, bizIds));
    await db.delete(imports).where(inArray(imports.businessId, bizIds));
    await db.delete(jobs).where(inArray(jobs.businessId, bizIds));
    await db.delete(defectCategories).where(inArray(defectCategories.businessId, bizIds));
  }
  // Detach ALL users pointing at demo businesses/clusters before deleting parents (FK constraints).
  if (bizIds.length) {
    await db.update(users).set({ businessId: null }).where(inArray(users.businessId, bizIds));
  }
  await db.update(users).set({ clusterId: null }).where(isNotNull(users.clusterId));
  if (bizIds.length) await db.delete(businesses).where(inArray(businesses.id, bizIds));
  await db.delete(clusters);
  await seedDemoData();
}

async function upsertDemoUser(email: string, vals: Partial<typeof users.$inferInsert> & { name: string; role: string }): Promise<typeof users.$inferSelect> {
  const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (existing[0] && (existing[0].isDemo || email.endsWith(".demo"))) {
    return (await db.update(users).set({ ...vals, email, isDemo: true }).where(eq(users.id, existing[0].id)).returning())[0];
  }
  return (await db.insert(users).values({ ...vals, email } as typeof users.$inferInsert).returning())[0];
}

export async function seedDemoData(): Promise<void> {
  const pw = hashPassword(DEMO_PASSWORD);
  const cluster = await db
    .insert(clusters)
    .values({ name: "Odisha MSME Cluster — Bhubaneswar", location: "Bhubaneswar, Khordha, Odisha" })
    .returning();
  const clusterId = cluster[0].id;
  await upsertDemoUser("cluster@pragati.demo", {
    name: "Ramesh Panda",
    passwordHash: pw,
    role: "cluster",
    clusterId,
    isDemo: true,
    phone: "9876500000",
  });

  for (const spec of BIZ_SPECS) {
    const tpl = industryTemplate(spec.industry);
    const existingBiz = await db.select().from(businesses).where(eq(businesses.slug, spec.slug)).limit(1);
    let bizId: string;
    if (existingBiz[0]) {
      bizId = existingBiz[0].id;
    } else {
      const biz = await db
        .insert(businesses)
        .values({
          name: spec.name,
          slug: spec.slug,
          industry: spec.industry,
          customIndustry: spec.customIndustry ?? null,
          location: spec.location,
          businessType: spec.businessType,
          products: spec.products,
          workersCount: spec.workersCount,
          recordMethod: spec.recordMethod,
          existingSoftware: spec.existingSoftware,
          mainProblems: spec.mainProblems,
          preferredLanguage: "en",
          stages: tpl.stages,
          adoptionPlan: buildAdoptionPlan({
            businessType: spec.businessType,
            industry: spec.industry,
            customIndustry: spec.customIndustry,
            products: spec.products,
            stages: tpl.stages,
            workersCount: spec.workersCount,
            recordMethod: spec.recordMethod,
            existingSoftware: spec.existingSoftware,
            mainProblems: spec.mainProblems,
            preferredLanguage: "en",
          }),
          clusterId,
          isDemo: true,
          readinessScore: spec.training,
          trainingCompleted: spec.training,
        })
        .returning();
      bizId = biz[0].id;
    }

    const mkUser = async (name: string, role: string, email: string) =>
      upsertDemoUser(email, {
        businessId: bizId,
        name,
        passwordHash: pw,
        role,
        isDemo: true,
        phone: "98765" + Math.floor(Math.random() * 100000),
      });
    const owner = await mkUser(spec.people.owner, "owner", `owner@${spec.slug}.demo`);
    const manager = await mkUser(spec.people.manager, "manager", `manager@${spec.slug}.demo`);
    const supervisor = await mkUser(spec.people.supervisor, "supervisor", `supervisor@${spec.slug}.demo`);
    const w1 = await mkUser(spec.people.w1, "worker", `worker1@${spec.slug}.demo`);
    const w2 = await mkUser(spec.people.w2, "worker", `worker2@${spec.slug}.demo`);
    const store = await mkUser(spec.people.store, "storekeeper", `store@${spec.slug}.demo`);
    const qc = await mkUser(spec.people.qc, "quality", `quality@${spec.slug}.demo`);

    await db.insert(defectCategories).values(tpl.defects.map((n) => ({ businessId: bizId, name: n, industry: spec.industry })));

    // ---- Jobs: 11 per business, oldest 56 days ago, newest yesterday ----
    const jobRows: JobRow[] = [];
    for (let i = 0; i < 11; i++) {
      const age = 56 - i * 5;
      const created = d(age, 9);
      const qty = 20 + ((i * 7) % 40);
      const completed = i < 7;
      const delayed = !completed && i >= 8;
      const stages = completed
        ? makeStages(tpl.stages, created, tpl.stages.length, null)
        : makeStages(tpl.stages, created, Math.min(2 + (i % 3), tpl.stages.length - 1), Math.min(2 + (i % 3), tpl.stages.length - 1), i === 9 ? 3 : null);
      const code = `${spec.prefix}-${101 + i}`;
      const job = await db
        .insert(jobs)
        .values({
          businessId: bizId,
          code,
          title: `${tpl.products[i % tpl.products.length]} — order ${code}`,
          product: tpl.products[i % tpl.products.length],
          quantity: qty,
          completedQty: completed ? qty : Math.floor(qty * (0.3 + (i % 4) * 0.15)),
          industry: spec.industry,
          stages,
          status: completed ? "completed" : delayed ? "delayed" : "active",
          supervisorId: supervisor.id,
          workerIds: [w1.id, w2.id],
          plannedStart: created,
          createdAt: created,
          expectedCompletion: d(age - (5 + (i % 4)), 18),
          actualCompletion: completed ? d(age - 4, 17) : null,
          qrToken: `qr_${code.toLowerCase()}`,
        })
        .returning();
      jobRows.push(job[0]);
    }

    // ---- Events ----
    type EvSpec = [jobIdx: number, category: string, stage: string, desc: string, dayOffset: number, duration: number | null, qty: number | null, verified: boolean];
    const specs: Record<string, EvSpec[]> = {
      fabrication: [
        [2, "machine_breakdown", "Cutting", "Cutting machine stopped — motor overload", 45, 45, null, true],
        [4, "machine_breakdown", "Cutting", "Cutting machine blade jam", 35, 60, null, true],
        [6, "machine_breakdown", "Cutting", "Hydraulic pressure low on cutting machine", 25, 30, null, true],
        [8, "machine_breakdown", "Welding / Fabrication", "Welding machine overheating", 15, 45, null, false],
        [9, "machine_breakdown", "Cutting", "Cutting machine stopped again — same motor", 8, 30, null, true],
        [3, "material_shortage", "Material Preparation", "Steel plate shortage — stock finished", 40, null, 12, true],
        [7, "material_shortage", "Material Preparation", "Angle iron not available in store", 25, null, 30, true],
        [10, "material_shortage", "Material Preparation", "MS sheet shortage before cutting", 2, null, 15, false],
        [5, "power_interruption", "Welding / Fabrication", "Power outage stopped welding line", 30, 40, null, true],
        [9, "power_interruption", "Welding / Fabrication", "Voltage fluctuation during welding", 6, 25, null, true],
        [6, "quality_issue", "Quality Inspection", "Weld defect found on 2 pieces", 24, null, 2, true],
        [8, "quality_issue", "Quality Inspection", "Dimension mismatch on fabricated frame", 14, null, 1, true],
        [4, "production_delay", "Finishing", "Grinding delayed — job held at finishing", 33, 120, null, true],
        [10, "production_delay", "Dispatch", "Dispatch delayed — customer vehicle late", 1, 90, null, false],
        [7, "labour_coordination", "Welding / Fabrication", "Welder shifted to another job mid-stage", 22, 60, null, true],
        [8, "equipment_unavailable", "Finishing", "Grinder under repair, finishing queue blocked", 13, 75, null, true],
      ],
      electrical: [
        [3, "quality_issue", "Electrical Testing", "Insulation test failed on 2 panels", 42, null, 2, true],
        [5, "quality_issue", "Electrical Testing", "Motor winding test failure", 32, null, 1, true],
        [7, "quality_issue", "Electrical Testing", "Panel wiring fault found in testing", 22, null, 3, true],
        [9, "quality_issue", "Electrical Testing", "Pump set failed load test", 10, null, 1, false],
        [2, "material_shortage", "Component Procurement", "Copper wire shortage", 47, null, null, true],
        [6, "material_shortage", "Component Procurement", "MCB / contactor stock out", 27, null, 8, true],
        [10, "material_shortage", "Component Procurement", "Lamination sheets not in stock", 3, null, 20, false],
        [4, "machine_breakdown", "Assembly", "Coil winding machine down", 37, 50, null, true],
        [8, "machine_breakdown", "Assembly", "Winding machine down again", 12, 35, null, true],
        [7, "equipment_unavailable", "Electrical Testing", "Test bench under calibration", 20, 180, null, true],
        [9, "production_delay", "Packaging", "Packaging material delay held dispatch", 8, 60, null, true],
        [5, "power_interruption", "Assembly", "Power cut during assembly shift", 30, 45, null, true],
      ],
      handloom: [
        [1, "material_shortage", "Yarn Procurement", "Cotton yarn stock finished", 50, null, 40, true],
        [4, "material_shortage", "Yarn Procurement", "Zari yarn shortage for saree order", 35, null, 12, true],
        [8, "material_shortage", "Yarn Procurement", "Dyed yarn not delivered on time", 15, null, 25, true],
        [10, "material_shortage", "Yarn Procurement", "Yarn shortage before new batch", 2, null, 18, false],
        [3, "machine_breakdown", "Weaving", "Loom no. 3 down — shaft broken", 43, 90, null, true],
        [6, "machine_breakdown", "Weaving", "Loom no. 5 down — recurring", 28, 60, null, true],
        [9, "machine_breakdown", "Weaving", "Loom no. 3 down again", 9, 75, null, false],
        [5, "quality_issue", "Quality Checking", "Weaving defect in 3 sarees", 30, null, 3, true],
        [7, "quality_issue", "Quality Checking", "Colour bleeding on finished cloth", 20, null, 5, true],
        [6, "labour_coordination", "Weaving", "Artisans not allocated across looms evenly", 26, 120, null, true],
        [10, "production_delay", "Dispatch", "Order dispatch delayed — finishing pending", 1, 240, null, false],
      ],
      other: [
        [2, "machine_breakdown", "Production", "Lathe machine chuck jam", 46, 55, null, true],
        [5, "machine_breakdown", "Production", "Lathe down again — same chuck issue", 31, 40, null, true],
        [8, "machine_breakdown", "Production", "CNC coolant pump failure", 13, 65, null, false],
        [4, "material_shortage", "Material", "MS round bar shortage", 36, null, 50, true],
        [9, "material_shortage", "Material", "Raw material late from supplier", 7, null, 20, false],
        [6, "power_interruption", "Production", "Power outage during night shift", 24, 50, null, true],
        [7, "quality_issue", "Quality Check", "Machining tolerance issue on 4 parts", 19, null, 4, true],
        [3, "production_delay", "Dispatch", "Dispatch delayed — vehicle arrangement", 41, 90, null, true],
      ],
    };
    const evSpecs = specs[spec.industry] ?? specs.other;
    for (const [ji, category, stage, desc, dayOffset, dur, qty, verified] of evSpecs) {
      const start = d(dayOffset, 11);
      const end = dur ? new Date(start.getTime() + dur * 60000) : null;
      await db.insert(events).values({
        businessId: bizId,
        jobId: jobRows[Math.min(ji, jobRows.length - 1)].id,
        stage,
        category,
        description: desc,
        startTime: start,
        endTime: end,
        durationMinutes: dur,
        qtyAffected: qty,
        reporterId: [w1.id, w2.id, store.id, supervisor.id][ji % 4],
        createdAt: start,
        verified,
        verifiedBy: verified ? supervisor.id : null,
        verifiedAt: verified ? d(dayOffset, 16) : null,
      });
    }

    // ---- Quality records ----
    const qSpecs: [number, number, number, number, number, string][] = [
      [0, 20, 18, 2, 1, tpl.defects[0]],
      [1, 30, 30, 0, 0, tpl.defects[0]],
      [2, 25, 22, 3, 2, tpl.defects[1] ?? tpl.defects[0]],
      [3, 40, 38, 2, 1, tpl.defects[2] ?? tpl.defects[0]],
      [4, 22, 21, 1, 1, tpl.defects[0]],
      [5, 35, 33, 2, 2, tpl.defects[3] ?? tpl.defects[0]],
      [6, 28, 25, 3, 2, tpl.defects[0]],
      [8, 18, 17, 1, 1, tpl.defects[1] ?? tpl.defects[0]],
    ];
    for (const [ji, ins, acc, rej, rew, defect] of qSpecs) {
      await db.insert(qualityRecords).values({
        businessId: bizId,
        jobId: jobRows[Math.min(ji, jobRows.length - 1)].id,
        stage: tpl.stages[tpl.stages.length - 2] ?? "Quality",
        inspected: ins,
        accepted: acc,
        rejected: rej,
        rework: rew,
        defectCategory: defect,
        notes: `${rej} rejected, ${rew} sent for rework`,
        inspectorId: qc.id,
        createdAt: d(56 - ji * 5, 15),
      });
    }

    // ---- Corrective actions ----
    const actSpecs: [string, string, string, string, string, string, string | null][] = [
      ["5 machine_breakdown events (210 min) across last 11 jobs", "Inspect cutting machine and review maintenance schedule", "Check motor, blade and hydraulic system before next production run. Keep a weekly maintenance log.", supervisor.id, "high", "completed", "20"],
      ["3 material_shortage events in last 11 jobs", "Create pre-production material checklist", "Storekeeper confirms material readiness before job start; report shortage early in Event Centre.", store.id, "medium", "in_progress", null],
      ["2 quality_issue events at inspection stage", "Add in-process quality check before final inspection", "Quality checker inspects first piece of each batch at the stage itself.", qc.id, "medium", "pending", null],
      ["2 production_delay events at finishing/dispatch", "Plan dispatch vehicle 1 day before expected completion", "Supervisor confirms transport and dispatch slot in advance.", manager.id, "low", "pending", null],
    ];
    for (const [ref, title, desc, assignee, priority, status, doneOffset] of actSpecs) {
      await db.insert(actions).values({
        businessId: bizId,
        problemRef: ref,
        insightId: null,
        title,
        description: desc,
        assignedTo: assignee,
        priority,
        deadline: d(-7, 18),
        status,
        completionNotes: status === "completed" ? "Machine inspected; maintenance log started. Monitoring next jobs." : null,
        verification: status === "completed" ? "Under review — compare frequency in next 5 jobs before claiming improvement" : "Pending",
        createdBy: owner.id,
        completedAt: doneOffset ? d(Number(doneOffset), 12) : null,
        createdAt: d(50, 10),
      });
    }

    // ---- Import history ----
    await db.insert(imports).values({
      businessId: bizId,
      fileName: "monthly_register_export.csv",
      target: "jobs",
      rowCount: 11,
      importedCount: 11,
      duplicates: 0,
      missing: 2,
      columns: ["Date", "Order", "Product", "Qty", "Status"],
      mapping: { Date: "plannedStart", Order: "code", Product: "product", Qty: "quantity", Status: "status" },
      status: "completed",
      createdAt: d(55, 11),
    });

    // ---- Notifications for owner ----
    await db.insert(notifications).values([
      { userId: owner.id, message: `${jobRows[10].code} is delayed — check the current stage.`, link: "/app/production", read: false },
      { userId: owner.id, message: "New unverified event reported: material shortage.", link: "/app/events", read: false },
      { userId: owner.id, message: "Smart Insights ready: machine downtime pattern detected.", link: "/app/insights", read: true },
    ]);
  }
}

let seedLock: Promise<void> | null = null;

export async function ensureSeed(): Promise<void> {
  if (seedLock) return seedLock;
  seedLock = (async () => {
    const rows = await db
      .select({ c: sql<number>`count(*)::int` })
      .from(businesses)
      .where(eq(businesses.isDemo, true));
    if ((rows[0]?.c ?? 0) === 0) {
      await seedDemoData();
    }
  })();
  try {
    await seedLock;
  } finally {
    seedLock = null;
  }
}
