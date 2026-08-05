import { usePlanLimitsStore } from "@/stores/planLimitsStore";
import { Gem, Rocket, Crown, Heart } from "lucide-react";

export type PlanId = "starter" | "editor" | "creator" | "studio";

export type Plan = {
  id: PlanId;
  name: string;
  icon: typeof Gem;
  monthly: number;
  monthlyStrike: number;
  yearly: number;
  yearlyStrike: number;
  gstNote?: boolean;
  popular?: boolean;
  featuresHeader: string;
  features: string[];
};

export const PLANS: Plan[] = [
  {
    id: "starter",
    name: "Free",
    icon: Heart,
    monthly: 0,
    monthlyStrike: 0,
    yearly: 0,
    yearlyStrike: 0,
    gstNote: false,
    featuresHeader: "KEY FEATURES",
    features: [
      "5 monthly processing minutes",
      "Up to 2-minute single video",
      "250 MB max upload size",
      "720p export with watermark",
      "Basic templates",
    ],
  },
  {
    id: "editor",
    name: "Editor",
    icon: Gem,
    monthly: 499,
    monthlyStrike: 670,
    yearly: 4990,
    yearlyStrike: 6700,
    gstNote: true,
    featuresHeader: "KEY FEATURES",
    features: [
      "120 monthly processing minutes",
      "Up to 30-minute single video",
      "1 GB max upload size",
      "1080p high-quality export",
      "Custom font uploads",
      "Advanced AI transcription",
      "Standard support"
    ],
  },
  {
    id: "creator",
    name: "Creator",
    icon: Rocket,
    monthly: 999,
    monthlyStrike: 1250,
    yearly: 9990,
    yearlyStrike: 12500,
    gstNote: true,
    popular: true,
    featuresHeader: "EVERYTHING IN EDITOR, PLUS",
    features: [
      "300 monthly processing minutes",
      "Up to 60-minute single video",
      "2 GB max upload size",
      "4K stunning export quality",
      "Multi-language translation",
      "Speaker detection (up to 5 presets)",
      "Up to 2 Brand Kits"
    ],
  },
  {
    id: "studio",
    name: "Studio",
    icon: Crown,
    monthly: 2599,
    monthlyStrike: 3400,
    yearly: 25990,
    yearlyStrike: 34000,
    featuresHeader: "EVERYTHING IN CREATOR, PLUS",
    features: [
      "720 monthly processing minutes",
      "Up to 120-minute single video",
      "5 GB max upload size",
      "Unlimited speaker presets",
      "Unlimited Brand Kits",
      "Unlimited branding layers",
      "Priority support"
    ],
  },
];

// ----------------------------------------------------------------------------
// PLAN CAPABILITIES & LIMITS (Server Authoritative)
// ----------------------------------------------------------------------------

export type PlanCapabilities = {
  maxVideoDurationMin: number;
  maxExportResolution: "720p" | "1080p" | "4K";
  monthlyMinutes: number;
  watermarkRequired: boolean;
  canTranslate: boolean;
  canSpeakerDetect: boolean;
  canCustomBrand: boolean;
  maxBrandKits: number;
  maxBrandLayers: number;
  maxSpeakerPresets: number;
  maxUploadBytes: number;
};

export const CAPABILITIES: Record<PlanId, PlanCapabilities> = {
  starter: {
    maxVideoDurationMin: 2,
    maxExportResolution: "720p",
    monthlyMinutes: 5,
    watermarkRequired: true,
    canTranslate: false,
    canSpeakerDetect: false,
    canCustomBrand: false,
    maxBrandKits: 0,
    maxBrandLayers: 0,
    maxSpeakerPresets: 0,
    maxUploadBytes: 250 * 1024 * 1024, // 250 MB
  },
  editor: {
    maxVideoDurationMin: 30,
    maxExportResolution: "1080p",
    monthlyMinutes: 120,
    watermarkRequired: false,
    canTranslate: true,
    canSpeakerDetect: false,
    canCustomBrand: false,
    maxBrandKits: 0,
    maxBrandLayers: 0,
    maxSpeakerPresets: 0,
    maxUploadBytes: 1 * 1024 * 1024 * 1024, // 1 GB
  },
  creator: {
    maxVideoDurationMin: 60,
    maxExportResolution: "4K",
    monthlyMinutes: 300,
    watermarkRequired: false,
    canTranslate: true,
    canSpeakerDetect: true,
    canCustomBrand: true,
    maxBrandKits: 2,
    maxBrandLayers: 5,
    maxSpeakerPresets: 5,
    maxUploadBytes: 2 * 1024 * 1024 * 1024, // 2 GB
  },
  studio: {
    maxVideoDurationMin: 120,
    maxExportResolution: "4K",
    monthlyMinutes: 720,
    watermarkRequired: false,
    canTranslate: true,
    canSpeakerDetect: true,
    canCustomBrand: true,
    maxBrandKits: 9999,
    maxBrandLayers: 9999,
    maxSpeakerPresets: 9999,
    maxUploadBytes: 5 * 1024 * 1024 * 1024, // 5 GB
  },
};


/**
 * Returns the resolved capabilities for a given plan.
 * Prioritizes database-synced limits from Zustand over hardcoded fallbacks.
 */
export function getPlanCapabilities(plan: string | null | undefined): PlanCapabilities {
  const safePlan = (plan || "starter") as PlanId;
  const defaults = CAPABILITIES[safePlan] || CAPABILITIES.starter;
  
  const serverLimits = usePlanLimitsStore.getState().limits[safePlan];
  if (!serverLimits) return defaults;

  return {
    ...defaults,
    maxVideoDurationMin: serverLimits.max_duration_minutes ?? defaults.maxVideoDurationMin,
    monthlyMinutes: serverLimits.monthly_included_minutes ?? defaults.monthlyMinutes,
    maxUploadBytes: (serverLimits.max_upload_size_mb ?? (defaults.maxUploadBytes / 1024 / 1024)) * 1024 * 1024,
    maxExportResolution: serverLimits.max_export_resolution ?? defaults.maxExportResolution,
  };
}


