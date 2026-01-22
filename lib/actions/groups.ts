'use server';

import { db } from '@/lib/db';
import { usersToGroups, expenses, users, groups, messages, expenseSplits, settlements, activityLogs, expenseItems, itemAssignments } from '@/lib/db/schema';
import { auth } from '@clerk/nextjs/server';
import { syncUser } from '@/lib/auth/sync';
import { eq, inArray, desc, and } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { invitations, groups as groupsTable } from '@/lib/db/schema';
import { sendGroupInvitationEmail } from '@/lib/email';

export type GroupMember = {
  id: string;
  name: string | null;
  avatarUrl: string | null;
};

export type GroupInvitation = {
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
};

export type GroupCardData = {
  id: number;
  name: string;
  description: string | null;
  members: GroupMember[];
  balance: number;
  unreadCount: number;
  recentActivity: string | null;
};

// Types for GroupDetail page
export type GroupDetailMember = {
  _id: string;
  name: string;
  email: string;
  avatar?: string;
  role: 'owner' | 'admin' | 'member';
  joinedAt: string;
  isGhost?: boolean;
};

export type GroupDetail = {
  _id: string;
  name: string;
  description?: string;
  coverImage?: string;
  members: GroupDetailMember[];
  pendingInvitations: GroupInvitation[];
  createdAt: string;
  updatedAt: string;
  unreadCount: number;
  recentActivity?: string;
  balance: number;
};

export type Message = {
  _id: string;
  groupId: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  content: string;
  type: 'text' | 'expense' | 'settlement' | 'image';
  timestamp: string;
  replyTo?: {
    _id: string;
    content: string;
    senderName: string;
  };
  reactions: {
    emoji: string;
    users: string[];
  }[];
  expenseId?: string;
  imageUrl?: string;
};

export type Balance = {
  _id: string;
  groupId: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  amount: number;
  owesTo: {
    userId: string;
    userName: string;
    amount: number;
  }[];
  owedBy: {
    userId: string;
    userName: string;
    amount: number;
  }[];
};

export async function getGroupsForUser(): Promise<GroupCardData[]> {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  const user = await syncUser();
  if (!user) redirect('/sign-in');

  const groupMemberships = await db.query.usersToGroups.findMany({
    where: eq(usersToGroups.userId, user.id),
    with: {
      group: true,
    },
  });

  // Filter out archived groups
  const activeGroupMemberships = groupMemberships.filter(gm => !gm.group.archived);

  if (activeGroupMemberships.length === 0) return [];

  const groupIds = activeGroupMemberships.map((gm) => gm.groupId);

  // Fetch all members for the user's groups in a single query
  const allGroupsMembers = await db.query.users.findMany({
    columns: {
      id: true,
      name: true,
      avatarUrl: true,
    },
    with: {
      groups: {
        where: inArray(usersToGroups.groupId, groupIds),
        columns: {
          groupId: true,
        },
      },
    },
    where: inArray(
      users.id,
      db.select({ userId: usersToGroups.userId }).from(usersToGroups).where(inArray(usersToGroups.groupId, groupIds))
    ),
  });

  const allExpenses = await db.query.expenses.findMany({
    where: inArray(expenses.groupId, groupIds),
    with: { splits: true },
  });

  const allSettlements = await db.query.settlements.findMany({
    where: inArray(settlements.groupId, groupIds),
    with: {
      payer: { columns: { name: true } },
      payee: { columns: { name: true } },
    }
  });

  const allLogs = await db.query.activityLogs.findMany({
    where: inArray(activityLogs.groupId, groupIds),
    with: {
      entity: { columns: { name: true } },
      actor: { columns: { name: true } },
    }
  });

  const result: GroupCardData[] = activeGroupMemberships.map(({ group }) => {
    const membersOfGroup = allGroupsMembers
      .filter((member) => member.groups.some((g) => g.groupId === group.id))
      .map(({ ...member }) => member); // Exclude the 'groups' property from the final member object

    const expensesInGroup = allExpenses.filter(e => e.groupId === group.id);

    // Calculate balance for the current user in this group
    let totalPaidByUser = 0;
    let totalUserShare = 0;

    for (const expense of expensesInGroup) {
      if (expense.paidById === user.id) {
        totalPaidByUser += parseFloat(expense.amount);
      }
      const userSplit = expense.splits.find(s => s.userId === user.id);
      if (userSplit) {
        totalUserShare += parseFloat(userSplit.amount);
      }
    }

    const balance = totalPaidByUser - totalUserShare;

    const recentExpense = expensesInGroup.sort((a, b) => b.date.getTime() - a.date.getTime())[0];

    // Get recent settlement
    const settlementsInGroup = allSettlements.filter(s => s.groupId === group.id);
    const recentSettlement = settlementsInGroup.sort((a, b) => b.date.getTime() - a.date.getTime())[0];

    // Get recent log
    const logsInGroup = allLogs.filter(l => l.groupId === group.id);
    const recentLog = logsInGroup.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];

    // Determine the most recent activity
    let recentActivity = 'No recent activity';
    let recentDate = new Date(0);

    if (recentExpense && recentExpense.date > recentDate) {
      recentDate = recentExpense.date;
      recentActivity = recentExpense.description;
    }

    if (recentSettlement && recentSettlement.date > recentDate) {
      recentDate = recentSettlement.date;
      const payerName = recentSettlement.payer?.name || 'Unknown';
      const payeeName = recentSettlement.payee?.name || 'Unknown';
      recentActivity = `${payerName} paid ${payeeName}`;
    }

    if (recentLog && recentLog.createdAt > recentDate) {
      recentDate = recentLog.createdAt;
      const entityName = recentLog.entity?.name || 'Unknown';
      if (recentLog.action === 'member_added') {
        recentActivity = `${entityName} joined the group`;
      } else if (recentLog.action === 'member_removed') {
        recentActivity = `${entityName} left the group`;
      }
    }

    return {
      id: group.id,
      name: group.name,
      description: group.description,
      members: membersOfGroup,
      balance: balance,
      unreadCount: 0, // Mock
      recentActivity: recentActivity,
    };
  });

  return result;
}

