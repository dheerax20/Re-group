/**
 * Wipes site content so a site can be rebuilt from scratch, WITHOUT touching
 * identity or billing.
 *
 * User, BillingCustomer, Subscription, SubscriptionItem, and Entitlement are
 * deliberately left alone: deleting a Subscription row here would not cancel
 * anything at Stripe, it would only make the app believe the account is
 * unpaid — and the paywall then blocks the very builder you were trying to
 * test. Re-onboarding through Auth0 and re-checking-out is a slow way back to
 * where you already are.
 *
 * Most of these tables cascade from Site anyway; they are listed explicitly so
 * the counts printed at the end are real rather than inferred.
 */
import { PrismaClient } from "@prisma/client";

const p = new PrismaClient();

const deleted = {
  chatMessages: (await p.chatMessage.deleteMany()).count,
  generationJobs: (await p.siteGenerationJob.deleteMany()).count,
  events: (await p.event.deleteMany()).count,
  sermons: (await p.sermon.deleteMany()).count,
  media: (await p.media.deleteMany()).count,
  socialLinks: (await p.socialLink.deleteMany()).count,
  siteDomains: (await p.siteDomain.deleteMany()).count,
  slackConnections: (await p.slackConnection.deleteMany()).count,
  sites: (await p.site.deleteMany()).count,
};

console.log("deleted:", deleted);
console.log("kept:", {
  users: await p.user.count(),
  subscriptions: await p.subscription.count(),
  entitlements: await p.entitlement.count(),
});

await p.$disconnect();
