'use client';

import { useEffect, useState, useTransition } from 'react';
import { Check, Loader2, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { getPlans, getCheckoutUrl, isSubscribed } from '@/lib/actions/billing';
import type { Plan } from '@/lib/db/schema';

interface PricingProps {
  className?: string;
}

// Features for each plan tier
const planFeatures: Record<string, string[]> = {
  free: [
    'Unlimited expense splitting',
    'Up to 3 groups',
    'Basic expense tracking',
  ],
  pro: [
    'AI Receipt Scanning',
    'Smart Settlement Links',
    'Advanced Charts & Analytics',
    'Unlimited groups',
    'Priority Support',
  ],
};

export function Pricing({ className }: PricingProps) {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [userIsSubscribed, setUserIsSubscribed] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [checkoutLoading, setCheckoutLoading] = useState<number | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        const [plansData, subscribed] = await Promise.all([
          getPlans(),
          isSubscribed(),
        ]);
        setPlans(plansData);
        setUserIsSubscribed(subscribed);
      } catch (error) {
        console.error('Failed to load plans:', error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const handleUpgrade = async (variantId: number) => {
    setCheckoutLoading(variantId);
    try {
      const checkoutUrl = await getCheckoutUrl(variantId);
      if (checkoutUrl) {
        window.open(checkoutUrl, '_blank');
      }
    } catch (error) {
      console.error('Failed to create checkout:', error);
    } finally {
      setCheckoutLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Format price from cents to dollars
  const formatPrice = (priceInCents: string) => {
    const price = parseInt(priceInCents, 10) / 100;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: price % 1 === 0 ? 0 : 2,
    }).format(price);
  };

  return (
    <div className={cn('grid gap-6 md:grid-cols-2 lg:max-w-4xl', className)}>
      {/* Free Plan Card */}
      <Card className="relative flex flex-col">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span>Free</span>
          </CardTitle>
          <CardDescription>
            Get started with expense splitting
          </CardDescription>
        </CardHeader>
        <CardContent className="flex-1">
          <div className="mb-4">
            <span className="text-3xl font-bold">$0</span>
            <span className="text-muted-foreground">/month</span>
          </div>
          <ul className="space-y-2">
            {planFeatures.free.map((feature) => (
              <li key={feature} className="flex items-center gap-2">
                <Check className="h-4 w-4 text-green-500" />
                <span className="text-sm">{feature}</span>
              </li>
            ))}
          </ul>
        </CardContent>
        <CardFooter>
          <Button variant="outline" className="w-full" disabled>
            Current Plan
          </Button>
        </CardFooter>
      </Card>

      {/* Pro Plan Cards from Database */}
      {plans.map((plan) => (
        <Card
          key={plan.id}
          className="relative flex flex-col border-2 border-primary"
        >
          <div className="absolute -top-3 left-1/2 -translate-x-1/2">
            <span className="rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground">
              Most Popular
            </span>
          </div>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary">
                <Zap className="h-4 w-4 text-primary-foreground" />
              </div>
              <span>{plan.name}</span>
            </CardTitle>
            <CardDescription>
              {plan.description || 'Unlock all premium features'}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-1">
            <div className="mb-4">
              <span className="text-3xl font-bold">
                {formatPrice(plan.price)}
              </span>
              <span className="text-muted-foreground">
                /{plan.interval || 'month'}
              </span>
            </div>
            <ul className="space-y-2">
              {planFeatures.pro.map((feature) => (
                <li key={feature} className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span className="text-sm">{feature}</span>
                </li>
              ))}
            </ul>
          </CardContent>
          <CardFooter>
            {userIsSubscribed ? (
              <Button variant="outline" className="w-full" disabled>
                Current Plan
              </Button>
            ) : (
              <Button
                className="w-full"
                onClick={() => handleUpgrade(plan.variantId)}
                disabled={checkoutLoading === plan.variantId}
              >
                {checkoutLoading === plan.variantId ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Loading...
                  </>
                ) : (
                  'Upgrade Now'
                )}
              </Button>
            )}
          </CardFooter>
        </Card>
      ))}

      {/* Fallback if no plans are synced */}
      {plans.length === 0 && (
        <Card className="relative flex flex-col border-2 border-primary">
          <div className="absolute -top-3 left-1/2 -translate-x-1/2">
            <span className="rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground">
              Most Popular
            </span>
          </div>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary">
                <Zap className="h-4 w-4 text-primary-foreground" />
              </div>
              <span>Pro</span>
            </CardTitle>
            <CardDescription>Unlock all premium features</CardDescription>
          </CardHeader>
          <CardContent className="flex-1">
            <div className="mb-4">
              <span className="text-3xl font-bold">$4.99</span>
              <span className="text-muted-foreground">/month</span>
            </div>
            <ul className="space-y-2">
              {planFeatures.pro.map((feature) => (
                <li key={feature} className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span className="text-sm">{feature}</span>
                </li>
              ))}
            </ul>
          </CardContent>
          <CardFooter>
            <Button variant="outline" className="w-full" disabled>
              Plans Loading...
            </Button>
          </CardFooter>
        </Card>
      )}
    </div>
  );
}