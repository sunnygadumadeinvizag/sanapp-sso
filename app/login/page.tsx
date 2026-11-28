import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { apiPath, Footer, getPlatformNav, Header } from "sanapp-common-ui";
import { prisma } from "@/lib/prisma";
import { verifySessionJwt } from "@/lib/crypto";
import { createCaptchaChallenge } from "@/lib/captcha";
import AnnouncementsPanel from "../components/AnnouncementsPanel";
import InstituteBand from "../components/InstituteBand";
import LoginForm from "../components/LoginForm";

export const metadata: Metadata = { title: "IIPE Intranet Login" };
export const dynamic = "force-dynamic";

const SSO_BASE_URL = process.env.SSO_BASE_URL ?? "http://localhost:3000";
const MAIN_BASE_URL = process.env.MAIN_BASE_URL ?? "http://localhost:3001";

type Announcement = {
  id: string;
  type: "UPDATE" | "ALERT";
  title: string;
  body: string;
  createdAt: Date;
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string; error?: string; loggedOut?: string; reset?: string }>;
}) {
  const params = await searchParams;
  const rawReturn = params.returnTo;
  const defaultReturn = MAIN_BASE_URL;
  let safeReturn = defaultReturn;
  if (rawReturn && rawReturn !== "/account" && rawReturn !== "/sso/account") {
    if (rawReturn.startsWith("/") && !rawReturn.startsWith("//")) {
      safeReturn = rawReturn;
    } else if (rawReturn.startsWith(MAIN_BASE_URL) || rawReturn.startsWith(SSO_BASE_URL)) {
      safeReturn = rawReturn;
    }
  }

  const store = await cookies();
  const session = store.get("sso_session")?.value ?? "";
  const claims = await verifySessionJwt(session);
  if (claims) {
    redirect(safeReturn);
  }

  const announcements: Announcement[] = await prisma.announcement.findMany({
    where: { published: true },
    select: { id: true, type: true, title: true, body: true, createdAt: true },
    orderBy: { createdAt: "desc" },
    take: 12,
  });

  const captcha = await createCaptchaChallenge();

  return (
    <>
      <Header
        appName="SSO"
        signedOut
        navItems={getPlatformNav({
          mainBaseUrl: MAIN_BASE_URL,
          ssoBaseUrl: SSO_BASE_URL,
          signedOut: true,
        })}
      />
      <InstituteBand />
      <main className="iipe-login-page">
        <div className="iipe-login-grid">
          <section className="iipe-auth-card" aria-labelledby="login-heading">
            <div className="iipe-auth-head">
              <div className="iipe-auth-monogram">IIPE</div>
              <h1 id="login-heading" className="iipe-auth-title">
                Welcome back
              </h1>
              <p className="iipe-auth-subtitle">IIPE Intranet · Single Sign-On</p>
              <p className="iipe-auth-subtitle" style={{ marginTop: 4 }}>
                Sign in with your username or institute email to continue.
              </p>
            </div>

            {params.error === "captcha" && (
              <div className="iipe-alert danger">
                Security check failed. Please try again.
              </div>
            )}
            {params.error === "ambiguous_email" && (
              <div className="iipe-alert danger">
                Multiple accounts share this email address. Please sign in with your username.
              </div>
            )}
            {params.error && params.error !== "captcha" && params.error !== "ambiguous_email" && (
              <div className="iipe-alert danger">Invalid username or password.</div>
            )}
            {params.loggedOut && (
              <div className="iipe-alert success">You have been signed out.</div>
            )}
            {params.reset && (
              <div className="iipe-alert success">
                Your password was reset. Sign in with your new password.
              </div>
            )}

            <LoginForm returnTo={safeReturn} initialToken={captcha.token} initialSvg={captcha.svg} />

            <p className="iipe-auth-foot-link">
              <a href={apiPath("/forgot-password")}>Forgot your password?</a>
            </p>
          </section>

          <AnnouncementsPanel
            announcements={announcements.map((a) => ({
              ...a,
              createdAt: a.createdAt.toISOString(),
            }))}
          />
        </div>
      </main>
      <Footer
        links={[
          { label: "Home", href: "/" },
          { label: "Main Portal", href: MAIN_BASE_URL },
        ]}
      />
    </>
  );
}
