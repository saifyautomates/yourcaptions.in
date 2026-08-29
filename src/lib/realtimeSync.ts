import { supabase } from "@/integrations/supabase/client";
import { useCreditStore } from "@/stores/creditStore";
import { toast } from "sonner";
import { RealtimeChannel } from "@supabase/supabase-js";

class RealtimeSyncManager {
  private channels: RealtimeChannel[] = [];
  private pollInterval: any;
  private userId: string | null = null;
  private initialized = false;

  async initialize() {
    if (this.initialized) return;
    
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;
    
    this.userId = session.user.id;
    await this.fetchInitialCredits();
    this.subscribeToChanges();
    this.startFallbackPolling();
    this.initialized = true;

    // Listen to auth changes
    supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        this.destroy();
      } else if (event === 'SIGNED_IN' && session?.user && session.user.id !== this.userId) {
        this.destroy();
        this.userId = session.user.id;
        this.initialize();
      }
    });
  }

  private async fetchInitialCredits() {
    if (!this.userId) return;
    const { data, error } = await supabase
      .from('credit_wallets')
      .select('plan_credits, topup_credits')
      .eq('user_id', this.userId)
      .maybeSingle();
    
    if (data && !error) {
      useCreditStore.getState().setCredits(data.plan_credits || 0, data.topup_credits || 0);
    } else {
      // Fallback to legacy profiles.credits_seconds if credit_wallets table is missing
      const { data: profile } = await supabase
        .from('profiles')
        .select('credits_seconds')
        .eq('id', this.userId)
        .maybeSingle();
      
      if (profile) {
        useCreditStore.getState().setCredits(profile.credits_seconds || 0, 0);
      }
    }
  }

  private subscribeToChanges() {
    if (!this.userId) return;

    const creditChannel = supabase
      .channel('public:credit_wallets')
      .on('postgres_changes', { 
        event: 'UPDATE', 
        schema: 'public', 
        table: 'credit_wallets',
        filter: `user_id=eq.${this.userId}`
      }, (payload) => {
        const { plan_credits, topup_credits } = payload.new;
        useCreditStore.getState().setCredits(plan_credits || 0, topup_credits || 0);
      })
      .on('postgres_changes', { 
        event: 'UPDATE', 
        schema: 'public', 
        table: 'profiles',
        filter: `id=eq.${this.userId}`
      }, (payload) => {
        const { credits_seconds } = payload.new;
        if (credits_seconds !== undefined) {
          useCreditStore.getState().setCredits(credits_seconds || 0, 0);
        }
      })
      .subscribe();

    const projectsChannel = supabase
      .channel('public:projects')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'projects',
        filter: `user_id=eq.${this.userId}`
      }, (payload) => {
        if (payload.old.status !== 'ready' && payload.new.status === 'ready') {
          toast.success('Your video transcription is ready!');
          // In a real app, we might want to trigger a global event here for the UI to refetch captions
          window.dispatchEvent(new CustomEvent('project-ready', { detail: payload.new }));
        } else if (payload.old.status !== 'error' && payload.new.status === 'error') {
          toast.error('Video processing failed. Credits have been refunded.');
          window.dispatchEvent(new CustomEvent('project-error', { detail: payload.new }));
        }
      })
      .subscribe();

    const rendersChannel = supabase
      .channel('public:render_jobs')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'render_jobs',
        filter: `user_id=eq.${this.userId}`
      }, (payload) => {
        window.dispatchEvent(new CustomEvent('render-update', { detail: payload.new }));
        if (payload.old.status !== 'completed' && payload.new.status === 'completed') {
          toast.success('Video export completed! You can download it now.');
        } else if (payload.old.status !== 'failed' && payload.new.status === 'failed') {
          toast.error('Video export failed. Please try again.');
        }
      })
      .subscribe();

    this.channels = [creditChannel, projectsChannel, rendersChannel];
  }

  private startFallbackPolling() {
    // Fallback polling every 30 seconds
    this.pollInterval = setInterval(() => {
      this.fetchInitialCredits();
    }, 30000);
  }

  destroy() {
    this.channels.forEach(ch => supabase.removeChannel(ch));
    this.channels = [];
    if (this.pollInterval) clearInterval(this.pollInterval);
    this.userId = null;
    this.initialized = false;
  }
}

export const realtimeSync = new RealtimeSyncManager();
