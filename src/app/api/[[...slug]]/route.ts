import { handleApi } from "@/lib/handlers";
import { ensureSeed } from "@/lib/seed";

export const dynamic = "force-dynamic";

async function run(req: Request, ctx: { params: Promise<{ slug?: string[] }> }) {
  await ensureSeed();
  const { slug = [] } = await ctx.params;
  return handleApi(slug, req.method, req);
}

export const GET = run;
export const POST = run;
export const PATCH = run;
export const PUT = run;
export const DELETE = run;