export async function getGroup(groupId: string): Promise<{ group: GroupDetail }> {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  const user = await syncUser();
  if (!user) redirect('/sign-in');

  const groupIdNum = parseInt(groupId);
  if (isNaN(groupIdNum)) {
    throw new Error('Invalid group ID');
  }

  // Check if user is a member of this group
  const membership = await db.query.usersToGroups.findFirst({
    where: and(
      eq(usersToGroups.userId, user.id),
      eq(usersToGroups.groupId, groupIdNum)
    ),
  });

  if (!membership) {
    // Check if user has a pending invitation for this group - auto-accept it
    const pendingInvitation = await db.query.invitations.findFirst({
      where: and(
        eq(invitations.groupId, groupIdNum),
        eq(invitations.email, user.email),
        eq(invitations.status, 'pending')
      ),
    });

    if (pendingInvitation) {
      // Auto-accept the invitation
      // If there is a ghost user linked, merge them
      if (pendingInvitation.ghostUserId) {
        // 1. Update expenses paid by ghost user
        await db.update(expenses)
          .set({ paidById: user.id })
          .where(eq(expenses.paidById, pendingInvitation.ghostUserId));

        // 2. Update expense splits assigned to ghost user
        await db.update(expenseSplits)
          .set({ userId: user.id })
          .where(eq(expenseSplits.userId, pendingInvitation.ghostUserId));

        // 3. Remove ghost user from group (usersToGroups)
        await db.delete(usersToGroups)
          .where(and(
            eq(usersToGroups.userId, pendingInvitation.ghostUserId),
            eq(usersToGroups.groupId, groupIdNum)
          ));

        // 4. Delete the ghost user record
        try {
          await db.delete(users).where(eq(users.id, pendingInvitation.ghostUserId));
        } catch (e) {
          console.warn('Could not delete ghost user record:', e);
        }
      }

      // Add user to group
      await db.insert(usersToGroups).values({
        userId: user.id,
        groupId: groupIdNum,
        role: 'member',
      }).onConflictDoNothing();

      // Update invitation status to accepted
      await db.update(invitations)
        .set({ status: 'accepted' })
        .where(eq(invitations.id, pendingInvitation.id));

      // Log activity
      await db.insert(activityLogs).values({
        groupId: groupIdNum,
        action: 'member_added',
        entityId: user.id,
        actorId: user.id, // User added themselves by accepting
      });

      console.log(`[getGroup] Auto-accepted invitation for user ${user.email} to group ${groupIdNum}`);
    } else {
      throw new Error('Access denied: You are not a member of this group');
    }
  }

  // Get group details
  const group = await db.query.groups.findFirst({
    where: eq(groups.id, groupIdNum),
  });

  if (!group) {
    throw new Error('Group not found');
  }

  if (group.archived) {
    throw new Error('Group is archived');
  }

  // Get all members of the group
  const groupMembers = await db.query.usersToGroups.findMany({
    where: eq(usersToGroups.groupId, groupIdNum),
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

  const members: GroupDetailMember[] = groupMembers.map((membership) => ({
    _id: membership.user.id,
    name: membership.user.name || 'Unknown',
    email: membership.user.email,
    avatar: membership.user.avatarUrl || undefined,
    role: membership.role,
    joinedAt: new Date().toISOString(), // Mock for now
    isGhost: membership.user.isGhost || false,
  }));

  // Calculate user's balance in this group
  const groupExpenses = await db.query.expenses.findMany({
    where: eq(expenses.groupId, groupIdNum),
    with: { splits: true },
  });

  // Get current member IDs (we already fetched groupMembers, so we can use that)
  const currentMemberIds = new Set(groupMembers.map(m => m.user.id));

  let totalPaidByUser = 0;
  let totalUserShare = 0;

  for (const expense of groupExpenses) {
    // Only count if payer is a current member
    if (currentMemberIds.has(expense.paidById)) {
      if (expense.paidById === user.id) {
        // Sum up splits for CURRENT members only
        expense.splits.forEach(split => {
          if (currentMemberIds.has(split.userId)) {
            totalPaidByUser += parseFloat(split.amount);
          }
        });
      }
    }

    const userSplit = expense.splits.find(s => s.userId === user.id);
    if (userSplit) {
      // Only count debt if the payer is a CURRENT member
      if (currentMemberIds.has(expense.paidById)) {
        totalUserShare += parseFloat(userSplit.amount);
      }
    }
  }

  // Fetch pending invitations
  const pendingInvites = await db.query.invitations.findMany({
    where: and(
      eq(invitations.groupId, groupIdNum),
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
        }
      }
    },
  });

  const formattedInvitations: GroupInvitation[] = pendingInvites.map(invite => ({
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
  }));

  const balance = totalPaidByUser - totalUserShare;
  const recentExpense = groupExpenses.sort((a, b) => b.date.getTime() - a.date.getTime())[0];

  return {
    group: {
      _id: group.id.toString(),
      name: group.name,
      description: group.description || undefined,
      coverImage: group.coverImageUrl || undefined,
      members,
      pendingInvitations: formattedInvitations,
      createdAt: group.createdAt.toISOString(),
      updatedAt: group.updatedAt.toISOString(),
      unreadCount: 0, // Mock
      recentActivity: recentExpense ? recentExpense.description : undefined,
      balance,
    },
  };
}

