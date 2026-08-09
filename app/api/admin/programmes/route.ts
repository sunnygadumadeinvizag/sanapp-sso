import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function authorized(request: NextRequest) {
  const key =
    request.nextUrl.searchParams.get("key") ??
    request.headers.get("x-admin-key") ??
    "";
  return key === process.env.SSO_ADMIN_KEY;
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) return unauthorized();
  const programmes = await prisma.programme.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  return NextResponse.json({ programmes });
}

function unauthorized() {
  return NextResponse.json({ error: "unauthorized" }, { status: 401 });
}
