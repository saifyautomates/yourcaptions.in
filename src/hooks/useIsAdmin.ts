import { useAuth } from "./useAuth";

export const useIsAdmin = () => {
  const { user, isAdmin, loading: authLoading, hydrating } = useAuth();

  return {
    isAdmin,
    loading: authLoading || hydrating
  };
};


