import { Resend } from 'resend';

// Initialize Resend client
// Will be undefined if RESEND_API_KEY is not set (development without email)
export const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

// Email configuration
export const emailConfig = {
  from: process.env.RESEND_FROM_EMAIL || 'notifications@spliq.app',
  replyTo: 'support@spliq.app',
  appUrl: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
} as const;

// Check if email is enabled
export function isEmailEnabled(): boolean {
  return resend !== null;
}
