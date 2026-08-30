import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { verifySessionJwt } from "@/lib/crypto";

const MAIN_BASE_URL = process.env.MAIN_BASE_URL ?? "http://localhost:3001/main";

export const dynamic = "force-dynamic";

export default async function Home() {
  const store = await cookies();
  const session = store.get("sso_session")?.value;
  const user = session ? await verifySessionJwt(session) : null;
  redirect(user ? MAIN_BASE_URL : "/login");
}
