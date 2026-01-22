/**
 * Subscription Queries - Data Access Layer
 * 
 * Contains all database queries related to billing and subscriptions.
 */

import { db } from '@/lib/db';
import { subscriptions, plans, webhookEvents, users } from '@/lib/db/schema';
import { eq, desc, and } from 'drizzle-orm';
import type { Subscription, Plan, WebhookEvent } from '@/lib/db/types';

/**
 * Get a subscription by its Lemon Squeezy ID
 */
export async function getSubscriptionByLemonSqueezyId(
    lemonSqueezyId: string
): Promise<Subscription | null> {
    const subscription = await db.query.subscriptions.findFirst({
        where: eq(subscriptions.lemonSqueezyId, lemonSqueezyId),
    });
    return subscription ?? null;
}

/**
 * Get a user's active subscription
 */
export async function getActiveSubscriptionByUserId(
    userId: string
): Promise<Subscription | null> {
    const subscription = await db.query.subscriptions.findFirst({
        where: and(
            eq(subscriptions.userId, userId),
            eq(subscriptions.status, 'active')
        ),
    });
    return subscription ?? null;
}

/**
 * Get the most recent subscription for a user
 */
export async function getLatestSubscriptionByUserId(
    userId: string
): Promise<Subscription | null> {
    const subscription = await db.query.subscriptions.findFirst({
        where: eq(subscriptions.userId, userId),
        orderBy: [desc(subscriptions.createdAt)],
    });
    return subscription ?? null;
}

/**
 * Get a plan by its variant ID
 */
export async function getPlanByVariantId(variantId: number): Promise<Plan | null> {
    const plan = await db.query.plans.findFirst({
        where: eq(plans.variantId, variantId),
    });
    return plan ?? null;
}

/**
 * Get a plan by ID
 */
export async function getPlanById(planId: number): Promise<Plan | null> {
    const plan = await db.query.plans.findFirst({
        where: eq(plans.id, planId),
    });
    return plan ?? null;
}

/**
 * Get all plans
 */
export async function getAllPlans(): Promise<Plan[]> {
    return db.query.plans.findMany({
        orderBy: [plans.sort],
    });
}

/**
 * Get unprocessed webhook events
 */
export async function getUnprocessedWebhookEvents(limit: number = 100): Promise<WebhookEvent[]> {
    return db.query.webhookEvents.findMany({
        where: eq(webhookEvents.processed, false),
        orderBy: [webhookEvents.createdAt],
        limit,
    });
}

/**
 * Check if user is on a paid tier
 */
export async function isUserOnPaidTier(userId: string): Promise<boolean> {
    const user = await db.query.users.findFirst({
        where: eq(users.id, userId),
        columns: { subscriptionTier: true },
    });
    return user?.subscriptionTier === 'pro';
}
