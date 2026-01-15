'use client';

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Crown, Calendar, ExternalLink } from 'lucide-react';

interface SubscriptionManagementProps {
    subscription: {
        status: string;
        statusFormatted: string | null;
        renewsAt: Date | null;
        endsAt: Date | null;
        isPaused: boolean;
        customerPortalUrl?: string;
    } | null;
    subscriptionTier: string;
}

export function SubscriptionManagement({ subscription, subscriptionTier }: SubscriptionManagementProps) {
    const isPro = subscriptionTier === 'pro';
    const isCancelled = subscription?.status === 'cancelled';

    const formatDate = (date: Date | null) => {
        if (!date) return null;
        return new Date(date).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        });
    };

    // Get status badge color
    const getStatusColor = (status: string) => {
        switch (status) {
            case 'active':
            case 'on_trial':
                return 'bg-green-100 text-green-800';
            case 'paused':
                return 'bg-yellow-100 text-yellow-800';
            case 'cancelled':
            case 'expired':
                return 'bg-red-100 text-red-800';
            case 'past_due':
                return 'bg-orange-100 text-orange-800';
            default:
                return 'bg-gray-100 text-gray-800';
        }
    };

    if (!isPro) {
        return (
            <div className="flex items-center justify-between">
                <div>
                    <div className="font-medium">Current Plan</div>
                    <div className="text-sm text-muted-foreground">Free</div>
                </div>
                <Button variant="default">Upgrade to Pro</Button>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Plan header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 text-lg font-semibold">
                        <Crown className="h-5 w-5 text-amber-500" />
                        Pro Plan
                    </div>
                    {subscription && (
                        <Badge className={getStatusColor(subscription.status)}>
                            {subscription.statusFormatted || subscription.status}
                        </Badge>
                    )}
                </div>
            </div>

            {/* Subscription details */}
            {subscription && (
                <div className="rounded-lg border bg-muted/50 p-4 space-y-2">
                    {subscription.renewsAt && !isCancelled && (
                        <div className="flex items-center gap-2 text-sm">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            <span className="text-muted-foreground">
                                {subscription.isPaused ? 'Paused' : 'Renews'} on {formatDate(subscription.renewsAt)}
                            </span>
                        </div>
                    )}
                    {isCancelled && subscription.endsAt && (
                        <div className="flex items-center gap-2 text-sm text-red-600">
                            <Calendar className="h-4 w-4" />
                            <span>Access ends on {formatDate(subscription.endsAt)}</span>
                        </div>
                    )}
                </div>
            )}

            {/* Manage Subscription Button */}
            {subscription?.customerPortalUrl && (
                <Button variant="outline" asChild>
                    <a href={subscription.customerPortalUrl} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Manage Subscription
                    </a>
                </Button>
            )}
        </div>
    );
}
