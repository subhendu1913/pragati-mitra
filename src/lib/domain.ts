// Shared domain constants and types for PRAGATI MITRA.
import { toOdia } from "@/lib/odia";

export type Role =
  | "owner"
  | "manager"
  | "supervisor"
  | "worker"
  | "storekeeper"
  | "quality"
  | "cluster";

export const ROLES: { id: Role; label: string; desc: string }[] = [
  { id: "owner", label: "MSME Owner", desc: "Full business view, insights, actions and settings." },
  { id: "manager", label: "Manager", desc: "Monitor orders, production, materials and reports." },
  { id: "supervisor", label: "Supervisor", desc: "Track production, update jobs and verify events." },
  { id: "worker", label: "Worker / Operator / Artisan", desc: "View assigned work and report problems." },
  { id: "storekeeper", label: "Storekeeper", desc: "Record material availability and shortages." },
  { id: "quality", label: "Quality Checker", desc: "Record inspections, defects and rework." },
  { id: "cluster", label: "Cluster Supervisor", desc: "Support and monitor multiple MSMEs in an authorised cluster." },
];

export type IndustryId = "fabrication" | "electrical" | "handloom" | "other";

export interface IndustryTemplate {
  id: IndustryId;
  name: string;
  description: string;
  stages: string[];
  defects: string[];
  products: string[];
}

export const INDUSTRIES: IndustryTemplate[] = [
  {
    id: "fabrication",
    name: "Fabrication Workshop",
    description: "Metal fabrication, welding, cutting and machining workshops.",
    stages: ["Material Preparation", "Cutting", "Welding / Fabrication", "Finishing", "Quality Inspection", "Dispatch"],
    defects: ["Weld defect", "Dimension mismatch", "Surface finish issue", "Cutting error", "Other"],
    products: ["Gate / grill", "Machine frame", "Shed structure", "Custom metal job"],
  },
  {
    id: "electrical",
    name: "Electrical Machinery & Equipment",
    description: "Small motor, panel, pump and equipment assembly units.",
    stages: ["Component Procurement", "Component Preparation", "Assembly", "Electrical Testing", "Quality Inspection", "Packaging", "Dispatch"],
    defects: ["Wiring fault", "Testing failure", "Insulation issue", "Assembly defect", "Other"],
    products: ["Motor rewinding", "Electrical panel", "Pump assembly", "Control panel"],
  },
  {
    id: "handloom",
    name: "Handloom & Textile",
    description: "Weaving units, textile clusters and handloom production groups.",
    stages: ["Yarn Procurement", "Yarn Preparation", "Loom Preparation", "Weaving", "Finishing", "Quality Checking", "Packaging", "Dispatch"],
    defects: ["Weaving defect", "Colour bleeding", "Yarn breakage", "Selvedge defect", "Other"],
    products: ["Sambalpuri saree", "Cotton cloth", "Towels", "Custom order"],
  },
  {
    id: "other",
    name: "Other Small Manufacturing",
    description: "Configure your own production stages.",
    stages: ["Order", "Material", "Production", "Quality Check", "Dispatch"],
    defects: ["Defect", "Damage", "Other"],
    products: ["Custom product"],
  },
];

export function industryTemplate(id: string): IndustryTemplate {
  return INDUSTRIES.find((i) => i.id === id) ?? INDUSTRIES[3];
}

export const EVENT_CATEGORIES = [
  { id: "machine_breakdown", label: "Machine breakdown" },
  { id: "material_shortage", label: "Material shortage" },
  { id: "power_interruption", label: "Power interruption" },
  { id: "production_delay", label: "Production delay" },
  { id: "quality_issue", label: "Quality issue" },
  { id: "labour_coordination", label: "Labour / coordination problem" },
  { id: "equipment_unavailable", label: "Equipment unavailable" },
  { id: "other", label: "Other" },
] as const;

export type EventCategoryId = (typeof EVENT_CATEGORIES)[number]["id"];

const CATEGORY_OD_RAW: Record<string, string> = {
  machine_breakdown: "Yantra bikala",
  material_shortage: "Kachamala abhava",
  power_interruption: "Bijuli samashya",
  production_delay: "Utpadana bilamba",
  quality_issue: "Pariksha samashya",
  labour_coordination: "Sramika samanvaya",
  equipment_unavailable: "Equipment upalabdha nai",
  other: "Anyanya",
};

export function eventCategoryLabel(id: string, lang: "en" | "od" = "en"): string {
  if (lang === "od") {
    const raw = CATEGORY_OD_RAW[id];
    if (raw) return toOdia(raw);
  }
  return EVENT_CATEGORIES.find((c) => c.id === id)?.label ?? id;
}

export type StageStatus = "pending" | "in_progress" | "paused" | "completed";

export interface JobStage {
  name: string;
  order: number;
  status: StageStatus;
  startedAt?: string | null;
  pausedAt?: string | null;
  completedAt?: string | null;
  note?: string | null;
}

export type JobStatus = "active" | "delayed" | "completed" | "on_hold";

export const RECORD_METHODS = [
  { id: "paper", label: "Paper registers" },
  { id: "excel", label: "Excel / spreadsheets" },
  { id: "software", label: "Some software" },
  { id: "mixed", label: "Mix of paper and digital" },
];

export const PROBLEM_OPTIONS = [
  "Machine breakdowns",
  "Material shortages",
  "Production delays",
  "Quality / rework",
  "Worker coordination",
  "No standard process",
  "Hard to find recurring problems",
  "Limited digital skills",
];

export interface OnboardingInput {
  businessType: string;
  industry: IndustryId;
  customIndustry?: string;
  products: string;
  stages: string[];
  workersCount: number;
  recordMethod: string;
  existingSoftware: string;
  mainProblems: string[];
  preferredLanguage: string;
}

export function buildAdoptionPlan(input: OnboardingInput): string {
  const lines: string[] = [];
  const method =
    RECORD_METHODS.find((r) => r.id === input.recordMethod)?.label ?? input.recordMethod;
  lines.push(
    `Your business currently uses ${method.toLowerCase()} for record keeping.`
  );
  lines.push(
    "Step 1 (this week): Start Production & Job tracking — create your first job and record stage progress digitally."
  );
  if (input.recordMethod === "paper" || input.recordMethod === "excel" || input.recordMethod === "mixed") {
    lines.push(
      "Step 2: Use Record Bridge to import your existing register / spreadsheet so old records become organised business data."
    );
  }
  lines.push(
    "Step 3: Ask workers to report problems from the Event Centre (or by scanning the job QR code) — start with machine breakdowns and material shortages."
  );
  lines.push(
    "Step 4: After at least 10 jobs and 15 verified events are recorded, switch on Smart Insights to see recurring problems automatically."
  );
  lines.push(
    "Step 5: Convert recurring problems into corrective actions in the Action Tracker and measure whether the problem reduces afterwards."
  );
  if (input.mainProblems.length > 0) {
    lines.push(`Because you reported: ${input.mainProblems.join(", ")} — Pragati AI will watch these areas first.`);
  }
  lines.push(
    "You do not need to activate everything at once. Pragati Mitra grows with your business, one process at a time."
  );
  return lines.join("\n");
}

export const DEMO_PASSWORD = "demo1234";

export const NAV_SECTIONS = [
  "dashboard",
  "production",
  "record-bridge",
  "events",
  "insights",
  "ai",
  "quality",
  "actions",
  "reports",
  "learn",
  "team",
  "settings",
] as const;

export type SectionSlug = (typeof NAV_SECTIONS)[number];
