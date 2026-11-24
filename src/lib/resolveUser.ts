import { prisma } from "@/lib/prisma";

export type ResolvedUser = NonNullable<Awaited<ReturnType<typeof prisma.user.findFirst>>>;

export type ResolveUserResult =
  | { status: "found"; user: ResolvedUser }
  | { status: "not_found" }
  | { status: "ambiguous_email" };

/**
 * Resolve a user by username (case-insensitive), or by email (case-insensitive)
 * when the email belongs uniquely to a single user ID.
 *
 * Emails are deliberately not unique in the schema (shared emails are allowed),
 * so if more than one user ID shares the email, return "ambiguous_email" so the
 * caller can ask the user to enter their username instead.
 */
export async function resolveUserByLoginIdentifier(identifier: string): Promise<ResolveUserResult> {
  const clean = identifier.trim();
  if (!clean) return { status: "not_found" };

  const byUsername = await prisma.user.findFirst({
    where: {
      username: {
        equals: clean,
        mode: "insensitive",
      },
    },
  });
  if (byUsername) return { status: "found", user: byUsername };

  if (clean.includes("@")) {
    const byEmail = await prisma.user.findMany({
      where: {
        email: {
          equals: clean,
          mode: "insensitive",
        },
      },
      take: 2,
    });
    if (byEmail.length === 1) return { status: "found", user: byEmail[0] };
    if (byEmail.length > 1) return { status: "ambiguous_email" };
  }

  return { status: "not_found" };
}
