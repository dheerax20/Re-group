import { redirect } from "next/navigation";
import { syncCurrentUser } from "@/lib/auth/session";

export default async function PostAuthPage() {
  const user = await syncCurrentUser();
  if (user.site) {
    redirect(`/dashboard?siteId=${user.site.id}`);
  }
  redirect("/builder");
}
