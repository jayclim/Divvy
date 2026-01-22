import { db } from '@/lib/db';
import { emailPreferences, pendingNotifications, users, emailUnsubscribes } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { sendEmail } from './send';
import { getUnsubscribeUrl, getEmailUnsubscribeUrl } from './tokens';
import { emailConfig } from './client';
import { GroupInvitation } from './templates/GroupInvitation';

/**
 * Get user's email preferences, creating default if not exists
 */
export async function getUserEmailPreferences(userId: string) {
  let prefs = await db.query.emailPreferences.findFirst({
    where: eq(emailPreferences.userId, userId),
  });

  if (!prefs) {
    // Create default preferences
    const [newPrefs] = await db
      .insert(emailPreferences)
      .values({ userId })
      .returning();
    prefs = newPrefs;
  }

  return prefs;
}

/**
 * Get user's email address from Clerk-synced user data
 * Returns null if user has no email or is a ghost user
 */
export async function getUserEmail(userId: string): Promise<string | null> {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: {
      email: true,
      isGhost: true,
    },
  });

  if (!user || user.isGhost || !user.email) {
    return null;
  }

  return user.email;
}

/**
 * Check if an email address is on the unsubscribe list
 * Used for non-users who received invitations
 */
export async function isEmailUnsubscribed(email: string): Promise<boolean> {
  const unsubscribe = await db.query.emailUnsubscribes.findFirst({
    where: eq(emailUnsubscribes.email, email.toLowerCase()),
  });
  return !!unsubscribe;
}

// =================================
//    IMMEDIATE NOTIFICATIONS
// =================================

/**
 * Send a group invitation email
 * This is sent immediately (not batched)
 */
export async function sendGroupInvitationEmail(params: {
  recipientEmail: string;
  recipientUserId?: string; // If they have an account
  inviterName: string;
  groupName: string;
  groupId: number;
}) {
  const { recipientEmail, recipientUserId, inviterName, groupName, groupId } = params;

  // Check preferences if user has an account
  if (recipientUserId) {
    const prefs = await getUserEmailPreferences(recipientUserId);
    if (!prefs.invitations) {
      console.log('[Email] User has disabled invitation emails:', recipientUserId);
      return { success: true, skipped: true, reason: 'user_disabled' };
    }
  } else {
    // Check if this email is on the unsubscribe list (non-users)
    const unsubscribed = await isEmailUnsubscribed(recipientEmail);
    if (unsubscribed) {
      console.log('[Email] Email is on unsubscribe list:', recipientEmail);
      return { success: true, skipped: true, reason: 'email_unsubscribed' };
    }
  }

  const inviteUrl = `${emailConfig.appUrl}/groups/${groupId}`;
  // Use proper unsubscribe URL - email-based for non-users, user-based for users
  const unsubscribeUrl = recipientUserId
    ? getUnsubscribeUrl(recipientUserId, 'invitations')
    : getEmailUnsubscribeUrl(recipientEmail);

  const result = await sendEmail({
    to: recipientEmail,
    subject: `${inviterName} invited you to join ${groupName} on Spliq`,
    react: GroupInvitation({
      inviterName,
      groupName,
      inviteUrl,
      unsubscribeUrl,
    }),
    tags: [
      { name: 'category', value: 'invitation' },
      { name: 'group_id', value: groupId.toString() },
    ],
  });

  return result;
}

// =================================
//    DIGEST NOTIFICATIONS
// =================================

/**
 * Queue a notification for digest delivery
 * These are batched and sent daily/weekly based on user preferences
 */
export async function queueDigestNotification(params: {
  userId: string;
  type: 'expense_added' | 'settlement_received' | 'member_joined' | 'member_left';
  groupId: number;
  data: {
    description?: string;
    amount?: string;
    actorName?: string;
    groupName?: string;
    [key: string]: unknown;
  };
}) {
  const { userId, type, groupId, data } = params;

  // Check if user has this notification type enabled
  const prefs = await getUserEmailPreferences(userId);

  // Map notification type to preference field
  const preferenceMap = {
    expense_added: prefs.expenseAdded,
    settlement_received: prefs.settlementReceived,
    member_joined: prefs.memberActivity,
    member_left: prefs.memberActivity,
  };

  if (!preferenceMap[type]) {
    console.log(`[Email] User disabled ${type} notifications:`, userId);
    return { queued: false, reason: 'user_disabled' };
  }

  // If user wants instant notifications, we could send immediately
  // For now, we always queue for digest (can be enhanced later)
  if (prefs.digestFrequency === 'none') {
    console.log('[Email] User disabled all digest notifications:', userId);
    return { queued: false, reason: 'digest_disabled' };
  }

  // Queue the notification
  await db.insert(pendingNotifications).values({
    userId,
    type,
    groupId,
    data,
  });

  console.log('[Email] Queued notification:', { userId, type, groupId });
  return { queued: true };
}

/**
 * Queue expense notification for all split participants
 * Excludes the person who created the expense
 */
export async function queueExpenseNotifications(params: {
  expenseId: number;
  creatorId: string;
  groupId: number;
  groupName: string;
  description: string;
  amount: string;
  creatorName: string;
  splitUserIds: string[];
}) {
  const { creatorId, groupId, groupName, description, amount, creatorName, splitUserIds } = params;

  // Notify all users in the split except the creator
  const usersToNotify = splitUserIds.filter(id => id !== creatorId);

  const results = await Promise.all(
    usersToNotify.map(userId =>
      queueDigestNotification({
        userId,
        type: 'expense_added',
        groupId,
        data: {
          description,
          amount,
          actorName: creatorName,
          groupName,
        },
      })
    )
  );

  const queued = results.filter(r => r.queued).length;
  console.log(`[Email] Queued expense notifications: ${queued}/${usersToNotify.length}`);

  return { queued, total: usersToNotify.length };
}

/**
 * Queue settlement notification for the payee
 */
export async function queueSettlementNotification(params: {
  payerId: string;
  payeeId: string;
  groupId: number;
  groupName: string;
  amount: string;
  payerName: string;
}) {
  const { payeeId, groupId, groupName, amount, payerName } = params;

  return queueDigestNotification({
    userId: payeeId,
    type: 'settlement_received',
    groupId,
    data: {
      amount,
      actorName: payerName,
      groupName,
    },
  });
}
