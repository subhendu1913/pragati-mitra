# PRAGATI MITRA — Your Smart Companion for MSME Growth

An AI-powered **MSME digital adoption and decision-support platform** for small manufacturers in India (initial focus: Odisha). It is deliberately **not another ERP**: it connects the records a business already keeps (paper registers, Excel), captures operational events, finds recurring problems with explainable insights, and closes the loop with corrective actions — one process at a time.

## Demo — open to everyone, no sign-in required

The landing page has a prominent **“Explore Demo – Continue as Guest”** button that opens the full dashboard instantly as a guest. No account, email or password is needed: without a session the app automatically uses a fictional demo user (business chosen via the demo cards or the “Switch demo view” menu; default: Odisha Metal Works). Sign In / Sign Up remain available as optional features for real accounts. Every page (`/app/*`, `/worker`, `/cluster`) and every API works in guest mode; only the fictional demo data is exposed this way — real registered businesses still require authentication.

Open the app → **Explore Demo** → pick one of four fictional sample businesses:

| Business | Industry | Slug |
|---|---|---|
| Odisha Metal Works | Fabrication | `odisha-metal-works` |
| Utkal Electrical Systems | Electrical machinery | `utkal-electrical` |
| Odisha Handloom Cooperative | Handloom & textile | `odisha-handloom` |
| Pragati Engineering Works | Other manufacturing | `pragati-engineering` |

All modules share the same demo data and stay consistent: creating an event updates the Event Centre, Dashboard, Smart Insights, Reports and Pragati AI answers; completing an action shows up in the improvement history; imports via Record Bridge become jobs/events/inspections; stage updates on a job change its status and the dashboard. Records can be added, edited, verified, completed and deleted (role-checked) in every module. A **Reset Demo** button (profile menu / Settings) restores the original fictional sample data.

A **Cluster Supervisor demo** (aggregated view of all four) is also available. Demo mode is persistently labelled **"DEMO MODE — FICTIONAL SAMPLE DATA"**; **Reset Demo** (top-right profile menu / Settings) restores the sample data. Demo accounts use password `demo1234` (e.g. `owner@odisha-metal-works.demo`).

### Hackathon demo journey

1. Explore Demo → select a fabrication or handloom business → Dashboard.
2. Production & Jobs → open a job → see stages, QR code, events, quality.
3. Worker view (`/worker?job=OMW-105`) → Start/Pause/Complete a stage, or report a machine breakdown / material shortage.
4. Event Centre → see the event, supervisor **Verify** it.
5. Smart Insights → recurring pattern with evidence, period, frequency, reliability, suggested action.
6. Pragati AI → ask "What should I improve first?" → approve the suggested corrective action.
7. Action Tracker → assign to a supervisor → mark completed → see improvement history (before/after event frequency).
8. Sign in as **Cluster Supervisor** demo → aggregated cluster dashboard, challenge radar, businesses needing assistance.

## Features

- Role-based experiences: Owner, Manager, Supervisor, Worker, Storekeeper, Quality Checker, **Cluster Supervisor** (aggregated, authorised data only).
- Industry-adaptive workflow templates (fabrication / electrical / handloom / custom) with editable stages and defect categories.
- **Record Bridge**: Excel/CSV upload, file preview, automatic column detection, field mapping, missing-data detection, duplicate-row warnings, import log.
- Production & job tracking with stage progress, assignments, dates, delayed view, activity history and **QR codes** per job.
- Worker-friendly mobile UI (`/worker`) with large buttons and English/Odia labels.
- **Event Centre**: 8 event categories with job/stage/duration/quantity/reporter/verification.
- **Smart Insights**: explainable patterns (what was observed, supporting records, period, frequency, suggested next step, reliability warning). Recorded facts are separated from possible causes.
- **Pragati AI**: contextual, rule-based prototype copilot ("Ask Your Business", problem explanation, recommendations, reports, learning help, cluster support). Answers always show records used + period; clearly labelled SIMULATED; asks approval before creating actions; ready for a real AI API.
- **Quality & Rework** module with customisable defect categories.
- **Action Tracker**: problem → action → assignee → deadline → completion notes → verification → improvement history (before/after comparison, no unverified causality claims).
- **Digital Readiness Score** (from actual usage/record completeness) + guided next-best-step recommendations + data-completeness indicator.
- Reports (daily/weekly/monthly/jobs/interruptions/quality/actions/cluster) with CSV export.
- Learning Centre with step-by-step guides in English and Odia.
- Secure auth flows: sign up (with onboarding wizard), sign in, sign out, and **forgot/reset password** (single-use, 1-hour tokens; in this prototype, with no mail server, the reset link is shown on the forgot-password page, clearly labelled as a demo alternative). Passwords are scrypt-hashed, sessions are httpOnly cookies, routes are role-guarded, and all business queries are scoped to the signed-in user's business (cluster role only gets aggregates).
- Clickable logo + "Back to Home" links on all auth pages and in the app shell.

