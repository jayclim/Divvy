import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { emailPreferences, pendingNotifications, users, groups } from '@/lib/db/schema';
import { eq, and, inArray, lte } from 'drizzle-orm';
import { sendEmail, getUnsubscribeUrl, emailConfig } from '@/lib/email';
import { DailyDigest, type DigestItem } from '@/lib/email/templates/DailyDigest';

/**
 * Cron job to process pending notifications and send digests
 *
 * This endpoint should be called by a cron service (e.g., Vercel Cron, GitHub Actions)
 * Recommended schedule: Daily at 9:00 AM in your primary timezone
 *
 * POST /api/cron/digest
 * Requires: CRON_SECRET header for authentication
 */
export async function POST(request: NextRequest) {
  // Verify cron secret to prevent unauthorized access
  const cronSecret = request.headers.get('x-cron-secret');
  const expectedSecret = process.env.CRON_SECRET;

  if (expectedSecret && cronSecret !== expectedSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await processDigests();
    return NextResponse.json(result);
  } catch (error) {
    console.error('[Cron] Digest processing error:', error);
    return NextResponse.json(
      { error: 'Failed to process digests' },
      { status: 500 }
    );
  }
}

/**
 * Process pending notifications and send digests
 */
async function processDigests() {
  console.log('[Cron] Starting digest processing...');

  // Get all users with pending notifications who have digest enabled
  const usersWithPending = await db
    .selectDistinct({ userId: pendingNotifications.userId })
    .from(pendingNotifications)
    .where(eq(pendingNotifications.processed, false));

  if (usersWithPending.length === 0) {
    console.log('[Cron] No pending notifications to process');
    return { processed: 0, sent: 0 };
  }

  const userIds = usersWithPending.map(u => u.userId);

  // Get user preferences and emails
  const userPrefs = await db.query.emailPreferences.findMany({
    where: inArray(emailPreferences.userId, userIds),
  });

  const userEmails = await db.query.users.findMany({
    where: and(
      inArray(users.id, userIds),
      eq(users.isGhost, false)
    ),
    columns: {
      id: true,
      email: true,
      name: true,
    },
  });

  // Create lookup maps
  const prefsMap = new Map(userPrefs.map(p => [p.userId, p]));
  const emailMap = new Map(userEmails.map(u => [u.id, { email: u.email, name: u.name }]));

  // Get all group names for reference
  const allNotifications = await db.query.pendingNotifications.findMany({
    where: and(
      inArray(pendingNotifications.userId, userIds),
      eq(pendingNotifications.processed, false)
    ),
  });

  const groupIds = [...new Set(allNotifications.map(n => n.groupId).filter(Boolean))] as number[];
  const groupsData = await db.query.groups.findMany({
    where: inArray(groups.id, groupIds),
    columns: { id: true, name: true },
  });
  const groupMap = new Map(groupsData.map(g => [g.id, g.name]));

  let sent = 0;
  const processedIds: number[] = [];

  // Process each user
  for (const userId of userIds) {
    const prefs = prefsMap.get(userId);
    const userInfo = emailMap.get(userId);

    // Skip if user has no email or digest is disabled
    if (!userInfo?.email) {
      console.log(`[Cron] Skipping user ${userId}: no email`);
      continue;
    }

    if (prefs?.digestFrequency === 'none') {
      console.log(`[Cron] Skipping user ${userId}: digest disabled`);
      continue;
    }

    // Get this user's pending notifications
    const userNotifications = allNotifications.filter(n => n.userId === userId);

    if (userNotifications.length === 0) continue;

    // Build digest items
    const items: DigestItem[] = userNotifications.map(n => ({
      type: n.type,
      groupName: n.groupId ? (groupMap.get(n.groupId) || 'Unknown Group') : 'Unknown Group',
      groupId: n.groupId || 0,
      description: (n.data as Record<string, unknown>).description as string || '',
      amount: (n.data as Record<string, unknown>).amount as string | undefined,
      actorName: (n.data as Record<string, unknown>).actorName as string || 'Someone',
      timestamp: n.createdAt.toISOString(),
    }));

    // Send digest email
    const result = await sendEmail({
      to: userInfo.email,
      subject: `Your Spliq Update: ${items.length} new notification${items.length === 1 ? '' : 's'}`,
      react: DailyDigest({
        userName: userInfo.name || 'there',
        items,
        appUrl: emailConfig.appUrl,
        unsubscribeUrl: getUnsubscribeUrl(userId, 'all'),
      }),
      tags: [
        { name: 'category', value: 'digest' },
        { name: 'count', value: items.length.toString() },
      ],
    });

    if (result.success) {
      sent++;
      processedIds.push(...userNotifications.map(n => n.id));
    }
  }

  // Mark notifications as processed
  if (processedIds.length > 0) {
    await db
      .update(pendingNotifications)
      .set({
        processed: true,
        processedAt: new Date(),
      })
      .where(inArray(pendingNotifications.id, processedIds));
  }

  console.log(`[Cron] Digest processing complete: ${sent} emails sent, ${processedIds.length} notifications processed`);

  return {
    processed: processedIds.length,
    sent,
    usersProcessed: userIds.length,
  };
}

/**
 * GET handler for testing/health check
 */
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    endpoint: '/api/cron/digest',
    description: 'Processes pending notifications and sends daily digest emails',
    note: 'Call POST with x-cron-secret header to trigger',
  });
}
