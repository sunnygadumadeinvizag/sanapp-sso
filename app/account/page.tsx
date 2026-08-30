import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getPlatformNav, PageShell, UserMenu } from "sanapp-common-ui";
import { prisma } from "@/lib/prisma";
import { verifySessionJwt } from "@/lib/crypto";
import { getLockedProfileRoles, isAccountDisplayDisabled, profileLockReason } from "@/lib/profilePolicy";
import { ProfileEditor, type ProfileUser } from "../components/ProfileEditor";
import { ChangePasswordCard } from "../components/ChangePasswordCard";

export const dynamic = "force-dynamic";

const SSO_BASE_URL = process.env.SSO_BASE_URL ?? "http://localhost:3000";
const MAIN_BASE_URL = process.env.MAIN_BASE_URL ?? "http://localhost:3001";

const PRIMARY_ROLE_LABELS: Record<string, string> = {
  STAFF_NON_TEACHING: "Staff — Non-Teaching",
  STAFF_TEACHING: "Staff — Teaching",
  STUDENT: "Student",
  SCHOLAR: "Scholar",
  GUEST: "Guest",
};

const EMPLOYMENT_LABELS: Record<string, string> = {
  REGULAR: "Regular",
  CONTRACTUAL: "Contractual",
  VISITING: "Visiting",
  OUTSOURCING: "Outsourcing",
  PROJECT_STAFF: "Project Staff",
  OTHER: "Other",
};

const GENDER_LABELS: Record<string, string> = {
  MALE: "Male",
  FEMALE: "Female",
  OTHER: "Other",
};

const PH_LABELS: Record<string, string> = {
  NONE: "None",
  OH: "Orthopaedically Handicapped",
  VI: "Visually Impaired",
  HI: "Hearing Impaired",
  LD: "Learning Disability",
  MD: "Multiple Disabilities",
  OTHER: "Other",
};

