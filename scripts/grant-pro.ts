/**
 * Grant permanent Pro access to a user (for owners/admins)
 * Usage: npm run grant:pro -- your@email.com
 */
import { db } from '../lib/db';
import { users } from '../lib/db/schema';
import { eq } from 'drizzle-orm';

async function main() {
    const email = process.argv[2];

    if (!email) {
        console.error('❌ Usage: npm run grant:pro -- your@email.com');
        process.exit(1);
    }

    console.log(`\n🔍 Looking for user: ${email}\n`);

    const user = await db.query.users.findFirst({
        where: eq(users.email, email),
    });

    if (!user) {
        console.error(`❌ User not found: ${email}`);
        process.exit(1);
    }

    console.log(`Found user: ${user.name} (${user.id})`);
    console.log(`Current tier: ${user.subscriptionTier}`);

    // Grant permanent Pro
    await db.update(users).set({
        subscriptionTier: 'pro',
        subscriptionStatus: 'active',
        currentPeriodEnd: null, // null = never expires
        isPaused: false,
    }).where(eq(users.id, user.id));

    console.log(`\n✅ ${email} now has PERMANENT Pro access!`);
    console.log('   (currentPeriodEnd = null means it never expires)\n');

    process.exit(0);
}

main().catch(console.error);
