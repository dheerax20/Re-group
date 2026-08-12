import { redirect } from "next/navigation";
import { createDraftSite } from "@/lib/site/actions";
import { wizardHref } from "@/lib/onboarding/steps";
import { OnboardingWelcome } from "@/components/onboarding/onboarding-welcome";

async function startBuilder() {
  "use server";
  const { siteId } = await createDraftSite();
  redirect(wizardHref("church", siteId));
}

export default function BuilderWizardStartPage() {
  return <OnboardingWelcome startAction={startBuilder} />;
}
