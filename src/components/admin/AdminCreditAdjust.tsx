import { adminFetch } from "@/lib/adminFetch";
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Wallet, Search } from 'lucide-react';

export function AdminCreditAdjust() {
  const [email, setEmail] = useState('');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [userData, setUserData] = useState<{ id: string; balance: number } | null>(null);

  const searchUser = async () => {
    if (!email) return;
    setLoading(true);
    
    try {
      const res = await adminFetch(`/functions/v1/admin-api/users/search?email=${encodeURIComponent(email)}`);
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setUserData({ id: data.id, balance: data.total_credits || 0 });
      toast.success('User found');
    } catch (error) {
      toast.error('User not found or error fetching user');
      setUserData(null);
    }
    setLoading(false);
  };

  const handleAdjust = async () => {
    if (!userData) {
      toast.error('Search for a user first');
      return;
    }
    if (reason.length < 10) {
      toast.error('Reason must be at least 10 characters');
      return;
    }
    const numAmount = parseInt(amount, 10);
    if (isNaN(numAmount) || numAmount === 0) {
      toast.error('Enter a valid non-zero amount');
      return;
    }

    setLoading(true);
    try {
      const response = await adminFetch('/functions/v1/admin-api/credits/adjust', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userData.id,
          amount: numAmount,
          reason
        })
      });

      if (!response.ok) {
        throw new Error('Failed to adjust credits');
      }
      
      const isJson = response.headers.get('content-type')?.includes('application/json');
      const resData = isJson ? await response.json() : { new_balance: userData.balance + numAmount };
      toast.success('Credits adjusted successfully');
      setUserData(prev => prev ? { ...prev, balance: resData.new_balance } : null);
      setAmount('');
      setReason('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error adjusting credits');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 border border-border rounded-xl bg-card max-w-xl mx-auto my-8">
      <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
        <Wallet className="h-5 w-5" /> Admin Credit Adjustment
      </h2>

      <div className="space-y-4">
        <div className="flex gap-2">
          <Input 
            placeholder="User email" 
            value={email} 
            onChange={(e) => setEmail(e.target.value)}
          />
          <Button variant="secondary" onClick={searchUser} disabled={loading}>
            <Search className="h-4 w-4 mr-2" /> Find
          </Button>
        </div>

        {userData && (
          <div className="p-4 bg-muted/30 rounded-lg space-y-4 border border-border/50">
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">Current Balance:</span>
              <span className="font-bold text-lg">{userData.balance}</span>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase text-muted-foreground">Amount (Positive to add, negative to remove)</label>
              <Input 
                type="number" 
                placeholder="e.g. 500 or -500" 
                value={amount} 
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase text-muted-foreground">Reason (Min 10 chars)</label>
              <Textarea 
                placeholder="Why are you adjusting these credits?" 
                value={reason} 
                onChange={(e) => setReason(e.target.value)}
                rows={3}
              />
            </div>

            {amount && !isNaN(parseInt(amount, 10)) && (
              <div className="text-sm font-medium p-3 bg-primary/10 text-primary rounded-md border border-primary/20">
                Preview: Balance will change from {userData.balance} to {userData.balance + parseInt(amount, 10)}
              </div>
            )}

            <Button 
              className="w-full" 
              onClick={handleAdjust} 
              disabled={loading || !amount || reason.length < 10}
            >
              Confirm Adjustment
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
