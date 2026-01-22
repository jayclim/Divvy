import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { emailPreferences, emailUnsubscribes } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { verifyUnsubscribeToken } from '@/lib/email';
import type { UnsubscribePayload, UnsubscribeType } from '@/lib/email/tokens';
import { checkRateLimit, getClientIp, getRateLimitHeaders, RATE_LIMIT_PRESETS } from '@/lib/rate-limit';

/**
 * One-click unsubscribe handler
 * GET /api/unsubscribe?token=xxx
 *
 * Supports:
 * - User unsubscribe (for Spliq account holders)
 * - Email unsubscribe (for non-users who received invitations)
 * - RFC 8058 one-click unsubscribe for email clients
 */
export async function GET(request: NextRequest) {
  // Rate limit: 20 requests per minute per IP
  const clientIp = getClientIp(request);
  const rateLimitResult = await checkRateLimit(`unsubscribe:${clientIp}`, RATE_LIMIT_PRESETS.standard);

  if (!rateLimitResult.success) {
    return new NextResponse(renderUnsubscribePage({
      success: false,
      message: 'Too many requests. Please try again in a few minutes.',
    }), {
      status: 429,
      headers: {
        'Content-Type': 'text/html',
        ...getRateLimitHeaders(rateLimitResult),
      },
    });
  }

  const token = request.nextUrl.searchParams.get('token');

  if (!token) {
    return new NextResponse(renderUnsubscribePage({
      success: false,
      message: 'Invalid unsubscribe link. Please check your email and try again.',
    }), {
      status: 400,
      headers: { 'Content-Type': 'text/html' },
    });
  }

  const payload = verifyUnsubscribeToken(token);

  if (!payload) {
    return new NextResponse(renderUnsubscribePage({
      success: false,
      message: 'This unsubscribe link has expired or is invalid. Please visit your account settings to manage notifications.',
    }), {
      status: 400,
      headers: { 'Content-Type': 'text/html' },
    });
  }

  try {
    await processUnsubscribe(payload);

    const message = payload.kind === 'email'
      ? `You've been unsubscribed from Spliq invitation emails. You won't receive any more invitations at this email address.`
      : getSuccessMessage(payload.type);

    return new NextResponse(renderUnsubscribePage({
      success: true,
      message,
      isNonUser: payload.kind === 'email',
    }), {
      status: 200,
      headers: { 'Content-Type': 'text/html' },
    });
  } catch (error) {
    console.error('[Unsubscribe] Error:', error);
    return new NextResponse(renderUnsubscribePage({
      success: false,
      message: 'Something went wrong. Please try again or visit your account settings.',
    }), {
      status: 500,
      headers: { 'Content-Type': 'text/html' },
    });
  }
}

/**
 * POST handler for RFC 8058 List-Unsubscribe-Post header support
 */
export async function POST(request: NextRequest) {
  // Rate limit: 20 requests per minute per IP
  const clientIp = getClientIp(request);
  const rateLimitResult = await checkRateLimit(`unsubscribe:${clientIp}`, RATE_LIMIT_PRESETS.standard);

  if (!rateLimitResult.success) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: getRateLimitHeaders(rateLimitResult) }
    );
  }

  const token = request.nextUrl.searchParams.get('token');

  if (!token) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 400 });
  }

  const payload = verifyUnsubscribeToken(token);

  if (!payload) {
    return NextResponse.json({ error: 'Expired or invalid token' }, { status: 400 });
  }

  try {
    await processUnsubscribe(payload);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Unsubscribe] Error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

/**
 * Process unsubscribe for both users and non-users
 */
async function processUnsubscribe(payload: UnsubscribePayload) {
  if (payload.kind === 'email') {
    // Non-user: add email to unsubscribe list
    await db
      .insert(emailUnsubscribes)
      .values({ email: payload.email.toLowerCase() })
      .onConflictDoNothing(); // Already unsubscribed

    console.log(`[Unsubscribe] Email ${payload.email} added to unsubscribe list`);
    return;
  }

  // User: update their preferences
  const { userId, type } = payload;

  const prefs = await db.query.emailPreferences.findFirst({
    where: eq(emailPreferences.userId, userId),
  });

  if (!prefs) {
    // Create with the specific type disabled
    const values: Record<string, unknown> = { userId };
    if (type === 'all') {
      values.invitations = false;
      values.expenseAdded = false;
      values.settlementReceived = false;
      values.memberActivity = false;
      values.digestFrequency = 'none';
    } else {
      values[type] = false;
    }
    await db.insert(emailPreferences).values(values as typeof emailPreferences.$inferInsert);
    return;
  }

  // Update existing preferences
  if (type === 'all') {
    await db
      .update(emailPreferences)
      .set({
        invitations: false,
        expenseAdded: false,
        settlementReceived: false,
        memberActivity: false,
        digestFrequency: 'none',
        updatedAt: new Date(),
      })
      .where(eq(emailPreferences.userId, userId));
  } else {
    await db
      .update(emailPreferences)
      .set({
        [type]: false,
        updatedAt: new Date(),
      })
      .where(eq(emailPreferences.userId, userId));
  }
}

function getSuccessMessage(type: UnsubscribeType): string {
  switch (type) {
    case 'all':
      return "You've been unsubscribed from all Spliq email notifications.";
    case 'invitations':
      return "You've been unsubscribed from group invitation emails.";
    case 'expenseAdded':
      return "You've been unsubscribed from expense notification emails.";
    case 'settlementReceived':
      return "You've been unsubscribed from settlement notification emails.";
    case 'memberActivity':
      return "You've been unsubscribed from member activity emails.";
    default:
      return "Your email preferences have been updated.";
  }
}

function renderUnsubscribePage(params: {
  success: boolean;
  message: string;
  isNonUser?: boolean;
}): string {
  const { success, message, isNonUser } = params;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${success ? 'Unsubscribed' : 'Error'} - Spliq</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif;
      background: #f6f9fc;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .container {
      background: white;
      border-radius: 12px;
      padding: 48px;
      max-width: 480px;
      width: 100%;
      text-align: center;
      box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
    }
    .icon {
      width: 64px;
      height: 64px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 24px;
      font-size: 32px;
    }
    .icon.success { background: #dcfce7; }
    .icon.error { background: #fee2e2; }
    h1 {
      color: #1a1a1a;
      font-size: 24px;
      font-weight: 600;
      margin-bottom: 12px;
    }
    p {
      color: #525f7f;
      font-size: 16px;
      line-height: 1.6;
      margin-bottom: 24px;
    }
    a {
      display: inline-block;
      background: #7c3aed;
      color: white;
      text-decoration: none;
      padding: 12px 24px;
      border-radius: 8px;
      font-weight: 500;
      transition: background 0.2s;
    }
    a:hover { background: #6d28d9; }
    .settings-link {
      display: block;
      margin-top: 16px;
      color: #7c3aed;
      background: transparent;
      padding: 0;
    }
    .settings-link:hover { background: transparent; text-decoration: underline; }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon ${success ? 'success' : 'error'}">
      ${success ? '✓' : '✕'}
    </div>
    <h1>${success ? 'Unsubscribed' : 'Something went wrong'}</h1>
    <p>${message}</p>
    ${isNonUser ? `
      <p style="font-size: 14px; color: #6b7280;">
        Changed your mind? Sign up for Spliq to manage your notification preferences.
      </p>
      <a href="${appUrl}/sign-up">Create an account</a>
    ` : `
      <a href="${appUrl}">Go to Spliq</a>
      <a href="${appUrl}/settings#notifications" class="settings-link">Manage notification settings</a>
    `}
  </div>
</body>
</html>
`;
}
