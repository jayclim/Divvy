/**
 * User Queries - Data Access Layer
 * 
 * Contains all database queries related to users.
 * These are pure data-fetching functions with no auth checks.
 * Auth should be handled at the action/route level.
 */

import { db } from '@/lib/db';
import { users, subscriptions, emailPreferences } from '@/lib/db/schema';
import { eq, inArray } from 'drizzle-orm';
import type { User, Subscription, EmailPreferences } from '@/lib/db/types';

/**
 * Get a user by their ID
 */
export async function getUserById(userId: string): Promise<User | null> {
    const user = await db.query.users.findFirst({
        where: eq(users.id, userId),
    });
    return user ?? null;
}

/**
 * Get multiple users by their IDs
 */
export async function getUsersByIds(userIds: string[]): Promise<User[]> {
    if (userIds.length === 0) return [];

    return db.query.users.findMany({
        where: inArray(users.id, userIds),
    });
}

/**
 * Get a user by their email
 */
export async function getUserByEmail(email: string): Promise<User | null> {
    const user = await db.query.users.findFirst({
        where: eq(users.email, email),
    });
    return user ?? null;
}

/**
 * Get user's subscription details
 */
export async function getUserSubscription(userId: string): Promise<Subscription | null> {
    const subscription = await db.query.subscriptions.findFirst({
        where: eq(subscriptions.userId, userId),
        orderBy: (subscriptions, { desc }) => [desc(subscriptions.createdAt)],
    });
    return subscription ?? null;
}

/**
 * Get user's email preferences
 */
export async function getUserEmailPreferences(userId: string): Promise<EmailPreferences | null> {
    const prefs = await db.query.emailPreferences.findFirst({
        where: eq(emailPreferences.userId, userId),
    });
    return prefs ?? null;
}

/**
 * Check if user is on Pro tier
 */
export async function isUserPro(userId: string): Promise<boolean> {
    const user = await db.query.users.findFirst({
        where: eq(users.id, userId),
        columns: { subscriptionTier: true },
    });
    return user?.subscriptionTier === 'pro';
}
