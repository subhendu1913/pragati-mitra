"use client";

import dynamic from "next/dynamic";
import type { SectionSlug } from "@/lib/domain";
import { Spinner } from "@/components/ui";

const sections: Record<SectionSlug, React.ComponentType> = {
  dashboard: dynamic(() => import("@/components/sections/dashboard"), { loading: () => <Spinner /> }),
  production: dynamic(() => import("@/components/sections/production"), { loading: () => <Spinner /> }),
  "record-bridge": dynamic(() => import("@/components/sections/record-bridge"), { loading: () => <Spinner /> }),
  events: dynamic(() => import("@/components/sections/events"), { loading: () => <Spinner /> }),
  insights: dynamic(() => import("@/components/sections/insights"), { loading: () => <Spinner /> }),
  ai: dynamic(() => import("@/components/sections/ai"), { loading: () => <Spinner /> }),
  quality: dynamic(() => import("@/components/sections/quality"), { loading: () => <Spinner /> }),
  actions: dynamic(() => import("@/components/sections/actions"), { loading: () => <Spinner /> }),
  reports: dynamic(() => import("@/components/sections/reports"), { loading: () => <Spinner /> }),
  learn: dynamic(() => import("@/components/sections/learn"), { loading: () => <Spinner /> }),
  team: dynamic(() => import("@/components/sections/team"), { loading: () => <Spinner /> }),
  settings: dynamic(() => import("@/components/sections/settings"), { loading: () => <Spinner /> }),
};

export default function SectionRouter({ section }: { section: SectionSlug }) {
  const C = sections[section];
  return <C />;
}
