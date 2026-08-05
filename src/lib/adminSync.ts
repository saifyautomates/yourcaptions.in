import { adminFetch } from "@/lib/adminFetch";
// Frontend: subscribes to ALL admin-controlled settings
// When admin changes anything → every user's UI updates immediately

import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useCreditRatesStore } from '../stores/creditRatesStore';
import { usePlanLimitsStore } from '../stores/planLimitsStore';
import { usePlanPricingStore } from '../stores/planPricingStore';
import { useFeatureFlagsStore } from '../stores/featureFlagsStore';
import { useSystemSettingsStore } from '../stores/systemSettingsStore';

export class AdminSync {
  private channels: any[] = [];

  // Call on app startup — before user even logs in
  async initialize() {
    // Load all settings from API on startup
    await Promise.all([
      this.loadCreditRates(),
      this.loadPlanLimits(),
      this.loadPlanPricing(),
      this.loadFeatureFlags(),
      this.loadSystemSettings(),
    ]);

    // Subscribe to real-time changes
    this.subscribeToChanges();
  }

  private async loadCreditRates() {
    const res = await adminFetch('/functions/v1/admin-api/credit-rates').catch(() => null);
    if (res?.ok && res.headers.get("content-type")?.includes("application/json")) {
        const { rates } = await res.json();
        useCreditRatesStore.getState().setRates(rates);
    }
  }

  private async loadPlanLimits() {
    const res = await adminFetch('/functions/v1/admin-api/plan-limits').catch(() => null);
    if (res?.ok && res.headers.get("content-type")?.includes("application/json")) {
        const { plans } = await res.json();
        usePlanLimitsStore.getState().setLimits(plans);
    }
  }

  private async loadPlanPricing() {
    const currency = detectUserCurrency();
    const res = await adminFetch(`/functions/v1/admin-api/plan-pricing?currency=${currency}`).catch(() => null);
    if (res?.ok && res.headers.get("content-type")?.includes("application/json")) {
        const { pricing } = await res.json();
        usePlanPricingStore.getState().setPricing(pricing);
    }
  }

  private async loadFeatureFlags() {
    const res = await adminFetch('/functions/v1/admin-api/feature-flags').catch(() => null);
    if (res?.ok && res.headers.get("content-type")?.includes("application/json")) {
        const { flags } = await res.json();
        useFeatureFlagsStore.getState().setFlags(flags);
    }
  }

  private async loadSystemSettings() {
    const res = await adminFetch('/functions/v1/admin-api/system-settings').catch(() => null);
    if (res?.ok && res.headers.get("content-type")?.includes("application/json")) {
        const { settings } = await res.json();
        useSystemSettingsStore.getState().setSettings(settings);
    }
  }

  private subscribeToChanges() {
    // Subscribe to credit_rates table changes
    const ratesChannel = supabase
      .channel('admin-credit-rates')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'credit_rates' },
        async () => {
          await this.loadCreditRates();
          console.log('[AdminSync] Credit rates updated');
        }
      )
      .subscribe();

    // Subscribe to plan_limits changes
    const planLimitsChannel = supabase
      .channel('admin-plan-limits')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'plan_limits' },
        async () => {
          await this.loadPlanLimits();
          console.log('[AdminSync] Plan limits updated');
        }
      )
      .subscribe();

    // Subscribe to plan_pricing changes
    const pricingChannel = supabase
      .channel('admin-plan-pricing')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'plan_pricing' },
        async () => {
          await this.loadPlanPricing();
          console.log('[AdminSync] Plan pricing updated');
        }
      )
      .subscribe();

    // Subscribe to feature_flags changes
    const flagsChannel = supabase
      .channel('admin-feature-flags')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'feature_flags' },
        async (payload) => {
          await this.loadFeatureFlags();
          const flag = payload.new as any;
          // Show toast to currently online users if feature was disabled
          if (flag && flag.enabled_global === false) {
            toast.info(`${flag.display_name} has been temporarily disabled.`);
          }
          console.log('[AdminSync] Feature flags updated');
        }
      )
      .subscribe();

    // Subscribe to system_settings changes
    const settingsChannel = supabase
      .channel('admin-system-settings')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'system_settings' },
        async (payload) => {
          await this.loadSystemSettings();
          const setting = payload.new as any;
          // Handle maintenance mode immediately
          if (setting && setting.key === 'maintenance_mode' && setting.value === true) {
            window.location.href = '/maintenance';
          }
          // Handle announcement bar
          if (setting && setting.key === 'announcement_bar') {
            useSystemSettingsStore.getState().updateAnnouncementBar(setting.value);
          }
          console.log('[AdminSync] System settings updated:', setting?.key);
        }
      )
      .subscribe();

    this.channels = [ratesChannel, planLimitsChannel, pricingChannel, flagsChannel, settingsChannel];
  }

  destroy() {
    this.channels.forEach(ch => supabase.removeChannel(ch));
  }
}

export const adminSync = new AdminSync();

function detectUserCurrency(): string {
  // Detect from IP or browser locale
  const locale = navigator.language || 'en-IN';
  return locale.includes('IN') ? 'INR' : 'USD';
}
