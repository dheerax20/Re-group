import { FeatureConfig } from "@/lib/features/types";
import { NavigationItem } from "./types";

/**
 * Navigation is always derived from enabled features, never hand-edited
 * into a stale list. A feature toggle immediately adds/removes its link.
 */
export function generateNavigation(features: FeatureConfig): NavigationItem[] {
  const items: NavigationItem[] = [{ label: "Home", href: "/" }];

  items.push({ label: "About", href: "/about" });

  if (features.sermons) {
    items.push({ label: "Sermons", href: "/sermons" });
  }
  if (features.events) {
    items.push({ label: "Events", href: "/events" });
  }
  if (features.ministries) {
    items.push({ label: "Ministries", href: "/ministries" });
  }
  if (features.giving) {
    items.push({ label: "Give", href: "/giving" });
  }
  if (features.contact) {
    items.push({ label: "Contact", href: "/contact" });
  }

  return items;
}
