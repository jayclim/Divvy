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
  - `email/`: Email sending utilities (Resend).
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

## Additional Documentation
- `docs/SETUP_WEBHOOKS_AND_STORAGE.md` - Detailed setup for Supabase Storage and Clerk webhooks
