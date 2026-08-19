import { defineConfig } from "@trigger.dev/sdk";
import { prismaExtension } from "@trigger.dev/build/extensions/prisma";

/**
 * Trigger.dev project configuration.
 *
 * `TRIGGER_PROJECT_REF` rather than a literal: the project reference is
 * created when someone runs `npx trigger.dev@latest init` against their own
 * account, and hard-coding one developer's would break everyone else's deploy.
 *
 * The Prisma extension is required because the task imports the generated
 * client — without it the deployed bundle ships the schema but not the engine,
 * and every run fails at the first query rather than at build time.
 */
export default defineConfig({
  project: process.env.TRIGGER_PROJECT_REF ?? "",
  dirs: ["./trigger"],
  maxDuration: 600,
  build: {
    extensions: [prismaExtension({ mode: "legacy", schema: "prisma/schema.prisma" })],
  },
  retries: {
    // The crew task opts out of retries itself (each attempt costs six LLM
    // calls). This only covers anything else added to ./trigger later.
    enabledInDev: false,
    default: {
      maxAttempts: 3,
      minTimeoutInMs: 1_000,
      maxTimeoutInMs: 10_000,
      factor: 2,
      randomize: true,
    },
  },
});
