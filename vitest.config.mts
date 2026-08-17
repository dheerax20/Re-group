import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // Env vars a few modules read at import time. Set here so a developer's
    // real .env cannot change what the suite asserts.
    env: {
      NEXT_PUBLIC_ROOT_DOMAIN: "regroup.app",
      VERCEL_APEX_IP: "76.76.21.21",
      VERCEL_CNAME_TARGET: "cname.vercel-dns.com",
    },
  },
  resolve: {
    alias: { "@": import.meta.dirname },
  },
});
