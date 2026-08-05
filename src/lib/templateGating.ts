// Pure gating logic for caption templates.
// Kept dependency-free so it can be unit-tested and reused anywhere.

import { FREE_PRESET_NAMES } from "@/lib/captionStyle";

export interface GateInput {
  /** Template name being applied. */
  name: string;
  /** Admin-configured list of free template names (case-insensitive). */
  freeNames?: readonly string[];
  /** User is on a paid plan. */
  isPaid?: boolean;
  /** User has admin role. */
  isAdmin?: boolean;
}

/** Returns true if the given template name is in the free-tier list. */
export function isFreeTemplateName(
  name: string,
  freeNames: readonly string[] = FREE_PRESET_NAMES,
): boolean {
  if (!name) return false;
  const target = name.trim().toLowerCase();
  if (!target) return false;
  for (const n of freeNames) {
    if (typeof n === "string" && n.trim().toLowerCase() === target) return true;
  }
  return false;
}

/**
 * Central rule: a template is usable when it's free OR the user is paid/admin.
 * Admin and paid users always get access to every template.
 */
export function canUseTemplate({
  name,
  freeNames = FREE_PRESET_NAMES,
  isPaid = false,
  isAdmin = false,
}: GateInput): boolean {
  if (isAdmin) return true;
  if (isPaid) return true;
  return isFreeTemplateName(name, freeNames);
}
