import { getProfile, updateProfile } from "@/lib/actions/user";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { redirect } from "next/navigation";
import { getCurrentUserSubscription, getSubscriptionURLs } from "@/lib/actions/subscription";
import { SubscriptionManagement } from "@/components/SubscriptionManagement";
import { PricingModal } from "@/components/PricingModal";
import { DeleteAccountButton } from "@/components/DeleteAccountButton";
import { NotificationSettings } from "@/components/NotificationSettings";
import { getNotificationPreferences } from "@/lib/actions/notifications";

export default async function SettingsPage() {
  const user = await getProfile();

  if (!user) {
    redirect("/sign-in");
  }

  // Get subscription details from subscriptions table
  const subscription = await getCurrentUserSubscription();

  // Get notification preferences
  const notificationPreferences = await getNotificationPreferences();

  // Determine the subscription ID to use (from subscriptions table or user record)
  const subscriptionId = subscription?.lemonSqueezyId || user.lemonSqueezySubscriptionId;

  // Get customer portal URLs if user has a subscription ID
  let subscriptionUrls: { customer_portal?: string; update_payment_method?: string } | null = null;
  if (subscriptionId) {
    try {
      subscriptionUrls = await getSubscriptionURLs(subscriptionId);
    } catch (error) {
      console.error('Failed to fetch subscription URLs:', error);
    }
  }

  // Cast paymentMethods to known type safely
  const paymentMethods = (user.paymentMethods as Record<string, string>) || {};

  async function savePaymentMethods(formData: FormData) {
    "use server";
    const methods = {
      venmo: formData.get("venmo") as string,
      cashapp: formData.get("cashapp") as string,
      paypal: formData.get("paypal") as string,
    };
    await updateProfile({ paymentMethods: methods });
  }

  // Prepare subscription data for the client component
  // Use subscription table data if available, otherwise fallback to user record
  const subscriptionData = (subscription || user.subscriptionTier === 'pro') ? {
    status: subscription?.status || user.subscriptionStatus || 'active',
    statusFormatted: subscription?.statusFormatted || (user.subscriptionStatus === 'active' ? 'Active' : user.subscriptionStatus),
    renewsAt: subscription?.renewsAt || user.currentPeriodEnd,
    endsAt: subscription?.endsAt || null,
    isPaused: subscription?.isPaused || user.isPaused || false,
    customerPortalUrl: subscriptionUrls?.customer_portal,
  } : null;

  return (
    <div className="container mx-auto max-w-2xl py-8 px-4">
      <h1 className="text-3xl font-bold mb-8">Account Settings</h1>

      <div className="space-y-6">
        {/* Subscription Card */}
        <Card>
          <CardHeader>
            <CardTitle>Subscription</CardTitle>
            <CardDescription>Manage your plan and billing details.</CardDescription>
          </CardHeader>
          <CardContent>
            {user.subscriptionTier === 'free' ? (
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">Current Plan</div>
                  <div className="text-sm text-muted-foreground">Free</div>
                </div>
                <PricingModal>
                  <Button variant="default">Upgrade to Pro</Button>
                </PricingModal>
              </div>
            ) : (
              <SubscriptionManagement
                subscription={subscriptionData}
                subscriptionTier={user.subscriptionTier}
              />
            )}
          </CardContent>
        </Card>

        {/* Payment Methods Card */}
        <Card>
          <CardHeader>
            <CardTitle>Smart Settlement Methods</CardTitle>
            <CardDescription>
              Add your handles to allow friends to pay you instantly with one click.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={savePaymentMethods} className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="venmo">Venmo Handle</Label>
                <Input
                  id="venmo"
                  name="venmo"
                  placeholder="@username"
                  defaultValue={paymentMethods.venmo || ''}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="cashapp">Cash App Cashtag</Label>
                <Input
                  id="cashapp"
                  name="cashapp"
                  placeholder="$cashtag"
                  defaultValue={paymentMethods.cashapp || ''}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="paypal">PayPal Username</Label>
                <Input
                  id="paypal"
                  name="paypal"
                  placeholder="username"
                  defaultValue={paymentMethods.paypal || ''}
                />
              </div>
              <Button type="submit">Save Changes</Button>
            </form>
          </CardContent>
        </Card>

        {/* Notification Settings Card */}
        {notificationPreferences && (
          <Card id="notifications">
            <CardHeader>
              <CardTitle>Email Notifications</CardTitle>
              <CardDescription>
                Choose which emails you want to receive from Spliq.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <NotificationSettings initialPreferences={notificationPreferences} />
            </CardContent>
          </Card>
        )}

        {/* Delete Account Card */}
        <Card className="border-destructive/50">
          <CardHeader>
            <CardTitle className="text-destructive">Danger Zone</CardTitle>
            <CardDescription>
              Permanently delete your account and all associated data.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Once you delete your account, your personal information will be permanently removed.
              Your expense history will be anonymized to preserve accurate balances for other group members.
            </p>
            <DeleteAccountButton />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