export async function getMessages(groupId: string): Promise<{ messages: Message[]; hasMore: boolean }> {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  const user = await syncUser();
  if (!user) redirect('/sign-in');

  const groupIdNum = parseInt(groupId);
  if (isNaN(groupIdNum)) {
    throw new Error('Invalid group ID');
  }

  // Check if user is a member of this group
  const membership = await db.query.usersToGroups.findFirst({
    where: and(
      eq(usersToGroups.userId, user.id),
      eq(usersToGroups.groupId, groupIdNum)
    ),
  });

  if (!membership) {
    throw new Error('Access denied: You are not a member of this group');
  }

  // Get messages for the group
  const groupMessages = await db.query.messages.findMany({
    where: eq(messages.groupId, groupIdNum),
    orderBy: [desc(messages.createdAt)],
    limit: 50,
    with: {
      user: {
        columns: {
          id: true,
          name: true,
          avatarUrl: true,
        },
      },
    },
  });

  // Get recent expenses to create expense messages
  const recentExpenses = await db.query.expenses.findMany({
    where: eq(expenses.groupId, groupIdNum),
    orderBy: [desc(expenses.createdAt)],
    limit: 10,
    with: {
      paidBy: {
        columns: {
          id: true,
          name: true,
          avatarUrl: true,
        },
      },
    },
  });

  // Combine messages and expense notifications
  const allMessages: Message[] = [
    ...groupMessages.map((msg) => ({
      _id: msg.id.toString(),
      groupId: groupId,
      senderId: msg.userId,
      senderName: msg.user.name || 'Unknown User',
      senderAvatar: msg.user.avatarUrl || undefined,
      content: msg.content,
      type: 'text' as const,
      timestamp: msg.createdAt.toISOString(),
      reactions: [], // Mock for now
    })),
    ...recentExpenses.map((expense) => ({
      _id: `expense-${expense.id}`,
      groupId: groupId,
      senderId: expense.paidById,
      senderName: expense.paidBy.name || 'Unknown User',
      senderAvatar: expense.paidBy.avatarUrl || undefined,
      content: `${expense.description} - $${expense.amount}`,
      type: 'expense' as const,
      timestamp: expense.createdAt.toISOString(),
      expenseId: expense.id.toString(),
      reactions: [], // Mock for now
    })),
  ];

  // Sort by timestamp
  allMessages.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return {
    messages: allMessages.slice(0, 50),
    hasMore: false,
  };
}

