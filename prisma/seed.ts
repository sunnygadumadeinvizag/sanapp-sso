import "dotenv/config";
import { hash } from "bcryptjs";
import { generateKeyPair, exportJWK } from "jose";
import { prisma } from "../src/lib/prisma";
import { PrimaryRole, EmploymentType, Gender } from "../src/generated/prisma/enums";

type SeedUser = {
  username: string;
  email: string;
  name: string;
  passwordHash: string;
  role: string;
  primaryRole: PrimaryRole;
  employmentType?: EmploymentType | null;
  designation?: string | null;
  departmentId: string;
  gender: Gender;
  phCategory: string;
  rollNo?: string | null;
  empNo?: string | null;
  programmeId?: string | null;
  courseId?: string | null;
  isTest?: boolean;
};

async function main() {
  console.log("Seeding sanapp_sso_db …");

  const passwordHash = await hash("password123", 10);
  const adminHash = await hash("admin123", 10);

  // ------------------------------------------------------------------
  // Departments / sections
  // ------------------------------------------------------------------
  const departments = [
    "Computer Science & Engineering",
    "Petroleum Engineering",
    "Chemical Engineering",
    "Chemistry",
    "Mechanical Engineering",
    "Administration",
    "Accounts & Finance",
    "Human Resources",
    "Library",
    "Estate & Services",
  ];

  for (const name of departments) {
    await prisma.department.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  // ------------------------------------------------------------------
  // Programmes (students) and courses
  // ------------------------------------------------------------------
  const programmes = [
    "B.Tech",
    "M.Tech",
    "MBA",
    "M.Sc",
    "Integrated M.Tech + PhD",
    "PhD",
  ];
  for (const name of programmes) {
    await prisma.programme.upsert({ where: { name }, update: {}, create: { name } });
  }

  const courses = [
    "Petroleum Engineering",
    "Chemical Engineering",
    "Computer Science & Engineering",
    "Chemistry",
    "Mechanical Engineering",
    "Management Studies",
  ];
  for (const name of courses) {
    await prisma.course.upsert({ where: { name }, update: {}, create: { name } });
  }

  // ------------------------------------------------------------------
  // Users — every user has a primary role + department profile
  // ------------------------------------------------------------------
  const dept = async (name: string) =>
    (await prisma.department.findUnique({ where: { name } }))!;
  const prog = async (name: string) =>
    (await prisma.programme.findUnique({ where: { name } }))!;
  const crs = async (name: string) =>
    (await prisma.course.findUnique({ where: { name } }))!;

  const cse = await dept("Computer Science & Engineering");
  const petroleum = await dept("Petroleum Engineering");
  const chemistry = await dept("Chemistry");
  const administration = await dept("Administration");
  const accounts = await dept("Accounts & Finance");

  // Create/update all users first (so guide/HOD references can resolve).
  const users: SeedUser[] = [
    {
      username: "sanyasi",
      isTest: true,
      email: "sanyasi.naidu@iipe.ac.in",
      name: "Sanyasi Naidu",
      passwordHash,
      role: "USER",
      gender: Gender.MALE,
      phCategory: "NONE",
      empNo: "IPE-T-001",
      primaryRole: PrimaryRole.STAFF_TEACHING,
      employmentType: EmploymentType.REGULAR,
      designation: "Professor",
      departmentId: cse.id,
    },
    {
      username: "lakshmi",
      isTest: true,
      email: "lakshmi@iipe.ac.in",
      name: "Lakshmi Devi",
      passwordHash,
      role: "USER",
      gender: Gender.FEMALE,
      phCategory: "NONE",
      empNo: "IPE-NT-014",
      primaryRole: PrimaryRole.STAFF_NON_TEACHING,
      employmentType: EmploymentType.REGULAR,
      designation: "Section Officer",
      departmentId: administration.id,
    },
    {
      username: "admin",
      isTest: true,
      email: "admin@iipe.ac.in",
      name: "System Administrator",
      passwordHash: adminHash,
      role: "SUPER_ADMIN",
      gender: Gender.MALE,
      phCategory: "NONE",
      empNo: "IPE-NT-001",
      primaryRole: PrimaryRole.STAFF_NON_TEACHING,
      employmentType: EmploymentType.REGULAR,
      designation: "Super Admin",
      departmentId: administration.id,
    },
    {
      username: "ramesh",
      isTest: true,
      email: "ramesh.kumar@iipe.ac.in",
      name: "Ramesh Kumar",
      passwordHash,
      role: "USER",
      gender: Gender.MALE,
      phCategory: "NONE",
      rollNo: "21PE3012",
      primaryRole: PrimaryRole.STUDENT,
      departmentId: petroleum.id,
      programmeId: (await prog("B.Tech")).id,
      courseId: (await crs("Petroleum Engineering")).id,
    },
    {
      username: "geeta",
      isTest: true,
      email: "geeta.sharma@iipe.ac.in",
      name: "Geeta Sharma",
      passwordHash,
      role: "USER",
      gender: Gender.FEMALE,
      phCategory: "NONE",
      rollNo: "23PH1105",
      primaryRole: PrimaryRole.SCHOLAR,
      departmentId: petroleum.id,
      programmeId: (await prog("PhD")).id,
    },
    {
      username: "kiran",
      isTest: true,
      email: "kiran.rao@iipe.ac.in",
      name: "Kiran Rao",
      passwordHash,
      role: "USER",
      gender: Gender.MALE,
      phCategory: "NONE",
      empNo: "IPE-T-042",
      primaryRole: PrimaryRole.STAFF_TEACHING,
      employmentType: EmploymentType.CONTRACTUAL,
      designation: "Assistant Professor (Contract)",
      departmentId: chemistry.id,
    },
    {
      username: "venkat",
      isTest: true,
      email: "venkat.reddy@iipe.ac.in",
      name: "Venkat Reddy",
      passwordHash,
      role: "USER",
      gender: Gender.MALE,
      phCategory: "NONE",
      empNo: "IPE-NT-077",
      primaryRole: PrimaryRole.STAFF_NON_TEACHING,
      employmentType: EmploymentType.OUTSOURCING,
      designation: "Accounts Assistant",
      departmentId: accounts.id,
    },
  ];

  for (const u of users) {
    await prisma.user.upsert({
      where: { username: u.username },
      update: { ...u },
      create: { ...u },
    });
  }

  // Assign guides (scholars) and Heads of Department.
  const sanyasi = await prisma.user.findUnique({ where: { username: "sanyasi" } });
  const geeta = await prisma.user.findUnique({ where: { username: "geeta" } });
  const adminUser = await prisma.user.findUnique({ where: { username: "admin" } });
  const lakshmi = await prisma.user.findUnique({ where: { username: "lakshmi" } });

  if (sanyasi && geeta) {
    await prisma.user.update({ where: { id: geeta.id }, data: { guideId: sanyasi.id } });
  }
  if (sanyasi) {
    await prisma.department.update({
      where: { id: cse.id },
      data: { headId: sanyasi.id },
    });
  }
  if (adminUser) {
    await prisma.department.update({
      where: { id: administration.id },
      data: { headId: adminUser.id },
    });
  }
  if (lakshmi) {
    await prisma.department.update({
      where: { id: petroleum.id },
      data: { headId: lakshmi.id },
    });
  }

  // ------------------------------------------------------------------
  // OIDC clients
  // ------------------------------------------------------------------
  const clients = [
    {
      clientId: "sanapp-main",
      clientSecret: "main_dev_client_secret",
      name: "Central Application Management",
      description: "IIPE Main — manages which users may access which applications",
      redirectUris: [
        "https://localintranet.iipe.ac.in/main/auth/callback",
        "http://localintranet.iipe.ac.in/main/auth/callback",
        "https://testintranet.iipe.ac.in/main/auth/callback",
        "http://testintranet.iipe.ac.in/main/auth/callback",
        "https://intranet.iipe.ac.in/main/auth/callback",
        "http://intranet.iipe.ac.in/main/auth/callback",
        "http://localhost:3001/main/auth/callback",
        "http://localhost:3001/auth/callback",
      ].join(","),
    },
    {
      clientId: "sanapp-wikidocs",
      clientSecret: "wikidocs_dev_client_secret",
      name: "Wiki Docs",
      description: "Institute documentation wiki (own database sanapp_wikidocs_db, own roles)",
      redirectUris: [
        "https://localintranet.iipe.ac.in/wikidocs/auth/callback",
        "http://localintranet.iipe.ac.in/wikidocs/auth/callback",
        "https://testintranet.iipe.ac.in/wikidocs/auth/callback",
        "http://testintranet.iipe.ac.in/wikidocs/auth/callback",
        "https://intranet.iipe.ac.in/wikidocs/auth/callback",
        "http://intranet.iipe.ac.in/wikidocs/auth/callback",
        "http://localhost:3002/wikidocs/auth/callback",
        "http://localhost:3002/auth/callback",
        "http://localhost:3008/auth/callback",
        "http://localhost:3002/auth/callback",
      ].join(","),
    },
    {
      clientId: "sanapp-app2",
      clientSecret: "app2_dev_client_secret",
      name: "Leave Management",
      description: "Independent application #2 (own database, own roles)",
      redirectUris: [
        "https://localintranet.iipe.ac.in/app2/auth/callback",
        "http://localintranet.iipe.ac.in/app2/auth/callback",
        "https://testintranet.iipe.ac.in/app2/auth/callback",
        "http://testintranet.iipe.ac.in/app2/auth/callback",
        "https://intranet.iipe.ac.in/app2/auth/callback",
        "http://intranet.iipe.ac.in/app2/auth/callback",
        "http://localhost:3003/app2/auth/callback",
        "http://localhost:3003/auth/callback",
      ].join(","),
    },
    {
      clientId: "sanapp-app3",
      clientSecret: "app3_dev_client_secret",
      name: "PhD ERP",
      description: "Independent application #3 (own database, own roles)",
      redirectUris: [
        "https://localintranet.iipe.ac.in/app3/auth/callback",
        "http://localintranet.iipe.ac.in/app3/auth/callback",
        "https://testintranet.iipe.ac.in/app3/auth/callback",
        "http://testintranet.iipe.ac.in/app3/auth/callback",
        "https://intranet.iipe.ac.in/app3/auth/callback",
        "http://intranet.iipe.ac.in/app3/auth/callback",
        "http://localhost:3004/app3/auth/callback",
        "http://localhost:3004/auth/callback",
      ].join(","),
    },
    {
      clientId: "sanapp-facilities",
      clientSecret: "app4_dev_client_secret",
      name: "Facilities Booking",
      description: "Independent application #4 (own database, own roles) — building and slot booking in IST",
      redirectUris: [
        "https://localintranet.iipe.ac.in/facilities/auth/callback",
        "http://localintranet.iipe.ac.in/facilities/auth/callback",
        "https://testintranet.iipe.ac.in/facilities/auth/callback",
        "http://testintranet.iipe.ac.in/facilities/auth/callback",
        "https://intranet.iipe.ac.in/facilities/auth/callback",
        "http://intranet.iipe.ac.in/facilities/auth/callback",
        "http://localhost:3005/facilities/auth/callback",
        "http://localhost:3005/auth/callback",
      ].join(","),
    },
    {
      clientId: "sanapp-logrequest",
      clientSecret: "app5_dev_client_secret",
      name: "Log Request",
      description: "Independent application #5 (own database sanapp_logrequest_db, own roles) — ServiceNow-style request tracking",
      redirectUris: [
        "https://localintranet.iipe.ac.in/logrequest/auth/callback",
        "http://localintranet.iipe.ac.in/logrequest/auth/callback",
        "https://testintranet.iipe.ac.in/logrequest/auth/callback",
        "http://testintranet.iipe.ac.in/logrequest/auth/callback",
        "https://intranet.iipe.ac.in/logrequest/auth/callback",
        "http://intranet.iipe.ac.in/logrequest/auth/callback",
        "http://localhost:3006/logrequest/auth/callback",
        "http://localhost:3006/auth/callback",
      ].join(","),
    },
    {
      clientId: "sanapp-inventory",
      clientSecret: "app6_dev_client_secret",
      name: "Inventory & Asset Tracking",
      description: "Independent application #6 (inventory schema inside sanapp_logrequest_db, own roles) — IT assets, licenses, repairs and asset service requests",
      redirectUris: [
        "https://localintranet.iipe.ac.in/inventory/auth/callback",
        "http://localintranet.iipe.ac.in/inventory/auth/callback",
        "https://testintranet.iipe.ac.in/inventory/auth/callback",
        "http://testintranet.iipe.ac.in/inventory/auth/callback",
        "https://intranet.iipe.ac.in/inventory/auth/callback",
        "http://intranet.iipe.ac.in/inventory/auth/callback",
        "http://localhost:3007/inventory/auth/callback",
        "http://localhost:3007/auth/callback",
      ].join(","),
    },
  ];

  for (const c of clients) {
    await prisma.oidcClient.upsert({
      where: { clientId: c.clientId },
      update: { ...c },
      create: { ...c },
    });
  }

  // Academic ERP was replaced by Wiki Docs — remove the old OIDC client.
  await prisma.oidcClient.deleteMany({ where: { clientId: "sanapp-app1" } });

  // ------------------------------------------------------------------
  // SMTP settings (stored in DB, not env) — dev Gmail credentials
  // ------------------------------------------------------------------
  await prisma.ssoSetting.upsert({
    where: { id: "smtp" },
    update: {
      host: "smtp.gmail.com",
      port: 587,
      user: "psanengineer@gmail.com",
      password: "yljqnrgulwltxcgg",
      fromEmail: "psanengineer@gmail.com",
    },
    create: {
      id: "smtp",
      host: "smtp.gmail.com",
      port: 587,
      user: "psanengineer@gmail.com",
      password: "yljqnrgulwltxcgg",
      fromEmail: "psanengineer@gmail.com",
    },
  });

  // Ensure an RSA signing key exists for RS256 tokens / JWKS.
  const existingKey = await prisma.signingKey.findUnique({ where: { id: "active" } });
  if (!existingKey) {
    const { publicKey, privateKey } = await generateKeyPair("RS256", {
      extractable: true,
    });
    await prisma.signingKey.create({
      data: {
        id: "active",
        privateJwk: (await exportJWK(privateKey)) as unknown as object,
        publicJwk: (await exportJWK(publicKey)) as unknown as object,
      },
    });
  }

  // ------------------------------------------------------------------
  // Platform theme settings — default mode + brand colors. Existing
  // values are left untouched so admin changes survive re-seeding.
  // ------------------------------------------------------------------
  const platformSettings: Array<{ key: string; value: string }> = [
    { key: "theme_mode", value: "system" }, // light | dark | system
    { key: "primary_color", value: "#0b5d4f" },
    { key: "accent_color", value: "#d9a441" },
    // Primary roles whose self-edits are locked (comma-separated). Empty by default.
    { key: "locked_profile_roles", value: "" },
  ];
  for (const s of platformSettings) {
    await prisma.platformSetting.upsert({
      where: { key: s.key },
      update: {},
      create: s,
    });
  }

  // ------------------------------------------------------------------
  // Platform updates & alerts shown on the SSO login page
  // ------------------------------------------------------------------
  const announcements: Array<{
    type: "UPDATE" | "ALERT";
    title: string;
    body: string;
  }> = [
    {
      type: "ALERT",
      title: "Scheduled maintenance this Sunday",
      body: "The intranet will be briefly unavailable on Sunday 23:00–00:30 IST for server maintenance. Save your work before then.",
    },
    {
      type: "UPDATE",
      title: "New PhD ERP module",
      body: "Thesis submission and guide approval are now live in the PhD ERP. Scholars can upload drafts and track approvals from their dashboard.",
    },
    {
      type: "UPDATE",
      title: "Leave Management now online",
      body: "Staff can apply for leave and track approvals. Accounts officers approve from the same dashboard.",
    },
    {
      type: "UPDATE",
      title: "New leave policy for contractual staff",
      body: "From this month, contractual and outsourced staff can apply for casual leave through Leave Management. The policy change follows the 12th staff council meeting: casual leave is now 12 days per calendar year, and staff must attach supporting documents for leave beyond 3 consecutive days. Please contact the HR section or your department head for clarifications on eligibility before applying.",
    },
    {
      type: "ALERT",
      title: "Phishing emails targeting staff",
      body: "We have received reports of phishing emails asking staff to share passwords or OTPs. The intranet team will never ask for your password or OTP by email or phone. If you receive such an email, do not click any links and report it to support@iipe.ac.in immediately. Change your password using the Forgot password flow if you already responded to a suspicious message.",
    },
    {
      type: "ALERT",
      title: "Change your password",
      body: "For security, all users are encouraged to use the Forgot password flow and set a strong, unique password.",
    },
  ];
  for (const a of announcements) {
    await prisma.announcement.upsert({
      where: { id: a.title },
      update: { type: a.type, body: a.body, published: true },
      create: {
        id: a.title,
        type: a.type,
        title: a.title,
        body: a.body,
        published: true,
      },
    });
  }

  console.log(
    "sanapp_sso_db seeded: 7 users with primary-role profiles, 10 departments (3 with HODs), 6 programmes, 6 courses, 4 OIDC clients, SMTP settings, theme settings, 6 announcements, signing key"
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
