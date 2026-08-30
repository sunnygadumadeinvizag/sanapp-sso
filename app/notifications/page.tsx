import { cookies } from "next/headers";
import { verifySessionJwt } from "@/lib/crypto";
import {
  AppNotificationsView,
  getPlatformNav,
  PageShell,
  UserMenu,
} from "sanapp-common-ui";
import { prisma } from "@/lib/prisma";

import { isAccountDisplayDisabled } from "@/lib/profilePolicy";

export const dynamic = "force-dynamic";

const SSO_BASE_URL = process.env.SSO_BASE_URL ?? "http://localhost:3000";
const MAIN_BASE_URL = process.env.MAIN_BASE_URL ?? "http://localhost:3001";

export default async function NotificationsPage() {
  const store = await cookies();
  const session = store.get("sso_session")?.value ?? "";
  const claims = await verifySessionJwt(session);
  const user = claims
    ? await prisma.user.findUnique({ where: { id: claims.sub } })
    : null;

  if (!user) {
    return <p className="iipe-container">Session not found.</p>;
  }

  const accountDisplayDisabled = await isAccountDisplayDisabled();
  const showAccount = !accountDisplayDisabled || user.role === "SUPER_ADMIN";

  return (
    <PageShell
      appName="SSO"
      header={{
        navItems: getPlatformNav({
          mainBaseUrl: MAIN_BASE_URL,
          ssoBaseUrl: SSO_BASE_URL,
          active: "notifications",
        }),
        appsLauncherHref: MAIN_BASE_URL,
        right: (
          <UserMenu
            name={user.name}
            email={user.email ?? undefined}
            role={user.role === "SUPER_ADMIN" ? "Super Admin" : "User"}
            signOutHref="/logout"
            avatarUrl={user.avatar ? `${SSO_BASE_URL}${user.avatar}` : undefined}
          >
            {showAccount && <a href={`${SSO_BASE_URL}/account`}>My Account</a>}
            {user.role === "SUPER_ADMIN" && (
              <>
                <div className="iipe-dropdown-section">Admin Console</div>
                <a href={`${MAIN_BASE_URL}/admin-console`}>Admin Console</a>
              </>
            )}
          </UserMenu>
        ),
      }}
      sidebarItems={[
        ...(showAccount ? [{ label: "My Account", href: `${SSO_BASE_URL}/account` }] : []),
        { label: "Home", href: MAIN_BASE_URL },
        { label: "App Notifications", href: "/notifications", active: true },
      ]}
    >
      <h1 className="iipe-page-title">App Notifications</h1>
      <p className="iipe-page-sub">
        Everything your intranet applications have notified you about — centralized in Main and
        grouped by application. The same list appears under the bell in every application's header.
      </p>
      <div className="mt-4">
        <AppNotificationsView appName="SSO" />
      </div>
    </PageShell>
  );
}
