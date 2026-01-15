/**
 * Fix subscription for alice@test.com by updating directly
 */
import { db } from '../lib/db';
import { users, subscriptions, webhookEvents } from '../lib/db/schema';
import { eq, desc } from 'drizzle-orm';

async function main() {
    console.log('\n=== FIXING ALICE SUBSCRIPTION ===\n');

    // 1. Find alice
    const alice = await db.query.users.findFirst({
        where: eq(users.email, 'alice@test.com'),
    });

    if (!alice) {
        console.log('❌ Alice not found!');
        process.exit(1);
    }

    console.log(`Found Alice: ${alice.id}`);
    console.log(`Current tier: ${alice.subscriptionTier}`);

    // 2. Get the latest subscription webhook
    const latestWebhook = await db.query.webhookEvents.findFirst({
        where: eq(webhookEvents.eventName, 'subscription_created'),
        orderBy: desc(webhookEvents.createdAt),
    });

    if (!latestWebhook) {
        console.log('❌ No subscription_created webhook found!');
        process.exit(1);
    }

    const payload = latestWebhook.body as {
        meta: { custom_data: { user_id: string } };
        data: {
            id: string;
            attributes: {
                customer_id: number;
                status: string;
                renews_at: string | null;
            };
        };
    };

    const webhookUserId = payload.meta.custom_data.user_id;
    const lsSubscriptionId = payload.data.id;
    const lsCustomerId = payload.data.attributes.customer_id;
    const status = payload.data.attributes.status;
    const renewsAt = payload.data.attributes.renews_at;

    console.log(`\nWebhook data:`);
    console.log(`  Webhook User ID: ${webhookUserId}`);
    console.log(`  LS Subscription ID: ${lsSubscriptionId}`);
    console.log(`  LS Customer ID: ${lsCustomerId}`);
    console.log(`  Status: ${status}`);

    // 3. Check if user IDs match
    if (alice.id !== webhookUserId) {
        console.log(`\n⚠️  User ID mismatch! Alice's current ID (${alice.id}) != Webhook User ID (${webhookUserId})`);
        console.log('   This is the root cause - the webhook was for a different user ID.');
    }

    // 4. Update alice to Pro
    console.log('\n🔧 Updating Alice to Pro...');
    await db
        .update(users)
        .set({
            subscriptionTier: 'pro',
            subscriptionStatus: status,
            lemonSqueezyCustomerId: lsCustomerId.toString(),
            lemonSqueezySubscriptionId: lsSubscriptionId,
            currentPeriodEnd: renewsAt ? new Date(renewsAt) : null,
            isPaused: false,
        })
        .where(eq(users.id, alice.id));

    console.log('✅ Alice updated to Pro!');

    // 5. Verify
    const updatedAlice = await db.query.users.findFirst({
        where: eq(users.email, 'alice@test.com'),
    });

    console.log(`\nVerification:`);
    console.log(`  Tier: ${updatedAlice?.subscriptionTier}`);
    console.log(`  Status: ${updatedAlice?.subscriptionStatus}`);
    console.log(`  LS Subscription ID: ${updatedAlice?.lemonSqueezySubscriptionId}`);

    process.exit(0);
}

main().catch(console.error);