## What's new: Odia-first UX, AI data entry, voice input

- **Full English ↔ Odia switching** (top bar and Settings): all 150+ UI strings render in proper Odia Unicode (Noto Sans Oriya font bundled), including menus, buttons, forms, errors, reports and the worker UI. The choice persists while navigating and never loses your place or typed data.
- **Update data by talking to Pragati AI** (English or Odia): e.g. “Today we completed 25 units”, “Two machines stopped for one hour”, “Mark job OMW-105 as completed”, or Odia equivalents. The AI parses the instruction, shows a **proposed-update summary**, and only saves after you confirm (`POST /api/ai/apply`). Unclear instructions get a clarifying question — nothing is updated silently. Applied updates immediately feed Production, Event Centre, Quality, Dashboard, Reports and Insights.
- **Voice input** in the AI chat: microphone button uses the browser Web Speech API (`en-IN` / `od-IN`), with live editable transcription before sending. If the browser/device doesn't support speech recognition, the mic is hidden and a labelled typing fallback is shown.
- **Pragati AI as a guide**: “What should I do next?”, “How do I report a machine problem?” etc. return step-by-step guidance in the selected language plus a direct link to the relevant page.
- **Demo role switching**: in demo mode the profile menu lets you switch between Owner, Manager, Supervisor, Worker, Storekeeper, Quality Checker and Cluster Supervisor — the interface and permissions change accordingly.
- Search now covers jobs, events, actions, quality records and imports with partial matching and a clear “No results” state. Marking a job completed completes all stages, sets the completion date and removes it from delayed lists everywhere.

## Tech stack

- **Next.js 16 (App Router) + React 19 + TypeScript**
- **PostgreSQL + Drizzle ORM** (all persistence is in the database; demo data is seeded rows flagged `is_demo`)
- Tailwind CSS 4, Lucide icons, Recharts charts, `qrcode` (job QR PNGs), `papaparse`/`xlsx` (Record Bridge)

## Project structure

```
src/
  app/
    page.tsx                 landing page
    login/ register/         auth + onboarding wizard
    app/[section]/           12 main modules behind the app shell (sidebar/topbar)
    worker/                  worker mobile UI (QR job view)
    cluster/                 cluster supervisor dashboard
    api/health/              healthcheck (also ensures demo seed)
    api/[[...slug]]/         single API dispatcher -> src/lib/handlers.ts
  components/                shell, ui primitives, landing, sections/*, worker-app, cluster-app
  lib/
    domain.ts                roles, industries, event categories, adoption-plan generator
    auth.ts                  password hashing (scrypt), sessions, cookie helpers
    seed.ts                  fictional demo dataset + ensureSeed/resetDemoData
    analytics.ts             insights, readiness, completeness, dashboard stats, cluster aggregation
    ai.ts                    Pragati AI rule-based assistant
    handlers.ts              all API endpoints (business-scoped, role-checked)
    i18n.tsx                 English/Odia UI dictionary + language context
    api.ts                   browser API client
  db/
    schema.ts                Drizzle schema
    index.ts                 pg pool + drizzle client
    seed-cli.ts              manual seed/reset CLI
```

## Local setup

```bash
cp .env.example .env   # or set DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/app_db
npm install
npx drizzle-kit push          # apply schema
npx tsx src/db/seed-cli.ts    # seed fictional demo data (idempotent; --reset to restore)
npm run dev                   # http://localhost:3000
```

Build & run in production:

```bash
npm run build
npm start
```

Typecheck / typegen:

```bash
npx next typegen
npx tsc --noEmit
```

## Deploy (Vercel / Netlify)

1. Create a Postgres database (e.g. Vercel Postgres / Neon) and set `DATABASE_URL` in the project environment variables.
2. Push the schema: `npx drizzle-kit push` (with the production `DATABASE_URL`).
3. Seed demo data once: `npx tsx src/db/seed-cli.ts` (or just open `/api/health` — it auto-seeds).
4. Deploy: `vercel` (or connect the repo on Netlify with build command `npm run build`, publish dir `.next`, and the Next.js runtime). No other secrets are required; no paid services or API keys are needed.

## Notes & honesty

- No official government partnership, approval or endorsement is claimed.
- All demo businesses/data are fictional; demo mode is labelled and resettable.
- Pragati AI in this prototype is a **labelled, rule-based** assistant over your own records (structure ready for a real LLM API); it never invents figures and flags missing data.
- Future-ready architecture: sessions table + RBAC guards, business-scoped queries, seed/import pipelines, CSV reports — ready to plug in real auth providers, row-level security and a real AI endpoint.
