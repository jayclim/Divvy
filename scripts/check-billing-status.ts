import { db } from '../lib/db';
import { users, subscriptions, webhookEvents, plans } from '../lib/db/schema';
import { desc, eq } from 'drizzle-orm';

async function checkBillingStatus() {
  console.log('\n=== WEBHOOK EVENTS ===');
  const events = await db.query.webhookEvents.findMany({
    orderBy: [desc(webhookEvents.createdAt)],
    limit: 5,
  });

  if (events.length === 0) {
    console.log('No webhook events found - webhook may not have been triggered');
  } else {
    events.forEach((event, i) => {
      console.log(`\n[${i + 1}] Event: ${event.eventName}`);
      console.log(`    Processed: ${event.processed}`);
      console.log(`    Error: ${event.processingError || 'None'}`);
      console.log(`    Created: ${event.createdAt}`);
    });
  }

  console.log('\n=== SUBSCRIPTIONS ===');
  const subs = await db.query.subscriptions.findMany({
    orderBy: [desc(subscriptions.createdAt)],
    limit: 5,
    with: { plan: true },
  });

  if (subs.length === 0) {
    console.log('No subscriptions found');
  } else {
    subs.forEach((sub, i) => {
      console.log(`\n[${i + 1}] Subscription ID: ${sub.lemonSqueezyId}`);
      console.log(`    User ID: ${sub.userId}`);
      console.log(`    Status: ${sub.status}`);
      console.log(`    Plan: ${sub.plan?.name || 'Unknown'}`);
      console.log(`    Renews At: ${sub.renewsAt}`);
    });
  }

  console.log('\n=== USERS WITH PRO TIER ===');
  const usersWithSubs = await db.query.users.findMany({
    where: eq(users.subscriptionTier, 'pro'),
    limit: 5,
  });

  if (usersWithSubs.length === 0) {
    console.log('No users with Pro tier found');
  } else {
    usersWithSubs.forEach((user, i) => {
      console.log(`\n[${i + 1}] User: ${user.email}`);
      console.log(`    ID: ${user.id}`);
      console.log(`    Tier: ${user.subscriptionTier}`);
      console.log(`    Status: ${user.subscriptionStatus}`);
      console.log(`    LS Customer ID: ${user.lemonSqueezyCustomerId}`);
      console.log(`    LS Subscription ID: ${user.lemonSqueezySubscriptionId}`);
    });
  }

  console.log('\n=== PLANS ===');
  const allPlans = await db.query.plans.findMany();
  if (allPlans.length === 0) {
    console.log('No plans synced - run syncPlans()');
  } else {
    allPlans.forEach((plan, i) => {
      console.log(`[${i + 1}] ${plan.name} (Variant: ${plan.variantId}) - $${parseInt(plan.price) / 100}/${plan.interval}`);
    });
  }

  process.exit(0);
}

checkBillingStatus().catch(console.error);