# Project "Spliq" Documentation for AI Agents

## Project Overview
This is a Next.js 15 application for expense splitting (similar to Splitwise). It uses the App Router, TypeScript, Tailwind CSS, and Drizzle ORM with Postgres.

## Tech Stack
- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS, Radix UI (via Shadcn/ui patterns), Lucide React.
- **Database**: PostgreSQL
- **ORM**: Drizzle ORM
- **Authentication**: Clerk
- **Payments**: Lemon Squeezy (subscription billing)
- **Storage**: Supabase Storage (receipt images)
- **AI**: Google Gemini (receipt scanning)
- **Email**: Resend (transactional emails)
- **Testing**: Jest, React Testing Library.

## Architecture & Directory Structure

### Core Directories
- **`app/`**: Next.js App Router pages and layouts.
  - `(main)/`: Main authenticated application routes.
  - `api/`: Next.js API Routes (HTTP endpoints).
  - `auth/`: Authentication pages.
- **`api/`**: **Service Layer**. Contains the core business logic and domain services.
  - `auth.ts`, `balances.ts`, `expenses.ts`, `groups.ts`, `messages.ts`.
  - **Rule**: Business logic should reside here, not in UI components or API route handlers directly.
- **`lib/`**: Shared utilities and configurations.
  - `db/`: Database configuration and Drizzle schema (`schema.ts`).
  - `actions/`: Server Actions for form submissions and mutations.
  - `supabase/`: Supabase Storage for receipt images (private bucket with signed URLs).
  - `ai/`: AI integrations (Gemini for receipt scanning).
  - `email/`: Email notifications (Resend integration, templates, unsubscribe tokens).
  - `constants/`: App-wide constants (scan limits, etc.).
- **`components/`**: Reusable React components.
- **`scripts/`**: Utility scripts for testing (seeding, cleaning data).

### Data Flow
1. **UI Components** trigger **Server Actions** (`lib/actions`) or call **API Routes** (`app/api`).
2. **Server Actions/API Routes** call into the **Service Layer** (`api/`).
3. **Service Layer** interacts with the **Database** via Drizzle ORM (`lib/db`).

## Database & Testing
- **ORM**: Drizzle is used for all DB interactions.
- **Migrations**: Managed via `drizzle-kit`.
- **Testing**:
  - Uses a dedicated test database (configured in `.env.test.local`).
  - `npm test` runs Jest.
  - Scripts in `scripts/` handle test data seeding and cleanup (`test:seed`, `test:clean`).

## Key Commands (Test Environment Focused)
- **Start Dev (Test DB)**: `npm run dev:test` (Runs app connected to `.env.test.local`)
- **Run Tests**: `npm test` (Runs Jest tests)
- **Setup Test DB**: `npm run test:setup` (Migrates and seeds test DB)
- **Reset Test DB**: `npm run test:reset` (Cleans, migrates, and seeds test DB)
- **Generate Migration (Test)**: `npm run test:db:generate`
- **Run Migration (Test)**: `npm run test:db:migrate`
- **Drop Test DB**: `npm run test:db:drop`

## Environment Variables
- **Production Testing**: `.env.local` - Used with `npm run dev` for testing against production services (real Clerk, real Lemon Squeezy, production DB)
- **Development/Test Environment**: `.env.test.local` - Used with `npm run dev:test` for local development with test data, ngrok webhook testing, and all `test:*` commands

### Required Environment Variables
```bash
# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
CLERK_SECRET_KEY=sk_...
CLERK_WEBHOOK_SECRET=whsec_...  # For user lifecycle webhooks

# Database
DATABASE_URL=postgresql://...

# Lemon Squeezy (Payments)
LEMONSQUEEZY_API_KEY=your_api_key
LEMONSQUEEZY_WEBHOOK_SECRET=your_webhook_signing_secret
LEMONSQUEEZY_STORE_ID=your_store_id
NEXT_PUBLIC_LEMONSQUEEZY_VARIANT_ID=your_variant_id

# Supabase Storage (Receipt Images)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...  # Server-side only, never expose to client

# Google Gemini (AI Receipt Scanning)
GEMINI_API_KEY=your_gemini_api_key

# Resend (Email)
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=Spliq <notifications@yourdomain.com>
NEXT_PUBLIC_APP_URL=https://yourdomain.com  # Used for email links
```

