import Link from "next/link";
import { ExternalLink, Globe } from "lucide-react";
import { resolveActiveSite } from "@/lib/site/actions";
import { getDomains } from "@/lib/domains/actions";
import { DomainManager } from "@/components/domains/domain-manager";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Domains — Regroup" };

export default async function DomainsPage() {
  const active = await resolveActiveSite();

  if (!active) {
    return (
      <div className="mx-auto max-w-3xl">
        <PageHeader
          title="Domains"
          description="Point your own web address at your church website."
        />
        <EmptyState
          icon={Globe}
          title="Build your website first"
          description="Once your site exists you can connect a domain you already own, or the Regroup address we give you."
          action={
            <Link href="/builder">
              <Button>Build my website</Button>
            </Link>
          }
        />
      </div>
    );
  }

  const state = await getDomains(active.id);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Domains"
        description="Point your own web address at your church website."
        actions={
          <a
            href={`https://${state.canonicalHost}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button variant="outline">
              Visit site
              <ExternalLink className="size-3.5" />
            </Button>
          </a>
        }
      />
      <DomainManager siteId={active.id} initialState={state} />
    </div>
  );
}
