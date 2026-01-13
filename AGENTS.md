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
  - `supabase/`: Supabase client configuration.
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

## Key Commands
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

# Database
DATABASE_URL=postgresql://...

# Lemon Squeezy (Payments)
LEMONSQUEEZY_API_KEY=your_api_key
LEMONSQUEEZY_WEBHOOK_SECRET=your_webhook_signing_secret
LEMONSQUEEZY_STORE_ID=your_store_id
NEXT_PUBLIC_LEMONSQUEEZY_VARIANT_ID=your_variant_id
```

## Code Quality
- **Linting**: `npm run lint`
- **Formatting**: Use Prettier (if configured) or follows standard rules.

## Development Guidelines
- **Styling**: Use Tailwind utility classes.
- **Components**: Prefer small, reusable components.
- **State**: Use Server Components where possible; Client Components for interactivity.
- **Type Safety**: strict TypeScript usage. Define interfaces for data models.