## Code Quality
- **Linting**: `npm run lint`
- **Formatting**: Use Prettier (if configured) or follows standard rules.

## Development Guidelines
- **Styling**: Use Tailwind utility classes.
- **Components**: Prefer small, reusable components.
- **State**: Use Server Components where possible; Client Components for interactivity.
- **Type Safety**: strict TypeScript usage. Define interfaces for data models.

## Key Features

### AI Receipt Scanning
- Uses Google Gemini to extract merchant, date, total, and line items from receipt images
- Images stored in Supabase Storage (private bucket with signed URLs for security)
- Usage tracked per user with monthly limits (free: 3 scans, pro: 50 scans)
- Scan logs stored in `ai_scan_logs` table for debugging/analytics
- Key files:
  - `lib/ai/gemini.ts` - Gemini API integration
  - `lib/supabase/storage.ts` - Image upload with signed URLs
  - `lib/actions/expenses.ts` - `processReceiptAction` server action
  - `components/AIExpenseModal.tsx` - UI for scanning receipts

### Supabase Storage
- **Bucket**: `receipts` (private, not public)
- **Security Model**: Time-limited signed URLs (1 hour expiry)
- **Path Format**: `{userId}/{timestamp}.{extension}`
- **Functions**:
  - `uploadReceiptImage()` - Returns storage path (not URL)
  - `getReceiptSignedUrl()` - Generates temporary access URL
  - `deleteReceiptImage()` - Deletes single image
  - `deleteAllUserReceipts()` - GDPR deletion

### Clerk Webhooks
Webhook endpoint: `/api/webhooks/clerk`

| Event | Handler |
|-------|---------|
| `user.deleted` | Anonymizes user data, cancels subscription, deletes receipt images |
| `user.updated` | Syncs profile changes (name, email, avatar) to database |

Setup instructions in `docs/SETUP_WEBHOOKS_AND_STORAGE.md`.

### Lemon Squeezy Webhooks
Webhook endpoint: `/api/webhooks/lemon-squeezy`

Handles subscription lifecycle events (created, updated, cancelled, etc.).

### Group Invitations
- Invitation email contains link to `/groups/{id}` (the group page)
- **Auto-accept flow**: When an invited user accesses the group page, `getGroup()` automatically accepts pending invitations matching their email
- Supports ghost users: expenses can be assigned to invited members before they join, then merged on acceptance
- Invitation flow:
  1. Owner invites by email → invitation record created, email sent
  2. Recipient clicks link → redirected to sign up (if new) or sign in
  3. After auth, redirected back to `/groups/{id}`
  4. `getGroup()` detects pending invitation → auto-accepts → user sees group immediately

### Email Notifications
- Uses Resend for transactional emails with React Email templates
- Supports immediate notifications (invitations) and batched digest notifications
- CAN-SPAM/GDPR compliant with one-click unsubscribe (RFC 8058)
- User preferences stored in `email_preferences` table
- Non-user unsubscribes tracked in `email_unsubscribes` table (for invitation recipients without accounts)
- Pending notifications queued in `pending_notifications` table for daily/weekly digest

**Key files:**
- `lib/email/client.ts` - Resend client configuration
- `lib/email/tokens.ts` - HMAC-signed unsubscribe tokens (30-day expiry)
- `lib/email/send.ts` - Low-level email sending with unsubscribe headers
- `lib/email/notifications.ts` - High-level notification functions
- `lib/email/templates/` - React Email templates (BaseLayout, GroupInvitation, DailyDigest)
- `lib/actions/notifications.ts` - Server actions for user preferences
- `app/api/unsubscribe/route.ts` - One-click unsubscribe handler
- `app/api/cron/digest/route.ts` - Cron endpoint for processing digest emails
- `components/NotificationSettings.tsx` - User notification preferences UI

**Database tables:**
- `email_preferences` - Per-user notification settings (invitations, expenseAdded, etc.)
- `pending_notifications` - Queue for batched digest notifications
- `email_unsubscribes` - Global email blocklist for non-users

## Additional Documentation
- `docs/SETUP_WEBHOOKS_AND_STORAGE.md` - Detailed setup for Supabase Storage and Clerk webhooks
- `docs/EMAIL_NOTIFICATIONS.md` - Email notification system setup and testing guide
