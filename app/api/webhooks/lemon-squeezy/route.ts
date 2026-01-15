import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { db } from '@/lib/db';
import { plans, subscriptions, users, webhookEvents } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

// Webhook event types we handle
type WebhookEventName =
  | 'subscription_created'
  | 'subscription_updated'
  | 'subscription_cancelled'
  | 'subscription_expired'
  | 'subscription_resumed'
  | 'subscription_paused';

interface WebhookPayload {
  meta: {
    event_name: WebhookEventName;
    custom_data?: {
      user_id?: string;
    };
  };
  data: {
    id: string;
    attributes: {
      store_id: number;
      customer_id: number;
      order_id: number;
      product_id: number;
      variant_id: number;
      product_name: string;
      variant_name: string;
      user_name: string;
      user_email: string;
      status: 'on_trial' | 'active' | 'paused' | 'past_due' | 'unpaid' | 'cancelled' | 'expired';
      status_formatted: string;
      card_brand: string;
      card_last_four: string;
      pause: null | { mode: string; resumes_at: string };
      cancelled: boolean;
      trial_ends_at: string | null;
      billing_anchor: number;
      first_subscription_item: {
        id: number;
        subscription_id: number;
        price_id: number;
        quantity: number;
        is_usage_based: boolean;
      };
      urls: {
        update_payment_method: string;
        customer_portal: string;
        customer_portal_update_subscription: string;
      };
      renews_at: string | null;
      ends_at: string | null;
      created_at: string;
      updated_at: string;
      test_mode: boolean;
    };
  };
}

/**
 * Verifies the webhook signature from Lemon Squeezy.
 */
