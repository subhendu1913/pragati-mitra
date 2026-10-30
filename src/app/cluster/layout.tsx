import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { ensureSeed } from "@/lib/seed";
import { AppShell } from "@/components/shell";

export const dynamic = "force-dynamic";

export default async function ClusterLayout({ children }: { children: ReactNode }) {
  await ensureSeed();
  // Open demo: guests can view the cluster dashboard too. Only real business users are sent to /app.
  const ctx = await getSession();
  if (ctx && ctx.user.role !== "cluster") redirect("/app");
  return <AppShell>{children}</AppShell>;
}
