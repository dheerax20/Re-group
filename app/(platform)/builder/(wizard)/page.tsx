import { redirect } from "next/navigation";
import { createDraftSite } from "@/lib/site/actions";
import { wizardHref } from "@/lib/onboarding/steps";
import { OnboardingWelcome } from "@/components/onboarding/onboarding-welcome";
import { syncCurrentUser } from "@/lib/auth/session";

async function startBuilder() {
  "use server";
  const result = await createDraftSite();
  if (!result?.siteId) redirect("/post-auth");
  if (result.existing) {
    redirect(`/dashboard?siteId=${result.siteId}`);
  }
  redirect(wizardHref("church", result.siteId));
}

export default async function BuilderWizardStartPage() {
  const user = await syncCurrentUser();
  if (user.site) {
    redirect(`/dashboard?siteId=${user.site.id}`);
  }
  return <OnboardingWelcome startAction={startBuilder} />;
}
