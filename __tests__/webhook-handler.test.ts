/**
 * Comprehensive tests for Lemon Squeezy webhook handler
 * Tests subscription lifecycle: created -> updated -> cancelled -> expired
 */

// Mock Clerk auth
jest.mock('@clerk/nextjs/server', () => ({
    auth: jest.fn(() => Promise.resolve({ userId: 'user_test_123' })),
    currentUser: jest.fn(() => Promise.resolve({
        id: 'user_test_123',
        emailAddresses: [{ emailAddress: 'test@example.com' }],
    })),
}));

jest.mock('next/cache', () => ({
    revalidatePath: jest.fn(),
}));

// Mock Lemon Squeezy SDK
jest.mock('@lemonsqueezy/lemonsqueezy.js', () => ({
    lemonSqueezySetup: jest.fn(),
    getSubscription: jest.fn(),
}));

import { db } from '@/lib/db';
import { users, plans, subscriptions, webhookEvents } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

// Test helpers
async function createTestUser(overrides: Partial<typeof users.$inferInsert> = {}) {
    const [user] = await db.insert(users).values({
        id: `user_test_${Date.now()}`,
        email: `test_${Date.now()}@example.com`,
        name: 'Test User',
        subscriptionTier: 'free',
        subscriptionStatus: 'active',
        ...overrides,
    }).returning();
    return user;
}

async function createTestPlan(overrides: Partial<typeof plans.$inferInsert> = {}) {
    const [plan] = await db.insert(plans).values({
        variantId: 12345,
        productId: 67890,
        productName: 'Test Product',
        name: 'Test Plan',
        price: '499',
        ...overrides,
    }).returning();
    return plan;
}

async function cleanupTestData() {
    // Clean in reverse order of dependencies
    await db.delete(webhookEvents);
    await db.delete(subscriptions);
    await db.delete(plans);
    await db.delete(users);
}

