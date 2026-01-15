import {
  timestamp,
  pgTable,
  text,
  primaryKey,
  integer,
  serial,
  boolean,
  pgEnum,
  decimal,
  jsonb,
} from 'drizzle-orm/pg-core';
import type { AdapterAccount } from '@auth/core/adapters';
import { relations } from 'drizzle-orm';

// =================================
//          ENUMS
// =================================

export const roleEnum = pgEnum('role', ['owner', 'admin', 'member']);
export const invitationStatusEnum = pgEnum('invitation_status', ['pending', 'accepted', 'declined']);
export const subscriptionStatusEnum = pgEnum('subscription_status_enum', [
  'on_trial',
  'active',
  'paused',
  'past_due',
  'unpaid',
  'cancelled',
  'expired',
]);

// =================================
//          TABLES
// =================================

export const users = pgTable('users', {
  id: text('id').primaryKey(), // Changed from uuid to text for Clerk ID
  name: text('name'),
  email: text('email').notNull().unique(),
  emailVerified: timestamp('emailVerified', { mode: 'date', withTimezone: true }),
  image: text('image'),
  avatarUrl: text('avatar_url'),
  isGhost: boolean('is_ghost').default(false).notNull(),
  // Subscription fields
  subscriptionTier: text('subscription_tier', { enum: ['free', 'pro'] }).default('free').notNull(),
  subscriptionStatus: text('subscription_status').default('active').notNull(),
  isPaused: boolean('is_paused').default(false).notNull(),
  lemonSqueezyCustomerId: text('lemon_squeezy_customer_id'),
  lemonSqueezySubscriptionId: text('lemon_squeezy_subscription_id'),
  currentPeriodEnd: timestamp('current_period_end', { withTimezone: true }),
  // Methods for smart settlements
  paymentMethods: jsonb('payment_methods').$type<Record<string, string>>().default({}),
});

export const accounts = pgTable(
  'accounts',
  {
    userId: text('userId') // Changed from uuid
      .notNull()
      .references(() => users.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    type: text('type').$type<AdapterAccount['type']>().notNull(),
    provider: text('provider').notNull(),
    providerAccountId: text('providerAccountId').notNull(),
    refresh_token: text('refresh_token'),
    access_token: text('access_token'),
    expires_at: integer('expires_at'),
    token_type: text('token_type'),
    scope: text('scope'),
    id_token: text('id_token'),
    session_state: text('session_state'),
  },
  (account) => ({
    compoundKey: primaryKey({
      columns: [account.provider, account.providerAccountId],
    }),
  })
);

export const sessions = pgTable('sessions', {
  sessionToken: text('sessionToken').notNull().primaryKey(),
  userId: text('userId') // Changed from uuid
    .notNull()
    .references(() => users.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
  expires: timestamp('expires', { mode: 'date', withTimezone: true }).notNull(),
});

export const verificationTokens = pgTable(
  'verification_tokens',
  {
    identifier: text('identifier').notNull(),
    token: text('token').notNull(),
    expires: timestamp('expires', { mode: 'date', withTimezone: true }).notNull(),
  },
  (vt) => ({
    compoundKey: primaryKey({ columns: [vt.identifier, vt.token] }),
  })
);

export const groups = pgTable('groups', {
  id: serial('id').primaryKey(),
  name: text('name').notNull().unique(),
  description: text('description'),
  coverImageUrl: text('cover_image_url'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  archived: boolean('archived').default(false).notNull(),
});

export const usersToGroups = pgTable(
  'users_to_groups',
  {
    userId: text('user_id') // Changed from uuid
      .notNull()
      .references(() => users.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    groupId: integer('group_id')
      .notNull()
      .references(() => groups.id, { onDelete: 'cascade' }),
    role: roleEnum('role').default('member').notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.userId, t.groupId] }),
  })
);

