'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { subscriptions, users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { configureLemonSqueezy } from '@/lib/lemon-squeezy/utils';
import {
    cancelSubscription,
    updateSubscription,
    getSubscription,
} from '@lemonsqueezy/lemonsqueezy.js';
import { auth } from '@clerk/nextjs/server';

/**
 * Cancels a user's subscription.
 * The subscription will remain active until the end of the current billing period.
 */
export async function cancelSub(subscriptionId: string) {
    configureLemonSqueezy();

    const { userId } = await auth();
    if (!userId) {
        throw new Error('User must be authenticated');
    }

    // Verify the subscription belongs to this user
    const subscription = await db.query.subscriptions.findFirst({
        where: eq(subscriptions.lemonSqueezyId, subscriptionId),
    });

    if (!subscription || subscription.userId !== userId) {
        throw new Error('Subscription not found or unauthorized');
    }

    const cancelledSub = await cancelSubscription(subscriptionId);

    if (cancelledSub.error) {
        throw new Error(cancelledSub.error.message);
    }

    const status = cancelledSub.data?.data.attributes.status;
    const endsAt = cancelledSub.data?.data.attributes.ends_at;

    try {
        // Update the subscriptions table
        await db
            .update(subscriptions)
            .set({
                status: status as typeof subscriptions.$inferSelect.status,
                endsAt: endsAt ? new Date(endsAt) : null,
                updatedAt: new Date(),
            })
            .where(eq(subscriptions.lemonSqueezyId, subscriptionId));

        // Update the users table for backward compatibility
        await db
            .update(users)
            .set({
                subscriptionStatus: status,
                // Don't immediately downgrade - let the webhook handle final downgrade
                // when subscription actually expires
            })
            .where(eq(users.id, userId));

        revalidatePath('/');
        return cancelledSub;
    } catch (error) {
        throw new Error(`Failed to cancel Subscription #${subscriptionId} in the database.`);
    }
}

/**
 * Pauses a user's subscription.
 * Paused subscriptions won't be billed until resumed.
 */
export async function pauseUserSubscription(subscriptionId: string) {
    configureLemonSqueezy();

    const { userId } = await auth();
    if (!userId) {
        throw new Error('User must be authenticated');
    }

    // Verify the subscription belongs to this user
    const subscription = await db.query.subscriptions.findFirst({
        where: eq(subscriptions.lemonSqueezyId, subscriptionId),
    });

    if (!subscription || subscription.userId !== userId) {
        throw new Error('Subscription not found or unauthorized');
    }

    const returnedSub = await updateSubscription(subscriptionId, {
        pause: {
            mode: 'void',
        },
    });

    if (returnedSub.error) {
        throw new Error(returnedSub.error.message);
    }

    const status = returnedSub.data?.data.attributes.status;
    const isPaused = returnedSub.data?.data.attributes.pause !== null;

    try {
        // Update the subscriptions table
        await db
            .update(subscriptions)
            .set({
                status: status as typeof subscriptions.$inferSelect.status,
                isPaused,
                updatedAt: new Date(),
            })
            .where(eq(subscriptions.lemonSqueezyId, subscriptionId));

        // Update the users table
        await db
            .update(users)
            .set({
                subscriptionStatus: status,
                isPaused,
            })
            .where(eq(users.id, userId));

        revalidatePath('/');
        return returnedSub;
    } catch (error) {
        throw new Error(`Failed to pause Subscription #${subscriptionId} in the database.`);
    }
}

/**
 * Resumes a paused subscription.
 */
export async function unpauseUserSubscription(subscriptionId: string) {
    configureLemonSqueezy();

    const { userId } = await auth();
    if (!userId) {
        throw new Error('User must be authenticated');
    }

    // Verify the subscription belongs to this user
    const subscription = await db.query.subscriptions.findFirst({
        where: eq(subscriptions.lemonSqueezyId, subscriptionId),
    });

    if (!subscription || subscription.userId !== userId) {
        throw new Error('Subscription not found or unauthorized');
    }

    const returnedSub = await updateSubscription(subscriptionId, {
        pause: null,
    });

    if (returnedSub.error) {
        throw new Error(returnedSub.error.message);
    }

    const status = returnedSub.data?.data.attributes.status;
    const isPaused = returnedSub.data?.data.attributes.pause !== null;
    const renewsAt = returnedSub.data?.data.attributes.renews_at;

    try {
        // Update the subscriptions table
        await db
            .update(subscriptions)
            .set({
                status: status as typeof subscriptions.$inferSelect.status,
                isPaused,
                renewsAt: renewsAt ? new Date(renewsAt) : null,
                updatedAt: new Date(),
            })
            .where(eq(subscriptions.lemonSqueezyId, subscriptionId));

        // Update the users table
        await db
            .update(users)
            .set({
                subscriptionStatus: status,
                isPaused,
                currentPeriodEnd: renewsAt ? new Date(renewsAt) : null,
            })
            .where(eq(users.id, userId));

        revalidatePath('/');
        return returnedSub;
    } catch (error) {
        throw new Error(`Failed to unpause Subscription #${subscriptionId} in the database.`);
    }
}

/**
 * Gets the customer portal and payment method update URLs for a subscription.
 */
export async function getSubscriptionURLs(subscriptionId: string) {
    configureLemonSqueezy();

    const { userId } = await auth();
    if (!userId) {
        throw new Error('User must be authenticated');
    }

    // Check authorization: either subscription table entry OR user record has this subscription ID
    const subscription = await db.query.subscriptions.findFirst({
        where: eq(subscriptions.lemonSqueezyId, subscriptionId),
    });

    const user = await db.query.users.findFirst({
        where: eq(users.id, userId),
        columns: { lemonSqueezySubscriptionId: true },
    });

    const ownsViaSubscriptionTable = subscription && subscription.userId === userId;
    const ownsViaUserRecord = user?.lemonSqueezySubscriptionId === subscriptionId;

    if (!ownsViaSubscriptionTable && !ownsViaUserRecord) {
        throw new Error('Subscription not found or unauthorized');
    }

    const lsSubscription = await getSubscription(subscriptionId);

    if (lsSubscription.error) {
        throw new Error(lsSubscription.error.message);
    }

    return lsSubscription.data?.data.attributes.urls;
}

/**
 * Gets the current user's active subscription from the database.
 */
export async function getCurrentUserSubscription() {
    const { userId } = await auth();
    if (!userId) {
        return null;
    }

    const subscription = await db.query.subscriptions.findFirst({
        where: eq(subscriptions.userId, userId),
        with: {
            plan: true,
        },
        orderBy: (subscriptions, { desc }) => [desc(subscriptions.createdAt)],
    });

    return subscription;
}