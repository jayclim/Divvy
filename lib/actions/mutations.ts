'use server';

import { db } from '@/lib/db';
import { groups, usersToGroups, expenses, expenseSplits, settlements, expenseItems, itemAssignments } from '@/lib/db/schema';
import { auth } from '@clerk/nextjs/server';
import { syncUser } from '@/lib/auth/sync';
import { revalidatePath } from 'next/cache';

export type CreateGroupData = {
  name: string;
  description?: string;
  coverImage?: string;
};

export async function createGroupAction(data: CreateGroupData) {
  const { userId } = await auth();
  if (!userId) throw new Error('Unauthorized');

  const user = await syncUser();
  if (!user) throw new Error('Unauthorized');

  if (!data.name) {
    throw new Error('Group name is required');
  }

  try {
    // Create the group
    const [newGroup] = await db.insert(groups).values({
      name: data.name,
      description: data.description,
      coverImageUrl: data.coverImage,
    }).returning();

    // Add creator as admin
    await db.insert(usersToGroups).values({
      userId: user.id,
      groupId: newGroup.id,
      role: 'admin',
    });

    revalidatePath('/dashboard');
    return { success: true, group: newGroup };
  } catch (error) {
    console.error('Error creating group:', error);
    throw new Error('Failed to create group');
  }
}

// Item data for item-based splitting
export type ExpenseItemData = {
  name: string;
  price: number;
  quantity?: number;
  isSharedCost: boolean;
  assignedTo: string[]; // Array of user IDs
};

export type CreateExpenseData = {
  groupId: string;
  description: string;
  amount: number;
  paidById: string;
  splitBetween: string[];
  splitType: 'equal' | 'custom' | 'by_item';
  customSplits?: { userId: string; amount: number }[];
  items?: ExpenseItemData[]; // For item-based splitting
  category?: string;
  receipt?: string;
};

