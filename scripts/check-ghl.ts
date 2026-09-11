/**
 * Diagnoses the GoHighLevel integration end to end.
 *
 *   npm run ghl:check
 *
 * Answers "did provisioning actually work?" without creating anything: it
 * validates configuration, makes one READ-ONLY call to confirm the token and
 * company id are real, and reports the provisioning state of recent users.
 *
 * It never calls `POST /locations/`, `POST /users/`, or `POST /contacts/upsert`.
 * The first two create billable sub-accounts, so proving the write path works
 * means letting a real subscription (or a Courses click) do it, then re-running
 * this. Minting a location token in step 3 creates nothing and is safe here.
 */
import { PrismaClient } from "@prisma/client";

try {
  process.loadEnvFile();
} catch {
  // no .env next to cwd — assume env vars are already set (e.g. CI)
}

const prisma = new PrismaClient();

const GHL_API_BASE = "https://services.leadconnectorhq.com";

function mask(email: string | null): string {
  if (!email) return "(no email)";
  return email.replace(/^(.{2}).*(@.*)$/, "$1***$2");
}

async function main() {
  let problems = 0;
  const fail = (message: string) => {
    problems += 1;
    console.log(`  ✗ ${message}`);
  };
  const pass = (message: string) => console.log(`  ✓ ${message}`);

  console.log("\n1. Configuration");
  const token = process.env.GHL_TOKEN?.trim();
  const companyId = process.env.GHL_COMPANY_ID?.trim();

  if (!token) fail("GHL_TOKEN is not set — provisioning is switched off entirely");
  else pass(`GHL_TOKEN is set (${token.length} chars)`);

  if (!companyId) fail("GHL_COMPANY_ID is not set — provisioning is switched off entirely");
  else pass(`GHL_COMPANY_ID is set (${companyId.length} chars)`);

  if (!token || !companyId) {
    console.log(
      "\nBoth values are required. Until then `isGhlConfigured()` is false, the\n" +
        "webhook skips provisioning silently, and no ghl_accounts row is created.\n" +
        "NOTE: env vars are read at server start — restart `next dev` after editing .env.\n"
    );
    await prisma.$disconnect();
    process.exit(1);
  }

  console.log("\n2. Credentials (read-only probe — creates nothing)");
  try {
    const response = await fetch(`${GHL_API_BASE}/locations/search?limit=5`, {
      headers: { Authorization: `Bearer ${token}`, Version: "2021-07-28", Accept: "application/json" },
    });

    if (!response.ok) {
      fail(`GHL returned ${response.status} — token rejected or lacks read scope`);
    } else {
      const data = (await response.json()) as { locations?: Array<{ companyId?: string }> };
      const owned = [...new Set((data.locations ?? []).map((l) => l.companyId).filter(Boolean))];
      pass(`token authenticates (${data.locations?.length ?? 0} locations visible)`);

      if (owned.length > 0 && !owned.includes(companyId)) {
        fail(
          `GHL_COMPANY_ID does not match this token's agency.\n` +
            `      configured: ${companyId}\n` +
            `      actual:     ${owned.join(", ")}\n` +
            `      companyId is REQUIRED on both create calls, so provisioning will fail.`
        );
      } else if (owned.includes(companyId)) {
        pass("GHL_COMPANY_ID matches the token's agency");
      }
    }
  } catch (error) {
    fail(`could not reach GHL: ${error instanceof Error ? error.message : "unknown"}`);
  }

  console.log("\n3. Contact sync (OAuth chain)");
  const { getOAuthConnectionStatus, getLocationAccessToken, isGhlOAuthConfigured } =
    await import("../lib/ghl/oauth");

  if (!isGhlOAuthConfigured()) {
    fail(
      "GHL_OAUTH_CLIENT_ID / GHL_OAUTH_CLIENT_SECRET are not set.\n" +
        "      The agency PIT above cannot reach /contacts/* or /oauth/locationToken\n" +
        "      (both answer 401 'not authorized for this scope'), so member sync needs\n" +
        "      an OAuth app: Target User Agency, Who can install Agency Only."
    );
  } else {
    const status = await getOAuthConnectionStatus();
    if (!status.connected) {
      fail(
        "the OAuth app is configured but has never been installed.\n" +
          "      Sign in as a GHL_ADMIN_EMAILS user and open /api/ghl/oauth/start."
      );
    } else {
      pass(
        `agency token stored for ${status.companyId} (expires ${status.expiresAt?.toISOString()}), ` +
          `${status.locationTokens} location token(s) cached`
      );

      const anyLocation = await prisma.ghlAccount.findFirst({
        where: { locationId: { not: null } },
        select: { locationId: true },
      });

      if (!anyLocation?.locationId) {
        console.log("  (no provisioned location to mint against yet)");
      } else {
        // Read-only in the sense that matters: minting a token creates no
        // billable object and touches no church's data.
        try {
          await getLocationAccessToken(anyLocation.locationId);
          pass(`minted a location token for ${anyLocation.locationId} — member sync will work`);
        } catch (error) {
          fail(
            `could not mint a location token: ${error instanceof Error ? error.message : "unknown"}`
          );
        }
      }
    }
  }

  console.log("\n4. Provisioning state (5 most recent users)");
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    take: 5,
    include: { ghlAccount: true, entitlements: { select: { featureKey: true } } },
  });

  if (users.length === 0) console.log("  (no users yet)");

  for (const user of users) {
    const paid = user.entitlements.some((e) => e.featureKey === "regroup_base");
    const account = user.ghlAccount;
    const label = `${mask(user.email)} ${paid ? "[paid]" : "[unpaid]"}`;

    if (!account) {
      console.log(`  · ${label} — no ghl_accounts row`);
      if (paid) {
        console.log(
          "      ↳ paid but never provisioned: the webhook ran before GHL was configured,\n" +
            "        or before the server was restarted. Opening Courses will self-heal it."
        );
      }
      continue;
    }

    const detail = `status=${account.status} location=${account.locationId ?? "-"} user=${account.ghlUserId ?? "-"} attempts=${account.attempts}`;
    console.log(`  · ${label} — ${detail}`);
    if (account.error) console.log(`      ↳ last error: ${account.error}`);
  }

  const active = await prisma.ghlAccount.count({ where: { status: "ACTIVE" } });
  const failed = await prisma.ghlAccount.count({ where: { status: "FAILED" } });
  console.log(`\n  totals: ${active} active, ${failed} failed, ${await prisma.ghlAccount.count()} rows`);

  console.log("\n5. Member contact sync");
  const bySync = await prisma.member.groupBy({
    by: ["syncStatus"],
    _count: { _all: true },
  });
  if (bySync.length === 0) {
    console.log("  (no members yet)");
  } else {
    for (const row of bySync) {
      console.log(`  · ${row.syncStatus}: ${row._count._all}`);
    }
    const stuck = await prisma.member.findMany({
      where: { syncStatus: "FAILED" },
      select: { syncError: true },
      take: 3,
    });
    for (const row of stuck) {
      if (row.syncError) console.log(`      ↳ ${row.syncError}`);
    }
  }

  console.log(
    problems === 0
      ? "\nConfiguration looks correct.\n"
      : `\n${problems} problem(s) found — fix these before expecting provisioning to work.\n`
  );

  await prisma.$disconnect();
  process.exit(problems === 0 ? 0 : 1);
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