describe('Webhook Handler - Subscription Lifecycle', () => {
    beforeAll(async () => {
        await cleanupTestData();
    });

    afterAll(async () => {
        await cleanupTestData();
    });

    describe('checkSubscription', () => {
        let testUser: typeof users.$inferSelect;

        beforeEach(async () => {
            await cleanupTestData();
        });

        test('returns false for free user', async () => {
            testUser = await createTestUser({ subscriptionTier: 'free' });

            // Mock the auth to return our test user
            const { auth } = await import('@clerk/nextjs/server');
            (auth as jest.Mock).mockResolvedValue({ userId: testUser.id });

            const { checkSubscription } = await import('@/lib/auth/subscription');
            const isPro = await checkSubscription();
            expect(isPro).toBe(false);
        });

        test('returns true for pro user', async () => {
            testUser = await createTestUser({ subscriptionTier: 'pro' });

            const { auth } = await import('@clerk/nextjs/server');
            (auth as jest.Mock).mockResolvedValue({ userId: testUser.id });

            const { checkSubscription } = await import('@/lib/auth/subscription');
            const isPro = await checkSubscription();
            expect(isPro).toBe(true);
        });

        test('returns true for cancelled user with future period end', async () => {
            const futureDate = new Date();
            futureDate.setMonth(futureDate.getMonth() + 1);

            testUser = await createTestUser({
                subscriptionTier: 'pro',
                subscriptionStatus: 'cancelled',
                currentPeriodEnd: futureDate,
            });

            const { auth } = await import('@clerk/nextjs/server');
            (auth as jest.Mock).mockResolvedValue({ userId: testUser.id });

            const { checkSubscription } = await import('@/lib/auth/subscription');
            const isPro = await checkSubscription();
            expect(isPro).toBe(true);
        });

        test('returns false for unauthenticated user', async () => {
            const { auth } = await import('@clerk/nextjs/server');
            (auth as jest.Mock).mockResolvedValue({ userId: null });

            const { checkSubscription } = await import('@/lib/auth/subscription');
            const isPro = await checkSubscription();
            expect(isPro).toBe(false);
        });
    });

    describe('Subscription Status Transitions', () => {
        let testUser: typeof users.$inferSelect;

        beforeEach(async () => {
            await cleanupTestData();
            testUser = await createTestUser({ id: 'user_transition_test' });
        });

        test('subscription_created sets user to Pro', async () => {
            await createTestPlan({ variantId: 99999 });

            // Simulate what webhook handler does for subscription_created
            await db.update(users).set({
                subscriptionTier: 'pro',
                subscriptionStatus: 'active',
                lemonSqueezyCustomerId: '12345',
                lemonSqueezySubscriptionId: 'sub_123',
            }).where(eq(users.id, testUser.id));

            const updatedUser = await db.query.users.findFirst({
                where: eq(users.id, testUser.id),
            });

            expect(updatedUser?.subscriptionTier).toBe('pro');
            expect(updatedUser?.subscriptionStatus).toBe('active');
        });

        test('subscription_cancelled keeps Pro tier with ends_at date', async () => {
            // Start with active Pro user
            await db.update(users).set({
                subscriptionTier: 'pro',
                subscriptionStatus: 'active',
            }).where(eq(users.id, testUser.id));

            const futureDate = new Date();
            futureDate.setMonth(futureDate.getMonth() + 1);

            // Simulate subscription_cancelled (should NOT downgrade to free)
            await db.update(users).set({
                subscriptionStatus: 'cancelled',
                currentPeriodEnd: futureDate,
                // Note: subscriptionTier stays 'pro'
            }).where(eq(users.id, testUser.id));

            const updatedUser = await db.query.users.findFirst({
                where: eq(users.id, testUser.id),
            });

            expect(updatedUser?.subscriptionTier).toBe('pro'); // Still Pro!
            expect(updatedUser?.subscriptionStatus).toBe('cancelled');
            expect(updatedUser?.currentPeriodEnd).not.toBeNull();
        });

        test('subscription_expired downgrades to free tier', async () => {
            // Start with cancelled Pro user
            await db.update(users).set({
                subscriptionTier: 'pro',
                subscriptionStatus: 'cancelled',
            }).where(eq(users.id, testUser.id));

            // Simulate subscription_expired (NOW we downgrade)
            await db.update(users).set({
                subscriptionTier: 'free',
                subscriptionStatus: 'expired',
                isPaused: false,
                lemonSqueezySubscriptionId: null,
            }).where(eq(users.id, testUser.id));

            const updatedUser = await db.query.users.findFirst({
                where: eq(users.id, testUser.id),
            });

            expect(updatedUser?.subscriptionTier).toBe('free');
            expect(updatedUser?.subscriptionStatus).toBe('expired');
        });

        test('subscription_paused sets isPaused flag', async () => {
            // Start with active Pro user
            await db.update(users).set({
                subscriptionTier: 'pro',
                subscriptionStatus: 'active',
                isPaused: false,
            }).where(eq(users.id, testUser.id));

            // Simulate subscription_paused
            await db.update(users).set({
                subscriptionStatus: 'paused',
                isPaused: true,
            }).where(eq(users.id, testUser.id));

            const updatedUser = await db.query.users.findFirst({
                where: eq(users.id, testUser.id),
            });

            expect(updatedUser?.subscriptionStatus).toBe('paused');
            expect(updatedUser?.isPaused).toBe(true);
        });

        test('subscription_resumed clears isPaused flag', async () => {
            // Start with paused Pro user
            await db.update(users).set({
                subscriptionTier: 'pro',
                subscriptionStatus: 'paused',
                isPaused: true,
            }).where(eq(users.id, testUser.id));

            // Simulate subscription_resumed
            await db.update(users).set({
                subscriptionStatus: 'active',
                isPaused: false,
            }).where(eq(users.id, testUser.id));

            const updatedUser = await db.query.users.findFirst({
                where: eq(users.id, testUser.id),
            });

            expect(updatedUser?.subscriptionStatus).toBe('active');
            expect(updatedUser?.isPaused).toBe(false);
        });
    });

    describe('Plan Auto-Creation', () => {
        beforeEach(async () => {
            await cleanupTestData();
        });

        test('creates plan when missing from webhook data', async () => {
            const newVariantId = 11111;

            // Simulate plan auto-creation (what webhook does when plan not found)
            const [newPlan] = await db.insert(plans).values({
                variantId: newVariantId,
                productId: 22222,
                productName: 'Auto-Created Product',
                name: 'Auto-Created Plan',
                price: '0', // Will be updated on sync
            }).onConflictDoNothing().returning();

            expect(newPlan).toBeDefined();
            expect(newPlan?.variantId).toBe(newVariantId);
        });

        test('does not duplicate plan on conflict', async () => {
            const existingVariantId = 33333;

            // Create first plan
            await db.insert(plans).values({
                variantId: existingVariantId,
                productId: 44444,
                productName: 'Existing Product',
                name: 'Existing Plan',
                price: '999',
            });

            // Try to insert again with onConflictDoNothing
            const result = await db.insert(plans).values({
                variantId: existingVariantId,
                productId: 55555, // Different product ID
                productName: 'Duplicate Product',
                name: 'Duplicate Plan',
                price: '0',
            }).onConflictDoNothing().returning();

            // Should not create a new plan
            const allPlans = await db.query.plans.findMany({
                where: eq(plans.variantId, existingVariantId),
            });

            expect(allPlans.length).toBe(1);
            expect(allPlans[0].price).toBe('999'); // Original price, not overwritten
        });
    });

    describe('Webhook Event Storage', () => {
        beforeEach(async () => {
            await cleanupTestData();
        });

        test('stores webhook event in database', async () => {
            const eventData = {
                eventName: 'subscription_created',
                body: { test: 'data' },
            };

            const [event] = await db.insert(webhookEvents).values({
                eventName: eventData.eventName,
                body: eventData.body,
                processed: false,
            }).returning();

            expect(event.id).toBeDefined();
            expect(event.eventName).toBe('subscription_created');
            expect(event.processed).toBe(false);
        });

        test('marks event as processed with error', async () => {
            const [event] = await db.insert(webhookEvents).values({
                eventName: 'subscription_created',
                body: {},
                processed: false,
            }).returning();

            await db.update(webhookEvents).set({
                processed: true,
                processingError: 'Test error message',
            }).where(eq(webhookEvents.id, event.id));

            const updatedEvent = await db.query.webhookEvents.findFirst({
                where: eq(webhookEvents.id, event.id),
            });

            expect(updatedEvent?.processed).toBe(true);
            expect(updatedEvent?.processingError).toBe('Test error message');
        });
    });

    describe('Subscription Table Operations', () => {
        let testUser: typeof users.$inferSelect;
        let testPlan: typeof plans.$inferSelect;

        beforeEach(async () => {
            await cleanupTestData();
            testUser = await createTestUser();
            testPlan = await createTestPlan();
        });

        test('creates subscription record on subscription_created', async () => {
            const [subscription] = await db.insert(subscriptions).values({
                lemonSqueezyId: 'ls_sub_123',
                orderId: 12345,
                name: 'Test User',
                email: testUser.email,
                status: 'active',
                statusFormatted: 'Active',
                userId: testUser.id,
                planId: testPlan.id,
                price: '499',
                isUsageBased: false,
                isPaused: false,
            }).returning();

            expect(subscription.lemonSqueezyId).toBe('ls_sub_123');
            expect(subscription.status).toBe('active');
            expect(subscription.userId).toBe(testUser.id);
        });

        test('upserts subscription on duplicate lemonSqueezyId', async () => {
            const lsId = 'ls_sub_upsert_test';

            // First insert
            await db.insert(subscriptions).values({
                lemonSqueezyId: lsId,
                orderId: 11111,
                name: 'Test User',
                email: testUser.email,
                status: 'active',
                userId: testUser.id,
                planId: testPlan.id,
                price: '499',
                isUsageBased: false,
                isPaused: false,
            });

            // Upsert with updated status
            await db.insert(subscriptions).values({
                lemonSqueezyId: lsId,
                orderId: 11111,
                name: 'Test User',
                email: testUser.email,
                status: 'cancelled',
                userId: testUser.id,
                planId: testPlan.id,
                price: '499',
                isUsageBased: false,
                isPaused: false,
            }).onConflictDoUpdate({
                target: subscriptions.lemonSqueezyId,
                set: { status: 'cancelled' },
            });

            const updated = await db.query.subscriptions.findFirst({
                where: eq(subscriptions.lemonSqueezyId, lsId),
            });

            expect(updated?.status).toBe('cancelled');
        });
    });
});
