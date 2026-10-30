import { db } from "@/db";
import { sql } from "drizzle-orm";
import { ensureSeed } from "@/lib/seed";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await db.execute(sql`select 1`);
    await ensureSeed();
    return Response.json({ ok: true, service: "pragati-mitra" });
  } catch {
    return Response.json({ ok: false }, { status: 500 });
  }
}
