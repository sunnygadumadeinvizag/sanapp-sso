import { prisma } from "./prisma";

export const PROFILE_LOCK_KEY = "locked_profile_roles";
export const ACCOUNT_DISPLAY_DISABLED_KEY = "account_display_disabled";

/** Primary roles whose self-edits are disabled (from PlatformSetting). */
export async function getLockedProfileRoles(): Promise<string[]> {
  const setting = await prisma.platformSetting.findUnique({
    where: { key: PROFILE_LOCK_KEY },
  });
  return (setting?.value ?? "")
    .split(",")
    .map((r) => r.trim().toUpperCase())
    .filter(Boolean);
}

/** Whether the My Account page and menu links are disabled for regular users. */
export async function isAccountDisplayDisabled(): Promise<boolean> {
  const setting = await prisma.platformSetting.findUnique({
    where: { key: ACCOUNT_DISPLAY_DISABLED_KEY },
  });
  return setting?.value === "true" || setting?.value === "1";
}

/**
 * Why this user cannot edit their own profile, or null when they can.
 * profileLocked (per-user flag, set by the Super Admin) always wins;
 * otherwise the primary-role policy applies.
 */
export function profileLockReason(
  user: { profileLocked: boolean; primaryRole: string },
  lockedRoles: string[]
): string | null {
  if (user.profileLocked) {
    return "Your profile is locked by the administrator. Contact the administrator to update your details.";
  }
  if (lockedRoles.includes(user.primaryRole)) {
    return `Profile changes are locked for ${user.primaryRole
      .replace(/_/g, " ")
      .toLowerCase()} accounts. Contact the administrator to update your details.`;
  }
  return null;
}
