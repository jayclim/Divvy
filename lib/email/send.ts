import { resend, emailConfig, isEmailEnabled } from './client';
import type { ReactElement } from 'react';

export type SendEmailOptions = {
  to: string | string[];
  subject: string;
  react: ReactElement;
  replyTo?: string;
  tags?: { name: string; value: string }[];
};

export type SendEmailResult = {
  success: boolean;
  id?: string;
  error?: string;
};

/**
 * Send an email using Resend
 * Logs errors but doesn't throw - emails should not block main operations
 */
export async function sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
  // Skip if email is not configured
  if (!isEmailEnabled()) {
    console.log('[Email] Skipping email send - Resend not configured');
    console.log('[Email] Would have sent:', {
      to: options.to,
      subject: options.subject,
    });
    return { success: true, id: 'skipped-no-resend' };
  }

  try {
    const { data, error } = await resend!.emails.send({
      from: emailConfig.from,
      to: options.to,
      subject: options.subject,
      react: options.react,
      replyTo: options.replyTo || emailConfig.replyTo,
      tags: options.tags,
    });

    if (error) {
      console.error('[Email] Resend API error:', error);
      return { success: false, error: error.message };
    }

    console.log('[Email] Sent successfully:', {
      id: data?.id,
      to: options.to,
      subject: options.subject,
    });

    return { success: true, id: data?.id };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Email] Failed to send:', errorMessage);
    return { success: false, error: errorMessage };
  }
}

/**
 * Send emails to multiple recipients individually
 * Useful for personalized emails where each recipient gets their own unsubscribe link
 */
export async function sendBulkEmails(
  emails: SendEmailOptions[]
): Promise<SendEmailResult[]> {
  const results = await Promise.all(emails.map(sendEmail));

  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  if (failed > 0) {
    console.warn(`[Email] Bulk send: ${successful} succeeded, ${failed} failed`);
  }

  return results;
}
