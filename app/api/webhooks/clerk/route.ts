import { Webhook } from 'svix';
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { anonymizeUser, syncUserFromClerk } from '@/lib/actions/user';

type ClerkWebhookEvent = {
  type: string;
  data: {
    id: string;
    email_addresses?: Array<{ email_address: string; id: string }>;
    primary_email_address_id?: string;
    first_name?: string | null;
    last_name?: string | null;
    image_url?: string | null;
    [key: string]: unknown;
  };
};

/**
 * Clerk Webhook Handler
 *
 * Handles user lifecycle events from Clerk.
 * Currently handles:
 * - user.deleted: Anonymizes user data and deletes receipt images
 * - user.updated: Syncs profile changes (name, email, avatar) to our database
 *
 * Setup:
 * 1. Go to Clerk Dashboard > Webhooks
 * 2. Create endpoint pointing to: https://your-domain.com/api/webhooks/clerk
 * 3. Select events: user.deleted, user.updated
 * 4. Copy the signing secret to CLERK_WEBHOOK_SECRET env var
 */
export async function POST(req: Request) {
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;

  if (!WEBHOOK_SECRET) {
    console.error('CLERK_WEBHOOK_SECRET is not set');
    return NextResponse.json(
      { error: 'Webhook secret not configured' },
      { status: 500 }
    );
  }

  // Get headers for verification
  const headerPayload = await headers();
  const svixId = headerPayload.get('svix-id');
  const svixTimestamp = headerPayload.get('svix-timestamp');
  const svixSignature = headerPayload.get('svix-signature');

  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json(
      { error: 'Missing svix headers' },
      { status: 400 }
    );
  }

  // Get the raw body
  const payload = await req.text();

  // Verify the webhook signature
  const wh = new Webhook(WEBHOOK_SECRET);
  let evt: ClerkWebhookEvent;

  try {
    evt = wh.verify(payload, {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature,
    }) as ClerkWebhookEvent;
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return NextResponse.json(
      { error: 'Invalid signature' },
      { status: 401 }
    );
  }

  // Handle the event
  const eventType = evt.type;
  console.log(`Received Clerk webhook: ${eventType}`);

  switch (eventType) {
    case 'user.deleted': {
      const userId = evt.data.id;
      console.log(`Processing user.deleted for user: ${userId}`);

      try {
        // Anonymize the user in our database and delete their receipt images
        // The user is already deleted from Clerk, so we just clean up our data
        await anonymizeUser(userId);
        console.log(`Successfully anonymized user: ${userId}`);
      } catch (error) {
        console.error(`Failed to anonymize user ${userId}:`, error);
        // Return 200 anyway to prevent Clerk from retrying
        // The error is logged for manual investigation
      }
      break;
    }

    case 'user.updated': {
      const userId = evt.data.id;
      console.log(`Processing user.updated for user: ${userId}`);

      try {
        // Extract primary email
        const primaryEmailId = evt.data.primary_email_address_id;
        const emailObj = evt.data.email_addresses?.find(e => e.id === primaryEmailId);
        const email = emailObj?.email_address;

        // Build full name from first/last
        const firstName = evt.data.first_name || '';
        const lastName = evt.data.last_name || '';
        const name = [firstName, lastName].filter(Boolean).join(' ') || undefined;

        // Sync profile changes to our database
        await syncUserFromClerk({
          userId,
          email,
          name,
          imageUrl: evt.data.image_url || undefined,
        });
        console.log(`Successfully synced user: ${userId}`);
      } catch (error) {
        console.error(`Failed to sync user ${userId}:`, error);
        // Return 200 anyway to prevent Clerk from retrying
      }
      break;
    }

    default:
      console.log(`Unhandled Clerk webhook event: ${eventType}`);
  }

  return NextResponse.json({ received: true }, { status: 200 });
}