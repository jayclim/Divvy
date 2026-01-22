"use client";

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Card, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Plus, Users, MapPin, Home, Crown, Info } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { createGroup } from '@/lib/actions/groups';
import { getGroupLimitStatus } from '@/lib/actions/limits';
import { useToast } from '@/hooks/useToast';
import { useRouter } from 'next/navigation';

interface CreateGroupModalProps {
  onGroupCreated: () => void;
}

interface LimitStatus {
  groupCount: number;
  limit: number | string;
  canCreateGroup: boolean;
  remaining: number;
  isPro: boolean;
}

export function CreateGroupModal({ onGroupCreated }: CreateGroupModalProps) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [limitStatus, setLimitStatus] = useState<LimitStatus | null>(null);
  const { toast } = useToast();
  const router = useRouter();
  const [createdGroup, setCreatedGroup] = useState<{ id: number; name: string } | null>(null);

  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm<{ name: string; description: string }>();

  // Fetch limit status when modal opens
  useEffect(() => {
    if (open) {
      getGroupLimitStatus().then((result) => {
        if (result) setLimitStatus(result);
      });
    }
  }, [open]);

  const templates = [
    {
      id: 'roommates',
      title: 'Roommate Expenses',
      description: 'Perfect for shared living costs',
      icon: <Home className="h-6 w-6" />,
      defaultName: 'Roommates',
      defaultDescription: 'Shared apartment expenses'
    },
    {
      id: 'trip',
      title: 'Trip Planning',
      description: 'Great for group vacations',
      icon: <MapPin className="h-6 w-6" />,
      defaultName: 'Weekend Trip',
      defaultDescription: 'Group vacation expenses'
    },
    {
      id: 'custom',
      title: 'Custom Group',
      description: 'Create your own setup',
      icon: <Users className="h-6 w-6" />,
      defaultName: '',
      defaultDescription: ''
    }
  ];

  const handleTemplateSelect = (template: typeof templates[0]) => {
    // Show info toast if at limit instead of proceeding
    if (limitStatus && !limitStatus.canCreateGroup) {
      toast({
        title: "Group Limit Reached",
        description: "Upgrade to Pro for unlimited groups!",
      });
      return;
    }

    setStep(2);
    // Pre-fill form with template data using setValue
    if (template.defaultName) {
      setValue('name', template.defaultName);
    }
    if (template.defaultDescription) {
      setValue('description', template.defaultDescription);
    }
  };

  const onSubmit = async (data: { name: string; description: string }) => {
    // Double-check limit before submitting
    if (limitStatus && !limitStatus.canCreateGroup) {
      toast({
        title: "Group Limit Reached",
        description: "Upgrade to Pro for unlimited groups!",
      });
      return;
    }

    try {
      setLoading(true);
      console.log('Creating group:', data);
      const newGroup = await createGroup(data.name, data.description);
      setCreatedGroup(newGroup);
      setStep(3); // Move to confirmation step
      toast({
        title: "Group created!",
        description: "Your new group is ready to use.",
      });
      onGroupCreated();
    } catch (error) {
      console.error('Error creating group:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create group",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setOpen(false);
    setStep(1);
    setCreatedGroup(null);
    reset();
  };

  const isAtLimit = limitStatus && !limitStatus.canCreateGroup;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
        >
          <Plus className="h-4 w-4 mr-2" />
          Create Group
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md bg-white">
        <DialogHeader>
          <DialogTitle>
            {step === 1 ? 'Choose a Template' : step === 2 ? 'Create Your Group' : 'Group Created!'}
          </DialogTitle>
        </DialogHeader>

        {/* Limit Status Banner */}
        {step === 1 && limitStatus && !limitStatus.isPro && (
          <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${isAtLimit
            ? 'bg-amber-50 border border-amber-200 text-amber-800'
            : 'bg-blue-50 border border-blue-200 text-blue-800'
            }`}>
            {isAtLimit ? (
              <>
                <Crown className="h-4 w-4 text-amber-600" />
                <span>You've reached the free limit of {limitStatus.limit} groups.</span>
                <Button
                  size="sm"
                  variant="outline"
                  className="ml-auto text-xs border-amber-300 hover:bg-amber-100"
                  onClick={() => router.push('/settings')}
                >
                  Upgrade
                </Button>
              </>
            ) : (
              <>
                <Info className="h-4 w-4 text-blue-600" />
                <span>{limitStatus.remaining} of {limitStatus.limit} groups remaining</span>
              </>
            )}
          </div>
        )}

        {step === 1 ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Create a group to split expenses with friends, roommates, or family. You can add members by email or share an invite link.
              For example, &quot;Summer Trip 2024&quot; or &quot;Apartment 4B&quot;.
            </p>
            <div className="space-y-3">
              {templates.map((template) => (
                <Card
                  key={template.id}
                  className={`cursor-pointer transition-shadow ${isAtLimit
                    ? 'opacity-50 cursor-not-allowed'
                    : 'hover:shadow-md'
                    }`}
                  onClick={() => handleTemplateSelect(template)}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center text-white">
                        {template.icon}
                      </div>
                      <div>
                        <CardTitle className="text-base">{template.title}</CardTitle>
                        <CardDescription className="text-sm">
                          {template.description}
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                </Card>
              ))}
            </div>
          </div>
        ) : step === 2 ? (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="groupName">Group Name</Label>
              <Input
                id="groupName"
                {...register('name', { required: 'Group name is required' })}
                placeholder="Enter group name"
              />
              {errors.name && (
                <p className="text-sm text-red-600">{errors.name.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="groupDescription">Description (Optional)</Label>
              <Textarea
                id="groupDescription"
                {...register('description')}
                placeholder="What's this group for?"
                rows={3}
              />
            </div>

            <div className="flex space-x-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep(1)}
                className="flex-1"
              >
                Back
              </Button>
              <Button
                type="submit"
                disabled={loading || !!isAtLimit}
                className="flex-1 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
              >
                {loading ? 'Creating...' : 'Create Group'}
              </Button>
            </div>
          </form>
        ) : (
          <div className="space-y-4 text-center">
            <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto">
              <Users className="h-8 w-8" />
            </div>
            <div>
              <h3 className="text-lg font-medium">&quot;{createdGroup?.name}&quot; is ready!</h3>
              <p className="text-sm text-muted-foreground mt-2">
                You can now add members to your group. Go to the &quot;Members&quot; tab in the group settings to add friends or create &quot;ghost&quot; members for quick splitting.
              </p>
            </div>
            <Button
              className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
              onClick={() => {
                handleClose();
                if (createdGroup) {
                  router.push(`/groups/${createdGroup.id}`);
                }
              }}
            >
              Go to Group
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}