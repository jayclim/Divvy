'use server';

import { db } from '@/lib/db';
import { plans, subscriptions, users, webhookEvents } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { configureLemonSqueezy } from '@/lib/lemon-squeezy/utils';
import {
  listProducts,
  listVariants,
  createCheckout,
} from '@lemonsqueezy/lemonsqueezy.js';
import { auth } from '@clerk/nextjs/server';

/**
 * Syncs all products and variants from Lemon Squeezy to the local plans table.
 * This ensures your pricing page loads instantly from your DB.
 */
export async function syncPlans() {
  configureLemonSqueezy();

  // Fetch all products with their variants
  const productsResponse = await listProducts({
    filter: { storeId: process.env.LEMONSQUEEZY_STORE_ID },
    include: ['variants'],
  });

  if (productsResponse.error) {
    throw new Error(`Failed to fetch products: ${productsResponse.error.message}`);
  }

  const allProducts = productsResponse.data?.data ?? [];

  // Also fetch variants separately to get full details
  const variantsResponse = await listVariants({
    filter: { productId: allProducts.map((p) => p.id).join(',') },
  });

  if (variantsResponse.error) {
    throw new Error(`Failed to fetch variants: ${variantsResponse.error.message}`);
  }

  const allVariants = variantsResponse.data?.data ?? [];

  // Create a map of products for easy lookup
  const productMap = new Map(
    allProducts.map((product) => [
      product.id,
      {
        id: parseInt(product.id, 10),
        name: product.attributes.name,
        description: product.attributes.description,
      },
    ])
  );

  // Process each variant and upsert into the plans table
  const upsertPromises = allVariants.map(async (variant) => {
    const productId = variant.attributes.product_id;
    const product = productMap.get(productId.toString());

    if (!product) {
      console.warn(`Product not found for variant ${variant.id}`);
      return null;
    }

    // Skip draft variants
    if (variant.attributes.status === 'draft') {
      return null;
    }

    const attrs = variant.attributes as Record<string, unknown>;
    const planData = {
      productId: product.id,
      productName: product.name,
      variantId: parseInt(variant.id, 10),
      name: variant.attributes.name,
      description: variant.attributes.description || product.description,
      price: variant.attributes.price.toString(),
      isUsageBased: (attrs.is_usage_based as boolean) ?? false,
      interval: variant.attributes.interval ?? null,
      intervalCount: variant.attributes.interval_count ?? null,
      trialInterval: (attrs.trial_interval as string) ?? null,
      trialIntervalCount: (attrs.trial_interval_count as number) ?? null,
      sort: variant.attributes.sort,
      updatedAt: new Date(),
    };

    // Upsert: Insert if not exists, update if exists
    await db
      .insert(plans)
      .values(planData)
      .onConflictDoUpdate({
        target: plans.variantId,
        set: planData,
      });

    return planData;
  });

  const results = await Promise.all(upsertPromises);
  const syncedPlans = results.filter(Boolean);

  revalidatePath('/');

  return {
    success: true,
    syncedCount: syncedPlans.length,
    plans: syncedPlans,
  };
}

/**
 * Fetches all plans from the local database.
 */
export async function getPlans() {
  const allPlans = await db.query.plans.findMany({
    orderBy: (plans, { asc }) => [asc(plans.sort)],
  });

  return allPlans;
}

/**
 * Creates a checkout URL for a specific plan variant using the SDK.
 */
export async function getCheckoutUrl(variantId: number, embed = false) {
  configureLemonSqueezy();

  const { userId } = await auth();

  if (!userId) {
    throw new Error('User must be logged in to create a checkout');
  }

  // Get user email from Clerk for checkout (ensures consistency with auth)
  const { currentUser } = await import('@clerk/nextjs/server');
  const clerkUser = await currentUser();
  const userEmail = clerkUser?.emailAddresses[0]?.emailAddress;

  const storeId = process.env.LEMONSQUEEZY_STORE_ID;
  if (!storeId) {
    throw new Error('LEMONSQUEEZY_STORE_ID is not configured');
  }

  const useTestMode = process.env.LEMONSQUEEZY_TEST_MODE === 'true' ||
    process.env.NODE_ENV === 'development';

  // Ensure storeId and variantId are numbers
  const numericStoreId = parseInt(storeId, 10);
  const numericVariantId = typeof variantId === 'string' ? parseInt(variantId, 10) : variantId;

  console.log('Creating checkout:', { numericStoreId, numericVariantId, useTestMode, email: userEmail });

  const checkout = await createCheckout(numericStoreId, numericVariantId, {
    checkoutOptions: {
      embed,
    },
    checkoutData: {
      email: userEmail ?? undefined,
      custom: {
        user_id: userId,
      },
    },
    testMode: useTestMode,
  });

  if (checkout.error) {
    console.error('Checkout error:', JSON.stringify(checkout.error, null, 2));
    throw new Error(`Failed to create checkout: ${checkout.error.message}`);
  }

  return checkout.data?.data.attributes.url;
}

/**
 * Gets the user's active subscription from the local database.
 */
export async function getUserSubscription() {
  const { userId } = await auth();

  if (!userId) {
    return null;
  }

  const subscription = await db.query.subscriptions.findFirst({
    where: eq(subscriptions.userId, userId),
    with: {
      plan: true,
    },
    orderBy: (subscriptions, { desc }) => [desc(subscriptions.createdAt)],
  });

  return subscription;
}

/**
 * Checks if the user has an active subscription.
 */
export async function isSubscribed(): Promise<boolean> {
  const subscription = await getUserSubscription();

  if (!subscription) {
    return false;
  }

  const activeStatuses = ['active', 'on_trial'];
  return activeStatuses.includes(subscription.status);
}

/**
 * Stores a webhook event in the database for processing.
 * Returns the created event ID.
 */
export async function storeWebhookEvent(eventName: string, body: unknown) {
  const result = await db
    .insert(webhookEvents)
    .values({
      eventName,
      body: body as Record<string, unknown>,
      processed: false,
    })
    .returning({ id: webhookEvents.id });

  return result[0].id;
}

/**
 * Marks a webhook event as processed.
 */
export async function markWebhookEventProcessed(
  eventId: number,
  error?: string
) {
  await db
    .update(webhookEvents)
    .set({
      processed: true,
      processingError: error,
    })
    .where(eq(webhookEvents.id, eventId));
}