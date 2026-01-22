// filepath: app/(main)/dashboard/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { GroupCard } from '@/components/GroupCard';
import { CreateGroupModal } from '@/components/CreateGroupModal';
import { Users, TrendingUp, DollarSign, Sparkles, Mail } from 'lucide-react';
import { getPendingInvitations, respondToInvitation } from '@/lib/actions/groups';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/useToast';
import { useGroups } from '@/hooks/useGroups';

interface PendingInvite {
  id: number;
  group: { name: string };
  invitedBy: { name: string | null };
}

export default function Dashboard() {
  const { data: groups = [], isLoading: loading, refetch } = useGroups();
  const { toast } = useToast();
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);
  const [invitesOpen, setInvitesOpen] = useState(false);

  // Load pending invites on mount
  useEffect(() => {
    const loadInvites = async () => {
      try {
        const invites = await getPendingInvitations();
        setPendingInvites(invites);
      } catch {
        console.error('Failed to load invites');
      }
    };
    loadInvites();
  }, []);

  const handleRespondToInvite = async (invitationId: number, accept: boolean) => {
    try {
      await respondToInvitation(invitationId, accept);
      toast({
        title: accept ? "Invitation Accepted" : "Invitation Declined",
        description: accept ? "You have joined the group." : "You declined the invitation.",
      });
      // Refresh invites and groups
      const invites = await getPendingInvitations();
      setPendingInvites(invites);
      if (accept) refetch();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to respond to invitation",
        variant: "destructive",
      });
      // Refresh invites to remove any stale entries
      const invites = await getPendingInvitations();
      setPendingInvites(invites);
    }
  };

  const handleGroupUpdate = () => {
    refetch(); // Assuming refetch from useGroups covers both groups and balances
  };

  // Calculate stats
  const totalBalance = groups.reduce((sum, group) => sum + (group.balance || 0), 0);
  const totalGroups = groups.length;
  const totalMembers = groups.reduce((sum, group) => sum + group.members.length, 0);

  const formatBalance = (amount: number) => {
    const abs = Math.abs(amount);
    const formatted = abs.toFixed(2);
    if (amount > 0) {
      return { text: `+$${formatted}`, color: 'text-green-600' };
    } else if (amount < 0) {
      return { text: `-$${formatted}`, color: 'text-red-600' };
    }
    return { text: '$0.00', color: 'text-muted-foreground' };
  };

  const balance = formatBalance(totalBalance);

  const renderInvitationsDialog = () => (
    <Dialog open={invitesOpen} onOpenChange={setInvitesOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="relative">
          <Mail className="h-4 w-4 mr-2" />
          Invites
          <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-red-500 text-[10px] font-bold text-white flex items-center justify-center">
            {pendingInvites.length}
          </span>
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Pending Invitations</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {pendingInvites.map((invite) => (
            <div key={invite.id} className="flex items-center justify-between p-4 border rounded-lg">
              <div className="space-y-1">
                <p className="font-medium">Join &quot;{invite.group.name}&quot;</p>
                <div className="flex items-center text-sm text-muted-foreground">
                  <span>Invited by {invite.invitedBy.name}</span>
                </div>
              </div>
              <div className="flex space-x-2">
                <Button size="sm" variant="outline" onClick={() => handleRespondToInvite(invite.id, false)}>
                  Decline
                </Button>
                <Button size="sm" onClick={() => handleRespondToInvite(invite.id, true)}>
                  Accept
                </Button>
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <Skeleton className="h-8 w-48 mb-2" />
            <Skeleton className="h-4 w-64" />
          </div>
          <div className="flex space-x-3">
            <Skeleton className="h-10 w-24" />
            <Skeleton className="h-10 w-32" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-48" />)}
        </div>
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="w-24 h-24 bg-black rounded-full flex items-center justify-center mx-auto mb-6">
          <Sparkles className="h-12 w-12 text-white" />
        </div>
        <h2 className="text-2xl font-bold mb-4">Welcome to Spliq!</h2>
        <p className="text-muted-foreground mb-4">
          You haven&apos;t joined any groups yet. Create a new group or join an existing one to start splitting expenses!
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          {pendingInvites.length > 0 && renderInvitationsDialog()}
          <CreateGroupModal onGroupCreated={handleGroupUpdate} />
          {/* <JoinGroupModal onGroupJoined={handleGroupUpdate} /> */}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold">Your Groups</h1>
          <p className="text-muted-foreground">
            Manage your shared expenses across {totalGroups} group{totalGroups !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex space-x-3">
          {pendingInvites.length > 0 && renderInvitationsDialog()}
          {/* <JoinGroupModal onGroupJoined={handleGroupUpdate} /> */}
          <CreateGroupModal onGroupCreated={handleGroupUpdate} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Balance</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${balance.color}`}>
              {balance.text}
            </div>
            <p className="text-xs text-muted-foreground">
              {totalBalance > 0 ? "You are owed money" : totalBalance < 0 ? "You owe money" : "You're all settled up"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Groups</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalGroups}</div>
            <p className="text-xs text-muted-foreground">
              {groups.filter(g => g.unreadCount > 0).length} with new activity
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Members</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalMembers}</div>
            <p className="text-xs text-muted-foreground">
              Across all your groups
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {groups.map((group) => (
          <GroupCard key={group.id} group={group} />
        ))}
      </div>
    </div>
  );
}