export default async function AccountPage() {
  const store = await cookies();
  const session = store.get("sso_session")?.value ?? "";
  const claims = await verifySessionJwt(session);
  const user = claims
    ? await prisma.user.findUnique({
        where: { id: claims.sub },
        include: {
          department: true,
          programme: true,
          course: true,
          guide: { select: { name: true, username: true } },
          headsOf: { select: { name: true } },
        },
      })
    : null;

  if (!user) {
    return <p className="iipe-container">Session not found.</p>;
  }

  const accountDisplayDisabled = await isAccountDisplayDisabled();
  if (accountDisplayDisabled && user.role !== "SUPER_ADMIN") {
    redirect(MAIN_BASE_URL);
  }

  const [clients, lockedRoles] = await Promise.all([
    prisma.oidcClient.findMany({
      where: { enabled: true },
      orderBy: { name: "asc" },
    }),
    getLockedProfileRoles(),
  ]);
  const lockReason = profileLockReason(user, lockedRoles);

  const profileUser: ProfileUser = {
    id: user.id,
    username: user.username,
    name: user.name,
    email: user.email,
    phone: user.phone,
    designation: user.designation,
    nonInstituteEmail: user.nonInstituteEmail,
    emergencyPhone: user.emergencyPhone,
    primaryRole: user.primaryRole,
    avatar: user.avatar,
    profileLocked: user.profileLocked,
  };

  const isStaff =
    user.primaryRole === "STAFF_TEACHING" ||
    user.primaryRole === "STAFF_NON_TEACHING";

  return (
    <PageShell
      appName="SSO"
      header={{
        navItems: getPlatformNav({
          mainBaseUrl: MAIN_BASE_URL,
          ssoBaseUrl: SSO_BASE_URL,
          active: "account",
        }),
        appsLauncherHref: MAIN_BASE_URL,
        right: (
          <UserMenu
            name={user.name}
            email={user.email ?? undefined}
            role={user.role === "SUPER_ADMIN" ? "Super Admin" : "User"}
            signOutHref="/logout"
            avatarUrl={
              user.avatar ? `${SSO_BASE_URL}${user.avatar}` : undefined
            }
          >
            {(!accountDisplayDisabled || user.role === "SUPER_ADMIN") && (
              <a href={`${SSO_BASE_URL}/account`}>My Account</a>
            )}
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

        { label: "Home", href: MAIN_BASE_URL },
        { label: "App Notifications", href: "/notifications" },
      ]}
    >
      <h1 className="iipe-page-title">My Account</h1>
      <p className="iipe-page-sub">
        This is who the central SSO knows you as. Applications ask the SSO
        &ldquo;who is this user?&rdquo; — the SSO answers.
      </p>

      <div className="iipe-grid iipe-grid-2">
        <ProfileEditor
          user={profileUser}
          ssoBaseUrl={SSO_BASE_URL}
          lockedReason={lockReason}
        />

        <ChangePasswordCard />

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
                <td>{user.email ?? "—"}</td>
              </tr>
              <tr>
                <td className="iipe-muted">User ID (sub)</td>
                <td>
                  <code>{user.id}</code>
                </td>
              </tr>
              <tr>
                <td className="iipe-muted">Member since</td>
                <td>
                  {user.createdAt.toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="iipe-card">
          <h2>Profile</h2>
          <table className="iipe-table">
            <tbody>
              <tr>
                <td className="iipe-muted">Primary role</td>
                <td>
                  <span className="iipe-badge accent">
                    {PRIMARY_ROLE_LABELS[user.primaryRole] ?? user.primaryRole}
                  </span>
                </td>
              </tr>
              <tr>
                <td className="iipe-muted">Department / Section</td>
                <td>{user.department?.name ?? "—"}</td>
              </tr>
              {(user.primaryRole === "STUDENT" ||
                user.primaryRole === "SCHOLAR") && (
                <tr>
                  <td className="iipe-muted">Roll number</td>
                  <td>{user.rollNo ?? "—"}</td>
                </tr>
              )}
              {isStaff && (
                <>
                  <tr>
                    <td className="iipe-muted">Employee number</td>
                    <td>{user.empNo ?? "—"}</td>
                  </tr>
                  <tr>
                    <td className="iipe-muted">Employment type</td>
                    <td>
                      {user.employmentType
                        ? EMPLOYMENT_LABELS[user.employmentType] ?? user.employmentType
                        : "—"}
                    </td>
                  </tr>
                  {user.designation && (
                    <tr>
                      <td className="iipe-muted">Designation</td>
                      <td>{user.designation}</td>
                    </tr>
                  )}
                </>
              )}
              {user.primaryRole === "STUDENT" ? (
                <>
                  <tr>
                    <td className="iipe-muted">Programme</td>
                    <td>{user.programme?.name ?? "—"}</td>
                  </tr>
                  <tr>
                    <td className="iipe-muted">Course</td>
                    <td>{user.course?.name ?? "—"}</td>
                  </tr>
                </>
              ) : null}
              {user.primaryRole === "SCHOLAR" ? (
                <tr>
                  <td className="iipe-muted">Guide</td>
                  <td>
                    {user.guide ? (
                      <>
                        {user.guide.name}{" "}
                        <span className="iipe-muted">(@{user.guide.username})</span>
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ) : null}
              <tr>
                <td className="iipe-muted">Gender</td>
                <td>{GENDER_LABELS[user.gender ?? ""] ?? user.gender ?? "—"}</td>
              </tr>
              <tr>
                <td className="iipe-muted">PH category</td>
                <td>{PH_LABELS[user.phCategory ?? ""] ?? user.phCategory ?? "—"}</td>
              </tr>
              <tr>
                <td className="iipe-muted">Phone</td>
                <td>{user.phone ?? "—"}</td>
              </tr>
              <tr>
                <td className="iipe-muted">Emergency phone</td>
                <td>{user.emergencyPhone ?? "—"}</td>
              </tr>
              <tr>
                <td className="iipe-muted">Non-institute email</td>
                <td>{user.nonInstituteEmail ?? "—"}</td>
              </tr>
              {user.headsOf.length > 0 ? (
                <tr>
                  <td className="iipe-muted">Head of</td>
                  <td>{user.headsOf.map((d) => d.name).join(", ")}</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="iipe-card">
          <h2>Connected applications</h2>
          <p className="iipe-muted" style={{ marginTop: 0 }}>
            These applications use the SSO for sign-in. Whether you can open
            them is managed centrally — see{" "}
            <a href={MAIN_BASE_URL}>your applications</a>.
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
