export type Plan = 'free' | 'editor' | 'creator' | 'studio';
export type AppFeature = keyof typeof FeatureSync.FEATURES;

export const FeatureSync = {
  // Check if current user's plan allows a feature
  canUse(feature: AppFeature, plan: Plan): boolean {
    const featureInfo = FeatureSync.FEATURES[feature];
    if (!featureInfo) return true;
    
    const minPlan = featureInfo.minPlan;
    const planLevels: Record<Plan, number> = { free: 0, editor: 1, creator: 2, studio: 3 };
    
    return planLevels[plan] >= planLevels[minPlan as Plan];
  },

  // Get lock reason for UI
  getLockReason(feature: AppFeature, plan: Plan): string | null {
    if (this.canUse(feature, plan)) return null;
    
    const featureInfo = FeatureSync.FEATURES[feature];
    if (!featureInfo) return null;
    
    const featureName = feature.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    const planName = featureInfo.minPlan.charAt(0).toUpperCase() + featureInfo.minPlan.slice(1);
    
    const prices: Record<string, string> = {
      Editor: '₹499/mo',
      Creator: '₹999/mo',
      Studio: '₹2599/mo'
    };
    
    return `${featureName} requires ${planName} plan (${prices[planName] || 'Paid'})`;
  },

  // Get upgrade CTA
  getUpgradeCTA(feature: AppFeature): {
    plan: Plan;
    price: string;
    url: string;
  } | null {
    const featureInfo = FeatureSync.FEATURES[feature];
    if (!featureInfo) return null;
    
    const minPlan = featureInfo.minPlan as Plan;
    const prices: Record<Plan, string> = {
      free: '₹0/mo',
      editor: '₹499/mo',
      creator: '₹999/mo',
      studio: '₹2599/mo'
    };
    
    return {
      plan: minPlan,
      price: prices[minPlan],
      url: `/pricing?upgrade=${minPlan}`
    };
  },

  // Check video duration against plan
  checkVideoDuration(durationSeconds: number, plan: Plan): {
    allowed: boolean;
    maxSeconds: number;
    upgradeRequired: Plan | null;
  } {
    const limits = FeatureSync.LIMITS[plan];
    const maxSeconds = limits.maxMinutes * 60;
    const allowed = durationSeconds <= maxSeconds;
    
    let upgradeRequired: Plan | null = null;
    if (!allowed) {
      if (durationSeconds <= FeatureSync.LIMITS.editor.maxMinutes * 60) upgradeRequired = 'editor';
      else if (durationSeconds <= FeatureSync.LIMITS.creator.maxMinutes * 60) upgradeRequired = 'creator';
      else upgradeRequired = 'studio';
    }
    
    return {
      allowed,
      maxSeconds,
      upgradeRequired
    };
  },

  // Check storage quota
  checkStorage(usedGB: number, fileSizeGB: number, plan: Plan): {
    allowed: boolean;
    usedGB: number;
    limitGB: number;
    availableGB: number;
  } {
    const limitGB = FeatureSync.LIMITS[plan].storageGB;
    const availableGB = Math.max(0, limitGB - usedGB);
    const allowed = fileSizeGB <= availableGB;
    
    return {
      allowed,
      usedGB,
      limitGB,
      availableGB
    };
  },

  // Plan limits constant (must match plan_limits DB table)
  LIMITS: {
    free:    { maxMinutes: 2,  maxGB: 5,   storageGB: 5,   monthlyCredits: 60,   maxTeamMembers: 1 },
    editor:  { maxMinutes: 10, maxGB: 20, storageGB: 20,  monthlyCredits: 300,  maxTeamMembers: 1 },
    creator: { maxMinutes: 30, maxGB: 60, storageGB: 60, monthlyCredits: 1000, maxTeamMembers: 3 },
    studio:  { maxMinutes: Infinity, maxGB: Infinity, storageGB: 150, monthlyCredits: 5000, maxTeamMembers: Infinity },
  } as const,

  // Feature access matrix (must match plan_limits DB table)
  FEATURES: {
    caption_burn:       { minPlan: 'editor' },
    ai_dubbing:         { minPlan: 'creator' },
    voice_cloning:      { minPlan: 'creator' },
    lip_sync:           { minPlan: 'creator' },
    video_generation:   { minPlan: 'studio' },
    api_access:         { minPlan: 'studio' },
    audio_only_upload:  { minPlan: 'creator' },
    green_screen:       { minPlan: 'creator' },
    export_4k:          { minPlan: 'creator' },
    custom_font:        { minPlan: 'editor' },
    watermark_optional: { minPlan: 'editor' },
    priority_render:    { minPlan: 'studio' },
  } as const,
};
