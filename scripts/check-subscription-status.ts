/**
 * Quick script to check subscription status in the database
 * Usage: npm run check:subscription
 */

import { db } from '../lib/db';
import { users, subscriptions, webhookEvents, plans } from '../lib/db/schema';
import { desc } from 'drizzle-orm';

async function main() {
    console.log('\n=== CHECKING SUBSCRIPTION STATUS ===\n');

    // 1. Check webhook events
    console.log('📩 Recent Webhook Events:');
    console.log('-'.repeat(50));
    const events = await db
        .select({
            id: webhookEvents.id,
            eventName: webhookEvents.eventName,
            processed: webhookEvents.processed,
            processingError: webhookEvents.processingError,
            createdAt: webhookEvents.createdAt,
        })
        .from(webhookEvents)
        .orderBy(desc(webhookEvents.createdAt))
        .limit(5);

    if (events.length === 0) {
        console.log('❌ No webhook events found! The webhook may not have been received.');
    } else {
        events.forEach((e) => {
            const status = e.processed ? (e.processingError ? '❌ Error' : '✅ Processed') : '⏳ Pending';
            console.log(`  ${status} | ${e.eventName} | ${e.createdAt}`);
            if (e.processingError) {
                console.log(`    Error: ${e.processingError}`);
            }
        });
    }

    // 2. Check plans
    console.log('\n📋 Plans in Database:');
    console.log('-'.repeat(50));
    const allPlans = await db.select().from(plans);
    if (allPlans.length === 0) {
        console.log('❌ No plans found! You need to sync plans from Lemon Squeezy.');
    } else {
        allPlans.forEach((p) => {
            console.log(`  Plan: ${p.name} | Variant ID: ${p.variantId} | Price: ${p.price}`);
        });
    }

    // 3. Check users and their subscription status
    console.log('\n👤 Users Subscription Status:');
    console.log('-'.repeat(50));
    const allUsers = await db
        .select({
            id: users.id,
            email: users.email,
            subscriptionTier: users.subscriptionTier,
            subscriptionStatus: users.subscriptionStatus,
            lemonSqueezyCustomerId: users.lemonSqueezyCustomerId,
            lemonSqueezySubscriptionId: users.lemonSqueezySubscriptionId,
            currentPeriodEnd: users.currentPeriodEnd,
        })
        .from(users)
        .limit(10);

    allUsers.forEach((u) => {
        const tier = u.subscriptionTier === 'pro' ? '🌟 PRO' : '🆓 Free';
        console.log(`  ${tier} | ${u.email}`);
        console.log(`    Status: ${u.subscriptionStatus}`);
        console.log(`    LS Customer ID: ${u.lemonSqueezyCustomerId || 'None'}`);
        console.log(`    LS Subscription ID: ${u.lemonSqueezySubscriptionId || 'None'}`);
        if (u.currentPeriodEnd) {
            console.log(`    Period End: ${u.currentPeriodEnd}`);
        }
    });

    // 4. Check subscriptions table
    console.log('\n💳 Subscriptions Table:');
    console.log('-'.repeat(50));
    const subs = await db.select().from(subscriptions).limit(5);
    if (subs.length === 0) {
        console.log('❌ No subscriptions found in the subscriptions table.');
    } else {
        subs.forEach((s) => {
            console.log(`  Subscription: ${s.lemonSqueezyId}`);
            console.log(`    User ID: ${s.userId} | Status: ${s.status}`);
            console.log(`    Email: ${s.email}`);
        });
    }

    console.log('\n=== END OF CHECK ===\n');
    process.exit(0);
}

main().catch((err) => {
    console.error('Error:', err);
    process.exit(1);
});
