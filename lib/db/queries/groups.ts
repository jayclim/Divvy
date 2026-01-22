/**
 * Group Queries - Data Access Layer
 * 
 * Contains all database queries related to groups.
 * These are pure data-fetching functions with no auth checks.
 * Auth should be handled at the action/route level.
 */

import { db } from '@/lib/db';
import {
    groups,
    usersToGroups,
    users,
    expenses,
    settlements,
    activityLogs,
    invitations
} from '@/lib/db/schema';
import { eq, inArray, and, desc } from 'drizzle-orm';
import type { Group, GroupMember, GroupCardData, GroupWithMembers, PendingInvitation } from '@/lib/db/types';

/**
 * Get a group by ID
 */
export async function getGroupById(groupId: number): Promise<Group | null> {
    const group = await db.query.groups.findFirst({
        where: eq(groups.id, groupId),
    });
    return group ?? null;
}

/**
 * Get group IDs that a user is a member of
 */
export async function getGroupIdsForUser(userId: string): Promise<number[]> {
    const memberships = await db.query.usersToGroups.findMany({
        where: eq(usersToGroups.userId, userId),
        columns: { groupId: true },
    });
    return memberships.map(m => m.groupId);
}

/**
 * Check if a user is a member of a group
 */
export async function isUserMemberOfGroup(
    userId: string,
    groupId: number
): Promise<boolean> {
    const membership = await db.query.usersToGroups.findFirst({
        where: and(
            eq(usersToGroups.userId, userId),
            eq(usersToGroups.groupId, groupId)
        ),
    });
    return !!membership;
}

/**
 * Get a user's role in a group
 */
export async function getUserRoleInGroup(
    userId: string,
    groupId: number
): Promise<'owner' | 'admin' | 'member' | null> {
    const membership = await db.query.usersToGroups.findFirst({
        where: and(
            eq(usersToGroups.userId, userId),
            eq(usersToGroups.groupId, groupId)
        ),
        columns: { role: true },
    });
    return membership?.role ?? null;
}

/**
 * Get all members of a group
 */
export async function getGroupMembers(groupId: number): Promise<GroupMember[]> {
    const memberships = await db.query.usersToGroups.findMany({
        where: eq(usersToGroups.groupId, groupId),
        with: {
            user: {
                columns: {
                    id: true,
                    name: true,
                    email: true,
                    avatarUrl: true,
                    isGhost: true,
                },
            },
        },
    });

    return memberships.map(m => ({
        id: m.user.id,
        name: m.user.name,
        email: m.user.email,
        avatarUrl: m.user.avatarUrl,
        role: m.role,
        joinedAt: new Date(), // TODO: Add joinedAt to schema
        isGhost: m.user.isGhost,
    }));
}

/**
 * Get group with members populated
 */
export async function getGroupWithMembers(groupId: number): Promise<GroupWithMembers | null> {
    const group = await db.query.groups.findFirst({
        where: eq(groups.id, groupId),
    });

    if (!group) return null;

    const members = await getGroupMembers(groupId);

    return {
        ...group,
        members,
    };
}

/**
 * Get pending invitations for a group
 */
export async function getGroupPendingInvitations(groupId: number): Promise<PendingInvitation[]> {
    const pendingInvites = await db.query.invitations.findMany({
        where: and(
            eq(invitations.groupId, groupId),
            eq(invitations.status, 'pending')
        ),
        with: {
            invitedBy: {
                columns: {
                    name: true,
                    avatarUrl: true,
                },
            },
            ghostUser: {
                columns: {
                    name: true,
                },
            },
        },
    });

    return pendingInvites.map(invite => ({
        id: invite.id,
        email: invite.email,
        status: invite.status,
        invitedBy: {
            name: invite.invitedBy.name,
            avatarUrl: invite.invitedBy.avatarUrl,
        },
        ghostUser: invite.ghostUser ? {
            name: invite.ghostUser.name,
        } : undefined,
        createdAt: invite.createdAt,
    }));
}

