import crypto from 'crypto';

// Secret key for signing tokens - MUST be set in environment
const TOKEN_SECRET = process.env.CLERK_SECRET_KEY;

function getTokenSecret(): string {
  if (!TOKEN_SECRET) {
    throw new Error('CLERK_SECRET_KEY environment variable is required for token signing');
  }
  return TOKEN_SECRET;
}

// Token expiration time (30 days)
const TOKEN_EXPIRY_DAYS = 30;

export type UnsubscribeType = 'all' | 'invitations' | 'expenseAdded' | 'settlementReceived' | 'memberActivity';

// For authenticated users (have an account)
export type UserUnsubscribePayload = {
  kind: 'user';
  userId: string;
  type: UnsubscribeType;
  exp: number;
};

// For non-users (received invitation but don't have account)
export type EmailUnsubscribePayload = {
  kind: 'email';
  email: string;
  type: 'invitations'; // Non-users can only unsubscribe from invitations
  exp: number;
};

export type UnsubscribePayload = UserUnsubscribePayload | EmailUnsubscribePayload;

/**
 * Generate a signed unsubscribe token for a user
 * Uses HMAC-SHA256 for signing to prevent tampering
 */
export function generateUnsubscribeToken(
  userId: string,
  type: UnsubscribeType = 'all'
): string {
  const payload: UserUnsubscribePayload = {
    kind: 'user',
    userId,
    type,
    exp: Date.now() + TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
  };

  return signPayload(payload);
}

/**
 * Generate a signed unsubscribe token for an email (non-user)
 * Only supports unsubscribing from invitations
 */
export function generateEmailUnsubscribeToken(email: string): string {
  const payload: EmailUnsubscribePayload = {
    kind: 'email',
    email: email.toLowerCase(),
    type: 'invitations',
    exp: Date.now() + TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
  };

  return signPayload(payload);
}

/**
 * Sign a payload and return the token
 */
function signPayload(payload: UnsubscribePayload): string {
  const payloadString = JSON.stringify(payload);
  const payloadBase64 = Buffer.from(payloadString).toString('base64url');

  const signature = crypto
    .createHmac('sha256', getTokenSecret())
    .update(payloadBase64)
    .digest('base64url');

  return `${payloadBase64}.${signature}`;
}

/**
 * Verify and decode an unsubscribe token
 * Returns null if invalid or expired
 */
export function verifyUnsubscribeToken(token: string): UnsubscribePayload | null {
  try {
    const [payloadBase64, signature] = token.split('.');

    if (!payloadBase64 || !signature) {
      return null;
    }

    // Verify signature
    const expectedSignature = crypto
      .createHmac('sha256', getTokenSecret())
      .update(payloadBase64)
      .digest('base64url');

    if (signature !== expectedSignature) {
      return null;
    }

    // Decode payload
    const payloadString = Buffer.from(payloadBase64, 'base64url').toString('utf-8');
    const payload = JSON.parse(payloadString) as UnsubscribePayload;

    // Check expiration
    if (payload.exp < Date.now()) {
      return null;
    }

    // Handle legacy tokens (without 'kind' field) - treat as user tokens
    if (!('kind' in payload)) {
      const legacyPayload = payload as unknown as { userId: string; type: UnsubscribeType; exp: number };
      return {
        kind: 'user',
        userId: legacyPayload.userId,
        type: legacyPayload.type,
        exp: legacyPayload.exp,
      };
    }

    return payload;
  } catch {
    return null;
  }
}

/**
 * Generate the full unsubscribe URL for a user
 */
export function getUnsubscribeUrl(
  userId: string,
  type: UnsubscribeType = 'all'
): string {
  const token = generateUnsubscribeToken(userId, type);
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  return `${baseUrl}/api/unsubscribe?token=${encodeURIComponent(token)}`;
}

/**
 * Generate the full unsubscribe URL for an email (non-user)
 */
export function getEmailUnsubscribeUrl(email: string): string {
  const token = generateEmailUnsubscribeToken(email);
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  return `${baseUrl}/api/unsubscribe?token=${encodeURIComponent(token)}`;
}
