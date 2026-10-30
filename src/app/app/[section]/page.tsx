import { notFound } from "next/navigation";
import { NAV_SECTIONS, type SectionSlug } from "@/lib/domain";
import SectionRouter from "@/components/section-router";

export const dynamic = "force-dynamic";

export default async function SectionPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  if (!(NAV_SECTIONS as readonly string[]).includes(section)) notFound();
  return <SectionRouter section={section as SectionSlug} />;
}
