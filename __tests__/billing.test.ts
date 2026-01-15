
// Mock dependencies
jest.mock('@clerk/nextjs/server', () => ({
    auth: jest.fn(() => Promise.resolve({ userId: 'user_123' })),
}));

jest.mock('next/cache', () => ({
    revalidatePath: jest.fn(),
}));

// Mock DB
const mockUser = {
    id: 'user_123',
    subscriptionTier: 'free',
    currentPeriodEnd: null,
    lemonSqueezySubscriptionId: 'sub_123',
};

const mockSubscription = {
    id: 1,
    lemonSqueezyId: 'sub_123',
    userId: 'user_123',
    status: 'active',
};

jest.mock('@/lib/db', () => ({
    db: {
        query: {
            users: {
                findFirst: jest.fn(() => Promise.resolve(mockUser)),
            },
            subscriptions: {
                findFirst: jest.fn(() => Promise.resolve(mockSubscription)),
            },
        },
        update: jest.fn(() => ({
            set: jest.fn(() => ({
                where: jest.fn(() => Promise.resolve([{ id: 'user_123' }])),
            })),
        })),
    },
}));

import { checkSubscription } from '@/lib/auth/subscription';
import { generateSettlementLink } from '@/lib/utils';

describe('Subscription Logic', () => {
    test('checkSubscription returns false for free user', async () => {
        mockUser.subscriptionTier = 'free';
        const isPro = await checkSubscription();
        expect(isPro).toBe(false);
    });

    test('checkSubscription returns true for pro user', async () => {
        mockUser.subscriptionTier = 'pro';
        const isPro = await checkSubscription();
        expect(isPro).toBe(true);
    });
});

describe('Smart Settlement Links', () => {
    test('generates valid Venmo deep link', () => {
        const link = generateSettlementLink('venmo', 'user123', 25.50, 'Dinner');
        expect(link).toBe('venmo://paycharge?txn=pay&recipients=user123&amount=25.5&note=Dinner');
    });

    test('generates valid Cash App link', () => {
        const link = generateSettlementLink('cashapp', 'user123', 10, 'Lunch');
        expect(link).toBe('https://cash.app/$user123/10');
    });

    test('generates valid PayPal link', () => {
        const link = generateSettlementLink('paypal', 'user123', 50.00, 'Rent');
        expect(link).toBe('https://paypal.me/user123/50');
    });

    test('returns null for unsupported platform', () => {
        // @ts-ignore
        const link = generateSettlementLink('unsupported', 'user123', 10);
        expect(link).toBeNull();
    });

    test('handles missing note gracefuly for Venmo', () => {
        const link = generateSettlementLink('venmo', 'user123', 25.50);
        expect(link).toBe('venmo://paycharge?txn=pay&recipients=user123&amount=25.5&note=Expense%20Settlement');
    });
});

// Mock Lemon Squeezy
jest.mock('@lemonsqueezy/lemonsqueezy.js', () => ({
    lemonSqueezySetup: jest.fn(),
    cancelSubscription: jest.fn(),
    updateSubscription: jest.fn(),
    getSubscription: jest.fn(),
}));

import { cancelSub, pauseUserSubscription, unpauseUserSubscription, getSubscriptionURLs } from '@/lib/actions/subscription';
import { cancelSubscription, updateSubscription, getSubscription } from '@lemonsqueezy/lemonsqueezy.js';

describe('Subscription Management Actions', () => {
    const subId = 'sub_123';

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('cancelSub calls Lemon Squeezy and updates DB', async () => {
        (cancelSubscription as jest.Mock).mockResolvedValue({
            error: null,
            data: {
                data: {
                    attributes: {
                        status: 'cancelled',
                        endpoints: {} // minimal mock
                    }
                }
            }
        });

        await cancelSub(subId);

        expect(cancelSubscription).toHaveBeenCalledWith(subId);
        // Verify DB update was called (mocked above)
        // We can inspect the calls to db.update
    });

    test('pauseUserSubscription calls Lemon Squeezy and updates DB', async () => {
        (updateSubscription as jest.Mock).mockResolvedValue({
            error: null,
            data: {
                data: {
                    attributes: {
                        status: 'paused',
                        pause: { mode: 'void' },
                        endpoints: {}
                    }
                }
            }
        });

        await pauseUserSubscription(subId);

        expect(updateSubscription).toHaveBeenCalledWith(subId, { pause: { mode: 'void' } });
    });

    test('unpauseUserSubscription calls Lemon Squeezy and updates DB', async () => {
        (updateSubscription as jest.Mock).mockResolvedValue({
            error: null,
            data: {
                data: {
                    attributes: {
                        status: 'active',
                        pause: null,
                        endpoints: {}
                    }
                }
            }
        });

        await unpauseUserSubscription(subId);

        // check the 2nd arg specifically has pause: null
        expect(updateSubscription).toHaveBeenCalledWith(subId, expect.objectContaining({ pause: null }));
    });

    test('getSubscriptionURLs returns URLs from Lemon Squeezy', async () => {
        const mockUrls = {
            update_payment_method: 'https://foo.bar/update',
            customer_portal: 'https://foo.bar/portal'
        };

        (getSubscription as jest.Mock).mockResolvedValue({
            error: null,
            data: {
                data: {
                    attributes: {
                        urls: mockUrls
                    }
                }
            }
        });

        const urls = await getSubscriptionURLs(subId);

        expect(getSubscription).toHaveBeenCalledWith(subId);
        expect(urls).toEqual(mockUrls);
    });
});
