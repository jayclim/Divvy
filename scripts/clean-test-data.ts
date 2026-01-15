import { db } from '../lib/db';
import { users, groups, usersToGroups, expenses, expenseSplits, settlements, messages, activityLogs, subscriptions, webhookEvents, plans } from '../lib/db/schema';
// import { createClerkClient } from '@clerk/backend'; // Removed top-level import
import { config } from 'dotenv';

// Load env vars for standalone script execution
// config({ path: '.env.test.local' }); // Commented out to allow dotenv-cli to control the environment

// const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY }); // Removed top-level init

async function cleanTestData(skipClerk = false) {
  console.log('🧹 Cleaning test data...');

  try {
    // Delete billing data first (no FK dependencies on other tables)
    await db.delete(webhookEvents);
    console.log('✅ Deleted webhook events');

    await db.delete(subscriptions);
    console.log('✅ Deleted subscriptions');

    await db.delete(plans);
    console.log('✅ Deleted plans');

    // Delete in correct order to respect foreign key constraints
    await db.delete(expenseSplits);
    console.log('✅ Deleted expense splits');

    await db.delete(expenses);
    console.log('✅ Deleted expenses');

    await db.delete(messages);
    console.log('✅ Deleted messages');

    await db.delete(settlements);
    console.log('✅ Deleted settlements');

    await db.delete(activityLogs);
    console.log('✅ Deleted activity logs');

    await db.delete(usersToGroups);
    console.log('✅ Deleted user-group relationships');

    await db.delete(groups);
    console.log('✅ Deleted groups');

    await db.delete(users);
    console.log('✅ Deleted users from public table');

    if (!skipClerk) {
      // Delete test users from Clerk
      console.log('🔥 Finding and deleting Clerk test users...');
      try {
        const { createClerkClient } = await import('@clerk/backend');
        const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });

        const testEmails = [
          'alice@test.com', 'bob@test.com', 'charlie@test.com',
          'dave@test.com', 'eve@test.com', 'frank@test.com'
        ];

        for (const email of testEmails) {
          const userList = await clerk.users.getUserList({ emailAddress: [email], limit: 1 });
          if (userList.data.length > 0) {
            await clerk.users.deleteUser(userList.data[0].id);
            console.log(`✅ Deleted Clerk user: ${email}`);
          }
        }
      } catch (error) {
        console.error('❌ Error deleting Clerk users:', error);
        // Don't fail the script if Clerk deletion fails, just log it
      }
    } else {
      console.log('ℹ️  Skipping Clerk user deletion.');
    }

    console.log('🎉 Test data cleanup completed!');
    console.log('');
    console.log('ℹ️  NOTE: Lemon Squeezy subscriptions cannot be deleted remotely.');
    console.log('   Test subscriptions persist in Lemon Squeezy but local DB tables are cleared.');
  } catch (error) {
    console.error('❌ Error cleaning test data:', error);
    process.exit(1);
  }
}

// Only run if this file is the entry point
if (import.meta.url === `file://${process.argv[1]}`) {
  cleanTestData().then(() => {
    console.log('👋 Exiting...');
    process.exit(0);
  });
}

export { cleanTestData };