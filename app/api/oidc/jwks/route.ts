import { NextResponse } from "next/server";
import { getPublicJwk } from "@/lib/crypto";

export async function GET() {
  const jwk = await getPublicJwk();
  return NextResponse.json({
    keys: [
      {
        ...jwk,
        kid: "iipe-sso-key-1",
        use: "sig",
        alg: "RS256",
      },
    ],
  });
}
