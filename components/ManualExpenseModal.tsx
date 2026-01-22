import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Tabs, TabsList, TabsTrigger } from './ui/tabs';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Calculator, ScanLine, Plus, Trash2, Receipt, Users } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { createExpenseAction, CreateExpenseData, ExpenseItemData } from '@/lib/actions/mutations';
import { GroupMember } from '@/api/groups';
import { useToast } from '@/hooks/useToast';
import { AIExpenseModal, ReceiptData } from './AIExpenseModal';
import { cn } from '@/lib/utils';

interface ManualExpenseModalProps {
  open: boolean;
  onClose: () => void;
  groupId: string;
  members: GroupMember[];
  onExpenseCreated: () => void;
  currentUserId: string | null;
}

// Local item type for the form
interface LocalItem {
  id: string;
  name: string;
  price: string;
  quantity: number;
  isSharedCost: boolean;
  assignedTo: string[];
}

export function ManualExpenseModal({ open, onClose, groupId, members, onExpenseCreated, currentUserId }: ManualExpenseModalProps) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<CreateExpenseData>({
    defaultValues: {
      splitType: 'equal',
      paidById: currentUserId || undefined,
    }
  });

  const [customAmounts, setCustomAmounts] = useState<Record<string, string>>({});
  const [items, setItems] = useState<LocalItem[]>([]);
  const [participants, setParticipants] = useState<string[]>([]); // Who actually went for item-based splitting
  const [tax, setTax] = useState<string>('');
  const [tip, setTip] = useState<string>('');
  const [isScrolledToBottom, setIsScrolledToBottom] = useState(false);
  const itemsScrollRef = useRef<HTMLDivElement>(null);
  const splitType = watch('splitType');
  const splitBetween = watch('splitBetween');
  const selectedMembers = useMemo(() => splitBetween || [], [splitBetween]);

  // Initialize participants when switching to by_item mode or when modal opens
  useEffect(() => {
    if (splitType === 'by_item' && participants.length === 0 && members.length > 0) {
      // Default to all members, but user can deselect
      setParticipants(members.map(m => m._id));
    }
  }, [splitType, members, participants.length]);

  // Get only participating members for item assignment
  const participatingMembers = useMemo(() =>
    members.filter(m => participants.includes(m._id)),
    [members, participants]
  );

  const toggleParticipant = useCallback((memberId: string) => {
    setParticipants(prev => {
      const isParticipating = prev.includes(memberId);
      if (isParticipating) {
        // Remove from participants and also remove from all item assignments
        setItems(currentItems => currentItems.map(item => ({
          ...item,
          assignedTo: item.assignedTo.filter(id => id !== memberId)
        })));
        return prev.filter(id => id !== memberId);
      } else {
        return [...prev, memberId];
      }
    });
  }, []);
  
  // Calculate total amount based on split type
  const formAmount = watch('amount');
  const taxAmount = parseFloat(tax) || 0;
  const tipAmount = parseFloat(tip) || 0;
  const itemsSubtotal = useMemo(() =>
    items.reduce((sum, item) => sum + (parseFloat(item.price) || 0) * item.quantity, 0),
    [items]
  );
  const itemsTotal = itemsSubtotal + taxAmount + tipAmount;
  const totalAmount = splitType === 'equal'
    ? (parseFloat(formAmount?.toString() || '0') || 0)
    : splitType === 'by_item'
    ? itemsTotal
    : Object.values(customAmounts).reduce((sum, val) => sum + (parseFloat(val) || 0), 0);

  // Calculate per-person totals for item-based splitting with detailed breakdown
  const itemBasedSummary = useMemo(() => {
    if (splitType !== 'by_item') {
      return { userBreakdowns: {}, totalSharedCost: 0, totalSubtotal: 0, tax: 0, tip: 0 };
    }

    const userSubtotals: Record<string, number> = {};
    const userSharedCosts: Record<string, number> = {};
    let totalNonSharedCost = 0;

    // Calculate non-shared costs (item subtotals) - items no longer include tax/tip
    for (const item of items) {
      const itemTotal = (parseFloat(item.price) || 0) * item.quantity;
      if (item.assignedTo.length > 0) {
        totalNonSharedCost += itemTotal;
        const perPerson = itemTotal / item.assignedTo.length;
        for (const userId of item.assignedTo) {
          userSubtotals[userId] = (userSubtotals[userId] || 0) + perPerson;
        }
      }
    }

    // Tax and tip are now separate fields
    const totalSharedCost = taxAmount + tipAmount;

    // Distribute tax/tip proportionally based on item spending
    if (totalSharedCost > 0) {
      if (totalNonSharedCost > 0) {
        for (const [userId, subtotal] of Object.entries(userSubtotals)) {
          const proportion = subtotal / totalNonSharedCost;
          userSharedCosts[userId] = totalSharedCost * proportion;
        }
      } else if (participants.length > 0) {
        // If only tax/tip with no items, split equally among participants
        const perPerson = totalSharedCost / participants.length;
        for (const userId of participants) {
          userSubtotals[userId] = userSubtotals[userId] || 0;
          userSharedCosts[userId] = perPerson;
        }
      }
    }

    // Build final breakdown per user
    const userBreakdowns: Record<string, { subtotal: number; sharedCost: number; total: number }> = {};
    const allUserIds = new Set([...Object.keys(userSubtotals), ...Object.keys(userSharedCosts)]);
    for (const userId of allUserIds) {
      const subtotal = userSubtotals[userId] || 0;
      const sharedCost = userSharedCosts[userId] || 0;
      userBreakdowns[userId] = {
        subtotal,
        sharedCost,
        total: subtotal + sharedCost,
      };
    }

    return { userBreakdowns, totalSharedCost, totalSubtotal: totalNonSharedCost, tax: taxAmount, tip: tipAmount };
  }, [items, splitType, taxAmount, tipAmount, participants]);

  // Helper functions for item management
  const addItem = useCallback((name = '', price = '', isSharedCost = false) => {
    const newItem: LocalItem = {
      id: crypto.randomUUID(),
      name,
      price,
      quantity: 1,
      isSharedCost,
      assignedTo: isSharedCost ? [] : participants, // Default: assign to participants only
    };
    setItems(prev => [...prev, newItem]);
  }, [participants]);

  const removeItem = useCallback((itemId: string) => {
    setItems(prev => prev.filter(item => item.id !== itemId));
  }, []);

  const updateItem = useCallback((itemId: string, updates: Partial<LocalItem>) => {
    setItems(prev => prev.map(item =>
      item.id === itemId ? { ...item, ...updates } : item
    ));
  }, []);

  const toggleMemberForItem = useCallback((itemId: string, memberId: string) => {
    setItems(prev => prev.map(item => {
      if (item.id !== itemId) return item;
      const isAssigned = item.assignedTo.includes(memberId);
      return {
        ...item,
        assignedTo: isAssigned
          ? item.assignedTo.filter(id => id !== memberId)
          : [...item.assignedTo, memberId]
      };
    }));
  }, []);

  // Handle scroll to detect when user reaches bottom
  const handleItemsScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.target as HTMLDivElement;
    const isAtBottom = target.scrollHeight - target.scrollTop - target.clientHeight < 10;
    setIsScrolledToBottom(isAtBottom);
  }, []);

  // Handle scanned receipt data
  const handleReceiptScanned = useCallback((data: ReceiptData) => {
    // Use current participants, or default to all members if none selected
    const assignees = participants.length > 0 ? participants : members.map(m => m._id);

    // If no participants yet, set them
    if (participants.length === 0) {
      setParticipants(members.map(m => m._id));
    }

    // Separate tax/tip from regular items
    let extractedTax = 0;
    let extractedTip = 0;
    const regularItems: LocalItem[] = [];

    for (const item of data.items) {
      const nameLower = item.name.toLowerCase();
      if (/\btax\b/.test(nameLower)) {
        extractedTax += item.price;
      } else if (/\b(tip|gratuity|service\s*(charge|fee)?)\b/.test(nameLower)) {
        extractedTip += item.price;
      } else {
        regularItems.push({
          id: crypto.randomUUID(),
          name: item.name,
          price: item.price.toString(),
          quantity: 1,
          isSharedCost: false,
          assignedTo: assignees,
        });
      }
    }

    setItems(regularItems);
    setTax(extractedTax > 0 ? extractedTax.toFixed(2) : '');
    setTip(extractedTip > 0 ? extractedTip.toFixed(2) : '');
    setValue('description', `Receipt from ${data.merchant || 'Unknown'}`);
    setValue('splitType', 'by_item');

    const taxTipMsg = extractedTax > 0 || extractedTip > 0
      ? ` Tax${extractedTax > 0 ? `: $${extractedTax.toFixed(2)}` : ''}${extractedTip > 0 ? `, Tip: $${extractedTip.toFixed(2)}` : ''} detected.`
      : '';
    toast({ title: 'Receipt Scanned', description: `Found ${regularItems.length} items.${taxTipMsg} Assign people who went!` });
  }, [members, participants, setValue, toast]);

  // Reset custom amounts when total amount changes or members change, if in equal mode
  useEffect(() => {
    if (splitType === 'equal' && totalAmount > 0 && selectedMembers.length > 0) {
      const splitAmount = (totalAmount / selectedMembers.length).toFixed(2);
      const newCustomAmounts: Record<string, string> = {};
      selectedMembers.forEach(id => {
        newCustomAmounts[id] = splitAmount;
      });
      setCustomAmounts(newCustomAmounts);
    }
  }, [totalAmount, selectedMembers, splitType]);

  const handleCustomAmountChange = (memberId: string, value: string) => {
    setCustomAmounts(prev => ({
      ...prev,
      [memberId]: value
    }));
  };

  // Update default paidById and splitBetween when modal opens
  useEffect(() => {
    if (open) {
      if (currentUserId) {
        setValue('paidById', currentUserId);
      }
      // Select all members by default
      if (members.length > 0) {
        setValue('splitBetween', members.map(m => m._id));
      }
    }
  }, [open, currentUserId, members, setValue]);

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  const onSubmit = async (data: CreateExpenseData) => {
    try {
      setLoading(true);

      if (!data.paidById) {
        toast({
          title: "Error",
          description: "Please select who paid for this expense",
          variant: "destructive",
        });
        return;
      }

      // Validation for item-based splitting
      if (data.splitType === 'by_item') {
        if (items.length === 0) {
          toast({
            title: "Error",
            description: "Please add at least one item",
            variant: "destructive",
          });
          setLoading(false);
          return;
        }

        // Check if any non-shared item has no assignments
        const unassignedItems = items.filter(item => !item.isSharedCost && item.assignedTo.length === 0);
        if (unassignedItems.length > 0) {
          toast({
            title: "Error",
            description: `Please assign "${unassignedItems[0].name}" to at least one person`,
            variant: "destructive",
          });
          setLoading(false);
          return;
        }

        // Convert local items to ExpenseItemData format
        const itemsData: ExpenseItemData[] = items.map(item => ({
          name: item.name,
          price: parseFloat(item.price) || 0,
          quantity: item.quantity,
          isSharedCost: false,
          assignedTo: item.assignedTo,
        }));

        // Add tax and tip as shared cost items if they have values
        if (taxAmount > 0) {
          itemsData.push({
            name: 'Tax',
            price: taxAmount,
            quantity: 1,
            isSharedCost: true,
            assignedTo: [],
          });
        }
        if (tipAmount > 0) {
          itemsData.push({
            name: 'Tip',
            price: tipAmount,
            quantity: 1,
            isSharedCost: true,
            assignedTo: [],
          });
        }

        // Get all assigned users for splitBetween
        const allAssignedUsers = new Set<string>();
        for (const item of items) {
          for (const userId of item.assignedTo) {
            allAssignedUsers.add(userId);
          }
        }

        await createExpenseAction({
          ...data,
          amount: itemsTotal,
          groupId,
          splitType: 'by_item',
          splitBetween: Array.from(allAssignedUsers),
          items: itemsData,
        });

        toast({
          title: "Expense added!",
          description: `Split ${items.length} items among ${allAssignedUsers.size} people.`,
        });
        handleClose();
        onExpenseCreated();
        return;
      }

      // Existing validation for equal/custom splits
      if (!data.splitBetween || data.splitBetween.length === 0) {
        toast({
          title: "Error",
          description: "Please select at least one person to split with",
          variant: "destructive",
        });
        return;
      }

      let finalCustomSplits: { userId: string; amount: number }[] | undefined;
      let finalAmount = data.amount;

      if (data.splitType === 'custom') {
        const currentTotal = Object.values(customAmounts).reduce((sum, val) => sum + (parseFloat(val) || 0), 0);
        finalAmount = currentTotal;

        if (currentTotal <= 0) {
           toast({
            title: "Error",
            description: "Total amount must be greater than 0",
            variant: "destructive",
          });
          setLoading(false);
          return;
        }

        finalCustomSplits = Object.entries(customAmounts)
          .filter(([userId]) => data.splitBetween.includes(userId))
          .map(([userId, amount]) => ({
            userId,
            amount: parseFloat(amount) || 0
          }));
      }

      console.log('Creating manual expense:', { ...data, amount: finalAmount });
      await createExpenseAction({
        ...data,
        amount: finalAmount,
        groupId,
        splitType: data.splitType || 'equal',
        customSplits: finalCustomSplits
      });
      toast({
        title: "Expense added!",
        description: "Your expense has been added to the group.",
      });
      handleClose();
      onExpenseCreated();
    } catch (error) {
      console.error('Error creating expense:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create expense",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    onClose();
    reset();
    setCustomAmounts({});
    setItems([]);
    setParticipants([]);
    setTax('');
    setTip('');
    setIsScrolledToBottom(false);
  };

  const handleSelectAll = () => {
    const allMemberIds = members.map(m => m._id);
    setValue('splitBetween', allMemberIds);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg bg-white max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-gradient-to-r from-green-500 to-emerald-600 rounded-lg flex items-center justify-center">
              <Calculator className="h-5 w-5 text-white" />
            </div>
            <span>Add Expense Manually</span>
          </DialogTitle>
          <AIExpenseModal
            groupId={parseInt(groupId)}
            onScanComplete={handleReceiptScanned}
          >
             <Button variant="outline" size="sm" className="gap-2 text-blue-600 border-blue-200 hover:bg-blue-50">
               <ScanLine className="h-4 w-4" />
               Auto-Scan Receipt
             </Button>
          </AIExpenseModal>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <Tabs
            defaultValue="equal"
            value={watch('splitType')}
            onValueChange={(val) => setValue('splitType', val as 'equal' | 'custom' | 'by_item')}
            className="w-full"
          >
            <TabsList className="grid w-full grid-cols-3 mb-6">
              <TabsTrigger value="equal">Equal</TabsTrigger>
              <TabsTrigger value="custom">Custom</TabsTrigger>
              <TabsTrigger value="by_item" className="flex items-center gap-1">
                <Receipt className="h-3 w-3" />
                By Item
              </TabsTrigger>
            </TabsList>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  {...register('description', { required: 'Description is required' })}
                  placeholder="What was this expense for?"
                />
                {errors.description && (
                  <p className="text-sm text-red-600">{errors.description.message}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                {splitType === 'equal' && (
                  <div className="space-y-2">
                    <Label htmlFor="amount">Amount ($)</Label>
                    <Input
                      id="amount"
                      type="number"
                      step="0.01"
                      {...register('amount', { required: 'Amount is required', min: 0.01 })}
                      placeholder="Enter total amount"
                    />
                    {errors.amount && (
                      <p className="text-sm text-red-600">{errors.amount.message}</p>
                    )}
                  </div>
                )}
                {splitType === 'custom' && (
                  <div className="space-y-2">
                    <Label>Total Amount</Label>
                    <div className="flex h-10 w-full rounded-md border border-input bg-slate-100 px-3 py-2 text-sm text-muted-foreground">
                      ${totalAmount.toFixed(2)}
                    </div>
                    <p className="text-[10px] text-muted-foreground">Calculated from individual splits below</p>
                  </div>
                )}
                {splitType === 'by_item' && (
                  <div className="space-y-2">
                    <Label>Total</Label>
                    <div className="flex h-10 w-full rounded-md border border-input bg-gradient-to-r from-amber-50 to-orange-50 px-3 py-2 text-sm font-medium text-amber-800">
                      ${itemsTotal.toFixed(2)}
                    </div>
                    <p className="text-[10px] text-muted-foreground">Items + Tax + Tip</p>
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Select onValueChange={(value) => setValue('category', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="food">Food & Dining</SelectItem>
                      <SelectItem value="transportation">Transportation</SelectItem>
                      <SelectItem value="entertainment">Entertainment</SelectItem>
                      <SelectItem value="shopping">Shopping</SelectItem>
                      <SelectItem value="utilities">Utilities</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="paidBy">Paid by</Label>
                <Select 
                  onValueChange={(value) => setValue('paidById', value)} 
                  defaultValue={currentUserId || members[0]?._id}
                  value={watch('paidById')}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select who paid" />
                  </SelectTrigger>
                  <SelectContent>
                    {members.map((member) => (
                      <SelectItem key={member._id} value={member._id}>
                        <div className="flex items-center space-x-2">
                          <Avatar className="h-6 w-6">
                            <AvatarImage src={member.avatar} />
                            <AvatarFallback className="text-xs">
                              {getInitials(member.name)}
                            </AvatarFallback>
                          </Avatar>
                          <span>{member.name}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Split between - only for equal/custom modes */}
              {splitType !== 'by_item' && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Split between</Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleSelectAll}
                      className="h-auto p-0 text-xs text-blue-600 hover:text-blue-700"
                    >
                      Select All
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 gap-2 max-h-32 overflow-y-auto border rounded-md p-2">
                    {members.map((member) => (
                      <label key={member._id} className="flex items-center space-x-3 cursor-pointer p-2 hover:bg-slate-50 rounded">
                        <input
                          type="checkbox"
                          {...register('splitBetween')}
                          value={member._id}
                          className="rounded border-slate-300 text-green-600 focus:ring-green-500"
                        />
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={member.avatar} />
                          <AvatarFallback className="text-xs">
                            {getInitials(member.name)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm font-medium">{member.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Item-based splitting UI */}
              {splitType === 'by_item' && (
                <div className="space-y-3">
                  {/* Who went? - Participant selector */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium flex items-center gap-1.5">
                      <Users className="h-4 w-4 text-slate-500" />
                      Who went?
                    </Label>
                    <div className="flex flex-wrap gap-1.5 p-2 bg-slate-50 rounded-lg border">
                      {members.map((member) => {
                        const isParticipating = participants.includes(member._id);
                        return (
                          <button
                            key={member._id}
                            type="button"
                            onClick={() => toggleParticipant(member._id)}
                            className={cn(
                              "flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium transition-all",
                              isParticipating
                                ? "bg-blue-100 text-blue-700 ring-1 ring-blue-300"
                                : "bg-white text-slate-400 ring-1 ring-slate-200 hover:ring-slate-300"
                            )}
                          >
                            <Avatar className="h-5 w-5">
                              <AvatarImage src={member.avatar} />
                              <AvatarFallback className="text-[9px]">
                                {getInitials(member.name)}
                              </AvatarFallback>
                            </Avatar>
                            <span>{member.name.split(' ')[0]}</span>
                          </button>
                        );
                      })}
                    </div>
                    {participants.length === 0 && (
                      <p className="text-xs text-amber-600">Select at least one person who participated</p>
                    )}
                  </div>

                  {/* Tax and Tip inputs */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="tax" className="text-xs text-slate-600">Tax</Label>
                      <div className="relative">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
                        <Input
                          id="tax"
                          type="number"
                          step="0.01"
                          min="0"
                          value={tax}
                          onChange={(e) => setTax(e.target.value)}
                          placeholder="0.00"
                          className="h-9 pl-6 text-sm bg-purple-50/50 border-purple-200 focus:border-purple-400"
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="tip" className="text-xs text-slate-600">Tip</Label>
                      <div className="relative">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
                        <Input
                          id="tip"
                          type="number"
                          step="0.01"
                          min="0"
                          value={tip}
                          onChange={(e) => setTip(e.target.value)}
                          placeholder="0.00"
                          className="h-9 pl-6 text-sm bg-purple-50/50 border-purple-200 focus:border-purple-400"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <Label className="text-base font-semibold">Receipt Items</Label>
                    <div className="flex gap-2">
                      <AIExpenseModal
                        groupId={parseInt(groupId)}
                        onScanComplete={handleReceiptScanned}
                      >
                        <Button type="button" variant="outline" size="sm" className="gap-1.5 text-blue-600 border-blue-200 hover:bg-blue-50">
                          <ScanLine className="h-3.5 w-3.5" />
                          Scan
                        </Button>
                      </AIExpenseModal>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => addItem()}
                        className="gap-1.5"
                        disabled={participants.length === 0}
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Add Item
                      </Button>
                    </div>
                  </div>

                  {items.length === 0 ? (
                    <div className="border-2 border-dashed rounded-lg p-6 text-center">
                      <Receipt className="h-10 w-10 mx-auto text-slate-300 mb-2" />
                      <p className="text-sm text-muted-foreground">
                        No items yet. Scan a receipt or add items manually.
                      </p>
                    </div>
                  ) : (
                    <div className="relative">
                      <div
                        ref={itemsScrollRef}
                        onScroll={handleItemsScroll}
                        className="space-y-2 max-h-[220px] overflow-y-auto pr-1 pb-1"
                      >
                      {items.map((item) => (
                        <div
                          key={item.id}
                          className="border rounded-lg p-3 space-y-2 transition-colors bg-white hover:bg-slate-50"
                        >
                          <div className="flex items-start gap-2">
                            <div className="flex-1 space-y-2">
                              <Input
                                value={item.name}
                                onChange={(e) => updateItem(item.id, { name: e.target.value })}
                                placeholder="Item name"
                                className="h-8 text-sm font-medium"
                              />
                              <div className="flex gap-2">
                                <div className="relative flex-1">
                                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
                                  <Input
                                    type="number"
                                    step="0.01"
                                    value={item.price}
                                    onChange={(e) => updateItem(item.id, { price: e.target.value })}
                                    placeholder="0.00"
                                    className="h-8 pl-5 text-sm"
                                  />
                                </div>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => removeItem(item.id)}
                                  className="h-8 w-8 text-slate-400 hover:text-red-500"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </div>

                          {/* Member assignment - only show participants */}
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            {participatingMembers.map((member) => {
                              const isAssigned = item.assignedTo.includes(member._id);
                              return (
                                <button
                                  key={member._id}
                                  type="button"
                                  onClick={() => toggleMemberForItem(item.id, member._id)}
                                  className={cn(
                                    "flex items-center gap-1 px-2 py-1 rounded-full text-xs transition-all",
                                    isAssigned
                                      ? "bg-green-100 text-green-700 ring-1 ring-green-300"
                                      : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                                  )}
                                >
                                  <Avatar className="h-4 w-4">
                                    <AvatarImage src={member.avatar} />
                                    <AvatarFallback className="text-[8px]">
                                      {getInitials(member.name)}
                                    </AvatarFallback>
                                  </Avatar>
                                  <span className="max-w-[60px] truncate">{member.name.split(' ')[0]}</span>
                                </button>
                              );
                            })}
                            {participatingMembers.length === 0 && (
                              <span className="text-xs text-slate-400 italic">Select participants above</span>
                            )}
                          </div>
                        </div>
                      ))}
                      </div>
                      {/* Scroll indicator - gradient fade when more than 2 items, hide when scrolled to bottom */}
                      {items.length > 2 && !isScrolledToBottom && (
                        <div className="absolute bottom-0 left-0 right-2 h-8 bg-gradient-to-t from-white via-white/80 to-transparent pointer-events-none flex items-end justify-center pb-1 transition-opacity">
                          <span className="text-[10px] text-slate-400 bg-white/90 px-2 py-0.5 rounded-full">
                            ↓ scroll for more
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Split Details - for equal/custom modes */}
              {splitType !== 'by_item' && selectedMembers.length > 0 && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">
                      {splitType === 'equal' ? 'Split Summary' : 'Enter Amounts'}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {splitType === 'equal' ? (
                      <div className="space-y-2">
                        {selectedMembers.map((memberId) => {
                          const member = members.find(m => m._id === memberId);
                          const amount = totalAmount / selectedMembers.length;
                          return (
                            <div key={memberId} className="flex justify-between items-center">
                              <div className="flex items-center space-x-2">
                                <Avatar className="h-6 w-6">
                                  <AvatarImage src={member?.avatar} />
                                  <AvatarFallback className="text-xs">
                                    {member ? getInitials(member.name) : '?'}
                                  </AvatarFallback>
                                </Avatar>
                                <span className="text-sm">{member?.name}</span>
                              </div>
                              <Badge variant="secondary">${amount.toFixed(2)}</Badge>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {selectedMembers.map((memberId) => {
                          const member = members.find(m => m._id === memberId);
                          return (
                            <div key={memberId} className="flex justify-between items-center gap-2">
                              <div className="flex items-center space-x-2 min-w-[120px]">
                                <Avatar className="h-6 w-6">
                                  <AvatarImage src={member?.avatar} />
                                  <AvatarFallback className="text-xs">
                                    {member ? getInitials(member.name) : '?'}
                                  </AvatarFallback>
                                </Avatar>
                                <span className="text-sm truncate max-w-[100px]">{member?.name}</span>
                              </div>
                              <div className="relative w-full max-w-[120px]">
                                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                                <Input
                                  type="number"
                                  step="0.01"
                                  className="pl-6 h-8"
                                  value={customAmounts[memberId] || ''}
                                  onChange={(e) => handleCustomAmountChange(memberId, e.target.value)}
                                  placeholder="0.00"
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Item-based Split Summary */}
              {splitType === 'by_item' && Object.keys(itemBasedSummary.userBreakdowns).length > 0 && (
                <Card className="border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Receipt className="h-4 w-4 text-amber-600" />
                      Split Summary
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {Object.entries(itemBasedSummary.userBreakdowns)
                        .sort(([, a], [, b]) => b.total - a.total)
                        .map(([memberId, breakdown]) => {
                          const member = members.find(m => m._id === memberId);
                          return (
                            <div key={memberId} className="space-y-1">
                              <div className="flex justify-between items-center">
                                <div className="flex items-center space-x-2">
                                  <Avatar className="h-6 w-6 ring-2 ring-white">
                                    <AvatarImage src={member?.avatar} />
                                    <AvatarFallback className="text-xs bg-amber-100">
                                      {member ? getInitials(member.name) : '?'}
                                    </AvatarFallback>
                                  </Avatar>
                                  <span className="text-sm font-medium">{member?.name}</span>
                                </div>
                                <Badge className="bg-amber-600 hover:bg-amber-700">
                                  ${breakdown.total.toFixed(2)}
                                </Badge>
                              </div>
                              {/* Breakdown details - always show */}
                              <div className="ml-8 flex gap-3 text-[11px] text-amber-700">
                                <span>Items: ${breakdown.subtotal.toFixed(2)}</span>
                                <span className="text-purple-600">+ Tax/Tip: ${breakdown.sharedCost.toFixed(2)}</span>
                              </div>
                            </div>
                          );
                        })}

                      {/* Totals breakdown - always show tax/tip */}
                      <div className="border-t border-amber-200 pt-2 mt-2 space-y-1">
                        <div className="flex justify-between items-center text-xs text-amber-700">
                          <span>Subtotal</span>
                          <span>${itemBasedSummary.totalSubtotal.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-center text-xs text-purple-600">
                          <span>Tax</span>
                          <span>${taxAmount.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-center text-xs text-purple-600">
                          <span>Tip</span>
                          <span>${tipAmount.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-center pt-1 border-t border-amber-200 mt-1">
                          <span className="text-sm font-semibold text-amber-800">Total</span>
                          <span className="text-sm font-bold text-amber-800">${itemsTotal.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            <div className="flex space-x-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={loading}
                className="flex-1 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700"
              >
                {loading ? 'Adding...' : 'Add Expense'}
              </Button>
            </div>
          </Tabs>
        </form>
      </DialogContent>
    </Dialog>
  );
}