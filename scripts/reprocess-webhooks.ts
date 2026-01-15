/**
 * Reprocess failed webhook events from the webhook_events table.
 * Usage: npm run reprocess:webhooks
 */

import { db } from '../lib/db';
import { plans, subscriptions, users, webhookEvents } from '../lib/db/schema';
import { eq, isNotNull, and } from 'drizzle-orm';

type WebhookEventName =
    | 'subscription_created'
    | 'subscription_updated'
    | 'subscription_cancelled'
    | 'subscription_expired'
    | 'subscription_resumed'
    | 'subscription_paused';

interface WebhookPayload {
    meta: {
        event_name: WebhookEventName;
        custom_data?: {
            user_id?: string;
        };
    };
    data: {
        id: string;
        attributes: {
            store_id: number;
            customer_id: number;
            order_id: number;
            product_id: number;
            variant_id: number;
            product_name: string;
            variant_name: string;
            user_name: string;
            user_email: string;
            status: 'on_trial' | 'active' | 'paused' | 'past_due' | 'unpaid' | 'cancelled' | 'expired';
            status_formatted: string;
            pause: null | { mode: string; resumes_at: string };
            trial_ends_at: string | null;
            first_subscription_item: {
                id: number;
                subscription_id: number;
                price_id: number;
                is_usage_based: boolean;
            };
            renews_at: string | null;
            ends_at: string | null;
        };
    };
}

async function processSubscriptionEvent(payload: WebhookPayload): Promise<void> {
    const { meta, data } = payload;
    const eventName = meta.event_name;
    const userId = meta.custom_data?.user_id;
    const attributes = data.attributes;

    if (!userId) {
        throw new Error('No user_id found in webhook custom_data');
    }

    // Verify user exists
    const user = await db.query.users.findFirst({
        where: eq(users.id, userId),
    });

    if (!user) {
        throw new Error(`User not found: ${userId}`);
    }

    // Find the plan for this variant, or auto-create if missing
    let plan = await db.query.plans.findFirst({
        where: eq(plans.variantId, attributes.variant_id),
    });

    if (!plan) {
        console.log(`  Auto-creating plan for variant: ${attributes.variant_id}`);
        const [newPlan] = await db
            .insert(plans)
            .values({
                variantId: attributes.variant_id,
                productId: attributes.product_id,
                productName: attributes.product_name,
                name: attributes.variant_name || attributes.product_name,
                price: '0',
                description: null,
            })
            .onConflictDoNothing()
            .returning();

        // If conflict, fetch the existing one
        plan = newPlan || await db.query.plans.findFirst({
            where: eq(plans.variantId, attributes.variant_id),
        });
    }

    if (!plan) {
        throw new Error(`Failed to get or create plan for variant: ${attributes.variant_id}`);
    }

    const lemonSqueezyId = data.id;
    const subscriptionData = {
        lemonSqueezyId,
        orderId: attributes.order_id,
        name: attributes.user_name,
        email: attributes.user_email,
        status: attributes.status,
        statusFormatted: attributes.status_formatted,
        renewsAt: attributes.renews_at ? new Date(attributes.renews_at) : null,
        endsAt: attributes.ends_at ? new Date(attributes.ends_at) : null,
        trialEndsAt: attributes.trial_ends_at ? new Date(attributes.trial_ends_at) : null,
        price: attributes.first_subscription_item?.price_id?.toString() ?? '0',
        isUsageBased: attributes.first_subscription_item?.is_usage_based ?? false,
        isPaused: attributes.pause !== null,
        subscriptionItemId: attributes.first_subscription_item?.id,
        userId,
        planId: plan.id,
        updatedAt: new Date(),
    };

    switch (eventName) {
        case 'subscription_created': {
            await db
                .insert(subscriptions)
                .values(subscriptionData)
                .onConflictDoUpdate({
                    target: subscriptions.lemonSqueezyId,
                    set: subscriptionData,
                });

            await db
                .update(users)
                .set({
                    subscriptionTier: 'pro',
                    subscriptionStatus: attributes.status,
                    lemonSqueezyCustomerId: attributes.customer_id.toString(),
                    lemonSqueezySubscriptionId: lemonSqueezyId,
                    currentPeriodEnd: subscriptionData.renewsAt,
                    isPaused: false,
                })
                .where(eq(users.id, userId));
            break;
        }

        case 'subscription_updated':
        case 'subscription_resumed': {
            await db
                .insert(subscriptions)
                .values(subscriptionData)
                .onConflictDoUpdate({
                    target: subscriptions.lemonSqueezyId,
                    set: subscriptionData,
                });

            const isPro = attributes.status === 'active' || attributes.status === 'on_trial';
            await db
                .update(users)
                .set({
                    subscriptionTier: isPro ? 'pro' : 'free',
                    subscriptionStatus: attributes.status,
                    currentPeriodEnd: subscriptionData.renewsAt,
                    isPaused: attributes.pause !== null,
                })
                .where(eq(users.id, userId));
            break;
        }

        case 'subscription_paused': {
            await db
                .update(subscriptions)
                .set({
                    status: 'paused',
                    isPaused: true,
                    updatedAt: new Date(),
                })
                .where(eq(subscriptions.lemonSqueezyId, lemonSqueezyId));

            await db
                .update(users)
                .set({
                    subscriptionStatus: 'paused',
                    isPaused: true,
                })
                .where(eq(users.id, userId));
            break;
        }

        case 'subscription_cancelled':
        case 'subscription_expired': {
            await db
                .update(subscriptions)
                .set({
                    status: attributes.status,
                    endsAt: attributes.ends_at ? new Date(attributes.ends_at) : new Date(),
                    updatedAt: new Date(),
                })
                .where(eq(subscriptions.lemonSqueezyId, lemonSqueezyId));

            await db
                .update(users)
                .set({
                    subscriptionTier: 'free',
                    subscriptionStatus: attributes.status,
                    isPaused: false,
                })
                .where(eq(users.id, userId));
            break;
        }
    }
}

async function main() {
    console.log('\n=== REPROCESSING FAILED WEBHOOK EVENTS ===\n');

    // Find failed events
    const failedEvents = await db
        .select()
        .from(webhookEvents)
        .where(
            and(
                eq(webhookEvents.processed, true),
                isNotNull(webhookEvents.processingError)
            )
        );

    if (failedEvents.length === 0) {
        console.log('✅ No failed webhook events to reprocess.');
        process.exit(0);
    }

    console.log(`Found ${failedEvents.length} failed event(s) to reprocess:\n`);

    for (const event of failedEvents) {
        console.log(`📩 Processing event #${event.id}: ${event.eventName}`);
        console.log(`   Previous error: ${event.processingError}`);

        try {
            const payload = event.body as unknown as WebhookPayload;
            await processSubscriptionEvent(payload);

            // Mark as successfully processed
            await db
                .update(webhookEvents)
                .set({ processingError: null })
                .where(eq(webhookEvents.id, event.id));

            console.log(`   ✅ Successfully reprocessed!\n`);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.log(`   ❌ Failed again: ${errorMessage}\n`);

            // Update with new error
            await db
                .update(webhookEvents)
                .set({ processingError: `Reprocess failed: ${errorMessage}` })
                .where(eq(webhookEvents.id, event.id));
        }
    }

    console.log('=== REPROCESSING COMPLETE ===\n');
    process.exit(0);
}

main().catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
});
