import { useState } from 'react';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Button } from './ui/button';
import { Skeleton } from './ui/skeleton';
import { Receipt, Calendar, DollarSign, Users, Plus, ArrowRightLeft, UserPlus, UserMinus, ChevronDown, ChevronUp, ListOrdered } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useGroupExpenses } from '@/hooks/useGroupDetails';
import { cn } from '@/lib/utils';

interface ExpenseHistoryProps {
  groupId: string;
  onAddExpense?: () => void;
}

export function ExpenseHistory({ groupId, onAddExpense }: ExpenseHistoryProps) {
  const { data: expensesData, isLoading: loading } = useGroupExpenses(groupId);
  const expenses = expensesData?.expenses || [];
  const [filter, setFilter] = useState<'all' | 'expense' | 'payment' | 'log'>('all');
  const [expandedExpenses, setExpandedExpenses] = useState<Set<string>>(new Set());

  const toggleExpanded = (expenseId: string) => {
    setExpandedExpenses(prev => {
      const next = new Set(prev);
      if (next.has(expenseId)) {
        next.delete(expenseId);
      } else {
        next.add(expenseId);
      }
      return next;
    });
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  const getCategoryColor = (category?: string) => {
    if (category === 'Payment') return 'bg-emerald-100 text-emerald-700';
    if (category === 'Log') return 'bg-gray-100 text-gray-700';
    
    const colors = {
      'Food': 'bg-orange-100 text-orange-700',
      'Transportation': 'bg-blue-100 text-blue-700',
      'Entertainment': 'bg-purple-100 text-purple-700',
      'Shopping': 'bg-pink-100 text-pink-700',
      'Utilities': 'bg-green-100 text-green-700',
      'Other': 'bg-slate-100 text-slate-700'
    };
    return colors[category as keyof typeof colors] || colors.Other;
  };

  const filteredExpenses = expenses.filter(expense => {
    if (filter === 'all') return true;
    if (filter === 'log') return expense.type === 'member_added' || expense.type === 'member_removed';
    return expense.type === filter;
  });

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter Buttons */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">History</h3>
        <div className="flex space-x-2">
          <Button
            variant={filter === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('all')}
          >
            All
          </Button>
          <Button
            variant={filter === 'expense' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('expense')}
          >
            Expenses
          </Button>
          <Button
            variant={filter === 'payment' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('payment')}
          >
            Payments
          </Button>
          <Button
            variant={filter === 'log' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('log')}
          >
            Logs
          </Button>
          {onAddExpense && (
            <Button
              size="sm"
              onClick={onAddExpense}
              className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 ml-2"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Expense
            </Button>
          )}
        </div>
      </div>

      {/* Expenses List */}
      <div className="space-y-3">
        {filteredExpenses.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Receipt className="h-12 w-12 text-slate-400 mx-auto mb-4" />
              <p className="text-muted-foreground">No activity found</p>
            </CardContent>
          </Card>
        ) : (
          filteredExpenses.map((expense) => (
            <Card key={expense._id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3 flex-1">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={expense.paidBy.avatar} />
                      <AvatarFallback>
                        {getInitials(expense.paidBy.name)}
                      </AvatarFallback>
                    </Avatar>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2 mb-1">
                        <h4 className="font-medium truncate">
                          {expense.type === 'member_added' || expense.type === 'member_removed' 
                            ? `${expense.entityName} ${expense.description}` 
                            : expense.description}
                        </h4>
                        {expense.type === 'payment' ? (
                          <Badge variant="secondary" className="text-xs bg-emerald-100 text-emerald-700">
                            Payment
                          </Badge>
                        ) : expense.type === 'member_added' ? (
                          <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-700">
                            Joined
                          </Badge>
                        ) : expense.type === 'member_removed' ? (
                          <Badge variant="secondary" className="text-xs bg-red-100 text-red-700">
                            Left
                          </Badge>
                        ) : (
                          <>
                            {expense.category && (
                              <Badge variant="secondary" className={`text-xs ${getCategoryColor(expense.category)}`}>
                                {expense.category}
                              </Badge>
                            )}
                            {expense.splitMethod === 'by_item' && (
                              <Badge variant="secondary" className="text-xs bg-amber-100 text-amber-700">
                                <ListOrdered className="h-3 w-3 mr-1" />
                                {expense.items?.length || 0} items
                              </Badge>
                            )}
                          </>
                        )}
                      </div>
                      
                      <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                        <span className="flex items-center space-x-1">
                          {expense.type === 'payment' ? <ArrowRightLeft className="h-3 w-3" /> : 
                           expense.type === 'member_added' ? <UserPlus className="h-3 w-3" /> :
                           expense.type === 'member_removed' ? <UserMinus className="h-3 w-3" /> :
                           <DollarSign className="h-3 w-3" />}
                          <span>
                            {expense.type === 'payment' 
                              ? `${expense.paidBy.name} paid ${expense.splitBetween[0].name}`
                              : expense.type === 'member_added' || expense.type === 'member_removed'
                              ? `Action by ${expense.actorName || expense.paidBy.name}`
                              : `Paid by ${expense.paidBy.name}`
                            }
                          </span>
                        </span>
                        {expense.type === 'expense' && (
                          <span className="flex items-center space-x-1">
                            <Users className="h-3 w-3" />
                            <span>{expense.splitBetween.length} people</span>
                          </span>
                        )}
                        <span className="flex items-center space-x-1">
                          <Calendar className="h-3 w-3" />
                          <span>{formatDistanceToNow(new Date(expense.createdAt), { addSuffix: true })}</span>
                        </span>
                      </div>

                      {/* Split Details (only for expenses) */}
                      {expense.type === 'expense' && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {expense.splitBetween.slice(0, 3).map((split) => (
                            <Badge key={split._id} variant="outline" className="text-xs">
                              {split.name}: ${split.amount.toFixed(2)}
                            </Badge>
                          ))}
                          {expense.splitBetween.length > 3 && (
                            <Badge variant="outline" className="text-xs">
                              +{expense.splitBetween.length - 3} more
                            </Badge>
                          )}
                        </div>
                      )}

                      {/* Item Details for item-based expenses */}
                      {expense.type === 'expense' && expense.splitMethod === 'by_item' && expense.items && expense.items.length > 0 && (
                        <div className="mt-2">
                          <button
                            type="button"
                            onClick={() => toggleExpanded(expense._id)}
                            className="flex items-center gap-1 text-xs text-amber-600 hover:text-amber-700 font-medium"
                          >
                            {expandedExpenses.has(expense._id) ? (
                              <>
                                <ChevronUp className="h-3 w-3" />
                                Hide items
                              </>
                            ) : (
                              <>
                                <ChevronDown className="h-3 w-3" />
                                View {expense.items.length} items
                              </>
                            )}
                          </button>

                          {expandedExpenses.has(expense._id) && (
                            <div className="mt-2 space-y-1.5 pl-2 border-l-2 border-amber-200">
                              {expense.items.map((item) => (
                                <div
                                  key={item.id}
                                  className={cn(
                                    "flex items-center justify-between text-xs py-1",
                                    item.isSharedCost && "text-purple-600 italic"
                                  )}
                                >
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium">{item.name}</span>
                                    {item.isSharedCost && (
                                      <span className="text-[10px] bg-purple-100 text-purple-600 px-1.5 py-0.5 rounded">
                                        shared
                                      </span>
                                    )}
                                    {!item.isSharedCost && item.assignedTo.length > 0 && (
                                      <span className="text-muted-foreground">
                                        ({item.assignedTo.map(a => a.userName.split(' ')[0]).join(', ')})
                                      </span>
                                    )}
                                  </div>
                                  <span className="font-mono">${item.price.toFixed(2)}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col items-end space-y-2">
                    {expense.type !== 'member_added' && expense.type !== 'member_removed' && (
                      <div className="text-right">
                        <p className={`text-lg font-semibold ${expense.type === 'payment' ? 'text-emerald-600' : ''}`}>
                          ${expense.amount.toFixed(2)}
                        </p>
                      </div>
                    )}
                    
                    {expense.receipt && (
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                        <Receipt className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}