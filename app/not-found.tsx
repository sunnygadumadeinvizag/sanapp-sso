import { cookies } from "next/headers";
import { apiPath, Footer, getPlatformNav, Header, Logo, PageShell, UserMenu } from "sanapp-common-ui";
import { verifySessionJwt } from "@/lib/crypto";

export const dynamic = "force-dynamic";

const SSO_BASE_URL = process.env.SSO_BASE_URL ?? "http://localhost:3000";
const MAIN_BASE_URL = process.env.MAIN_BASE_URL ?? "http://localhost:3001";

function NotFoundBody() {
  return (
    <div className="iipe-card" style={{ width: 520, maxWidth: "100%" }}>
      <Logo showText={false} />
      <h1 style={{ margin: "14px 0 4px", fontSize: "1.3rem" }}>404 — Page not found</h1>
      <p style={{ marginTop: 8 }}>
        The page you are looking for does not exist or may have been moved.
      </p>
      <div className="iipe-form-actions">
        <a className="iipe-btn" href={apiPath("/account")}>
          Go to My Account
        </a>
        <a className="iipe-btn secondary" href={`${MAIN_BASE_URL}/my-apps`}>
          My Apps
        </a>
      </div>
    </div>
  );
}

export default async function NotFoundPage() {
  const store = await cookies();
  const claims = await verifySessionJwt(store.get("sso_session")?.value ?? "");

  if (!claims) {
    return (
      <>
        <Header
          appName="SSO"
          navItems={getPlatformNav({
            mainBaseUrl: MAIN_BASE_URL,
            ssoBaseUrl: SSO_BASE_URL,
            signedOut: true,
          })}
        />
        <div className="iipe-center-page">
          <NotFoundBody />
        </div>
        <Footer />
      </>
    );
  }

  return (
    <PageShell
      appName="SSO"
      header={{
        navItems: getPlatformNav({
          mainBaseUrl: MAIN_BASE_URL,
          ssoBaseUrl: SSO_BASE_URL,
          active: "home",
        }),
        appsLauncherHref: `${MAIN_BASE_URL}/my-apps`,
        right: (
          <UserMenu
            name={claims.name}
            email={claims.email ?? undefined}
            role="User"
            signOutHref="/logout"
          >
            <a href={`${SSO_BASE_URL}/account`}>My Account</a>
            <a href={`${MAIN_BASE_URL}/my-apps`}>My Apps</a>
          </UserMenu>
        ),
      }}
    >
      <NotFoundBody />
    </PageShell>
  );
}
