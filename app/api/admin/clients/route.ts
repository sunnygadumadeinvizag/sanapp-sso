import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/** Key-guarded list of registered OIDC clients (used by sanapp-main when
 *  registering applications — the client must already exist in the SSO). */
export async function GET(request: NextRequest) {
  const key =
    request.nextUrl.searchParams.get("key") ??
    request.headers.get("x-admin-key") ??
    "";
  if (key !== process.env.SSO_ADMIN_KEY) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const clients = await prisma.oidcClient.findMany({
    select: {
      clientId: true,
      name: true,
      description: true,
      enabled: true,
      redirectUris: true,
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ clients });
}
