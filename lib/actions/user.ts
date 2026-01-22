'use server';

import { db } from '@/lib/db';
import { users, subscriptions } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { revalidatePath } from 'next/cache';
import { cancelSubscription } from '@lemonsqueezy/lemonsqueezy.js';
import { configureLemonSqueezy } from '@/lib/lemon-squeezy/utils';
import { deleteAllUserReceipts } from '@/lib/supabase/storage';

export async function updateProfile(data: {
    paymentMethods: {
        venmo?: string;
        cashapp?: string;
        paypal?: string;
    };
}) {
    const { userId } = await auth();

    if (!userId) {
        throw new Error('Unauthorized');
    }

    // Find Internal User ID
    // Note: Assuming Clerk ID matches or we mock sync. 
    // In real app we usually query verify user exists first.

    await db.update(users)
        .set({
            paymentMethods: data.paymentMethods,
        })
        .where(eq(users.id, userId));

    revalidatePath('/settings');
    return { success: true };
}

export async function getProfile() {
    const { userId } = await auth();
    if (!userId) return null;

    const user = await db.query.users.findFirst({
        where: eq(users.id, userId),
    });

    return user;
}

/**
 * Anonymizes a user's personal data while preserving their record for expense integrity.
 * This is GDPR-compliant as it removes identifying information while keeping
 * necessary records for other users' expense calculations.
 */
export async function anonymizeUser(userId: string) {
    // Cancel any active Lemon Squeezy subscription
    const userSubscription = await db.query.subscriptions.findFirst({
        where: eq(subscriptions.userId, userId),
    });

    if (userSubscription && userSubscription.status === 'active') {
        try {
            configureLemonSqueezy();
            await cancelSubscription(userSubscription.lemonSqueezyId);
        } catch (error) {
            console.error('Failed to cancel Lemon Squeezy subscription:', error);
            // Continue with anonymization even if subscription cancellation fails
        }
    }

    // Delete all receipt images from Supabase Storage (GDPR compliance)
    try {
        await deleteAllUserReceipts(userId);
    } catch (error) {
        console.error('Failed to delete receipt images:', error);
        // Continue with anonymization even if image deletion fails
    }

    // Anonymize user data - keep the record but remove PII
    await db.update(users)
        .set({
            name: 'Deleted User',
            email: `deleted-${userId}@deleted.spliq.app`,
            image: null,
            avatarUrl: null,
            isGhost: true,
            paymentMethods: {},
            // Clear subscription data
            lemonSqueezyCustomerId: null,
            lemonSqueezySubscriptionId: null,
            subscriptionTier: 'free',
            subscriptionStatus: 'cancelled',
        })
        .where(eq(users.id, userId));

    // Delete subscription records (they reference the anonymized user)
    await db.delete(subscriptions).where(eq(subscriptions.userId, userId));
}

/**
 * Deletes the current user's account.
 * Anonymizes data in our database, then deletes from Clerk.
 */
export async function deleteAccount() {
    const { userId } = await auth();

    if (!userId) {
        throw new Error('Unauthorized');
    }

    // First, anonymize the user in our database
    await anonymizeUser(userId);

    // Then delete from Clerk (this will sign them out)
    const clerk = await clerkClient();
    await clerk.users.deleteUser(userId);

    return { success: true };
}

/**
 * Syncs user profile data from Clerk webhook.
 * Called when user.updated event is received.
 */
export async function syncUserFromClerk(data: {
    userId: string;
    email?: string;
    name?: string;
    imageUrl?: string;
}) {
    const { userId, email, name, imageUrl } = data;

    // Check if user exists in our database
    const existingUser = await db.query.users.findFirst({
        where: eq(users.id, userId),
    });

    if (!existingUser) {
        // User doesn't exist in our database yet - they haven't used the app
        console.log(`User ${userId} not found in database, skipping sync`);
        return;
    }

    // Don't update if user is anonymized/deleted
    if (existingUser.isGhost) {
        console.log(`User ${userId} is anonymized, skipping sync`);
        return;
    }

    // Update user profile with Clerk data
    await db.update(users)
        .set({
            ...(email && { email }),
            ...(name && { name }),
            ...(imageUrl && { image: imageUrl, avatarUrl: imageUrl }),
        })
        .where(eq(users.id, userId));

    console.log(`Synced profile for user ${userId}`);
}
