import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { verifySessionJwt } from "@/lib/crypto";

export default async function Home() {
  const store = await cookies();
  const session = store.get("sso_session")?.value;
  const user = session ? await verifySessionJwt(session) : null;
  redirect(user ? "/account" : "/login");
}