export async function createExpenseAction(data: CreateExpenseData) {
  const { userId } = await auth();
  if (!userId) throw new Error('Unauthorized');

  const user = await syncUser();
  if (!user) throw new Error('Unauthorized');

  const groupIdNum = parseInt(data.groupId);
  if (isNaN(groupIdNum)) {
    throw new Error('Invalid group ID');
  }

  try {
    // Verify membership
    const membership = await db.query.usersToGroups.findFirst({
      where: (usersToGroups, { and, eq }) => and(
        eq(usersToGroups.userId, user.id),
        eq(usersToGroups.groupId, groupIdNum)
      ),
    });

    if (!membership) {
      throw new Error('You are not a member of this group');
    }

    // Create expense
    const [newExpense] = await db.insert(expenses).values({
      groupId: groupIdNum,
      description: data.description,
      amount: data.amount.toString(),
      paidById: data.paidById,
      category: data.category,
      receiptUrl: data.receipt,
      splitMethod: data.splitType,
      date: new Date(),
    }).returning();

    // Handle different split types
    let splitsToInsert: { expenseId: number; userId: string; amount: string }[] = [];

    if (data.splitType === 'by_item' && data.items && data.items.length > 0) {
      // Item-based splitting
      const userTotals: Record<string, number> = {};

      // First pass: calculate non-shared item costs per user
      let totalNonSharedCost = 0;
      const sharedCosts: ExpenseItemData[] = [];

      for (const item of data.items) {
        if (item.isSharedCost) {
          sharedCosts.push(item);
        } else {
          totalNonSharedCost += item.price * (item.quantity || 1);
          const itemTotal = item.price * (item.quantity || 1);
          const perPersonAmount = itemTotal / item.assignedTo.length;

          for (const assignedUserId of item.assignedTo) {
            userTotals[assignedUserId] = (userTotals[assignedUserId] || 0) + perPersonAmount;
          }
        }
      }

      // Second pass: distribute shared costs proportionally
      const totalSharedCost = sharedCosts.reduce((sum, item) => sum + item.price * (item.quantity || 1), 0);

      if (totalSharedCost > 0 && totalNonSharedCost > 0) {
        // Distribute shared costs proportionally based on non-shared spending
        for (const [uid, amount] of Object.entries(userTotals)) {
          const proportion = amount / totalNonSharedCost;
          userTotals[uid] = amount + (totalSharedCost * proportion);
        }
      } else if (totalSharedCost > 0 && Object.keys(userTotals).length > 0) {
        // If only shared costs, split equally among all assigned users
        const allUsers = new Set<string>();
        for (const item of data.items) {
          for (const uid of item.assignedTo) {
            allUsers.add(uid);
          }
        }
        const perPersonShared = totalSharedCost / allUsers.size;
        for (const uid of allUsers) {
          userTotals[uid] = (userTotals[uid] || 0) + perPersonShared;
        }
      }

      // Create expense items and assignments
      for (const item of data.items) {
        const [newItem] = await db.insert(expenseItems).values({
          expenseId: newExpense.id,
          name: item.name,
          price: item.price.toString(),
          quantity: item.quantity || 1,
          isSharedCost: item.isSharedCost,
        }).returning();

        // Create assignments for this item
        if (item.assignedTo.length > 0) {
          const assignmentsToInsert = item.assignedTo.map(uid => ({
            itemId: newItem.id,
            userId: uid,
            sharePercentage: (100 / item.assignedTo.length).toFixed(2),
          }));
          await db.insert(itemAssignments).values(assignmentsToInsert);
        }
      }

      // Create splits from calculated totals
      splitsToInsert = Object.entries(userTotals).map(([uid, amount]) => ({
        expenseId: newExpense.id,
        userId: uid,
        amount: amount.toFixed(2),
      }));

    } else if (data.splitType === 'custom' && data.customSplits) {
      // Custom split amounts
      splitsToInsert = data.customSplits.map(split => ({
        expenseId: newExpense.id,
        userId: split.userId,
        amount: split.amount.toString(),
      }));
    } else {
      // Default to equal split
      const splitAmount = data.amount / data.splitBetween.length;
      splitsToInsert = data.splitBetween.map(uid => ({
        expenseId: newExpense.id,
        userId: uid,
        amount: splitAmount.toString(),
      }));
    }

    if (splitsToInsert.length > 0) {
      await db.insert(expenseSplits).values(splitsToInsert);
    }

    revalidatePath(`/groups/${data.groupId}`);
    revalidatePath('/dashboard');

    return { success: true, expense: newExpense };
  } catch (error) {
    console.error('Error creating expense:', error);
    throw new Error('Failed to create expense');
  }
}

export async function joinGroupAction(code: string) {
  // TODO: Implement join by code logic
  // For now, this is a placeholder as the invite system wasn't fully detailed in schema
  // We might need to add an 'inviteCode' to the groups table or a separate invites table
  console.log("Joining with code:", code);
  throw new Error("Join by code not yet implemented");
}

export type CreateSettlementData = {
  groupId: string;
  payeeId: string;
  amount: number;
  method?: string;
  notes?: string;
};

export async function createSettlementAction(data: CreateSettlementData) {
  const { userId } = await auth();
  if (!userId) throw new Error('Unauthorized');

  const user = await syncUser();
  if (!user) throw new Error('Unauthorized');

  const groupIdNum = parseInt(data.groupId);
  if (isNaN(groupIdNum)) {
    throw new Error('Invalid group ID');
  }

  try {
    // Verify membership
    const membership = await db.query.usersToGroups.findFirst({
      where: (usersToGroups, { and, eq }) => and(
        eq(usersToGroups.userId, user.id),
        eq(usersToGroups.groupId, groupIdNum)
      ),
    });

    if (!membership) {
      throw new Error('You are not a member of this group');
    }

    // Create settlement
    // Note: In the schema, settlements table has payerId and payeeId
    // The current user is the payer
    const [newSettlement] = await db.insert(settlements).values({
      groupId: groupIdNum,
      payerId: user.id,
      payeeId: data.payeeId,
      amount: data.amount.toString(),
      // method: data.method, // Schema doesn't have method or notes yet, ignoring for now or need to update schema
      // notes: data.notes,
    }).returning();

    revalidatePath(`/groups/${data.groupId}`);
    revalidatePath('/dashboard');

    return { success: true, settlement: newSettlement };
  } catch (error) {
    console.error('Error creating settlement:', error);
    throw new Error('Failed to create settlement');
  }
}
