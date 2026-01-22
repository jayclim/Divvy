import { useState, useEffect, useMemo } from 'react';
import { useUser } from '@clerk/nextjs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter, DialogClose } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Settings, Users, Trash2, UserMinus, Crown, Mail, Ghost, ArrowUpCircle, ArrowDownCircle } from 'lucide-react';
import { Group } from '@/api/groups';
import { createGhostMember, inviteMember, removeMember, updateGroupRole, cancelInvitation } from '@/lib/actions/groups';
import { useToast } from '@/hooks/useToast';

interface GroupSettingsModalProps {
  group: Group;
  onGroupUpdated: () => void;
}

export function GroupSettingsModal({ group, onGroupUpdated }: GroupSettingsModalProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [ghostName, setGhostName] = useState('');
  // Default to notifications
  const [activeTab, setActiveTab] = useState("notifications");
  const [addMemberMode, setAddMemberMode] = useState<'email' | 'ghost'>('email');
  const [memberToRemove, setMemberToRemove] = useState<string | null>(null);
  const { toast } = useToast();
  const { user } = useUser();

  const currentUserRole = group.members.find(m => m._id === user?.id)?.role;
  const isOwner = currentUserRole === 'owner';
  const isAdmin = currentUserRole === 'admin';
  const isMember = currentUserRole === 'member';

  // Determine available tabs
  // Member: Notifications only (no tabs UI, just content)
  // Admin: Notifications, Info, Members
  // Owner: Notifications, Info, Members, Advanced

  const showTabs = !isMember;
  const tabs = useMemo(() => {
    const t = ['notifications', 'info', 'members'];
    if (isOwner) {
      t.push('advanced');
    }
    return t;
  }, [isOwner]);

  // Effect to ensure valid tab selection when role changes or modal opens
  useEffect(() => {
    if (isMember) {
      setActiveTab('notifications');
    } else if (!tabs.includes(activeTab)) {
      setActiveTab('notifications');
    }
  }, [currentUserRole, activeTab, isMember, tabs]);

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  const sortedMembers = [...group.members].sort((a, b) => {
    if (a._id === user?.id) return -1;
    if (b._id === user?.id) return 1;
    return (a.name || '').localeCompare(b.name || '');
  });

  const confirmRemoveMember = async () => {
    if (!memberToRemove) return;
    try {
      setLoading(true);
      await removeMember(group._id, memberToRemove);
      toast({
        title: "Member removed",
        description: "Member has been removed from the group.",
      });
      setMemberToRemove(null);
      onGroupUpdated();
    } catch (error) {
      console.error(error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to remove member",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateRole = async (memberId: string, newRole: 'admin' | 'member') => {
    try {
      setLoading(true);
      await updateGroupRole(group._id, memberId, newRole);
      toast({
        title: "Role updated",
        description: `Member role updated to ${newRole}.`,
      });
      onGroupUpdated();
    } catch (error) {
      console.error(error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update member role",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleInviteMember = async (ghostUserId?: string) => {
    if (!inviteEmail) return;
    try {
      setLoading(true);
      await inviteMember(group._id, inviteEmail, ghostUserId);
      toast({
        title: "Invitation sent",
        description: `Invitation sent to ${inviteEmail}`,
      });
      setInviteEmail('');
      onGroupUpdated();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to send invitation",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddGhostMember = async () => {
    if (!ghostName) return;
    try {
      setLoading(true);
      await createGhostMember(group._id, ghostName);
      toast({
        title: "Member added",
        description: `${ghostName} has been added to the group.`,
      });
      setGhostName('');
      onGroupUpdated();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to add member",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const canRemove = (targetRole: string) => {
    if (isOwner) return targetRole !== 'owner';
    if (isAdmin) return targetRole === 'member';
    return false;
  };

  const handleCancelInvitation = async (invitationId: number) => {
    try {
      setLoading(true);
      await cancelInvitation(group._id, invitationId);
      toast({
        title: "Invitation cancelled",
        description: "The invitation has been cancelled.",
      });
      onGroupUpdated();
    } catch (error) {
      console.error(error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to cancel invitation",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon">
          <Settings className="h-5 w-5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-3xl bg-white max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Settings className="h-5 w-5" />
            <span>{isMember ? 'Notifications' : 'Group Settings'}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="w-full">
          {showTabs && (
            <div className="flex w-full mb-4 bg-muted p-1 rounded-md overflow-x-auto">
              {tabs.map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`
                    flex-1 inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50
                    ${activeTab === tab ? 'bg-white text-foreground shadow-sm' : 'text-muted-foreground hover:bg-muted-foreground/10'}
                  `}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>
          )}

          {activeTab === 'info' && (isOwner || isAdmin) && (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Group Information</CardTitle>
                  <CardDescription>Update your group details</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="groupName">Group Name</Label>
                    <Input id="groupName" defaultValue={group.name} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="groupDescription">Description</Label>
                    <Textarea id="groupDescription" defaultValue={group.description} rows={3} />
                  </div>
                  <Button className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700">
                    Save Changes
                  </Button>
                </CardContent>
              </Card>
            </div>
          )}

          {activeTab === 'members' && (isOwner || isAdmin) && (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Manage Members</CardTitle>
                  <CardDescription>Add or remove group members</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4 p-4 border rounded-lg bg-slate-50">
                    <h4 className="font-medium flex items-center">
                      <Users className="h-4 w-4 mr-2" />
                      Add New Member
                    </h4>
                    <div className="flex space-x-2 mb-4">
                      <Button
                        variant={addMemberMode === 'email' ? 'default' : 'outline'}
                        onClick={() => setAddMemberMode('email')}
                        className="flex-1"
                        size="sm"
                      >
                        Invite by Email
                      </Button>
                      <Button
                        variant={addMemberMode === 'ghost' ? 'default' : 'outline'}
                        onClick={() => setAddMemberMode('ghost')}
                        className="flex-1"
                        size="sm"
                      >
                        Add Ghost User
                      </Button>
                    </div>

                    {addMemberMode === 'email' ? (
                      <div className="space-y-3">
                        <div className="flex space-x-2">
                          <Input
                            placeholder="friend@example.com"
                            value={inviteEmail}
                            onChange={(e) => setInviteEmail(e.target.value)}
                          />
                          <Button onClick={() => handleInviteMember()} disabled={loading || !inviteEmail}>
                            <Mail className="h-4 w-4 mr-2" />
                            Invite
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Send an invitation email to add a registered user.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="flex space-x-2">
                          <Input
                            placeholder="Member Name (e.g. Bob)"
                            value={ghostName}
                            onChange={(e) => setGhostName(e.target.value)}
                          />
                          <Button onClick={handleAddGhostMember} disabled={loading || !ghostName}>
                            <Ghost className="h-4 w-4 mr-2" />
                            Add
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Add a member without an account. You can link them later.
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="space-y-4">

                    {group.pendingInvitations && group.pendingInvitations.length > 0 && (
                      <div className="mb-6">
                        <h4 className="font-medium mb-3">Pending Invitations</h4>
                        <div className="space-y-2">
                          {group.pendingInvitations.map((invite) => (
                            <div key={invite.id} className="flex items-center justify-between p-3 border rounded-lg bg-slate-50 border-slate-200">
                              <div className="flex items-center space-x-3">
                                <div className="h-8 w-8 rounded-full bg-slate-200 flex items-center justify-center">
                                  <Mail className="h-4 w-4 text-slate-500" />
                                </div>
                                <div>
                                  <p className="font-medium text-sm">
                                    {invite.ghostUser ? `Claim Request: ${invite.ghostUser.name}` : `Invited: ${invite.email}`}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {invite.ghostUser ? `Sent to ${invite.email}` : `Invited by ${invite.invitedBy.name}`}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center space-x-2">
                                <Badge variant="outline" className="text-orange-600 border-orange-200 bg-orange-50">
                                  Pending
                                </Badge>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleCancelInvitation(invite.id)}
                                  disabled={loading}
                                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                >
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <h4 className="font-medium">Current Members</h4>
                    {sortedMembers.map((member) => (
                      <div key={member._id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center space-x-3">
                          <Avatar>
                            <AvatarImage src={member.avatar} />
                            <AvatarFallback>{getInitials(member.name)}</AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">{member.name}</p>
                            {!member.isGhost && (
                              <p className="text-sm text-muted-foreground">{member.email}</p>
                            )}
                            {member.isGhost && (
                              <Badge variant="outline" className="text-xs mt-1">Ghost User</Badge>
                            )}
                          </div>
                          {member.role === 'owner' && <Badge className="bg-black text-white hover:bg-black/90">Owner</Badge>}
                          {member.role === 'admin' && <Badge className="bg-indigo-500 hover:bg-indigo-600 border-transparent text-white">Admin</Badge>}
                          {member.role === 'member' && <Badge variant="outline" className="text-slate-500 border-slate-200">Member</Badge>}
                        </div>
                        <div className="flex space-x-2">
                          {member.isGhost && (
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button size="sm" variant="outline">
                                  <Mail className="h-4 w-4 mr-1" />
                                  Claim
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="sm:max-w-md">
                                <DialogHeader>
                                  <DialogTitle>Invite User to Claim {member.name}</DialogTitle>
                                  <DialogDescription>
                                    Enter the email address of the person who should claim this ghost profile.
                                  </DialogDescription>
                                </DialogHeader>
                                <div className="flex items-center space-x-2">
                                  <Input
                                    placeholder="email@example.com"
                                    value={inviteEmail}
                                    onChange={(e) => setInviteEmail(e.target.value)}
                                  />
                                  <Button onClick={() => handleInviteMember(member._id)} disabled={loading || !inviteEmail}>
                                    Send
                                  </Button>
                                </div>
                              </DialogContent>
                            </Dialog>
                          )}
                          {canRemove(member.role) && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setMemberToRemove(member._id)}
                              disabled={loading}
                              className="text-red-600 hover:text-red-700"
                            >
                              <UserMinus className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Notification Settings</CardTitle>
                  <CardDescription>Manage your notification preferences</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">New Expenses</p>
                      <p className="text-sm text-muted-foreground">Get notified when expenses are added</p>
                    </div>
                    <input type="checkbox" defaultChecked className="rounded" />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Settlement Requests</p>
                      <p className="text-sm text-muted-foreground">Get notified about payment requests</p>
                    </div>
                    <input type="checkbox" defaultChecked className="rounded" />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">New Messages</p>
                      <p className="text-sm text-muted-foreground">Get notified about group messages</p>
                    </div>
                    <input type="checkbox" defaultChecked className="rounded" />
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {activeTab === 'advanced' && isOwner && (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-red-600">Danger Zone</CardTitle>
                  <CardDescription>Irreversible actions</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-4 border rounded-lg bg-slate-50">
                    <h4 className="font-medium mb-4 flex items-center">
                      <Crown className="h-4 w-4 mr-2" />
                      Manage Roles
                    </h4>
                    <div className="space-y-3">
                      {sortedMembers.map((member) => (
                        <div key={member._id} className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={member.avatar} />
                              <AvatarFallback>{getInitials(member.name)}</AvatarFallback>
                            </Avatar>
                            <span className="text-sm font-medium">{member.name}</span>
                            {member.role === 'owner' && <Badge className="ml-2 bg-black text-white hover:bg-black/90">Owner</Badge>}
                            {member.role === 'admin' && <Badge className="ml-2 bg-indigo-500 hover:bg-indigo-600 border-transparent text-white">Admin</Badge>}
                            {member.role === 'member' && <Badge variant="outline" className="ml-2 text-slate-500 border-slate-200">Member</Badge>}
                          </div>

                          {member.role !== 'owner' && (
                            <div className="flex items-center space-x-2">
                              {member.role === 'member' ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleUpdateRole(member._id, 'admin')}
                                  disabled={loading}
                                  className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                >
                                  <ArrowUpCircle className="h-4 w-4 mr-1" />
                                  Promote
                                </Button>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleUpdateRole(member._id, 'member')}
                                  disabled={loading}
                                  className="text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                                >
                                  <ArrowDownCircle className="h-4 w-4 mr-1" />
                                  Demote
                                </Button>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="p-4 border border-red-200 rounded-lg bg-red-50">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-red-800">Delete Group</p>
                        <p className="text-sm text-red-600">This action cannot be undone</p>
                      </div>
                      <Button variant="destructive">
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete Group
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </DialogContent>

      <Dialog open={!!memberToRemove} onOpenChange={(open) => !open && setMemberToRemove(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-red-600 flex items-center">
              <Trash2 className="h-5 w-5 mr-2" />
              Remove Member
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to remove this member? They will be removed from the group, but their expense history will be preserved as "Removed User".
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="sm:justify-end">
            <DialogClose asChild>
              <Button type="button" variant="secondary">
                Cancel
              </Button>
            </DialogClose>
            <Button type="button" variant="destructive" onClick={confirmRemoveMember} disabled={loading}>
              {loading ? "Removing..." : "Remove Member"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}