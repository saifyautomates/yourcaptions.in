import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type LibraryCategory = "text" | "template" | "transition" | "ai_voice" | "audio";

export interface LibraryItem {
  id: string;
  category: LibraryCategory;
  name: string;
  payload: Record<string, any>;
  preview_url: string | null;
  sort_order: number;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export function useLibrary(category: LibraryCategory) {
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("library_items")
      .select("*")
      .eq("category", category)
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) setError(error.message);
    else setItems((data as unknown as LibraryItem[]) || []);
    setLoading(false);
  }, [category]);

  useEffect(() => { refetch(); }, [refetch]);

  const create = useCallback(async (name: string, payload: Record<string, any>, preview_url?: string) => {
    const { data, error } = await supabase
      .from("library_items")
      .insert({ category, name, payload, preview_url: preview_url ?? null })
      .select()
      .single();
    if (error) throw error;
    await refetch();
    return data as unknown as LibraryItem;
  }, [category, refetch]);

  const update = useCallback(async (id: string, patch: Partial<Pick<LibraryItem, "name" | "payload" | "preview_url" | "sort_order" | "is_active">>) => {
    const { error } = await supabase.from("library_items").update(patch).eq("id", id);
    if (error) throw error;
    await refetch();
  }, [refetch]);

  const remove = useCallback(async (id: string) => {
    // Soft delete so existing projects still resolve references
    const { error } = await supabase.from("library_items").update({ is_active: false }).eq("id", id);
    if (error) throw error;
    await refetch();
  }, [refetch]);

  return { items, loading, error, refetch, create, update, remove };
}
