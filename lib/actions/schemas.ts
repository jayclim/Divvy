/**
 * Zod Validation Schemas for Server Actions
 * 
 * All server action inputs should be validated using these schemas.
 * This ensures type safety and consistent error handling.
 */

import { z } from 'zod';

// =================================
//     GROUP SCHEMAS
// =================================

export const createGroupSchema = z.object({
    name: z.string()
        .min(1, 'Group name is required')
        .max(100, 'Group name must be 100 characters or less'),
    description: z.string()
        .max(500, 'Description must be 500 characters or less')
        .optional(),
    coverImageUrl: z.string().url('Invalid cover image URL').optional(),
});

export const inviteMemberSchema = z.object({
    groupId: z.string().regex(/^\d+$/, 'Invalid group ID'),
    email: z.string().email('Invalid email address'),
    ghostUserId: z.string().optional(),
});

export const removeMemberSchema = z.object({
    groupId: z.string().regex(/^\d+$/, 'Invalid group ID'),
    memberId: z.string().min(1, 'Member ID is required'),
});

export const updateGroupRoleSchema = z.object({
    groupId: z.string().regex(/^\d+$/, 'Invalid group ID'),
    memberId: z.string().min(1, 'Member ID is required'),
    newRole: z.enum(['admin', 'member']),
});

export const createGhostMemberSchema = z.object({
    groupId: z.string().regex(/^\d+$/, 'Invalid group ID'),
    name: z.string()
        .min(1, 'Name is required')
        .max(100, 'Name must be 100 characters or less'),
});

// =================================
//     EXPENSE SCHEMAS
// =================================

export const createExpenseSchema = z.object({
    groupId: z.string().regex(/^\d+$/, 'Invalid group ID'),
    description: z.string()
        .min(1, 'Description is required')
        .max(200, 'Description must be 200 characters or less'),
    amount: z.number()
        .positive('Amount must be positive')
        .max(1000000, 'Amount cannot exceed 1,000,000'),
    paidById: z.string().min(1, 'Payer is required'),
    date: z.string().refine(val => !isNaN(Date.parse(val)), 'Invalid date'),
    category: z.string().max(50).optional(),
    splitMethod: z.enum(['equal', 'custom', 'by_item']).default('equal'),
    splits: z.array(z.object({
        userId: z.string().min(1),
        amount: z.number().min(0, 'Split amount cannot be negative'),
    })).optional(),
    items: z.array(z.object({
        name: z.string().min(1, 'Item name is required'),
        price: z.number().positive('Price must be positive'),
        quantity: z.number().int().positive().default(1),
        isSharedCost: z.boolean().default(false),
        assignedTo: z.array(z.string()).min(1, 'At least one person must be assigned'),
    })).optional(),
});

export const settleUpSchema = z.object({
    groupId: z.string().regex(/^\d+$/, 'Invalid group ID'),
    payeeId: z.string().min(1, 'Payee is required'),
    amount: z.number()
        .positive('Amount must be positive')
        .max(1000000, 'Amount cannot exceed 1,000,000'),
});

// =================================
//     MESSAGE SCHEMAS
// =================================

export const sendMessageSchema = z.object({
    groupId: z.string().regex(/^\d+$/, 'Invalid group ID'),
    content: z.string()
        .min(1, 'Message cannot be empty')
        .max(2000, 'Message must be 2000 characters or less'),
    replyToId: z.string().optional(),
});

// =================================
//     INVITATION SCHEMAS
// =================================

export const respondToInvitationSchema = z.object({
    invitationId: z.number().int().positive('Invalid invitation ID'),
    accept: z.boolean(),
});

// =================================
//     SETTINGS SCHEMAS
// =================================

export const updateEmailPreferencesSchema = z.object({
    invitations: z.boolean().optional(),
    expenseAdded: z.boolean().optional(),
    settlementReceived: z.boolean().optional(),
    memberActivity: z.boolean().optional(),
    digestFrequency: z.enum(['instant', 'daily', 'weekly', 'none']).optional(),
});

export const updatePaymentMethodsSchema = z.object({
    venmo: z.string().max(100).optional(),
    paypal: z.string().max(100).optional(),
    cashapp: z.string().max(100).optional(),
});

// =================================
//     TYPE EXPORTS
// =================================

export type CreateGroupInput = z.infer<typeof createGroupSchema>;
export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;
export type RemoveMemberInput = z.infer<typeof removeMemberSchema>;
export type UpdateGroupRoleInput = z.infer<typeof updateGroupRoleSchema>;
export type CreateGhostMemberInput = z.infer<typeof createGhostMemberSchema>;
export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;
export type SettleUpInput = z.infer<typeof settleUpSchema>;
export type SendMessageInput = z.infer<typeof sendMessageSchema>;
export type RespondToInvitationInput = z.infer<typeof respondToInvitationSchema>;
export type UpdateEmailPreferencesInput = z.infer<typeof updateEmailPreferencesSchema>;
export type UpdatePaymentMethodsInput = z.infer<typeof updatePaymentMethodsSchema>;

// =================================
//     STANDARD RESPONSE TYPE
// =================================

/**
 * Standard response type for server actions
 */
export type ZodIssue = z.ZodIssue;

export type ActionResult<T = void> =
    | { success: true; data?: T; message?: string }
    | { success: false; message: string; errors?: ZodIssue[] };

/**
 * Helper to create a success response
 */
export function successResponse<T>(data?: T, message?: string): ActionResult<T> {
    return { success: true, data, message };
}

/**
 * Helper to create an error response
 */
export function errorResponse(message: string, errors?: ZodIssue[]): ActionResult<never> {
    return { success: false, message, errors };
}

/**
 * Helper to validate input and return error if invalid
 */
export function validateInput<T>(
    schema: z.ZodSchema<T>,
    data: unknown
): { success: true; data: T } | { success: false; error: ActionResult<never> } {
    const result = schema.safeParse(data);

    if (!result.success) {
        const issues = result.error.issues;
        return {
            success: false,
            error: errorResponse(
                issues[0]?.message || 'Validation failed',
                issues
            ),
        };
    }

    return { success: true, data: result.data };
}
