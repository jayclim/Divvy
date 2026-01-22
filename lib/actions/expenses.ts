'use server';

import { auth } from '@clerk/nextjs/server';
import { scanReceipt } from '@/lib/ai/gemini';
import { db } from '@/lib/db';
import { users, aiScanLogs } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { uploadReceiptImage } from '@/lib/supabase/storage';
import { AI_SCAN_LIMITS } from '@/lib/constants/limits';

// Use the centralized scan limits
const SCAN_LIMITS = AI_SCAN_LIMITS;

/**
 * Check and update AI scan usage for a user.
 * Returns true if scan is allowed, false if limit reached.
 */
async function checkAndUpdateScanLimit(userId: string): Promise<{ allowed: boolean; remaining: number; limit: number }> {
    const user = await db.query.users.findFirst({
        where: eq(users.id, userId),
        columns: {
            subscriptionTier: true,
            monthlyAiScansUsed: true,
            lastScanReset: true,
        },
    });

    if (!user) {
        throw new Error('User not found');
    }

    const tier = user.subscriptionTier as 'free' | 'pro';
    const limit = SCAN_LIMITS[tier];

    // Check if we need to reset the counter (new month)
    const now = new Date();
    const lastReset = user.lastScanReset;
    const shouldReset = !lastReset ||
        lastReset.getMonth() !== now.getMonth() ||
        lastReset.getFullYear() !== now.getFullYear();

    let currentUsage = user.monthlyAiScansUsed;

    if (shouldReset) {
        // Reset counter for new month
        currentUsage = 0;
        await db.update(users).set({
            monthlyAiScansUsed: 0,
            lastScanReset: now,
        }).where(eq(users.id, userId));
    }

    // Check if limit reached
    if (currentUsage >= limit) {
        return { allowed: false, remaining: 0, limit };
    }

    // Increment usage
    await db.update(users).set({
        monthlyAiScansUsed: currentUsage + 1,
        lastScanReset: shouldReset ? now : user.lastScanReset,
    }).where(eq(users.id, userId));

    return { allowed: true, remaining: limit - currentUsage - 1, limit };
}

export async function processReceiptAction(formData: FormData) {
    const { userId } = await auth();
    if (!userId) {
        throw new Error('Unauthorized');
    }

    // Check scan limit (individual-based)
    const { allowed, remaining, limit } = await checkAndUpdateScanLimit(userId);

    if (!allowed) {
        throw new Error(`You've used all ${limit} AI scans this month. Upgrade to Pro for ${SCAN_LIMITS.pro} scans/month!`);
    }

    const file = formData.get('receipt') as File;
    if (!file) {
        throw new Error('No receipt image provided');
    }

    // Convert File to Base64
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64Image = buffer.toString('base64');
    const mimeType = file.type || 'image/jpeg';

    let receiptImageUrl: string | null = null;

    try {
        // Upload image to Supabase Storage
        receiptImageUrl = await uploadReceiptImage(userId, base64Image, mimeType);

        // Scan receipt with AI
        const data = await scanReceipt(base64Image);

        // Log successful scan
        await db.insert(aiScanLogs).values({
            userId,
            receiptImageUrl,
            rawResponse: data,
            status: 'success',
        });

        return {
            success: true,
            data,
            receiptImageUrl,
            scansRemaining: remaining,
        };
    } catch (error) {
        console.error('Process Receipt Error:', error);

        // Log failed scan
        await db.insert(aiScanLogs).values({
            userId,
            receiptImageUrl,
            status: 'failed',
            errorMessage: error instanceof Error ? error.message : 'Unknown error',
        });

        // Rollback the scan count on error
        await db.update(users).set({
            monthlyAiScansUsed: (await db.query.users.findFirst({
                where: eq(users.id, userId),
                columns: { monthlyAiScansUsed: true },
            }))!.monthlyAiScansUsed - 1,
        }).where(eq(users.id, userId));

        return { success: false, error: 'Failed to scan receipt' };
    }
}

/**
 * Get current scan usage for the logged-in user.
 */
export async function getScanUsage() {
    const { userId } = await auth();
    if (!userId) {
        return null;
    }

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

    return {
        used,
        limit,
        remaining: Math.max(0, limit - used),
        tier,
    };
}
