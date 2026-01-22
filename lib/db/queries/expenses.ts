/**
 * Expense Queries - Data Access Layer
 * 
 * Contains all database queries related to expenses.
 * These are pure data-fetching functions with no auth checks.
 */

import { db } from '@/lib/db';
import {
    expenses,
    expenseSplits,
    expenseItems,
    itemAssignments,
    users
} from '@/lib/db/schema';
import { eq, inArray, desc } from 'drizzle-orm';
import type { ExpenseWithDetails } from '@/lib/db/types';

/**
 * Basic expense type from query (for internal use)
 */
interface ExpenseQueryResult {
    id: number;
    groupId: number;
    description: string;
    amount: string;
    paidById: string;
    date: Date;
    category: string | null;
    receiptUrl: string | null;
    settled: boolean;
    splitMethod: 'equal' | 'custom' | 'by_item';
    createdAt: Date;
    paidBy: {
        id: string;
        name: string | null;
        avatarUrl: string | null;
    };
    splits: {
        id: number;
        userId: string;
        amount: string;
        user: {
            id: string;
            name: string | null;
            avatarUrl: string | null;
        };
    }[];
}

/**
 * Get an expense by ID with all details
 */
export async function getExpenseById(expenseId: number): Promise<ExpenseQueryResult | null> {
    const expense = await db.query.expenses.findFirst({
        where: eq(expenses.id, expenseId),
        with: {
            paidBy: {
                columns: { id: true, name: true, avatarUrl: true },
            },
            splits: {
                with: {
                    user: {
                        columns: { id: true, name: true, avatarUrl: true },
                    },
                },
            },
        },
    });
    return expense ?? null;
}

/**
 * Get all expenses for a group
 */
export async function getExpensesByGroupId(groupId: number): Promise<ExpenseQueryResult[]> {
    return db.query.expenses.findMany({
        where: eq(expenses.groupId, groupId),
        orderBy: [desc(expenses.date)],
        with: {
            paidBy: {
                columns: { id: true, name: true, avatarUrl: true },
            },
            splits: {
                with: {
                    user: {
                        columns: { id: true, name: true, avatarUrl: true },
                    },
                },
            },
        },
    });
}

/**
 * Get expenses with splits only (for balance calculations)
 */
export async function getExpensesWithSplitsByGroupId(groupId: number) {
    return db.query.expenses.findMany({
        where: eq(expenses.groupId, groupId),
        with: {
            splits: true,
        },
    });
}

/**
 * Get expense items with assignments
 */
export async function getExpenseItems(expenseId: number) {
    return db.query.expenseItems.findMany({
        where: eq(expenseItems.expenseId, expenseId),
        with: {
            assignments: {
                with: {
                    user: {
                        columns: { id: true, name: true },
                    },
                },
            },
        },
    });
}

/**
 * Get recent expenses for a group (for messages/activity feed)
 */
export async function getRecentExpenses(groupId: number, limit: number = 10) {
    return db.query.expenses.findMany({
        where: eq(expenses.groupId, groupId),
        orderBy: [desc(expenses.createdAt)],
        limit,
        with: {
            paidBy: {
                columns: { id: true, name: true, avatarUrl: true },
            },
        },
    });
}
