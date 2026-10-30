import { ensureSeed } from "@/lib/seed";
import WorkerApp from "@/components/worker-app";

export const dynamic = "force-dynamic";

export default async function WorkerPage() {
  await ensureSeed();
  // Open demo: the worker view is accessible without signing in (guest demo context).
  return <WorkerApp />;
}
