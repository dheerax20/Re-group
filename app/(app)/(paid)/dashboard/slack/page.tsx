import Link from "next/link";
import { MessageSquare } from "lucide-react";
import { resolveActiveSite } from "@/lib/site/actions";
import { getSlackConnectionState } from "@/lib/slack/actions";
import { SlackConnectPanel } from "@/components/slack/slack-connect-panel";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Slack — Regroup" };

export default async function SlackPage({
  searchParams,
}: {
  searchParams: Promise<{ slack?: string }>;
}) {
  const { slack: notice } = await searchParams;
  const active = await resolveActiveSite();

  if (!active) {
    return (
      <div className="mx-auto max-w-3xl">
        <PageHeader
          title="Slack"
          description="Connect your church's Slack workspace to this site."
        />
        <EmptyState
          icon={MessageSquare}
          title="Build your website first"
          description="Once your site exists you can connect a Slack workspace to it."
          action={
            <Link href="/builder">
              <Button>Build my website</Button>
            </Link>
          }
        />
      </div>
    );
  }

  const state = await getSlackConnectionState(active.id);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Slack" description="Connect your church's Slack workspace to this site." />
      <SlackConnectPanel siteId={active.id} state={state} notice={notice} />
    </div>
  );
}
