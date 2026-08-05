import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useCreditStore } from "@/stores/creditStore";

export function useCredits() {
  const { user } = useAuth();
  const { isAdmin } = useIsAdmin();
  const state = useCreditStore();
  
  // Initialize state based on loading state of auth/initial setup.
  // Actually, realtimeSync manages the credits store fetching now.
  
  const totalRemaining = state.balance;
  
  return { 
    loading: false, // Could track global loading state
    ...state, 
    isAdmin, 
    blocked: totalRemaining <= 0 && !isAdmin 
  };
}
