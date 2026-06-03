import type { Metadata } from "next";

import {
  AgentOfficeDashboard,
  LockedAgentOffice,
} from "@/components/agent-office/AgentOfficeDashboard";
import { getAgentOfficeDashboardData } from "@/lib/agent-office";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "ICHI Agent Office | AIアバター進捗確認室",
  description:
    "ICHI SocialのHermes、Codex、Gmail営業、Instagram運用の進捗を表示専用で確認する内部向けページです。",
  robots: {
    index: false,
    follow: false,
  },
};

type AgentOfficePageProps = {
  searchParams: Promise<{
    key?: string | string[];
  }>;
};

export default async function AgentOfficePage({
  searchParams,
}: AgentOfficePageProps) {
  const params = await searchParams;
  const requestedKey = Array.isArray(params.key) ? params.key[0] : params.key;
  const accessKey = process.env.AGENT_OFFICE_ACCESS_KEY;
  const canView = accessKey
    ? requestedKey === accessKey
    : process.env.NODE_ENV !== "production";

  if (!canView) {
    return <LockedAgentOffice />;
  }

  return <AgentOfficeDashboard data={getAgentOfficeDashboardData()} />;
}
