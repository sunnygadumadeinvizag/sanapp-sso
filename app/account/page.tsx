import { cookies } from "next/headers";
import { PageShell, UserMenu } from "iipe-common-ui";
import { prisma } from "@/lib/prisma";
import { verifySessionJwt } from "@/lib/crypto";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const store = await cookies();
  const session = store.get("sso_session")?.value ?? "";
  const claims = await verifySessionJwt(session);
  const user = claims
    ? await prisma.user.findUnique({ where: { id: claims.sub } })
    : null;

  if (!user) {
    return <p className="iipe-container">Session not found.</p>;
  }

  const clients = await prisma.oidcClient.findMany({
    where: { enabled: true },
    orderBy: { name: "asc" },
  });

  return (
    <PageShell
      header={{
        navItems: [{ label: "My Account", href: "/account", active: true }],
        right: (
          <UserMenu
            name={user.name}
            email={user.email}
            role={user.role === "SUPER_ADMIN" ? "Super Admin" : "User"}
            signOutHref="/logout"
          >
            <a href="/account">My Account</a>
          </UserMenu>
        ),
      }}
    >
      <h1 className="iipe-page-title">My Account</h1>
      <p className="iipe-page-sub">
        This is who the central SSO knows you as. Applications ask the SSO
        &ldquo;who is this user?&rdquo; — the SSO answers.
      </p>

      <div className="iipe-grid iipe-grid-2">
        <div className="iipe-card">
          <h2>Identity</h2>
          <table className="iipe-table">
            <tbody>
              <tr>
                <td className="iipe-muted">Name</td>
                <td>{user.name}</td>
              </tr>
              <tr>
                <td className="iipe-muted">Username</td>
                <td>
                  <code>{user.username}</code>
                </td>
              </tr>
              <tr>
                <td className="iipe-muted">Email</td>
                <td>{user.email}</td>
              </tr>
              <tr>
                <td className="iipe-muted">User ID (sub)</td>
                <td>
                  <code>{user.id}</code>
                </td>
              </tr>
              <tr>
                <td className="iipe-muted">Member since</td>
                <td>{user.createdAt.toLocaleDateString()}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="iipe-card">
          <h2>Connected applications</h2>
          <p className="iipe-muted" style={{ marginTop: 0 }}>
            These applications use the SSO for sign-in. Whether you can open
            them is managed centrally — see{" "}
            <a href={`${process.env.MAIN_BASE_URL ?? "http://localhost:3001"}/my-apps`}>
              your applications
            </a>
            .
          </p>
          <ul style={{ paddingLeft: 18, marginBottom: 0 }}>
            {clients.map((c) => (
              <li key={c.clientId} style={{ marginBottom: 6 }}>
                <strong>{c.name}</strong>
                <span className="iipe-muted"> ({c.clientId})</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </PageShell>
  );
}