/**
 * Get all groups for a user with card data (for dashboard)
 * This is a complex query that fetches all data needed for the dashboard.
 */
export async function getGroupCardsForUser(userId: string): Promise<GroupCardData[]> {
    // Get user's group memberships (excluding archived)
    const memberships = await db.query.usersToGroups.findMany({
        where: eq(usersToGroups.userId, userId),
        with: {
            group: true,
        },
    });

    const activeMemberships = memberships.filter(m => !m.group.archived);
    if (activeMemberships.length === 0) return [];

    const groupIds = activeMemberships.map(m => m.groupId);

    // Batch fetch all related data
    const [allMembers, allExpenses, allSettlements, allLogs] = await Promise.all([
        // Get all members for these groups
        db.query.usersToGroups.findMany({
            where: inArray(usersToGroups.groupId, groupIds),
            with: {
                user: {
                    columns: { id: true, name: true, avatarUrl: true },
                },
            },
        }),
        // Get all expenses
        db.query.expenses.findMany({
            where: inArray(expenses.groupId, groupIds),
            with: { splits: true },
        }),
        // Get all settlements
        db.query.settlements.findMany({
            where: inArray(settlements.groupId, groupIds),
            with: {
                payer: { columns: { name: true } },
                payee: { columns: { name: true } },
            },
        }),
        // Get all activity logs
        db.query.activityLogs.findMany({
            where: inArray(activityLogs.groupId, groupIds),
            with: {
                entity: { columns: { name: true } },
                actor: { columns: { name: true } },
            },
        }),
    ]);

    // Build card data for each group
    return activeMemberships.map(({ group }) => {
        // Get members for this group
        const groupMembersList = allMembers
            .filter(m => m.groupId === group.id)
            .map(m => ({
                id: m.user.id,
                name: m.user.name,
                avatarUrl: m.user.avatarUrl,
            }));

        // Calculate balance for current user
        const groupExpenses = allExpenses.filter(e => e.groupId === group.id);
        let totalPaid = 0;
        let totalOwed = 0;

        for (const expense of groupExpenses) {
            if (expense.paidById === userId) {
                totalPaid += parseFloat(expense.amount);
            }
            const userSplit = expense.splits.find(s => s.userId === userId);
            if (userSplit) {
                totalOwed += parseFloat(userSplit.amount);
            }
        }

        const balance = totalPaid - totalOwed;

        // Get most recent activity
        const groupSettlements = allSettlements.filter(s => s.groupId === group.id);
        const groupLogs = allLogs.filter(l => l.groupId === group.id);

        let recentActivity: string | null = 'No recent activity';
        let recentDate = new Date(0);

        const recentExpense = groupExpenses.sort((a, b) => b.date.getTime() - a.date.getTime())[0];
        if (recentExpense && recentExpense.date > recentDate) {
            recentDate = recentExpense.date;
            recentActivity = recentExpense.description;
        }

        const recentSettlement = groupSettlements.sort((a, b) => b.date.getTime() - a.date.getTime())[0];
        if (recentSettlement && recentSettlement.date > recentDate) {
            recentDate = recentSettlement.date;
            recentActivity = `${recentSettlement.payer?.name || 'Unknown'} paid ${recentSettlement.payee?.name || 'Unknown'}`;
        }

        const recentLog = groupLogs.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
        if (recentLog && recentLog.createdAt > recentDate) {
            const entityName = recentLog.entity?.name || 'Unknown';
            recentActivity = recentLog.action === 'member_added'
                ? `${entityName} joined the group`
                : `${entityName} left the group`;
        }

        return {
            id: group.id,
            name: group.name,
            description: group.description,
            coverImageUrl: group.coverImageUrl,
            members: groupMembersList,
            balance,
            unreadCount: 0, // TODO: Implement unread count tracking
            recentActivity,
        };
    });
}
