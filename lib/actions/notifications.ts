'use server';

import { db } from '@/lib/db';
import { emailPreferences } from '@/lib/db/schema';
import { auth } from '@clerk/nextjs/server';
import { syncUser } from '@/lib/auth/sync';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

export type NotificationPreferences = {
  invitations: boolean;
  expenseAdded: boolean;
  settlementReceived: boolean;
  memberActivity: boolean;
  digestFrequency: 'instant' | 'daily' | 'weekly' | 'none';
};

/**
 * Get the current user's notification preferences
 */
export async function getNotificationPreferences(): Promise<NotificationPreferences | null> {
  const { userId } = await auth();
  if (!userId) return null;

  const user = await syncUser();
  if (!user) return null;

  const prefs = await db.query.emailPreferences.findFirst({
    where: eq(emailPreferences.userId, user.id),
  });

  // Return defaults if no preferences set
  if (!prefs) {
    return {
      invitations: true,
      expenseAdded: true,
      settlementReceived: true,
      memberActivity: true,
      digestFrequency: 'daily',
    };
  }

  return {
    invitations: prefs.invitations,
    expenseAdded: prefs.expenseAdded,
    settlementReceived: prefs.settlementReceived,
    memberActivity: prefs.memberActivity,
    digestFrequency: prefs.digestFrequency,
  };
}

/**
 * Update the current user's notification preferences
 */
export async function updateNotificationPreferences(
  preferences: Partial<NotificationPreferences>
): Promise<{ success: boolean; error?: string }> {
  const { userId } = await auth();
  if (!userId) {
    return { success: false, error: 'Not authenticated' };
  }

  const user = await syncUser();
  if (!user) {
    return { success: false, error: 'User not found' };
  }

  try {
    // Check if preferences exist
    const existing = await db.query.emailPreferences.findFirst({
      where: eq(emailPreferences.userId, user.id),
    });

    if (existing) {
      // Update existing
      await db
        .update(emailPreferences)
        .set({
          ...preferences,
          updatedAt: new Date(),
        })
        .where(eq(emailPreferences.userId, user.id));
    } else {
      // Create new
      await db.insert(emailPreferences).values({
        userId: user.id,
        invitations: preferences.invitations ?? true,
        expenseAdded: preferences.expenseAdded ?? true,
        settlementReceived: preferences.settlementReceived ?? true,
        memberActivity: preferences.memberActivity ?? true,
        digestFrequency: preferences.digestFrequency ?? 'daily',
      });
    }

    revalidatePath('/settings');
    return { success: true };
  } catch (error) {
    console.error('[Notifications] Failed to update preferences:', error);
    return { success: false, error: 'Failed to update preferences' };
  }
}

/**
 * Disable all email notifications for the current user
 */
export async function disableAllNotifications(): Promise<{ success: boolean; error?: string }> {
  return updateNotificationPreferences({
    invitations: false,
    expenseAdded: false,
    settlementReceived: false,
    memberActivity: false,
    digestFrequency: 'none',
  });
}

/**
 * Enable all email notifications with default settings
 */
export async function enableAllNotifications(): Promise<{ success: boolean; error?: string }> {
  return updateNotificationPreferences({
    invitations: true,
    expenseAdded: true,
    settlementReceived: true,
    memberActivity: true,
    digestFrequency: 'daily',
  });
}
