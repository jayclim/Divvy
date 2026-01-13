'use client';

import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Users, MessageCircle, DollarSign } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { GroupCardData } from '@/lib/actions/groups'; // Import the correct data type

interface GroupCardProps {
  group: GroupCardData; // Use the correct data type
}

export function GroupCard({ group }: GroupCardProps) {
  const router = useRouter();

  const getInitials = (name: string | null) => {
    if (!name) return '??';
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  const formatBalance = (amount: number) => {
    const abs = Math.abs(amount);
    const formatted = abs.toFixed(2);
    if (amount > 0) {
      return { text: `+$${formatted}`, color: 'text-green-600', bg: 'bg-green-50' };
    } else if (amount < 0) {
      return { text: `-$${formatted}`, color: 'text-red-600', bg: 'bg-red-50' };
    }
    return { text: '$0.00', color: 'text-slate-600', bg: 'bg-slate-50' };
  };

  const balance = formatBalance(group.balance);

  return (
    <Card className="hover:shadow-lg transition-all duration-300 cursor-pointer group h-full flex flex-col" onClick={() => router.push(`/groups/${group.id}`)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg group-hover:text-slate-600 transition-colors">
            {group.name}
          </CardTitle>
          {group.unreadCount > 0 && (
            <Badge variant="destructive" className="h-5 w-5 p-0 flex items-center justify-center text-xs">
              {group.unreadCount}
            </Badge>
          )}
        </div>
        {group.description && (
          <p className="text-sm text-muted-foreground h-10 overflow-hidden text-ellipsis">{group.description}</p>
        )}
      </CardHeader>
      
      <CardContent className="space-y-4 mt-auto">
        {/* Members */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              {group.members.length} member{group.members.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="flex -space-x-2">
            {group.members.slice(0, 3).map((member) => (
              <Avatar key={member.id} className="h-6 w-6 border-2 border-white">
                <AvatarImage src={member.avatarUrl || undefined} />
                <AvatarFallback className="text-xs">
                  {getInitials(member.name)}
                </AvatarFallback>
              </Avatar>
            ))}
            {group.members.length > 3 && (
              <div className="h-6 w-6 rounded-full bg-slate-200 border-2 border-white flex items-center justify-center">
                <span className="text-xs text-slate-600">+{group.members.length - 3}</span>
              </div>
            )}
          </div>
        </div>

        {/* Balance */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <DollarSign className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Your balance</span>
          </div>
          <Badge variant="secondary" className={`${balance.bg} ${balance.color} border-0`}>
            {balance.text}
          </Badge>
        </div>

        {/* Recent Activity */}
        {group.recentActivity && (
          <div className="flex items-center space-x-2 pt-2 border-t">
            <MessageCircle className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground truncate">
              {group.recentActivity}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}