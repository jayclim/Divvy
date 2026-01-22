'use server';

import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { users, usersToGroups } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

// Limits (not exported - use server files can only export async functions)
const FREE_GROUP_LIMIT = 3;
const SCAN_LIMITS = {
    free: 3,
    pro: 50,
} as const;

/**
 * Get the current user's group count and limit status
 */
export async function getGroupLimitStatus() {
    const { userId } = await auth();
    if (!userId) return null;

    const user = await db.query.users.findFirst({
        where: eq(users.id, userId),
        columns: {
            subscriptionTier: true,
        },
    });

    if (!user) return null;

    const isPro = user.subscriptionTier === 'pro';

    // Count user's groups
    const userGroups = await db.query.usersToGroups.findMany({
        where: eq(usersToGroups.userId, userId),
    });

    const groupCount = userGroups.length;
    const limit = isPro ? Infinity : FREE_GROUP_LIMIT;
    const canCreateGroup = groupCount < limit;
    const remaining = isPro ? Infinity : Math.max(0, FREE_GROUP_LIMIT - groupCount);

    return {
        groupCount,
        limit: isPro ? 'unlimited' : FREE_GROUP_LIMIT,
        canCreateGroup,
        remaining,
        isPro,
    };
}

/**
 * Get the current user's AI scan usage and limit status
 */
export async function getScanLimitStatus() {
    const { userId } = await auth();
    if (!userId) return null;

    const user = await db.query.users.findFirst({
        where: eq(users.id, userId),
        columns: {
            subscriptionTier: true,
            monthlyAiScansUsed: true,
            lastScanReset: true,
        },
    });

    if (!user) return null;

    const tier = user.subscriptionTier as 'free' | 'pro';
    const limit = SCAN_LIMITS[tier];

    // Check for month reset
    const now = new Date();
    const lastReset = user.lastScanReset;
    const isNewMonth = !lastReset ||
        lastReset.getMonth() !== now.getMonth() ||
        lastReset.getFullYear() !== now.getFullYear();

    const used = isNewMonth ? 0 : user.monthlyAiScansUsed;
    const remaining = Math.max(0, limit - used);
    const canScan = remaining > 0;

    return {
        used,
        limit,
        remaining,
        canScan,
        isPro: tier === 'pro',
    };
}