function verifySignature(payload: string, signature: string): boolean {
  const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET;
  if (!secret) {
    console.error('LEMONSQUEEZY_WEBHOOK_SECRET is not set');
    return false;
  }

  const hmac = crypto.createHmac('sha256', secret);
  const digest = Buffer.from(hmac.update(payload).digest('hex'), 'utf8');
  const signatureBuffer = Buffer.from(signature, 'utf8');

  if (digest.length !== signatureBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(digest, signatureBuffer);
}

/**
 * Stores the webhook event in the database for reliability and debugging.
 */
async function storeWebhookEvent(eventName: string, body: unknown): Promise<number> {
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
async function markWebhookEventProcessed(eventId: number, error?: string): Promise<void> {
  await db
    .update(webhookEvents)
    .set({
      processed: true,
      processingError: error,
    })
    .where(eq(webhookEvents.id, eventId));
}

/**
 * Processes subscription events and updates the database.
 */
async function processSubscriptionEvent(payload: WebhookPayload): Promise<void> {
  const { meta, data } = payload;
  const eventName = meta.event_name;
  const userId = meta.custom_data?.user_id;
  const attributes = data.attributes;

  if (!userId) {
    throw new Error('No user_id found in webhook custom_data');
  }

  // Verify user exists
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });

  if (!user) {
    throw new Error(`User not found: ${userId}`);
  }

  // Find the plan for this variant, or auto-create if missing
  let plan = await db.query.plans.findFirst({
    where: eq(plans.variantId, attributes.variant_id),
  });

  if (!plan) {
    // Auto-create plan from webhook data to handle race conditions
    // (webhook arriving before plans are synced)
    console.log(`Auto-creating plan for variant: ${attributes.variant_id}`);
    const [newPlan] = await db
      .insert(plans)
      .values({
        variantId: attributes.variant_id,
        productId: attributes.product_id,
        productName: attributes.product_name,
        name: attributes.variant_name || attributes.product_name,
        price: '0', // Will be updated on next sync
        description: null,
      })
      .returning();
    plan = newPlan;
  }

  const lemonSqueezyId = data.id;
  const subscriptionData = {
    lemonSqueezyId,
    orderId: attributes.order_id,
    name: attributes.user_name,
    email: attributes.user_email,
    status: attributes.status,
    statusFormatted: attributes.status_formatted,
    renewsAt: attributes.renews_at ? new Date(attributes.renews_at) : null,
    endsAt: attributes.ends_at ? new Date(attributes.ends_at) : null,
    trialEndsAt: attributes.trial_ends_at ? new Date(attributes.trial_ends_at) : null,
    price: attributes.first_subscription_item?.price_id?.toString() ?? '0',
    isUsageBased: attributes.first_subscription_item?.is_usage_based ?? false,
    isPaused: attributes.pause !== null,
    subscriptionItemId: attributes.first_subscription_item?.id,
    userId,
    planId: plan.id,
    updatedAt: new Date(),
  };

  switch (eventName) {
    case 'subscription_created': {
      // Upsert subscription (handles duplicate webhooks)
      await db
        .insert(subscriptions)
        .values(subscriptionData)
        .onConflictDoUpdate({
          target: subscriptions.lemonSqueezyId,
          set: subscriptionData,
        });

      // Update user's subscription tier
      await db
        .update(users)
        .set({
          subscriptionTier: 'pro',
          subscriptionStatus: attributes.status,
          lemonSqueezyCustomerId: attributes.customer_id.toString(),
          lemonSqueezySubscriptionId: lemonSqueezyId,
          currentPeriodEnd: subscriptionData.renewsAt,
          isPaused: false,
        })
        .where(eq(users.id, userId));
      break;
    }

    case 'subscription_updated':
    case 'subscription_resumed': {
      // Upsert subscription
      await db
        .insert(subscriptions)
        .values(subscriptionData)
        .onConflictDoUpdate({
          target: subscriptions.lemonSqueezyId,
          set: subscriptionData,
        });

      // Update user based on status
      const isPro = attributes.status === 'active' || attributes.status === 'on_trial';
      await db
        .update(users)
        .set({
          subscriptionTier: isPro ? 'pro' : 'free',
          subscriptionStatus: attributes.status,
          currentPeriodEnd: subscriptionData.renewsAt,
          isPaused: attributes.pause !== null,
        })
        .where(eq(users.id, userId));
      break;
    }

    case 'subscription_paused': {
      // Update subscription status
      await db
        .update(subscriptions)
        .set({
          status: 'paused',
          isPaused: true,
          updatedAt: new Date(),
        })
        .where(eq(subscriptions.lemonSqueezyId, lemonSqueezyId));

      // Update user
      await db
        .update(users)
        .set({
          subscriptionStatus: 'paused',
          isPaused: true,
        })
        .where(eq(users.id, userId));
      break;
    }

    case 'subscription_cancelled': {
      // Update subscription status - user keeps Pro access until ends_at
      await db
        .update(subscriptions)
        .set({
          status: attributes.status,
          endsAt: attributes.ends_at ? new Date(attributes.ends_at) : null,
          updatedAt: new Date(),
        })
        .where(eq(subscriptions.lemonSqueezyId, lemonSqueezyId));

      // Update user status but keep Pro tier until subscription expires
      await db
        .update(users)
        .set({
          subscriptionStatus: 'cancelled',
          currentPeriodEnd: attributes.ends_at ? new Date(attributes.ends_at) : null,
        })
        .where(eq(users.id, userId));
      break;
    }

    case 'subscription_expired': {
      // Update subscription status
      await db
        .update(subscriptions)
        .set({
          status: 'expired',
          endsAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(subscriptions.lemonSqueezyId, lemonSqueezyId));

      // NOW downgrade user to free - subscription has actually ended
      await db
        .update(users)
        .set({
          subscriptionTier: 'free',
          subscriptionStatus: 'expired',
          isPaused: false,
          lemonSqueezySubscriptionId: null,
        })
        .where(eq(users.id, userId));
      break;
    }

    default:
      console.log(`Unhandled event type: ${eventName}`);
  }
}

export async function POST(req: NextRequest) {
  try {
    // Get raw body for signature verification
    const rawBody = await req.text();
    const signature = req.headers.get('x-signature') ?? '';

    // Verify signature
    if (!verifySignature(rawBody, signature)) {
      console.error('Invalid webhook signature');
      return NextResponse.json({ message: 'Invalid signature' }, { status: 401 });
    }

    // Parse payload
    const payload: WebhookPayload = JSON.parse(rawBody);
    const eventName = payload.meta.event_name;

    console.log(`Received webhook event: ${eventName}`);

    // Step 1: Store the raw event first (for reliability)
    const eventId = await storeWebhookEvent(eventName, payload);

    // Step 2: Process the event
    try {
      // Only process subscription events
      const subscriptionEvents: WebhookEventName[] = [
        'subscription_created',
        'subscription_updated',
        'subscription_cancelled',
        'subscription_expired',
        'subscription_resumed',
        'subscription_paused',
      ];

      if (subscriptionEvents.includes(eventName)) {
        await processSubscriptionEvent(payload);
      }

      // Mark event as successfully processed
      await markWebhookEventProcessed(eventId);
    } catch (processError) {
      // Mark event with error for later retry/debugging
      const errorMessage = processError instanceof Error ? processError.message : 'Unknown error';
      await markWebhookEventProcessed(eventId, errorMessage);
      console.error(`Error processing webhook event ${eventId}:`, processError);
      // Still return 200 to prevent Lemon Squeezy from retrying
    }

    return NextResponse.json({ message: 'Webhook received', eventId }, { status: 200 });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}