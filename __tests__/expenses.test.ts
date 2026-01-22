import { cleanTestData } from '@/scripts/clean-test-data';
import { seedTestData } from '@/scripts/seed-test-data';
import { db, client } from '@/lib/db';
import { groups } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

describe('Expenses Integration Tests', () => {
    // Increase timeout for DB operations
    jest.setTimeout(60000);

    beforeAll(async () => {
        // Reset and seed the test database
        console.log('🔄 Resetting test database...');
        try {
            await cleanTestData(true);
            await seedTestData(true);
            console.log('✅ Test database reset complete.');
        } catch (error) {
            console.error('❌ Failed to reset test database:', error);
            throw error;
        }
    });

    afterAll(async () => {
        await client.end();
    });

    it('should have seeded unequal split expense correctly', async () => {
        // Find Project X
        const projectX = await db.query.groups.findFirst({
            where: eq(groups.name, 'Project X')
        });
        expect(projectX).toBeDefined();

        // Find the unequal split expense
        const expense = await db.query.expenses.findFirst({
            where: (expenses, { and, eq }) => and(
                eq(expenses.groupId, projectX!.id),
                eq(expenses.description, 'Unequal Split Test')
            ),
            with: {
                splits: {
                    with: {
                        user: true
                    }
                }
            }
        });

        expect(expense).toBeDefined();
        expect(expense?.amount).toBe('100.00');
        expect(expense?.splits.length).toBe(3);

        // Verify individual splits
        const aliceSplit = expense?.splits.find(s => s.user.name?.includes('Alice'));
        const daveSplit = expense?.splits.find(s => s.user.name?.includes('Dave'));
        const charlieSplit = expense?.splits.find(s => s.user.name?.includes('Charlie'));

        expect(aliceSplit).toBeDefined();
        expect(parseFloat(aliceSplit?.amount || '0')).toBe(10.00);

        expect(daveSplit).toBeDefined();
        expect(parseFloat(daveSplit?.amount || '0')).toBe(20.00);

        expect(charlieSplit).toBeDefined();
        expect(parseFloat(charlieSplit?.amount || '0')).toBe(70.00);
    });

    it('should have seeded item-based split expense correctly', async () => {
        // Find Project X
        const projectX = await db.query.groups.findFirst({
            where: eq(groups.name, 'Project X')
        });
        expect(projectX).toBeDefined();

        // Find the item-based expense
        const expense = await db.query.expenses.findFirst({
            where: (expenses, { and, eq }) => and(
                eq(expenses.groupId, projectX!.id),
                eq(expenses.description, 'Restaurant Dinner - Item Split')
            ),
            with: {
                splits: {
                    with: {
                        user: true
                    }
                },
                items: {
                    with: {
                        assignments: {
                            with: {
                                user: true
                            }
                        }
                    }
                }
            }
        });

        expect(expense).toBeDefined();
        expect(expense?.splitMethod).toBe('by_item');
        expect(expense?.amount).toBe('86.25');

        // Verify items were created
        expect(expense?.items.length).toBe(5); // Burger, Steak, Salad, Tax, Tip

        // Verify regular items
        const burgerItem = expense?.items.find(i => i.name === 'Burger');
        expect(burgerItem).toBeDefined();
        expect(parseFloat(burgerItem?.price || '0')).toBe(15.00);
        expect(burgerItem?.isSharedCost).toBe(false);
        expect(burgerItem?.assignments.length).toBe(1);
        expect(burgerItem?.assignments[0].user.name).toContain('Alice');

        const steakItem = expense?.items.find(i => i.name === 'Steak');
        expect(steakItem).toBeDefined();
        expect(parseFloat(steakItem?.price || '0')).toBe(35.00);
        expect(steakItem?.isSharedCost).toBe(false);
        expect(steakItem?.assignments[0].user.name).toContain('Dave');

        const saladItem = expense?.items.find(i => i.name === 'Salad');
        expect(saladItem).toBeDefined();
        expect(parseFloat(saladItem?.price || '0')).toBe(25.00);
        expect(saladItem?.isSharedCost).toBe(false);
        expect(saladItem?.assignments[0].user.name).toContain('Charlie');

        // Verify shared cost items (tax, tip)
        const taxItem = expense?.items.find(i => i.name === 'Tax');
        expect(taxItem).toBeDefined();
        expect(taxItem?.isSharedCost).toBe(true);
        expect(parseFloat(taxItem?.price || '0')).toBe(6.75);

        const tipItem = expense?.items.find(i => i.name === 'Tip');
        expect(tipItem).toBeDefined();
        expect(tipItem?.isSharedCost).toBe(true);
        expect(parseFloat(tipItem?.price || '0')).toBe(4.50);

        // Verify splits include proportional tax/tip
        expect(expense?.splits.length).toBe(3);

        const aliceSplit = expense?.splits.find(s => s.user.name?.includes('Alice'));
        const daveSplit = expense?.splits.find(s => s.user.name?.includes('Dave'));
        const charlieSplit = expense?.splits.find(s => s.user.name?.includes('Charlie'));

        // Alice: $15 item + proportional tax/tip = $17.25
        expect(aliceSplit).toBeDefined();
        expect(parseFloat(aliceSplit?.amount || '0')).toBe(17.25);

        // Dave: $35 item + proportional tax/tip = $40.25
        expect(daveSplit).toBeDefined();
        expect(parseFloat(daveSplit?.amount || '0')).toBe(40.25);

        // Charlie: $25 item + proportional tax/tip = $28.75
        expect(charlieSplit).toBeDefined();
        expect(parseFloat(charlieSplit?.amount || '0')).toBe(28.75);

        // Verify total splits equal total amount
        const totalSplits = expense?.splits.reduce((sum, s) => sum + parseFloat(s.amount), 0) || 0;
        expect(totalSplits).toBeCloseTo(86.25, 2);
    });

    it('should correctly calculate proportional shared costs', async () => {
        // This test verifies the proportional distribution algorithm
        // Total items: $75, Shared costs: $11.25
        // Alice (20% of items): 20% of shared = $2.25
        // Dave (46.67% of items): 46.67% of shared = $5.25
        // Charlie (33.33% of items): 33.33% of shared = $3.75

        const projectX = await db.query.groups.findFirst({
            where: eq(groups.name, 'Project X')
        });

        const expense = await db.query.expenses.findFirst({
            where: (expenses, { and, eq }) => and(
                eq(expenses.groupId, projectX!.id),
                eq(expenses.splitMethod, 'by_item')
            ),
            with: {
                splits: {
                    with: {
                        user: true
                    }
                },
                items: true
            }
        });

        expect(expense).toBeDefined();

        // Calculate expected proportions
        const regularItems = expense?.items.filter(i => !i.isSharedCost) || [];
        const sharedItems = expense?.items.filter(i => i.isSharedCost) || [];

        const totalRegular = regularItems.reduce((sum, i) => sum + parseFloat(i.price), 0);
        const totalShared = sharedItems.reduce((sum, i) => sum + parseFloat(i.price), 0);

        expect(totalRegular).toBe(75.00); // Burger + Steak + Salad
        expect(totalShared).toBe(11.25);  // Tax + Tip

        // Verify each person's share includes their proportion of shared costs
        const aliceSplit = expense?.splits.find(s => s.user.name?.includes('Alice'));
        const aliceItemCost = 15.00; // Burger
        const aliceProportion = aliceItemCost / totalRegular;
        const aliceExpectedTotal = aliceItemCost + (totalShared * aliceProportion);
        expect(parseFloat(aliceSplit?.amount || '0')).toBeCloseTo(aliceExpectedTotal, 2);
    });
});
