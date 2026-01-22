/**
 * Centralized Type Exports for Spliq Database
 * 
 * This file re-exports all database types from schema.ts and defines
 * domain-specific composite types used across the application.
 * 
 * Import from here instead of directly from schema.ts for better organization.
 */

// =================================
//     RE-EXPORT SCHEMA TYPES
// =================================

// Core entity types
export type {
    User,
    NewUser,
    Group,
    NewGroup,
    UserToGroup,
    NewUserToGroup,
    Expense,
    NewExpense,
    ExpenseSplit,
    NewExpenseSplit,
    ExpenseItem,
    NewExpenseItem,
    ItemAssignment,
    NewItemAssignment,
    Settlement,
    NewSettlement,
    Message,
    NewMessage,
    Invitation,
    NewInvitation,
    ActivityLog,
    NewActivityLog,
} from './schema';

// Billing types
export type {
    Plan,
    NewPlan,
    Subscription,
    NewSubscription,
    WebhookEvent,
    NewWebhookEvent,
} from './schema';

// Email types
export type {
    EmailPreferences,
    NewEmailPreferences,
    EmailUnsubscribe,
    NewEmailUnsubscribe,
    PendingNotification,
    NewPendingNotification,
} from './schema';

// AI types
export type {
    AiScanLog,
    NewAiScanLog,
} from './schema';

// Auth types
export type {
    Account,
    NewAccount,
    Session,
    NewSession,
    VerificationToken,
    NewVerificationToken,
} from './schema';

// =================================
//     COMPOSITE / DOMAIN TYPES
// =================================

import type { User, Group, Expense, ExpenseSplit, ExpenseItem, ItemAssignment } from './schema';

/**
 * A group member with their role and user details
 */
export interface GroupMember {
    id: string;
    name: string | null;
    email: string;
    avatarUrl: string | null;
    role: 'owner' | 'admin' | 'member';
    joinedAt: Date;
    isGhost: boolean;
}

/**
 * Group with its members populated
 */
export interface GroupWithMembers extends Group {
    members: GroupMember[];
}

/**
 * Expense with payer details populated
 */
export interface ExpenseWithPayer extends Expense {
    paidBy: Pick<User, 'id' | 'name' | 'avatarUrl'>;
}

/**
 * Expense with full split and item details
 */
export interface ExpenseWithDetails extends Expense {
    paidBy: Pick<User, 'id' | 'name' | 'avatarUrl'>;
    splits: (ExpenseSplit & {
        user: Pick<User, 'id' | 'name' | 'avatarUrl'>;
    })[];
    items?: (ExpenseItem & {
        assignments: (ItemAssignment & {
            user: Pick<User, 'id' | 'name'>;
        })[];
    })[];
}

/**
 * Balance data for a user within a group
 */
export interface UserBalance {
    userId: string;
    userName: string;
    userAvatar: string | null;
    netBalance: number;
    owesTo: { userId: string; userName: string; amount: number }[];
    owedBy: { userId: string; userName: string; amount: number }[];
}

/**
 * Pending invitation with inviter details
 */
export interface PendingInvitation {
    id: number;
    email: string;
    status: 'pending' | 'accepted' | 'declined';
    invitedBy: {
        name: string | null;
        avatarUrl: string | null;
    };
    ghostUser?: {
        name: string | null;
    };
    createdAt: Date;
}

/**
 * Group card data for dashboard display
 */
export interface GroupCardData {
    id: number;
    name: string;
    description: string | null;
    coverImageUrl: string | null;
    members: Pick<GroupMember, 'id' | 'name' | 'avatarUrl'>[];
    balance: number;
    unreadCount: number;
    recentActivity: string | null;
}

/**
 * User subscription status
 */
export interface UserSubscriptionStatus {
    tier: 'free' | 'pro';
    isActive: boolean;
    isPaused: boolean;
    currentPeriodEnd: Date | null;
}