export const expenses = pgTable('expenses', {
  id: serial('id').primaryKey(),
  groupId: integer('group_id')
    .notNull()
    .references(() => groups.id, { onDelete: 'cascade' }),
  description: text('description').notNull(),
  amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),
  paidById: text('paid_by_id') // Changed from uuid
    .notNull()
    .references(() => users.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
  date: timestamp('date', { withTimezone: true }).notNull(),
  category: text('category'),
  receiptUrl: text('receipt_url'),
  settled: boolean('settled').default(false).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const expenseSplits = pgTable(
  'expense_splits',
  {
    id: serial('id').primaryKey(),
    expenseId: integer('expense_id')
      .notNull()
      .references(() => expenses.id, { onDelete: 'cascade' }),
    userId: text('user_id') // Changed from uuid
      .notNull()
      .references(() => users.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),
  }
  // Remove the table configuration function entirely since we're using 'id' as primary key
);

export const settlements = pgTable('settlements', {
  id: serial('id').primaryKey(),
  groupId: integer('group_id')
    .notNull()
    .references(() => groups.id, { onDelete: 'cascade' }),
  payerId: text('payer_id') // Changed from uuid
    .notNull()
    .references(() => users.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
  payeeId: text('payee_id') // Changed from uuid
    .notNull()
    .references(() => users.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
  amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),
  date: timestamp('date', { withTimezone: true }).defaultNow().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// type AnyPlaceholder = Placeholder<string, unknown>;

export const messages = pgTable('messages', {
  id: serial('id').primaryKey(),
  groupId: integer('group_id')
    .notNull()
    .references(() => groups.id, { onDelete: 'cascade' }),
  userId: text('user_id') // Changed from uuid
    .notNull()
    .references(() => users.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
  content: text('content').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const invitations = pgTable('invitations', {
  id: serial('id').primaryKey(),
  groupId: integer('group_id')
    .notNull()
    .references(() => groups.id, { onDelete: 'cascade' }),
  email: text('email').notNull(),
  invitedById: text('invited_by_id') // Changed from uuid
    .notNull()
    .references(() => users.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
  ghostUserId: text('ghost_user_id') // Changed from uuid
    .references(() => users.id, { onDelete: 'set null', onUpdate: 'cascade' }),
  status: invitationStatusEnum('status').default('pending').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const activityLogs = pgTable('activity_logs', {
  id: serial('id').primaryKey(),
  groupId: integer('group_id')
    .notNull()
    .references(() => groups.id, { onDelete: 'cascade' }),
  action: text('action').notNull(), // 'member_added', 'member_removed'
  entityId: text('entity_id').notNull(), // ID of the user being added/removed
  actorId: text('actor_id').notNull(), // ID of the user performing the action
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// =================================
//        BILLING TABLES
// =================================

// Plans table - synced from Lemon Squeezy products/variants
export const plans = pgTable('plans', {
  id: serial('id').primaryKey(),
  productId: integer('product_id').notNull(), // Lemon Squeezy product ID
  productName: text('product_name'),
  variantId: integer('variant_id').notNull().unique(), // Lemon Squeezy variant ID
  name: text('name').notNull(),
  description: text('description'),
  price: text('price').notNull(), // Store as string to avoid floating point issues
  isUsageBased: boolean('is_usage_based').default(false),
  interval: text('interval'), // 'month', 'year', null for one-time
  intervalCount: integer('interval_count').default(1),
  trialInterval: text('trial_interval'),
  trialIntervalCount: integer('trial_interval_count'),
  sort: integer('sort'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// Subscriptions table - links users to their Lemon Squeezy subscriptions
export const subscriptions = pgTable('subscriptions', {
  id: serial('id').primaryKey(),
  lemonSqueezyId: text('lemon_squeezy_id').notNull().unique(), // Lemon Squeezy subscription ID
  orderId: integer('order_id').notNull(), // Lemon Squeezy order ID
  name: text('name').notNull(),
  email: text('email').notNull(),
  status: subscriptionStatusEnum('status').notNull(),
  statusFormatted: text('status_formatted'),
  renewsAt: timestamp('renews_at', { withTimezone: true }),
  endsAt: timestamp('ends_at', { withTimezone: true }),
  trialEndsAt: timestamp('trial_ends_at', { withTimezone: true }),
  price: text('price').notNull(),
  isUsageBased: boolean('is_usage_based').default(false),
  isPaused: boolean('is_paused').default(false),
  subscriptionItemId: integer('subscription_item_id'),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
  planId: integer('plan_id')
    .notNull()
    .references(() => plans.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// Webhook events table - stores raw webhook payloads for debugging and reprocessing
export const webhookEvents = pgTable('webhook_events', {
  id: serial('id').primaryKey(),
  eventName: text('event_name').notNull(),
  processed: boolean('processed').default(false).notNull(),
  body: jsonb('body').notNull(),
  processingError: text('processing_error'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// =================================
//          RELATIONS
// =================================

export const usersRelations = relations(users, ({ many }) => ({
  groups: many(usersToGroups),
  expenses: many(expenses),
  expenseSplits: many(expenseSplits),
  messages: many(messages),
  subscriptions: many(subscriptions),
}));

export const groupsRelations = relations(groups, ({ many }) => ({
  members: many(usersToGroups),
  expenses: many(expenses),
  messages: many(messages),
}));

export const usersToGroupsRelations = relations(usersToGroups, ({ one }) => ({
  group: one(groups, {
    fields: [usersToGroups.groupId],
    references: [groups.id],
  }),
  user: one(users, {
    fields: [usersToGroups.userId],
    references: [users.id],
  }),
}));

export const expensesRelations = relations(expenses, ({ one, many }) => ({
  group: one(groups, {
    fields: [expenses.groupId],
    references: [groups.id],
  }),
  paidBy: one(users, {
    fields: [expenses.paidById],
    references: [users.id],
  }),
  splits: many(expenseSplits),
}));

export const expenseSplitsRelations = relations(expenseSplits, ({ one }) => ({
  expense: one(expenses, {
    fields: [expenseSplits.expenseId],
    references: [expenses.id],
  }),
  user: one(users, {
    fields: [expenseSplits.userId],
    references: [users.id],
  }),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  group: one(groups, {
    fields: [messages.groupId],
    references: [groups.id],
  }),
  user: one(users, {
    fields: [messages.userId],
    references: [users.id],
  }),
}));

export const invitationsRelations = relations(invitations, ({ one }) => ({
  group: one(groups, {
    fields: [invitations.groupId],
    references: [groups.id],
  }),
  invitedBy: one(users, {
    fields: [invitations.invitedById],
    references: [users.id],
  }),
  ghostUser: one(users, {
    fields: [invitations.ghostUserId],
    references: [users.id],
  }),
}));

export const settlementsRelations = relations(settlements, ({ one }) => ({
  group: one(groups, {
    fields: [settlements.groupId],
    references: [groups.id],
  }),
  payer: one(users, {
    fields: [settlements.payerId],
    references: [users.id],
  }),
  payee: one(users, {
    fields: [settlements.payeeId],
    references: [users.id],
  }),
}));

export const activityLogsRelations = relations(activityLogs, ({ one }) => ({
  group: one(groups, {
    fields: [activityLogs.groupId],
    references: [groups.id],
  }),
  entity: one(users, {
    fields: [activityLogs.entityId],
    references: [users.id],
  }),
  actor: one(users, {
    fields: [activityLogs.actorId],
    references: [users.id],
  }),
}));

export const plansRelations = relations(plans, ({ many }) => ({
  subscriptions: many(subscriptions),
}));

export const subscriptionsRelations = relations(subscriptions, ({ one }) => ({
  user: one(users, {
    fields: [subscriptions.userId],
    references: [users.id],
  }),
  plan: one(plans, {
    fields: [subscriptions.planId],
    references: [plans.id],
  }),
}));

// =================================
//          TYPE EXPORTS
// =================================

export type NewSettlement = typeof settlements.$inferInsert;
export type NewUser = typeof users.$inferInsert;
export type NewGroup = typeof groups.$inferInsert;
export type NewExpense = typeof expenses.$inferInsert;
export type NewExpenseSplit = typeof expenseSplits.$inferInsert;
export type NewMessage = typeof messages.$inferInsert;
export type NewInvitation = typeof invitations.$inferInsert;
export type NewActivityLog = typeof activityLogs.$inferInsert;
export type NewPlan = typeof plans.$inferInsert;
export type Plan = typeof plans.$inferSelect;
export type NewSubscription = typeof subscriptions.$inferInsert;
export type Subscription = typeof subscriptions.$inferSelect;
export type NewWebhookEvent = typeof webhookEvents.$inferInsert;
export type WebhookEvent = typeof webhookEvents.$inferSelect;