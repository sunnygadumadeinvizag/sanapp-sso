import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySessionJwt } from "@/lib/crypto";

/**
 * GET — the user's accessible applications, proxied from iipe-main.
 *
 * Feeds the shared AppsMenu (Apps launcher icon) on the SSO account page.
 * The SSO session is verified here, then main's registry is asked for the
 * enabled applications granted to this user.
 */
export async function GET() {
  const store = await cookies();
  const token = store.get("sso_session")?.value;
  const user = token ? await verifySessionJwt(token) : null;
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const res = await fetch(`${process.env.MAIN_BASE_URL!}/api/my-apps`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-app-key": process.env.MAIN_API_KEY!,
      },
      body: JSON.stringify({ userId: user.sub, username: user.username }),
      cache: "no-store",
    });
    if (!res.ok) return NextResponse.json({ apps: [] });
    return NextResponse.json(await res.json());
  } catch {
    return NextResponse.json({ apps: [] });
  }
}
