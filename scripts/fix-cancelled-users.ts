/**
 * Fix users who have cancelled status but Free tier - they should still be Pro
 * until their currentPeriodEnd date passes
 */
import { db } from '../lib/db';
import { users } from '../lib/db/schema';
import { eq, and, isNotNull, gt } from 'drizzle-orm';

async function main() {
    console.log('\n=== FIXING CANCELLED USERS TIER ===\n');

    // Find users who are cancelled but have a future period end
    const now = new Date();
    const usersToFix = await db
        .select()
        .from(users)
        .where(
            and(
                eq(users.subscriptionStatus, 'cancelled'),
                eq(users.subscriptionTier, 'free'),
                isNotNull(users.currentPeriodEnd),
                gt(users.currentPeriodEnd, now)
            )
        );

    console.log(`Found ${usersToFix.length} users to fix:`);

    for (const user of usersToFix) {
        console.log(`  - ${user.email}: cancelled but period ends ${user.currentPeriodEnd}`);

        await db
            .update(users)
            .set({ subscriptionTier: 'pro' })
            .where(eq(users.id, user.id));

        console.log(`    ✅ Updated to Pro`);
    }

    console.log('\n=== DONE ===\n');
    process.exit(0);
}

main().catch(console.error);
