
import { removeMember } from '@/lib/actions/groups';
import { db, client } from '@/lib/db';
import { users, groups, usersToGroups, expenses, expenseSplits } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

// Mock auth and syncUser
jest.mock('@clerk/nextjs/server', () => ({
    auth: jest.fn().mockResolvedValue({ userId: 'test_admin_id' }),
}));

jest.mock('@/lib/auth/sync', () => ({
    syncUser: jest.fn().mockResolvedValue({ id: 'test_admin_id', email: 'admin@test.com' }),
}));

jest.mock('next/navigation', () => ({
    redirect: jest.fn(),
}));

describe('removeMember Server Action', () => {
    jest.setTimeout(30000);
    const adminId = 'test_admin_id';
    const memberId = 'test_member_id';
    let groupId: number;

    beforeAll(async () => {
        // Setup test data
        // Create admin user
        await db.insert(users).values({
            id: adminId,
            name: 'Admin User',
            email: 'admin@test.com',
            isGhost: false,
        }).onConflictDoNothing();

        // Create member user
        await db.insert(users).values({
            id: memberId,
            name: 'Member User',
            email: 'member@test.com',
            isGhost: false,
        }).onConflictDoNothing();

        // Create group
        const [group] = await db.insert(groups).values({
            name: 'Test Removal Group ' + Date.now(),
            description: 'Test Group',
        }).returning();
        groupId = group.id;

        // Add admin to group
        await db.insert(usersToGroups).values({
            userId: adminId,
            groupId: groupId,
            role: 'admin',
        });

        // Add member to group
        await db.insert(usersToGroups).values({
            userId: memberId,
            groupId: groupId,
            role: 'member',
        });
    });

    afterAll(async () => {
        // Cleanup
        await db.delete(groups).where(eq(groups.id, groupId));
        await db.delete(users).where(eq(users.id, adminId));
        await db.delete(users).where(eq(users.id, memberId));
        await client.end();
    });

    it('should remove a member from the group', async () => {
        // Verify member is in group
        let memberInGroup = await db.query.usersToGroups.findFirst({
            where: and(
                eq(usersToGroups.userId, memberId),
                eq(usersToGroups.groupId, groupId)
            ),
        });
        expect(memberInGroup).toBeDefined();

        // Call removeMember
        await removeMember(groupId.toString(), memberId);

        // Verify member is removed
        memberInGroup = await db.query.usersToGroups.findFirst({
            where: and(
                eq(usersToGroups.userId, memberId),
                eq(usersToGroups.groupId, groupId)
            ),
        });
        expect(memberInGroup).toBeUndefined();
    });

    it('should throw error if requester is not admin', async () => {
        // Mock auth as non-admin
        const nonAdminId = 'test_non_admin_id';

        // Create non-admin user
        await db.insert(users).values({
            id: nonAdminId,
            name: 'Non Admin',
            email: 'nonadmin@test.com',
            isGhost: false,
        }).onConflictDoNothing();

        // Add to group as member
        await db.insert(usersToGroups).values({
            userId: nonAdminId,
            groupId: groupId,
            role: 'member',
        });

        // Mock auth to return non-admin
        const { auth } = require('@clerk/nextjs/server');
        const { syncUser } = require('@/lib/auth/sync');
        auth.mockResolvedValue({ userId: nonAdminId });
        syncUser.mockResolvedValue({ id: nonAdminId, email: 'nonadmin@test.com' });

        // Try to remove admin (or anyone)
        await expect(removeMember(groupId.toString(), adminId))
            .rejects
            .toThrow('Access denied: Only owners and admins can remove members');

        // Cleanup non-admin
        await db.delete(users).where(eq(users.id, nonAdminId));
    });

    it('should throw error if admin tries to remove another admin', async () => {
        // Create another admin
        const otherAdminId = 'other_admin_id';
        await db.insert(users).values({
            id: otherAdminId,
            name: 'Other Admin',
            email: 'otheradmin@test.com',
            isGhost: false,
        }).onConflictDoNothing();

        // Add to group as admin
        await db.insert(usersToGroups).values({
            userId: otherAdminId,
            groupId: groupId,
            role: 'admin',
        });

        // Mock auth as original admin (already set in global mock, but let's be sure)
        const { auth } = require('@clerk/nextjs/server');
        const { syncUser } = require('@/lib/auth/sync');
        auth.mockResolvedValue({ userId: adminId });
        syncUser.mockResolvedValue({ id: adminId, email: 'admin@test.com' });

        // Try to remove the other admin
        await expect(removeMember(groupId.toString(), otherAdminId))
            .rejects
            .toThrow('Access denied: Admins cannot remove other admins');

        // Cleanup other admin
        await db.delete(users).where(eq(users.id, otherAdminId));
    });

    it('should display "Removed User" for expenses paid by removed member', async () => {
        const { getExpenses } = require('@/lib/actions/groups');
        // The expenses schema is already imported at the top: `import { users, groups, usersToGroups, expenses } from '@/lib/db/schema';`

        // 1. Add an expense paid by memberId
        const [expense] = await db.insert(expenses).values({
            groupId: groupId,
            description: 'Test Expense',
            amount: '50.00',
            paidById: memberId,
            date: new Date(),
            category: 'test'
        }).returning();

        // 2. Remove memberId (if not already removed by previous test, but let's re-add to be safe or check status)
        // In previous test 'should remove a member', memberId was removed.
        // So memberId is currently NOT in the group.

        // 3. Call getExpenses
        const result = await getExpenses(groupId.toString());
        const fetchedExpense = result.expenses.find((e: any) => e._id === expense.id.toString());

        expect(fetchedExpense).toBeDefined();
        expect(fetchedExpense.paidBy.name).toBe('Removed User');

        // Cleanup expense
        await db.delete(expenses).where(eq(expenses.id, expense.id));
    });

    it('should update balances correctly when a user is removed', async () => {
        const { getBalances } = require('@/lib/actions/groups');
        // expenseSplits is imported at top level now

        // 1. Create a new member (to be removed)
        const removedMemberId = 'removed_member_id';
        await db.insert(users).values({
            id: removedMemberId,
            name: 'Removed Member',
            email: 'removed@test.com',
            isGhost: false,
        }).onConflictDoNothing();

        await db.insert(usersToGroups).values({
            userId: removedMemberId,
            groupId: groupId,
            role: 'member',
        });

        // 2. Add an expense paid by admin, split with removed member
        // Admin pays $100. Split: Admin $50, Removed $50.
        const [expense] = await db.insert(expenses).values({
            groupId: groupId,
            description: 'Balance Test Expense',
            amount: '100.00',
            paidById: adminId,
            date: new Date(),
            category: 'test'
        }).returning();

        await db.insert(expenseSplits).values([
            { expenseId: expense.id, userId: adminId, amount: '50.00' },
            { expenseId: expense.id, userId: removedMemberId, amount: '50.00' },
        ]);

        // 3. Verify initial balance (Admin should be +50, Removed should be -50)
        let result = await getBalances(groupId.toString());
        let adminBalance = result.balances.find((b: any) => b.userId === adminId);
        expect(adminBalance.amount).toBe(50);

        // 4. Remove the member
        await removeMember(groupId.toString(), removedMemberId);

        // 5. Verify balance after removal
        // Admin should now be 0 (since debt from removed user is ignored)
        result = await getBalances(groupId.toString());
        adminBalance = result.balances.find((b: any) => b.userId === adminId);
        expect(adminBalance.amount).toBe(0);

        // Cleanup
        await db.delete(expenses).where(eq(expenses.id, expense.id));
        await db.delete(users).where(eq(users.id, removedMemberId));
    });
});
