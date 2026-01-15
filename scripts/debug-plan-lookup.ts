/**
 * Debug script to understand the plan lookup issue
 */

import { db } from '../lib/db';
import { plans, webhookEvents } from '../lib/db/schema';
import { eq, desc } from 'drizzle-orm';

async function main() {
    console.log('\n=== DEBUGGING PLAN LOOKUP ISSUE ===\n');

    // Check plans
    const allPlans = await db.select().from(plans);
    console.log('📋 All Plans:');
    allPlans.forEach((p) => {
        console.log(`  ID: ${p.id}, variantId: ${p.variantId} (type: ${typeof p.variantId}), name: ${p.name}`);
        console.log(`  Created: ${p.createdAt}`);
    });

    // Check webhook event body
    console.log('\n📩 Webhook Event Details:');
    const events = await db
        .select()
        .from(webhookEvents)
        .orderBy(desc(webhookEvents.createdAt))
        .limit(2);

    events.forEach((e) => {
        console.log(`\n  Event: ${e.eventName}`);
        console.log(`  Created: ${e.createdAt}`);
        console.log(`  Error: ${e.processingError}`);

        const body = e.body as { data?: { attributes?: { variant_id?: number } } };
        const variantId = body?.data?.attributes?.variant_id;
        console.log(`  Variant ID from webhook: ${variantId} (type: ${typeof variantId})`);
    });

    // Try a lookup manually
    console.log('\n🔍 Manual Plan Lookup Test:');
    const variantToFind = 1215764;
    const foundPlan = await db.query.plans.findFirst({
        where: eq(plans.variantId, variantToFind),
    });
    console.log(`  Searching for variantId: ${variantToFind}`);
    console.log(`  Result: ${foundPlan ? `Found! ID: ${foundPlan.id}` : 'NOT FOUND'}`);

    process.exit(0);
}

main().catch(console.error);
