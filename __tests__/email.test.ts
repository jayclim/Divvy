import { cleanTestData } from '@/scripts/clean-test-data';
import { seedTestData } from '@/scripts/seed-test-data';
import { db, client } from '@/lib/db';
import { users, emailPreferences, emailUnsubscribes } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import {
  generateUnsubscribeToken,
  generateEmailUnsubscribeToken,
  verifyUnsubscribeToken,
  getUnsubscribeUrl,
  getEmailUnsubscribeUrl,
} from '@/lib/email/tokens';
import {
  getUserEmailPreferences,
  isEmailUnsubscribed,
} from '@/lib/email/notifications';

describe('Email Notifications Integration Tests', () => {
  jest.setTimeout(60000);

  beforeAll(async () => {
    console.log('🔄 Resetting test database...');
    try {
      await cleanTestData(true);
      await seedTestData(true);
      console.log('✅ Test database reset complete.');
    } catch (error) {
      console.error('❌ Failed to reset test database:', error);
      throw error;
    }
  });

  afterAll(async () => {
    await client.end();
  });

  describe('Unsubscribe Tokens', () => {
    it('should generate and verify user unsubscribe token', () => {
      const userId = 'test_user_123';
      const token = generateUnsubscribeToken(userId, 'invitations');

      expect(token).toBeDefined();
      expect(token.split('.').length).toBe(2); // payload.signature format

      const payload = verifyUnsubscribeToken(token);
      expect(payload).not.toBeNull();
      expect(payload?.kind).toBe('user');
      if (payload?.kind === 'user') {
        expect(payload.userId).toBe(userId);
        expect(payload.type).toBe('invitations');
      }
    });

    it('should generate and verify email unsubscribe token', () => {
      const email = 'test@example.com';
      const token = generateEmailUnsubscribeToken(email);

      expect(token).toBeDefined();

      const payload = verifyUnsubscribeToken(token);
      expect(payload).not.toBeNull();
      expect(payload?.kind).toBe('email');
      if (payload?.kind === 'email') {
        expect(payload.email).toBe(email.toLowerCase());
        expect(payload.type).toBe('invitations');
      }
    });

    it('should reject tampered tokens', () => {
      const token = generateUnsubscribeToken('user_123', 'all');
      const tamperedToken = token.slice(0, -5) + 'xxxxx'; // Modify signature

      const payload = verifyUnsubscribeToken(tamperedToken);
      expect(payload).toBeNull();
    });

    it('should reject malformed tokens', () => {
      expect(verifyUnsubscribeToken('')).toBeNull();
      expect(verifyUnsubscribeToken('invalid')).toBeNull();
      expect(verifyUnsubscribeToken('no.dots.here.invalid')).toBeNull();
    });

    it('should generate correct unsubscribe URLs', () => {
      const userId = 'user_123';
      const url = getUnsubscribeUrl(userId, 'expenseAdded');

      expect(url).toContain('/api/unsubscribe?token=');
      expect(url).toContain('http');
    });

    it('should generate correct email unsubscribe URLs', () => {
      const email = 'test@example.com';
      const url = getEmailUnsubscribeUrl(email);

      expect(url).toContain('/api/unsubscribe?token=');
      expect(url).toContain('http');
    });
  });

  describe('Email Preferences', () => {
    it('should have seeded email preferences correctly', async () => {
      // Find Alice (has custom preferences)
      const alice = await db.query.users.findFirst({
        where: eq(users.email, 'alice@test.com'),
      });
      expect(alice).toBeDefined();

      const alicePrefs = await db.query.emailPreferences.findFirst({
        where: eq(emailPreferences.userId, alice!.id),
      });

      expect(alicePrefs).toBeDefined();
      expect(alicePrefs?.invitations).toBe(true);
      expect(alicePrefs?.expenseAdded).toBe(true);
      expect(alicePrefs?.digestFrequency).toBe('daily');
    });

    it('should have seeded disabled preferences for Dave', async () => {
      const dave = await db.query.users.findFirst({
        where: eq(users.email, 'dave@test.com'),
      });
      expect(dave).toBeDefined();

      const davePrefs = await db.query.emailPreferences.findFirst({
        where: eq(emailPreferences.userId, dave!.id),
      });

      expect(davePrefs).toBeDefined();
      expect(davePrefs?.invitations).toBe(false);
      expect(davePrefs?.expenseAdded).toBe(false);
      expect(davePrefs?.digestFrequency).toBe('none');
    });

    it('should return default preferences for users without custom settings', async () => {
      // Eve has no preferences entry, should get defaults
      const eve = await db.query.users.findFirst({
        where: eq(users.email, 'eve@test.com'),
      });
      expect(eve).toBeDefined();

      // getUserEmailPreferences creates defaults if none exist
      const evePrefs = await getUserEmailPreferences(eve!.id);

      expect(evePrefs).toBeDefined();
      expect(evePrefs?.invitations).toBe(true); // Default is true
      expect(evePrefs?.expenseAdded).toBe(true);
      expect(evePrefs?.digestFrequency).toBe('daily');
    });
  });

  describe('Email Unsubscribe List', () => {
    it('should have seeded unsubscribed emails', async () => {
      const unsubscribed = await db.query.emailUnsubscribes.findFirst({
        where: eq(emailUnsubscribes.email, 'unsubscribed@example.com'),
      });

      expect(unsubscribed).toBeDefined();
    });

    it('should detect unsubscribed emails', async () => {
      const isUnsubscribed = await isEmailUnsubscribed('unsubscribed@example.com');
      expect(isUnsubscribed).toBe(true);
    });

    it('should not flag subscribed emails', async () => {
      const isUnsubscribed = await isEmailUnsubscribed('subscribed@example.com');
      expect(isUnsubscribed).toBe(false);
    });

    it('should handle case-insensitive email lookup', async () => {
      const isUnsubscribed = await isEmailUnsubscribed('UNSUBSCRIBED@EXAMPLE.COM');
      // Note: isEmailUnsubscribed converts to lowercase, so this should match
      expect(isUnsubscribed).toBe(true);
    });
  });

  describe('Email Preference Scenarios', () => {
    it('Bob should only receive invitation emails', async () => {
      const bob = await db.query.users.findFirst({
        where: eq(users.email, 'bob@test.com'),
      });
      expect(bob).toBeDefined();

      const bobPrefs = await db.query.emailPreferences.findFirst({
        where: eq(emailPreferences.userId, bob!.id),
      });

      expect(bobPrefs?.invitations).toBe(true);
      expect(bobPrefs?.expenseAdded).toBe(false);
      expect(bobPrefs?.settlementReceived).toBe(false);
      expect(bobPrefs?.memberActivity).toBe(false);
    });

    it('Charlie should have weekly digest enabled', async () => {
      const charlie = await db.query.users.findFirst({
        where: eq(users.email, 'charlie@test.com'),
      });
      expect(charlie).toBeDefined();

      const charliePrefs = await db.query.emailPreferences.findFirst({
        where: eq(emailPreferences.userId, charlie!.id),
      });

      expect(charliePrefs?.digestFrequency).toBe('weekly');
    });
  });
});
