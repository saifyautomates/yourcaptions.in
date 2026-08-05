import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface PlanPricing {
  id: string;
  plan: string;
  currency: string;
  monthly_price: number;
  yearly_price: number;
  yearly_total: number;
  original_monthly: number | null;
  original_yearly: number | null;
  is_active: boolean;
}

export function usePlanPricing(currency: string = 'INR') {
  return useQuery({
    queryKey: ['plan_pricing', currency],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('plan_pricing')
        .select('*')
        .eq('currency', currency)
        .eq('is_active', true);
      
      if (error) {
        if (error.code === 'PGRST205') {
          console.warn('plan_pricing table not found, falling back to defaults.');
          return [];
        }
        console.error('Error fetching plan pricing:', error);
        throw error;
      }
      
      return data as PlanPricing[];
    },
    staleTime: 1000 * 60 * 60, // 1 hour
  });
}
