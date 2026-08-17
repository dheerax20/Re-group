"use client";

import { usePathname } from "next/navigation";
import { useSidebar } from "@/components/ui/sidebar";
import { useEffect } from "react";

/** Hides the Church OS sidebar while the Framer-style website editor is open. */
export function BuilderSidebarGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { setOpen, setOpenMobile, isMobile } = useSidebar();
  const isBuilder = pathname.startsWith("/dashboard/builder");

  useEffect(() => {
    if (!isBuilder) return;
    setOpen(false);
    if (isMobile) setOpenMobile(false);
  }, [isBuilder, isMobile, setOpen, setOpenMobile]);

  if (isBuilder) {
    return (
      <div className="fixed inset-0 z-50 flex min-h-svh flex-col bg-editor-shell">
        {children}
      </div>
    );
  }

  return <>{children}</>;
}
