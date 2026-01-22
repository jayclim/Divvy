# Webhook & Storage Setup Guide

This guide covers setting up Clerk webhooks and Supabase Storage for both **local development/testing** and **production** environments.

---

## Table of Contents

1. [Environment Variables Overview](#environment-variables-overview)
2. [Supabase Storage Setup](#supabase-storage-setup)
3. [Clerk Webhook Setup](#clerk-webhook-setup)
4. [Testing Your Setup](#testing-your-setup)

---

## Environment Variables Overview

You'll need these environment variables configured:

```bash
# Supabase (required for receipt image storage)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...        # Public anon key
SUPABASE_SERVICE_ROLE_KEY=eyJ...             # Service role key (server-side only)

# Clerk Webhook (required for user lifecycle events)
CLERK_WEBHOOK_SECRET=whsec_...               # From Clerk Dashboard
```

**File locations:**
- `.env.local` - Production/main environment
- `.env.test.local` - Test environment

---

## Supabase Storage Setup

### Step 1: Create a Supabase Project

**For Production:**
1. Go to [supabase.com](https://supabase.com) and sign in
2. Click **New Project**
3. Choose your organization and enter:
   - **Name:** `split-prod` (or your app name)
   - **Database Password:** Generate a strong password (save it!)
   - **Region:** Choose closest to your users
4. Click **Create new project** and wait for setup

**For Testing:**
- Create a separate project named `split-test` following the same steps
- This keeps test data isolated from production

### Step 2: Get Your API Keys

1. In your Supabase project, go to **Settings** → **API**
2. Copy these values:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role** key → `SUPABASE_SERVICE_ROLE_KEY`

⚠️ **Security Note:** The `service_role` key bypasses Row Level Security. Never expose it client-side.

### Step 3: Create the Storage Bucket

1. In Supabase Dashboard, go to **Storage** (left sidebar)
2. Click **New bucket**
3. Configure:
   - **Name:** `receipts`
   - **Public bucket:** ❌ **Disabled** (we use signed URLs for security)
   - **File size limit:** `5MB` (recommended for receipt images)
   - **Allowed MIME types:** `image/jpeg, image/png, image/webp, image/heic`
4. Click **Create bucket**

### Step 4: Storage Access Model

We use a **private bucket with signed URLs** for security:

- **Storage**: Images are stored in a private bucket (not publicly accessible)
- **Access**: Time-limited signed URLs (1 hour expiry) are generated on-demand
- **Benefits**:
  - URLs cannot be guessed or enumerated
  - Leaked URLs expire automatically
  - Receipt PII is protected

**No additional policies needed** - the service role key has full access for server-side operations.

### Step 5: Update Environment Variables

Add to `.env.local` (production):
```bash
NEXT_PUBLIC_SUPABASE_URL=https://abc123.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

Add to `.env.test.local` (testing):
```bash
NEXT_PUBLIC_SUPABASE_URL=https://xyz789.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## Clerk Webhook Setup

Clerk webhooks notify your app about user lifecycle events:
- **user.deleted**: Anonymizes user data and deletes receipt images (GDPR compliance)
- **user.updated**: Syncs profile changes (name, email, avatar) to your database

### Local Development Setup (with ngrok)

For local testing, you need a public URL. We use ngrok for this.

#### Step 1: Install and Configure ngrok

```bash
# Install ngrok (macOS)
brew install ngrok

# Sign up at https://dashboard.ngrok.com/signup
# Get your authtoken from https://dashboard.ngrok.com/get-started/your-authtoken

# Configure ngrok with your token
ngrok config add-authtoken YOUR_AUTHTOKEN
```

#### Step 2: Start Your Dev Server and ngrok

**Terminal 1 - Start your app:**
```bash
npm run dev        # or npm run dev:test for test environment
```

**Terminal 2 - Start ngrok:**
```bash
npm run ngrok:setup
# or manually:
ngrok http 3000
```

ngrok will output a URL like:
```
https://a1b2-123-45-678-90.ngrok-free.app
```

#### Step 3: Configure Clerk Webhook (Development)

1. Go to [Clerk Dashboard](https://dashboard.clerk.com)
2. Select your **Development** instance
3. Navigate to **Webhooks** in the sidebar
4. Click **Add Endpoint**
5. Configure:
   - **Endpoint URL:** `https://YOUR-NGROK-URL.ngrok-free.app/api/webhooks/clerk`
   - **Subscribe to events:** Select `user.deleted` and `user.updated`
6. Click **Create**
7. Copy the **Signing Secret** (starts with `whsec_`)

#### Step 4: Add Webhook Secret to Environment

Add to `.env.test.local`:
```bash
CLERK_WEBHOOK_SECRET=whsec_abc123...
```

⚠️ **Note:** ngrok URLs change each time you restart. You'll need to update the webhook URL in Clerk Dashboard when this happens. Consider [ngrok paid plans](https://ngrok.com/pricing) for static URLs.

### Production Setup

#### Step 1: Configure Clerk Webhook (Production)

1. Go to [Clerk Dashboard](https://dashboard.clerk.com)
2. Select your **Production** instance
3. Navigate to **Webhooks** in the sidebar
4. Click **Add Endpoint**
5. Configure:
   - **Endpoint URL:** `https://yourdomain.com/api/webhooks/clerk`
   - **Subscribe to events:** Select `user.deleted` and `user.updated`
6. Click **Create**
7. Copy the **Signing Secret**

#### Step 2: Add to Production Environment

Add to your production environment (Vercel, etc.):
```bash
CLERK_WEBHOOK_SECRET=whsec_production123...
```

**On Vercel:**
1. Go to your project → **Settings** → **Environment Variables**
2. Add `CLERK_WEBHOOK_SECRET` with your production signing secret
3. Set it for **Production** environment only

### Webhook Events Reference

Currently handled events:

| Event | Description | Handler Action |
|-------|-------------|----------------|
| `user.deleted` | User deleted their Clerk account | Anonymizes user data, cancels subscription, deletes receipt images |
| `user.updated` | User updated their profile in Clerk | Syncs name, email, and avatar to database |

To add more events:
1. Update the webhook endpoint in Clerk Dashboard to subscribe to new events
2. Add handlers in `app/api/webhooks/clerk/route.ts`

---

## Testing Your Setup

### Test Supabase Storage

1. Start your dev server:
   ```bash
   npm run dev:test
   ```

2. Navigate to a group page
3. Click the AI Receipt Scanner button
4. Upload a receipt image
5. Verify:
   - The scan completes successfully
   - Check Supabase Dashboard → Storage → `receipts` bucket
   - You should see a new file under `{userId}/{timestamp}.jpg`

### Test Clerk Webhook

1. Start ngrok and your dev server
2. Update the webhook URL in Clerk Dashboard if needed
3. Go to Clerk Dashboard → **Webhooks** → Your endpoint
4. Click **Testing** tab

**Test user.deleted:**
1. Select `user.deleted` event
2. Click **Send test event**
3. Check your terminal logs for:
   ```
   Received Clerk webhook: user.deleted
   Processing user.deleted for user: test_user_id
   Successfully anonymized user: test_user_id
   ```

**Test user.updated:**
1. Select `user.updated` event
2. Click **Send test event**
3. Check your terminal logs for:
   ```
   Received Clerk webhook: user.updated
   Processing user.updated for user: test_user_id
   Successfully synced user: test_user_id
   ```

### Verify Database Logs

After a successful receipt scan, check the `ai_scan_logs` table:

```bash
npm run db:studio
```

Look for entries with:
- `status: 'success'`
- `receipt_image_url` populated with Supabase URL
- `raw_response` containing the parsed receipt data

---

## Troubleshooting

### Supabase Storage Issues

**"Missing Supabase environment variables"**
- Check that `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set
- Restart your dev server after adding env vars

**"Failed to upload receipt image: new row violates row-level security"**
- Check bucket policies allow INSERT for the service role
- Verify you're using the `service_role` key, not the `anon` key

**Images not accessible (404)**
- Verify the bucket is set to **Public**
- Check the SELECT policy allows public access

### Clerk Webhook Issues

**"Missing svix headers" or "Invalid signature"**
- Verify `CLERK_WEBHOOK_SECRET` is correct
- Make sure you're using the secret from the correct environment (dev vs prod)

**Webhook not triggering**
- Verify ngrok is running and URL is updated in Clerk Dashboard
- Check Clerk Dashboard → Webhooks → Logs for delivery attempts
- Ensure event types are subscribed (`user.deleted`, `user.updated`)

**ngrok URL expired**
- Free ngrok URLs change on restart
- Update the webhook URL in Clerk Dashboard
- Consider ngrok paid plans for static subdomains

---

## Security Checklist

- [ ] `SUPABASE_SERVICE_ROLE_KEY` is only used server-side (never exposed to client)
- [ ] `CLERK_WEBHOOK_SECRET` is kept secret and environment-specific
- [ ] Production and test environments use separate Supabase projects
- [ ] Production and test environments use separate Clerk webhook secrets
- [ ] Storage bucket has appropriate policies (no unrestricted uploads)
- [ ] Webhook signature verification is enabled (using svix)
