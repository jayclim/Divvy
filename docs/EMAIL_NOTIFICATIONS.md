# Email Notifications Setup Guide

This guide covers setting up the Resend email service for both test and production environments.

## Overview

Spliq uses [Resend](https://resend.com) for transactional emails with the following features:
- Group invitation emails (sent immediately)
- Expense/settlement notifications (batched into daily digest)
- One-click unsubscribe (RFC 8058 compliant)
- User notification preferences

## Environment Variables

Add these to your `.env.local` (production) or `.env.test.local` (development):

```bash
# Resend Configuration
RESEND_API_KEY=re_...                    # Your Resend API key
RESEND_FROM_EMAIL=Spliq <notifications@yourdomain.com>  # Verified sender
NEXT_PUBLIC_APP_URL=https://yourdomain.com  # Base URL for email links
```

## Setup Instructions

### 1. Create a Resend Account

1. Go to [resend.com](https://resend.com) and create an account
2. Navigate to **API Keys** and create a new key
3. Copy the key (starts with `re_`)

### 2. Verify Your Domain (Production)

For production emails:
1. Go to **Domains** in Resend dashboard
2. Add your domain (e.g., `yourdomain.com`)
3. Add the required DNS records (SPF, DKIM, DMARC)
4. Wait for verification (usually a few minutes)

### 3. Test Environment Setup

For local development and testing, you have two options:

**Option A: Use Resend Test Mode (Recommended)**
- Use the same API key but send to `@resend.dev` addresses
- Emails appear in the Resend dashboard but aren't actually delivered
- Example: `test@resend.dev`

**Option B: Use Real Emails**
- Send to your own email addresses
- Useful for testing the full email flow

### 4. Configure Environment Variables

**For `.env.test.local` (development):**
```bash
RESEND_API_KEY=re_your_api_key
RESEND_FROM_EMAIL=Spliq <onboarding@resend.dev>  # Use Resend's test domain
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

**For `.env.local` (production):**
```bash
RESEND_API_KEY=re_your_production_api_key
RESEND_FROM_EMAIL=Spliq <notifications@yourdomain.com>
NEXT_PUBLIC_APP_URL=https://yourdomain.com
```

## Group Invitation Flow

The invitation email contains a direct link to the group page (`/groups/{id}`). The system handles both new and existing users seamlessly:

### For New Users (Not Yet Signed Up)
1. User receives email with "Accept Invitation" button linking to `/groups/{id}`
2. Click link → Clerk middleware redirects to sign-up (preserving return URL)
3. User creates account
4. Clerk redirects back to `/groups/{id}`
5. `getGroup()` detects pending invitation matching their email → **auto-accepts**
6. User sees the group immediately (no extra steps needed)

### For Existing Users
1. User receives email with link to `/groups/{id}`
2. Click link → if not logged in, redirected to sign-in
3. After auth, redirected back to `/groups/{id}`
4. `getGroup()` auto-accepts the invitation
5. User sees the group

### Ghost User Merging
If expenses were assigned to the invited member before they joined (via ghost user):
- Ghost user's paid expenses are transferred to the real user
- Ghost user's expense splits are transferred to the real user
- Ghost user is removed from the group and deleted

### Key Implementation
The auto-accept logic is in `getGroup()` ([lib/actions/groups.ts](../lib/actions/groups.ts)):
- Checks for pending invitation matching user's email and group ID
- Handles ghost user merging if applicable
- Adds user to group as member
- Updates invitation status to 'accepted'

## Testing Email Functionality

### Test Invitation Emails

1. Start the dev server: `npm run dev:test`
2. Create a group and invite a user by email
3. Check Resend dashboard for the sent email
4. If using a real email address, check your inbox

### Test Invitation Auto-Accept

1. Invite a new email address to a group
2. Sign out or use incognito
3. Click the invitation link from the email
4. Sign up with the invited email address
5. After signup, you should land directly in the group (auto-accepted)

### Test Unsubscribe Flow

1. Send a test invitation email
2. Open the email and click the "Unsubscribe" link
3. Verify you see the success page
4. Check the database:
   - For users: `email_preferences` table should be updated
   - For non-users: `email_unsubscribes` table should have a new entry

### Test Notification Preferences

1. Log in as a test user
2. Go to Settings > Notification Settings
3. Toggle various notification types
4. Verify changes in `email_preferences` table

## Database Tables

### `email_preferences`
Stores per-user notification settings:
- `invitations` - Receive group invitation emails
- `expenseAdded` - Receive expense notification emails
- `settlementReceived` - Receive settlement notification emails
- `memberActivity` - Receive member join/leave notifications
- `digestFrequency` - 'instant', 'daily', 'weekly', or 'none'

### `pending_notifications`
Queue for batched notifications (daily/weekly digest):
- `userId` - Recipient user ID
- `type` - Notification type
- `groupId` - Related group
- `data` - JSON payload with notification details

### `email_unsubscribes`
Global blocklist for non-users who received invitation emails and unsubscribed.

## Architecture

```
lib/email/
├── client.ts           # Resend client and config
├── index.ts            # Public exports
├── notifications.ts    # High-level notification functions
├── send.ts             # Low-level email sending
├── tokens.ts           # Unsubscribe token generation/verification
└── templates/
    ├── BaseLayout.tsx      # Shared email layout
    ├── DailyDigest.tsx     # Digest email template
    └── GroupInvitation.tsx # Invitation email template
```

## API Endpoints

### `GET/POST /api/unsubscribe?token=xxx`
One-click unsubscribe handler. Supports both browser clicks (GET) and RFC 8058 email client unsubscribe (POST).

### `GET /api/cron/digest`
Cron endpoint for processing pending notifications into daily digest emails. Should be called once daily (e.g., via Vercel Cron or external scheduler).

## Security Considerations

1. **Unsubscribe Tokens**: HMAC-SHA256 signed with 30-day expiry
2. **Rate Limiting**: Unsubscribe endpoint rate-limited to prevent abuse
3. **Email Validation**: Non-existent emails gracefully skipped
4. **CLERK_SECRET_KEY**: Used for token signing (already required for auth)

## Troubleshooting

### Emails Not Sending

1. Check Resend dashboard for errors
2. Verify API key is correct
3. Check `RESEND_FROM_EMAIL` is from a verified domain
4. Look for errors in server logs

### Unsubscribe Link Not Working

1. Verify `NEXT_PUBLIC_APP_URL` is correct
2. Check token hasn't expired (30-day limit)
3. Look for rate limit errors (429 responses)

### Missing Notification Preferences

Default preferences are created automatically when first accessed. If issues persist, check the `getUserEmailPreferences()` function in `lib/email/notifications.ts`.
