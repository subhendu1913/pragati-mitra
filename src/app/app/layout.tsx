import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { ensureSeed } from "@/lib/seed";
import { AppShell } from "@/components/shell";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: ReactNode }) {
  await ensureSeed();
  // Open demo: no sign-in required. Only redirect real signed-in users to their role view.
  const ctx = await getSession();
  if (ctx?.user.role === "worker") redirect("/worker");
  if (ctx?.user.role === "cluster") redirect("/cluster");
  return <AppShell>{children}</AppShell>;
}
