import { cookies } from "next/headers";
import { apiPath, Footer, getPlatformNav, Header, Logo, PageShell, UserMenu } from "sanapp-common-ui";
import { verifySessionJwt } from "@/lib/crypto";
import { prisma } from "@/lib/prisma";
import { isAccountDisplayDisabled } from "@/lib/profilePolicy";

export const dynamic = "force-dynamic";

const SSO_BASE_URL = process.env.SSO_BASE_URL ?? "http://localhost:3000";
const MAIN_BASE_URL = process.env.MAIN_BASE_URL ?? "http://localhost:3001";

function NotFoundBody({ showAccount = false }: { showAccount?: boolean }) {
  return (
    <div className="iipe-card" style={{ width: 520, maxWidth: "100%" }}>
      <Logo showText={false} />
      <h1 style={{ margin: "14px 0 4px", fontSize: "1.3rem" }}>404 — Page not found</h1>
      <p style={{ marginTop: 8 }}>
        The page you are looking for does not exist or may have been moved.
      </p>
      <div className="iipe-form-actions">
        {showAccount && (
          <a className="iipe-btn" href={apiPath("/account")}>
            Go to My Account
          </a>
        )}
        <a className={showAccount ? "iipe-btn secondary" : "iipe-btn"} href={MAIN_BASE_URL}>
          Main Portal
        </a>
      </div>
    </div>
  );
}

export default async function NotFoundPage() {
  const store = await cookies();
  const claims = await verifySessionJwt(store.get("sso_session")?.value ?? "");
  const user = claims
    ? await prisma.user.findUnique({
        where: { id: claims.sub },
        select: { role: true },
      })
    : null;
  const isSuperAdmin = user?.role === "SUPER_ADMIN";
  const accountDisplayDisabled = await isAccountDisplayDisabled();
  const showAccount = Boolean(claims && (!accountDisplayDisabled || isSuperAdmin));

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
          <NotFoundBody showAccount={false} />
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
        appsLauncherHref: MAIN_BASE_URL,
        right: (
          <UserMenu
            name={claims.name}
            email={claims.email ?? undefined}
            role={isSuperAdmin ? "Super Admin" : "User"}
            signOutHref="/logout"
          >
            {showAccount && <a href={`${SSO_BASE_URL}/account`}>My Account</a>}
          </UserMenu>
        ),
      }}
    >
      <NotFoundBody showAccount={showAccount} />
    </PageShell>
  );
}
