import { archiveGroup, getGroupsForUser, getGroup } from '@/lib/actions/groups';
import { db } from '@/lib/db';
import { users, groups, usersToGroups, activityLogs } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { syncUser } from '@/lib/auth/sync';

let mockUserId = 'user_alice';

// Mock auth
jest.mock('@clerk/nextjs/server', () => ({
    auth: jest.fn().mockImplementation(() => Promise.resolve({ userId: mockUserId })),
}));

jest.mock('@/lib/auth/sync', () => ({
    syncUser: jest.fn(),
}));

describe('Group Archival', () => {
    let groupId: number;
    let aliceId: string;
    let bobId: string;

    beforeAll(async () => {
        // Setup: Get Alice and Bob
        const alice = await db.query.users.findFirst({ where: eq(users.email, 'alice@test.com') });
        const bob = await db.query.users.findFirst({ where: eq(users.email, 'bob@test.com') });

        if (!alice || !bob) throw new Error('Test users not found');
        aliceId = alice.id;
        bobId = bob.id;
        mockUserId = aliceId;

        (syncUser as jest.Mock).mockResolvedValue({ id: aliceId, email: 'alice@test.com' });
    });

    beforeEach(async () => {
        // Create a group for testing
        const [group] = await db.insert(groups).values({
            name: 'Archive Test Group',
            description: 'Testing archival',
        }).returning();
        groupId = group.id;

        // Add Alice as owner
        await db.insert(usersToGroups).values({
            userId: aliceId,
            groupId: groupId,
            role: 'owner',
        });

        // Add Bob as member
        await db.insert(usersToGroups).values({
            userId: bobId,
            groupId: groupId,
            role: 'member',
        });
    });

    afterEach(async () => {
        if (groupId) {
            // Cleanup
            await db.delete(groups).where(eq(groups.id, groupId));
        }
    });

    it('should allow owner to archive group', async () => {
        mockUserId = aliceId;
        (syncUser as jest.Mock).mockResolvedValue({ id: aliceId, email: 'alice@test.com' });

        await archiveGroup(groupId.toString());

        const group = await db.query.groups.findFirst({
            where: eq(groups.id, groupId),
        });

        expect(group?.archived).toBe(true);

        // Check log
        const log = await db.query.activityLogs.findFirst({
            where: and(
                eq(activityLogs.groupId, groupId),
                eq(activityLogs.action, 'group_archived')
            ),
        });
        expect(log).toBeDefined();
        expect(log?.actorId).toBe(aliceId);
    });

    it('should not allow non-owner to archive group', async () => {
        mockUserId = bobId;
        (syncUser as jest.Mock).mockResolvedValue({ id: bobId, email: 'bob@test.com' });

        await expect(archiveGroup(groupId.toString()))
            .rejects
            .toThrow('Access denied: Only owners can delete groups');

        const group = await db.query.groups.findFirst({
            where: eq(groups.id, groupId),
        });

        expect(group?.archived).toBe(false);
    });

    it('should filter archived groups from getGroupsForUser', async () => {
        mockUserId = aliceId;
        (syncUser as jest.Mock).mockResolvedValue({ id: aliceId, email: 'alice@test.com' });

        // Verify it's there initially
        let userGroups = await getGroupsForUser();
        let testGroup = userGroups.find(g => g.id === groupId);
        expect(testGroup).toBeDefined();

        // Archive it
        await archiveGroup(groupId.toString());

        // Verify it's gone
        userGroups = await getGroupsForUser();
        testGroup = userGroups.find(g => g.id === groupId);
        expect(testGroup).toBeUndefined();
    });

    it('should prevent access to archived group via getGroup', async () => {
        mockUserId = aliceId;
        (syncUser as jest.Mock).mockResolvedValue({ id: aliceId, email: 'alice@test.com' });

        await archiveGroup(groupId.toString());

        await expect(getGroup(groupId.toString()))
            .rejects
            .toThrow('Group is archived');
    });
});
