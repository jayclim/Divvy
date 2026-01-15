/**
 * Debug script to check all webhook events in database
 */
import { db } from '../lib/db';
import { webhookEvents, subscriptions } from '../lib/db/schema';
import { desc } from 'drizzle-orm';

async function main() {
    console.log('\n=== ALL WEBHOOK EVENTS ===\n');

    const events = await db
        .select()
        .from(webhookEvents)
        .orderBy(desc(webhookEvents.id))
        .limit(10);

    events.forEach((e) => {
        const body = e.body as { meta?: { custom_data?: { user_id?: string } } };
        console.log(`Event #${e.id}: ${e.eventName}`);
        console.log(`  Created: ${e.createdAt}`);
        console.log(`  Processed: ${e.processed}`);
        console.log(`  Error: ${e.processingError || 'None'}`);
        console.log(`  User ID from payload: ${body?.meta?.custom_data?.user_id || 'N/A'}`);
        console.log('');
    });

    console.log('=== ALL SUBSCRIPTIONS ===\n');
    const subs = await db.select().from(subscriptions);
    if (subs.length === 0) {
        console.log('No subscriptions in database.');
    } else {
        subs.forEach((s) => {
            console.log(`Sub #${s.id}: ${s.lemonSqueezyId}`);
            console.log(`  User ID: ${s.userId}`);
            console.log(`  Status: ${s.status}`);
            console.log('');
        });
    }

    process.exit(0);
}

main().catch(console.error);
