import Link from "next/link";
import { PanelsTopLeft } from "lucide-react";
import { resolveActiveSite, getSite } from "@/lib/site/actions";
import { getSiteContent } from "@/lib/site/get-site-content";
import { VisualEditor } from "@/components/builder/visual-editor";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Website editor — Regroup" };

/** Shown inside the editor's dark shell, so it uses the editor tokens. */
function EditorNotice({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex h-full items-center justify-center p-8 text-center">
      <div className="max-w-sm">
        <span className="mx-auto flex size-11 items-center justify-center rounded-2xl bg-white/10 text-editor-foreground">
          <PanelsTopLeft className="size-5" />
        </span>
        <h1 className="mt-4 text-xl font-semibold text-editor-foreground">{title}</h1>
        <p className="mt-2 text-sm text-editor-muted">{description}</p>
        {action ? <div className="mt-6">{action}</div> : null}
      </div>
    </div>
  );
}

export default async function DashboardBuilderPage() {
  const active = await resolveActiveSite();

  if (!active) {
    return (
      <EditorNotice
        title="Build your website first"
        description="The visual editor opens once your site exists."
        action={
          <Link href="/builder">
            <Button>Build my website</Button>
          </Link>
        }
      />
    );
  }

  const [site, content] = await Promise.all([
    getSite(active.id),
    getSiteContent(active.id),
  ]);

  if (!site) {
    return (
      <EditorNotice
        title="We could not open that site"
        description="Reload the page. If it keeps happening, go back to the dashboard and try again."
        action={
          <Link href="/dashboard">
            <Button variant="outline">Back to dashboard</Button>
          </Link>
        }
      />
    );
  }

  return <VisualEditor site={site} content={content} />;
}