export async function getBalances(groupId: string): Promise<{ balances: Balance[] }> {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  const user = await syncUser();
  if (!user) redirect('/sign-in');

  const groupIdNum = parseInt(groupId);
  if (isNaN(groupIdNum)) {
    throw new Error('Invalid group ID');
  }

  // Check if user is a member of this group
  const membership = await db.query.usersToGroups.findFirst({
    where: and(
      eq(usersToGroups.userId, user.id),
      eq(usersToGroups.groupId, groupIdNum)
    ),
  });

  if (!membership) {
    throw new Error('Access denied: You are not a member of this group');
  }

  // Get all members of the group
  const groupMembers = await db.query.usersToGroups.findMany({
    where: eq(usersToGroups.groupId, groupIdNum),
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

  // Get all expenses for the group
  const groupExpenses = await db.query.expenses.findMany({
    where: eq(expenses.groupId, groupIdNum),
    with: { splits: true },
  });

  // Get all settlements for the group
  const groupSettlements = await db.query.settlements.findMany({
    where: eq(settlements.groupId, groupIdNum),
  });

  // Get all current members of the group
  const currentMembers = await db.query.usersToGroups.findMany({
    where: eq(usersToGroups.groupId, groupIdNum),
    columns: { userId: true },
  });
  const currentMemberIds = new Set(currentMembers.map(m => m.userId));

  // Calculate balances for each member
  const balances: Balance[] = groupMembers.map((member) => {
    let totalPaid = 0;
    let totalOwed = 0;

    // Calculate expense-based balance
    for (const expense of groupExpenses) {
      // Only count payments made by current members
      if (currentMemberIds.has(expense.paidById)) {
        // If I paid
        if (expense.paidById === member.user.id) {
          // Sum up splits for CURRENT members only
          expense.splits.forEach(split => {
            if (currentMemberIds.has(split.userId)) {
              totalPaid += parseFloat(split.amount);
            }
          });
        }
      }

      // If I have a split
      const userSplit = expense.splits.find(s => s.userId === member.user.id);
      if (userSplit) {
        // Only count debt if the payer is a CURRENT member
        if (currentMemberIds.has(expense.paidById)) {
          totalOwed += parseFloat(userSplit.amount);
        }
      }
    }

    // Adjust for settlements
    for (const settlement of groupSettlements) {
      // Only consider settlements between current members
      if (currentMemberIds.has(settlement.payerId) && currentMemberIds.has(settlement.payeeId)) {
        if (settlement.payerId === member.user.id) {
          totalPaid += parseFloat(settlement.amount);
        }
        if (settlement.payeeId === member.user.id) {
          totalOwed += parseFloat(settlement.amount);
        }
      }
    }

    const netBalance = totalPaid - totalOwed;

    // Calculate who this member owes money to and who owes them
    const owesTo: { userId: string; userName: string; amount: number }[] = [];
    const owedBy: { userId: string; userName: string; amount: number }[] = [];

    // For each other member, calculate pairwise debt
    groupMembers.forEach((otherMember) => {
      if (otherMember.user.id === member.user.id) return; // Skip self

      let memberOwesToOther = 0;
      let otherOwesToMember = 0;

      // Go through all expenses to calculate what member owes to otherMember
      for (const expense of groupExpenses) {
        const memberSplit = expense.splits.find(s => s.userId === member.user.id);
        const otherSplit = expense.splits.find(s => s.userId === otherMember.user.id);

        // Only consider if payer is current (which they are, since we are iterating groupMembers which are current)
        // But we should double check just in case groupMembers logic changes.
        // Actually groupMembers comes from getGroupDetails which fetches current members.

        if (expense.paidById === otherMember.user.id && memberSplit) {
          // Other member paid, current member owes their share
          memberOwesToOther += parseFloat(memberSplit.amount);
        }

        if (expense.paidById === member.user.id && otherSplit) {
          // Current member paid, other member owes their share
          otherOwesToMember += parseFloat(otherSplit.amount);
        }
      }

      // Adjust for settlements between these two
      for (const settlement of groupSettlements) {
        // If member paid otherMember, it reduces what member owes to other
        if (settlement.payerId === member.user.id && settlement.payeeId === otherMember.user.id) {
          memberOwesToOther -= parseFloat(settlement.amount);
        }

        // If otherMember paid member, it reduces what other owes to member
        if (settlement.payerId === otherMember.user.id && settlement.payeeId === member.user.id) {
          otherOwesToMember -= parseFloat(settlement.amount);
        }
      }

      // Net debt between these two people
      const netDebt = memberOwesToOther - otherOwesToMember;

      if (netDebt > 0.01) { // Member owes other member (with small tolerance for rounding)
        owesTo.push({
          userId: otherMember.user.id,
          userName: otherMember.user.name || 'Unknown User',
          amount: netDebt,
        });
      } else if (netDebt < -0.01) { // Other member owes current member
        owedBy.push({
          userId: otherMember.user.id,
          userName: otherMember.user.name || 'Unknown User',
          amount: Math.abs(netDebt),
        });
      }
    });

    return {
      _id: `balance-${member.user.id}`,
      groupId: groupId,
      userId: member.user.id,
      userName: member.user.name || 'Unknown User',
      userAvatar: member.user.avatarUrl || undefined,
      amount: netBalance,
      owesTo,
      owedBy,
    };
  });

  return { balances };
}

export async function sendMessage(data: {
  groupId: string;
  content: string;
  replyToId?: string;
}): Promise<{ message: Message }> {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  const user = await syncUser();
  if (!user) redirect('/sign-in');

  const groupIdNum = parseInt(data.groupId);
  if (isNaN(groupIdNum)) {
    throw new Error('Invalid group ID');
  }

  // Check if user is a member of this group
  const membership = await db.query.usersToGroups.findFirst({
    where: and(
      eq(usersToGroups.userId, user.id),
      eq(usersToGroups.groupId, groupIdNum)
    ),
  });

  if (!membership) {
    throw new Error('Access denied: You are not a member of this group');
  }

  // Insert the message
  const [newMessage] = await db.insert(messages).values({
    groupId: groupIdNum,
    userId: user.id,
    content: data.content,
  }).returning();

  // Get user details for the response
  const userDetails = await db.query.users.findFirst({
    where: eq(users.id, user.id),
    columns: {
      id: true,
      name: true,
      avatarUrl: true,
    },
  });

  return {
    message: {
      _id: newMessage.id.toString(),
      groupId: data.groupId,
      senderId: user.id,
      senderName: userDetails?.name || 'Unknown User',
      senderAvatar: userDetails?.avatarUrl || undefined,
      content: data.content,
      type: 'text',
      timestamp: newMessage.createdAt.toISOString(),
      reactions: [],
    },
  };
}

export async function addReaction(messageId: string, emoji: string): Promise<void> {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  const user = await syncUser();
  if (!user) redirect('/sign-in');

  // For now, this is a mock implementation
  // In a real app, you'd store reactions in a separate table
  console.log(`User ${user.id} added reaction ${emoji} to message ${messageId}`);
}

export type ExpenseItem = {
  id: number;
  name: string;
  price: number;
  quantity: number;
  isSharedCost: boolean;
  assignedTo: {
    userId: string;
    userName: string;
  }[];
};

export type Expense = {
  _id: string;
  groupId: string;
  description: string;
  amount: number;
  paidBy: {
    _id: string;
    name: string;
    avatar?: string;
  };
  splitBetween: {
    _id: string;
    name: string;
    amount: number;
  }[];
  category?: string;
  date: string;
  createdAt: string;
  receipt?: string;
  settled: boolean;
  type: 'expense' | 'payment' | 'member_added' | 'member_removed';
  splitMethod?: 'equal' | 'custom' | 'by_item';
  items?: ExpenseItem[];
  // For logs
  entityName?: string;
  actorName?: string;
};

export async function getExpenses(groupId: string): Promise<{ expenses: Expense[] }> {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  const user = await syncUser();
  if (!user) redirect('/sign-in');

  const groupIdNum = parseInt(groupId);
  if (isNaN(groupIdNum)) {
    throw new Error('Invalid group ID');
  }

  // Check if user is a member of this group
  const membership = await db.query.usersToGroups.findFirst({
    where: and(
      eq(usersToGroups.userId, user.id),
      eq(usersToGroups.groupId, groupIdNum)
    ),
  });

  if (!membership) {
    throw new Error('Access denied: You are not a member of this group');
  }

  // Get all current members of the group to check for removed users
  const currentMembers = await db.query.usersToGroups.findMany({
    where: eq(usersToGroups.groupId, groupIdNum),
    columns: { userId: true },
  });
  const currentMemberIds = new Set(currentMembers.map(m => m.userId));

  // Get all expenses for the group
  const groupExpenses = await db.query.expenses.findMany({
    where: eq(expenses.groupId, groupIdNum),
    with: {
      paidBy: {
        columns: {
          id: true,
          name: true,
          avatarUrl: true,
        },
      },
      splits: {
        with: {
          user: {
            columns: {
              id: true,
              name: true,
            },
          },
        },
      },
      items: {
        with: {
          assignments: {
            with: {
              user: {
                columns: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      },
    },
  });

  // Get all settlements for the group
  const groupSettlements = await db.query.settlements.findMany({
    where: eq(settlements.groupId, groupIdNum),
    with: {
      payer: {
        columns: {
          id: true,
          name: true,
          avatarUrl: true,
        },
      },
      payee: {
        columns: {
          id: true,
          name: true,
        },
      },
    },
  });

  // Get all activity logs for the group
  const groupLogs = await db.query.activityLogs.findMany({
    where: eq(activityLogs.groupId, groupIdNum),
    with: {
      entity: {
        columns: {
          id: true,
          name: true,
        },
      },
      actor: {
        columns: {
          id: true,
          name: true,
        },
      },
    },
  });

  // Format expenses to match the expected interface
  const formattedExpenses: Expense[] = groupExpenses.map((expense) => {
    const isPayerMember = currentMemberIds.has(expense.paidBy.id);

    // Format items if this is an item-based expense
    const formattedItems: ExpenseItem[] | undefined =
      expense.splitMethod === 'by_item' && expense.items.length > 0
        ? expense.items.map((item) => ({
          id: item.id,
          name: item.name,
          price: parseFloat(item.price),
          quantity: item.quantity,
          isSharedCost: item.isSharedCost,
          assignedTo: item.assignments.map((assignment) => ({
            userId: assignment.user.id,
            userName: assignment.user.name || 'Unknown User',
          })),
        }))
        : undefined;

    return {
      _id: expense.id.toString(),
      groupId: groupId,
      description: expense.description,
      amount: parseFloat(expense.amount),
      paidBy: {
        _id: expense.paidBy.id,
        name: isPayerMember ? (expense.paidBy.name || 'Unknown User') : 'Removed User',
        avatar: isPayerMember ? (expense.paidBy.avatarUrl || undefined) : undefined,
      },
      splitBetween: expense.splits.map((split) => {
        const isSplitMember = currentMemberIds.has(split.user.id);
        return {
          _id: split.user.id,
          name: isSplitMember ? (split.user.name || 'Unknown User') : 'Removed User',
          amount: parseFloat(split.amount),
        };
      }),
      category: expense.category || undefined,
      date: expense.date.toISOString(),
      createdAt: expense.createdAt.toISOString(),
      receipt: expense.receiptUrl || undefined,
      settled: expense.settled,
      type: 'expense',
      splitMethod: expense.splitMethod as 'equal' | 'custom' | 'by_item',
      items: formattedItems,
    };
  });

  // Format settlements as expenses
  const formattedSettlements: Expense[] = groupSettlements.map((settlement) => {
    const isPayerMember = currentMemberIds.has(settlement.payer.id);
    const isPayeeMember = currentMemberIds.has(settlement.payee.id);

    return {
      _id: `settlement-${settlement.id}`,
      groupId: groupId,
      description: `Paid ${isPayeeMember ? (settlement.payee.name || 'Unknown User') : 'Removed User'}`,
      amount: parseFloat(settlement.amount),
      paidBy: {
        _id: settlement.payer.id,
        name: isPayerMember ? (settlement.payer.name || 'Unknown User') : 'Removed User',
        avatar: isPayerMember ? (settlement.payer.avatarUrl || undefined) : undefined,
      },
      splitBetween: [{
        _id: settlement.payee.id,
        name: isPayeeMember ? (settlement.payee.name || 'Unknown User') : 'Removed User',
        amount: parseFloat(settlement.amount),
      }],
      category: 'Payment',
      date: settlement.date.toISOString(),
      createdAt: settlement.createdAt.toISOString(),
      settled: true,
      type: 'payment',
    };
  });

  // Format logs as expenses
  const formattedLogs: Expense[] = groupLogs.map((log) => {
    return {
      _id: `log-${log.id}`,
      groupId: groupId,
      description: log.action === 'member_added' ? 'joined the group' : 'left the group',
      amount: 0,
      paidBy: {
        _id: log.actorId,
        name: log.actor?.name || 'Unknown User',
      },
      splitBetween: [],
      category: 'Log',
      date: log.createdAt.toISOString(),
      createdAt: log.createdAt.toISOString(),
      settled: true,
      type: log.action as 'member_added' | 'member_removed',
      entityName: log.entity?.name || 'Unknown User',
      actorName: log.actor?.name || 'Unknown User',
    };
  });

  // Combine and sort by date descending
  const allItems = [...formattedExpenses, ...formattedSettlements, ...formattedLogs].sort((a, b) => {
    return new Date(b.date).getTime() - new Date(a.date).getTime();
  });

  return { expenses: allItems };
}

export async function createGroup(name: string, description?: string, coverImageUrl?: string) {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  const user = await syncUser();
  if (!user) redirect('/sign-in');

  // Check group limit for free tier users (3 groups max)
  const FREE_TIER_GROUP_LIMIT = 3;

  if (user.subscriptionTier !== 'pro') {
    // Count how many groups the user is already in
    const userGroups = await db.query.usersToGroups.findMany({
      where: eq(usersToGroups.userId, user.id),
    });

    if (userGroups.length >= FREE_TIER_GROUP_LIMIT) {
      throw new Error(`Free tier users can only be in ${FREE_TIER_GROUP_LIMIT} groups. Upgrade to Pro for unlimited groups!`);
    }
  }

  // Create the group
  const [newGroup] = await db.insert(groups).values({
    name,
    description,
    coverImageUrl,
  }).returning();

  // Add the creator as an owner
  await db.insert(usersToGroups).values({
    userId: user.id,
    groupId: newGroup.id,
    role: 'owner',
  });

  return newGroup;
}

export async function createGhostMember(groupId: string, name: string) {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  const user = await syncUser();
  if (!user) redirect('/sign-in');

  const groupIdNum = parseInt(groupId);
  if (isNaN(groupIdNum)) {
    throw new Error('Invalid group ID');
  }

  // Verify requester is a member of the group
  const membership = await db.query.usersToGroups.findFirst({
    where: and(
      eq(usersToGroups.userId, user.id),
      eq(usersToGroups.groupId, groupIdNum)
    ),
  });

  if (!membership) {
    throw new Error('Access denied');
  }

  // Create ghost user
  const ghostId = `ghost_${crypto.randomUUID()}`;
  const [ghostUser] = await db.insert(users).values({
    id: ghostId,
    name,
    email: `ghost_${Date.now()}_${Math.random().toString(36).substring(7)}@placeholder.com`, // Unique placeholder email
    isGhost: true,
  }).returning();

  // Add ghost user to group
  await db.insert(usersToGroups).values({
    userId: ghostUser.id,
    groupId: groupIdNum,
    role: 'member',
  });

  // Log activity
  await db.insert(activityLogs).values({
    groupId: groupIdNum,
    action: 'member_added',
    entityId: ghostUser.id,
    actorId: user.id,
  });

  return ghostUser;
}

export async function inviteMember(groupId: string, email: string, ghostUserId?: string) {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  const user = await syncUser();
  if (!user) redirect('/sign-in');

  const groupIdNum = parseInt(groupId);
  if (isNaN(groupIdNum)) {
    throw new Error('Invalid group ID');
  }

  // Verify requester is a member
  const membership = await db.query.usersToGroups.findFirst({
    where: and(
      eq(usersToGroups.userId, user.id),
      eq(usersToGroups.groupId, groupIdNum)
    ),
  });

  if (!membership) {
    throw new Error('Access denied');
  }

  // Check if user is already in the group
  const existingUser = await db.query.users.findFirst({
    where: eq(users.email, email),
  });

  if (existingUser) {
    const existingMembership = await db.query.usersToGroups.findFirst({
      where: and(
        eq(usersToGroups.userId, existingUser.id),
        eq(usersToGroups.groupId, groupIdNum)
      ),
    });

    if (existingMembership) {
      throw new Error('User is already a member of this group');
    }

    // Add user to group
    await db.insert(usersToGroups).values({
      userId: existingUser.id,
      groupId: groupIdNum,
      role: 'member',
    });

    // Log activity
    await db.insert(activityLogs).values({
      groupId: groupIdNum,
      action: 'member_added',
      entityId: existingUser.id,
      actorId: user.id,
    });

    // If there was a ghost user, we might want to link/merge data here,
    // but for now we just add the real user.
    // TODO: Handle ghost user merging if ghostUserId is provided

    return existingUser;
  }

  // If user doesn't exist, create an invitation
  // Check if invitation already exists
  const existingInvitation = await db.query.invitations.findFirst({
    where: and(
      eq(invitations.groupId, groupIdNum),
      eq(invitations.email, email),
      eq(invitations.status, 'pending')
    ),
  });

  if (existingInvitation) {
    return existingInvitation; // Already invited
  }

  const [invitation] = await db.insert(invitations).values({
    groupId: groupIdNum,
    email,
    invitedById: user.id,
    ghostUserId: ghostUserId,
    status: 'pending',
  }).returning();

  // Get group name for the email
  const group = await db.query.groups.findFirst({
    where: eq(groupsTable.id, groupIdNum),
    columns: { name: true },
  });

  // Send invitation email (non-blocking - errors are logged but don't fail the invite)
  // Note: At this point, existingUser is undefined (if user existed, we returned early above)
  sendGroupInvitationEmail({
    recipientEmail: email,
    recipientUserId: undefined,
    inviterName: user.name || 'A Spliq user',
    groupName: group?.name || 'a group',
    groupId: groupIdNum,
  }).catch(err => {
    console.error('[inviteMember] Failed to send invitation email:', err);
  });

  return invitation;
}

export async function cancelInvitation(groupId: string, invitationId: number) {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  const user = await syncUser();
  if (!user) redirect('/sign-in');

  const groupIdNum = parseInt(groupId);
  if (isNaN(groupIdNum)) {
    throw new Error('Invalid group ID');
  }

  // Verify requester is an admin or owner of the group
  const requesterMembership = await db.query.usersToGroups.findFirst({
    where: and(
      eq(usersToGroups.userId, user.id),
      eq(usersToGroups.groupId, groupIdNum)
    ),
  });

  if (!requesterMembership || (requesterMembership.role !== 'admin' && requesterMembership.role !== 'owner')) {
    throw new Error('Access denied: Only owners and admins can cancel invitations');
  }

  // Find the invitation
  const invitation = await db.query.invitations.findFirst({
    where: and(
      eq(invitations.id, invitationId),
      eq(invitations.groupId, groupIdNum),
      eq(invitations.status, 'pending')
    ),
  });

  if (!invitation) {
    throw new Error('Invitation not found or already processed');
  }

  // Delete the invitation
  await db.delete(invitations).where(eq(invitations.id, invitationId));

  return { success: true };
}

export async function removeMember(groupId: string, memberId: string) {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  const user = await syncUser();
  if (!user) redirect('/sign-in');

  const groupIdNum = parseInt(groupId);
  if (isNaN(groupIdNum)) {
    throw new Error('Invalid group ID');
  }

  // Verify requester is an admin of the group
  const requesterMembership = await db.query.usersToGroups.findFirst({
    where: and(
      eq(usersToGroups.userId, user.id),
      eq(usersToGroups.groupId, groupIdNum)
    ),
  });

  if (!requesterMembership || (requesterMembership.role !== 'admin' && requesterMembership.role !== 'owner')) {
    throw new Error('Access denied: Only owners and admins can remove members');
  }

  // Prevent removing yourself (optional, but good practice to have a separate "leave group" flow or just allow it)
  // For now, let's allow it, but if it's the last admin, that might be an issue.
  // Let's just proceed with removal.

  // Check if the member exists in the group
  const memberToRemove = await db.query.usersToGroups.findFirst({
    where: and(
      eq(usersToGroups.userId, memberId),
      eq(usersToGroups.groupId, groupIdNum)
    ),
  });

  if (!memberToRemove) {
    throw new Error('Member not found in this group');
  }

  if (memberToRemove.role === 'owner') {
    throw new Error('Access denied: Cannot remove the owner');
  }

  // Admin cannot remove other admins
  if (requesterMembership.role === 'admin' && memberToRemove.role === 'admin') {
    throw new Error('Access denied: Admins cannot remove other admins');
  }

  // Remove the member
  await db.delete(usersToGroups)
    .where(and(
      eq(usersToGroups.userId, memberId),
      eq(usersToGroups.groupId, groupIdNum)
    ));

  // Log activity
  await db.insert(activityLogs).values({
    groupId: groupIdNum,
    action: 'member_removed',
    entityId: memberId,
    actorId: user.id,
  });

  return { success: true };
}



export async function getPendingInvitations() {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  const user = await syncUser();
  if (!user) redirect('/sign-in');

  if (!user.email) return [];

  const pendingInvites = await db.query.invitations.findMany({
    where: and(
      eq(invitations.email, user.email),
      eq(invitations.status, 'pending')
    ),
    with: {
      group: true,
      invitedBy: {
        columns: {
          name: true,
          avatarUrl: true,
        },
      },
    },
  });

  return pendingInvites;
}

export async function respondToInvitation(invitationId: number, accept: boolean) {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  const user = await syncUser();
  if (!user) redirect('/sign-in');

  const invitation = await db.query.invitations.findFirst({
    where: eq(invitations.id, invitationId),
  });

  if (!invitation) {
    throw new Error('This invitation is no longer available. It may have been cancelled by the group admin.');
  }

  if (invitation.email !== user.email) {
    throw new Error('This invitation is not for you');
  }

  if (accept) {
    // If there is a ghost user linked, merge them
    if (invitation.ghostUserId) {
      // 1. Update expenses paid by ghost user
      await db.update(expenses)
        .set({ paidById: user.id })
        .where(eq(expenses.paidById, invitation.ghostUserId));

      // 2. Update expense splits assigned to ghost user
      await db.update(expenseSplits)
        .set({ userId: user.id })
        .where(eq(expenseSplits.userId, invitation.ghostUserId));

      // 3. Remove ghost user from group (usersToGroups)
      await db.delete(usersToGroups)
        .where(and(
          eq(usersToGroups.userId, invitation.ghostUserId),
          eq(usersToGroups.groupId, invitation.groupId)
        ));

      // 4. Delete the ghost user record (optional, but cleaner)
      // Note: This might fail if there are other constraints, but usually safe if we updated references
      try {
        await db.delete(users).where(eq(users.id, invitation.ghostUserId));
      } catch (e) {
        console.warn('Could not delete ghost user record:', e);
      }
    }

    // Add user to group (if not already added via merge logic - wait, merge logic removed ghost membership)
    // We always need to add the real user to the group
    await db.insert(usersToGroups).values({
      userId: user.id,
      groupId: invitation.groupId,
      role: 'member',
    }).onConflictDoNothing();

    // Update invitation status
    await db.update(invitations)
      .set({ status: 'accepted' })
      .where(eq(invitations.id, invitationId));

    // Log activity
    await db.insert(activityLogs).values({
      groupId: invitation.groupId,
      action: 'member_added',
      entityId: user.id,
      actorId: user.id, // User added themselves by accepting
    });
  } else {
    // Declined - just update the status
    await db.update(invitations)
      .set({ status: 'declined' })
      .where(eq(invitations.id, invitationId));
  }
}

export async function archiveGroup(groupId: string) {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  const user = await syncUser();
  if (!user) redirect('/sign-in');

  const groupIdNum = parseInt(groupId);
  if (isNaN(groupIdNum)) {
    throw new Error('Invalid group ID');
  }

  // Check if user is admin
  const membership = await db.query.usersToGroups.findFirst({
    where: and(
      eq(usersToGroups.userId, user.id),
      eq(usersToGroups.groupId, groupIdNum),
      eq(usersToGroups.role, 'owner')
    ),
  });

  if (!membership) {
    throw new Error('Access denied: Only owners can delete groups');
  }

  // Archive group
  await db.update(groups)
    .set({ archived: true })
    .where(eq(groups.id, groupIdNum));

  // Log activity
  await db.insert(activityLogs).values({
    groupId: groupIdNum,
    action: 'group_archived',
    entityId: groupId, // Using group ID as entity ID for this action
    actorId: user.id,
  });
}

export async function updateGroupRole(groupId: string, memberId: string, newRole: 'admin' | 'member') {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  const user = await syncUser();
  if (!user) redirect('/sign-in');

  const groupIdNum = parseInt(groupId);
  if (isNaN(groupIdNum)) {
    throw new Error('Invalid group ID');
  }

  // Verify requester is the owner of the group
  const requesterMembership = await db.query.usersToGroups.findFirst({
    where: and(
      eq(usersToGroups.userId, user.id),
      eq(usersToGroups.groupId, groupIdNum),
      eq(usersToGroups.role, 'owner')
    ),
  });

  if (!requesterMembership) {
    throw new Error('Access denied: Only the owner can manage roles');
  }

  // Verify member exists in group
  const memberToUpdate = await db.query.usersToGroups.findFirst({
    where: and(
      eq(usersToGroups.userId, memberId),
      eq(usersToGroups.groupId, groupIdNum)
    ),
  });

  if (!memberToUpdate) {
    throw new Error('Member not found in this group');
  }

  if (memberToUpdate.role === 'owner') {
    throw new Error('Cannot change the role of the owner');
  }

  // Update role
  await db.update(usersToGroups)
    .set({ role: newRole })
    .where(and(
      eq(usersToGroups.userId, memberId),
      eq(usersToGroups.groupId, groupIdNum)
    ));

  // Log activity
  await db.insert(activityLogs).values({
    groupId: groupIdNum,
    action: 'role_updated', // You might need to add this to your types or schema if strict
    entityId: memberId,
    actorId: user.id,
  });

  return { success: true };
}