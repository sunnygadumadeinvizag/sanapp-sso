import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const key =
    request.nextUrl.searchParams.get("key") ??
    request.headers.get("x-admin-key") ??
    "";
  if (key !== process.env.SSO_ADMIN_KEY) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const users = await prisma.user.findMany({
    select: {
      id: true,
      username: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      createdAt: true,
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ users });
}
