"use client";

import { usePathname } from "next/navigation";
import { useSidebar } from "@/components/ui/sidebar";
import { useEffect } from "react";
import { isImmersiveRoute } from "@/components/layout/nav-config";

/**
 * Hides the Church OS sidebar while an immersive workflow is open — the
 * Framer-style website editor, or event check-in.
 *
 * The two get different grounds: the editor is a dark workspace so the
 * church's bright site reads as the object on the canvas, while check-in keeps
 * the app's own background because it is a screen someone reads at arm's length
 * in a foyer, not a canvas.
 */
export function BuilderSidebarGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { setOpen, setOpenMobile, isMobile } = useSidebar();
  const immersive = isImmersiveRoute(pathname);
  const isBuilder = pathname.startsWith("/dashboard/builder");

  useEffect(() => {
    if (!immersive) return;
    setOpen(false);
    if (isMobile) setOpenMobile(false);
  }, [immersive, isMobile, setOpen, setOpenMobile]);

  if (immersive) {
    return (
      <div
        className={
          isBuilder
            ? "fixed inset-0 z-50 flex min-h-svh flex-col bg-editor-shell"
            : "fixed inset-0 z-50 flex min-h-svh flex-col bg-background"
        }
      >
        {children}
      </div>
    );
  }

  return <>{children}</>;
}
