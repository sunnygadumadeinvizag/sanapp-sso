import { prisma } from "./prisma";

export const PROFILE_LOCK_KEY = "locked_profile_roles";

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
