import {
  pgTable,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  uuid,
} from "drizzle-orm/pg-core";
import type { JobStage } from "@/lib/domain";

export const clusters = pgTable("clusters", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  location: text("location"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const businesses = pgTable("businesses", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  industry: text("industry").notNull(), // fabrication | electrical | handloom | other
  customIndustry: text("custom_industry"),
  location: text("location"),
  businessType: text("business_type"),
  products: text("products"),
  workersCount: integer("workers_count").default(0),
  recordMethod: text("record_method"), // paper | excel | software | mixed
  existingSoftware: text("existing_software"),
  mainProblems: jsonb("main_problems").$type<string[]>().default([]),
  preferredLanguage: text("preferred_language").default("en"),
  stages: jsonb("stages").$type<string[]>().notNull().default([]),
  adoptionPlan: text("adoption_plan"),
  clusterId: uuid("cluster_id").references(() => clusters.id),
  isDemo: boolean("is_demo").default(false).notNull(),
  readinessScore: integer("readiness_score").default(0),
  trainingCompleted: integer("training_completed").default(0), // percent 0-100
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  businessId: uuid("business_id").references(() => businesses.id),
  clusterId: uuid("cluster_id").references(() => clusters.id),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull(), // owner | manager | supervisor | worker | storekeeper | quality | cluster
  phone: text("phone"),
  isDemo: boolean("is_demo").default(false).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const sessions = pgTable("sessions", {
  token: text("token").primaryKey(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const jobs = pgTable("jobs", {
  id: uuid("id").primaryKey().defaultRandom(),
  businessId: uuid("business_id")
    .references(() => businesses.id, { onDelete: "cascade" })
    .notNull(),
  code: text("code").notNull(),
  title: text("title").notNull(),
  product: text("product"),
  quantity: integer("quantity").default(0),
  completedQty: integer("completed_qty").default(0),
  industry: text("industry").notNull(),
  stages: jsonb("stages").$type<JobStage[]>().notNull().default([]),
  status: text("status").notNull().default("active"), // active | delayed | completed | on_hold
  supervisorId: uuid("supervisor_id").references(() => users.id),
  workerIds: jsonb("worker_ids").$type<string[]>().default([]),
  plannedStart: timestamp("planned_start", { withTimezone: true }),
  expectedCompletion: timestamp("expected_completion", { withTimezone: true }),
  actualCompletion: timestamp("actual_completion", { withTimezone: true }),
  qrToken: text("qr_token").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const events = pgTable("events", {
  id: uuid("id").primaryKey().defaultRandom(),
  businessId: uuid("business_id")
    .references(() => businesses.id, { onDelete: "cascade" })
    .notNull(),
  jobId: uuid("job_id").references(() => jobs.id, { onDelete: "cascade" }),
  stage: text("stage"),
  category: text("category").notNull(),
  description: text("description"),
  startTime: timestamp("start_time", { withTimezone: true }),
  endTime: timestamp("end_time", { withTimezone: true }),
  durationMinutes: integer("duration_minutes"),
  qtyAffected: integer("qty_affected"),
  reporterId: uuid("reporter_id").references(() => users.id),
  verified: boolean("verified").default(false).notNull(),
  verifiedBy: uuid("verified_by").references(() => users.id),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const qualityRecords = pgTable("quality_records", {
  id: uuid("id").primaryKey().defaultRandom(),
  businessId: uuid("business_id")
    .references(() => businesses.id, { onDelete: "cascade" })
    .notNull(),
  jobId: uuid("job_id").references(() => jobs.id, { onDelete: "cascade" }),
  stage: text("stage"),
  inspected: integer("inspected").default(0),
  accepted: integer("accepted").default(0),
  rejected: integer("rejected").default(0),
  rework: integer("rework").default(0),
  defectCategory: text("defect_category"),
  notes: text("notes"),
  inspectorId: uuid("inspector_id").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const defectCategories = pgTable("defect_categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  businessId: uuid("business_id")
    .references(() => businesses.id, { onDelete: "cascade" })
    .notNull(),
  name: text("name").notNull(),
  industry: text("industry"),
});

export const actions = pgTable("actions", {
  id: uuid("id").primaryKey().defaultRandom(),
  businessId: uuid("business_id")
    .references(() => businesses.id, { onDelete: "cascade" })
    .notNull(),
  problemRef: text("problem_ref"), // human readable reference, e.g. insight id / event ids
  insightId: text("insight_id"),
  title: text("title").notNull(),
  description: text("description"),
  assignedTo: uuid("assigned_to").references(() => users.id),
  priority: text("priority").default("medium"), // low | medium | high
  deadline: timestamp("deadline", { withTimezone: true }),
  status: text("status").default("pending").notNull(), // pending | in_progress | completed
  completionNotes: text("completion_notes"),
  verification: text("verification"), // verified / pending / not verified
  createdBy: uuid("created_by").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

export const imports = pgTable("imports", {
  id: uuid("id").primaryKey().defaultRandom(),
  businessId: uuid("business_id")
    .references(() => businesses.id, { onDelete: "cascade" })
    .notNull(),
  fileName: text("file_name").notNull(),
  target: text("target").notNull(), // jobs | events | quality
  rowCount: integer("row_count").default(0),
  importedCount: integer("imported_count").default(0),
  duplicates: integer("duplicates").default(0),
  missing: integer("missing").default(0),
  columns: jsonb("columns").$type<string[]>().default([]),
  mapping: jsonb("mapping").$type<Record<string, string>>().default({}),
  status: text("status").default("completed"), // completed | partial | failed
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const passwordResets = pgTable("password_resets", {
  token: text("token").primaryKey(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  used: boolean("used").default(false).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const notifications = pgTable("notifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  message: text("message").notNull(),
  link: text("link"),
  read: boolean("read").default(false).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export type ClusterRow = typeof clusters.$inferSelect;
export type BusinessRow = typeof businesses.$inferSelect;
export type UserRow = typeof users.$inferSelect;
export type JobRow = typeof jobs.$inferSelect;
export type EventRow = typeof events.$inferSelect;
export type QualityRow = typeof qualityRecords.$inferSelect;
export type ActionRow = typeof actions.$inferSelect;
export type ImportRow = typeof imports.$inferSelect;
export type NotificationRow = typeof notifications.$inferSelect;
