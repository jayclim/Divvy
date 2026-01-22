/**
 * Data Access Layer - Barrel Export
 * 
 * Re-exports all query modules for convenient importing.
 * 
 * Usage:
 *   import { getUserById, getGroupById } from '@/lib/db/queries';
 */

// User queries
export {
    getUserById,
    getUsersByIds,
    getUserByEmail,
    getUserSubscription,
    getUserEmailPreferences,
    isUserPro,
} from './users';

// Group queries
export {
    getGroupById,
    getGroupIdsForUser,
    isUserMemberOfGroup,
    getUserRoleInGroup,
    getGroupMembers,
    getGroupWithMembers,
    getGroupPendingInvitations,
    getGroupCardsForUser,
} from './groups';

// Expense queries
export {
    getExpenseById,
    getExpensesByGroupId,
    getExpensesWithSplitsByGroupId,
    getExpenseItems,
    getRecentExpenses,
} from './expenses';

// Subscription queries
export {
    getSubscriptionByLemonSqueezyId,
    getActiveSubscriptionByUserId,
    getLatestSubscriptionByUserId,
    getPlanByVariantId,
    getPlanById,
    getAllPlans,
    getUnprocessedWebhookEvents,
    isUserOnPaidTier,
} from './subscriptions';
