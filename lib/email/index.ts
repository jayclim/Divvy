// Re-export everything for easy imports

// Client
export { resend, emailConfig, isEmailEnabled } from './client';

// Send functions
export { sendEmail, sendBulkEmails } from './send';
export type { SendEmailOptions, SendEmailResult } from './send';

// Tokens
export {
  generateUnsubscribeToken,
  generateEmailUnsubscribeToken,
  verifyUnsubscribeToken,
  getUnsubscribeUrl,
  getEmailUnsubscribeUrl,
} from './tokens';
export type { UnsubscribePayload, UnsubscribeType } from './tokens';

// Notification functions
export {
  getUserEmailPreferences,
  getUserEmail,
  isEmailUnsubscribed,
  sendGroupInvitationEmail,
  queueDigestNotification,
  queueExpenseNotifications,
  queueSettlementNotification,
} from './notifications';

// Templates (for direct use if needed)
export { BaseLayout } from './templates/BaseLayout';
export { GroupInvitation } from './templates/GroupInvitation';
export { DailyDigest } from './templates/DailyDigest';
