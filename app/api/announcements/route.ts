import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/announcements — public.
 * Platform updates & alerts posted by the Super Admin, shown on the SSO login
 * page. Only published items are returned, newest first.
 */
export async function GET() {
  const announcements = await prisma.announcement.findMany({
    where: { published: true },
    select: {
      id: true,
      type: true,
      title: true,
      body: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
    take: 12,
  });

  return NextResponse.json({ announcements });
}
