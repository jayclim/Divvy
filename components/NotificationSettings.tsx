'use client';

import { useState, useTransition } from 'react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import {
  updateNotificationPreferences,
  type NotificationPreferences,
} from '@/lib/actions/notifications';

type NotificationSettingsProps = {
  initialPreferences: NotificationPreferences;
};

export function NotificationSettings({ initialPreferences }: NotificationSettingsProps) {
  const [preferences, setPreferences] = useState(initialPreferences);
  const [isPending, startTransition] = useTransition();

  const handleToggle = (key: keyof NotificationPreferences) => {
    if (key === 'digestFrequency') return;

    const newValue = !preferences[key];
    setPreferences(prev => ({ ...prev, [key]: newValue }));

    startTransition(async () => {
      const result = await updateNotificationPreferences({ [key]: newValue });
      if (!result.success) {
        // Revert on error
        setPreferences(prev => ({ ...prev, [key]: !newValue }));
        toast.error('Failed to update preferences');
      }
    });
  };

  const handleFrequencyChange = (value: NotificationPreferences['digestFrequency']) => {
    setPreferences(prev => ({ ...prev, digestFrequency: value }));

    startTransition(async () => {
      const result = await updateNotificationPreferences({ digestFrequency: value });
      if (!result.success) {
        setPreferences(prev => ({ ...prev, digestFrequency: initialPreferences.digestFrequency }));
        toast.error('Failed to update preferences');
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Immediate Notifications */}
      <div className="space-y-4">
        <div>
          <h4 className="text-sm font-medium mb-1">Immediate Notifications</h4>
          <p className="text-xs text-muted-foreground">These are sent right away</p>
        </div>

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="invitations" className="text-sm font-normal">
              Group invitations
            </Label>
            <p className="text-xs text-muted-foreground">
              When someone invites you to a group
            </p>
          </div>
          <Switch
            id="invitations"
            checked={preferences.invitations}
            onCheckedChange={() => handleToggle('invitations')}
            disabled={isPending}
          />
        </div>
      </div>

      {/* Digest Notifications */}
      <div className="space-y-4 pt-4 border-t">
        <div>
          <h4 className="text-sm font-medium mb-1">Activity Digest</h4>
          <p className="text-xs text-muted-foreground">
            Bundled updates about your groups
          </p>
        </div>

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="digestFrequency" className="text-sm font-normal">
              Digest frequency
            </Label>
            <p className="text-xs text-muted-foreground">
              How often to receive activity summaries
            </p>
          </div>
          <Select
            value={preferences.digestFrequency}
            onValueChange={handleFrequencyChange}
            disabled={isPending}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="daily">Daily</SelectItem>
              <SelectItem value="weekly">Weekly</SelectItem>
              <SelectItem value="none">Never</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {preferences.digestFrequency !== 'none' && (
          <>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="expenseAdded" className="text-sm font-normal">
                  New expenses
                </Label>
                <p className="text-xs text-muted-foreground">
                  When expenses are added that include you
                </p>
              </div>
              <Switch
                id="expenseAdded"
                checked={preferences.expenseAdded}
                onCheckedChange={() => handleToggle('expenseAdded')}
                disabled={isPending}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="settlementReceived" className="text-sm font-normal">
                  Settlements
                </Label>
                <p className="text-xs text-muted-foreground">
                  When someone records a payment to you
                </p>
              </div>
              <Switch
                id="settlementReceived"
                checked={preferences.settlementReceived}
                onCheckedChange={() => handleToggle('settlementReceived')}
                disabled={isPending}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="memberActivity" className="text-sm font-normal">
                  Member activity
                </Label>
                <p className="text-xs text-muted-foreground">
                  When members join or leave your groups
                </p>
              </div>
              <Switch
                id="memberActivity"
                checked={preferences.memberActivity}
                onCheckedChange={() => handleToggle('memberActivity')}
                disabled={isPending}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
