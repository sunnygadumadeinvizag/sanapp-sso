import { NextRequest, NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { parseCsv } from "@/lib/csv";

export const runtime = "nodejs";

const PRIMARY_ROLES = [
  "STAFF_NON_TEACHING",
  "STAFF_TEACHING",
  "STUDENT",
  "SCHOLAR",
  "GUEST",
];

const EMPLOYMENT_TYPES = [
  "REGULAR",
  "CONTRACTUAL",
  "VISITING",
  "OUTSOURCING",
  "PROJECT_STAFF",
  "OTHER",
];

function authorized(request: NextRequest) {
  const key =
    request.nextUrl.searchParams.get("key") ??
    request.headers.get("x-admin-key") ??
    "";
  return key === process.env.SSO_ADMIN_KEY;
}

const norm = (v: string) => v.trim().toUpperCase().replace(/[\s-]+/g, "_");
const cell = (row: string[], i: number) => (row[i] ?? "").trim();

type RowError = { row: number; username: string; error: string };

export async function POST(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "Please choose a CSV file" },
      { status: 400 }
    );
  }
  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json(
      { error: "CSV file is too large — maximum size is 5 MB" },
      { status: 400 }
    );
  }

  const text = await file.text();
  const rows = parseCsv(text);
  if (rows.length === 0) {
    return NextResponse.json({ error: "The CSV file is empty" }, { status: 400 });
  }

  // Skip the template header row when present (name + username as first cells).
  const first = rows[0].map((c) => c.trim().toLowerCase());
  let start = 0;
  if (first.includes("name") && first.includes("username")) {
    start = 1;
  }
  const dataRows = rows.slice(start);
  if (dataRows.length === 0) {
    return NextResponse.json(
      { error: "The CSV file has no data rows (only a header)" },
      { status: 400 }
    );
  }

  // Load reference tables once.
  const [departments, programmes, courses, staff, existing] = await Promise.all([
    prisma.department.findMany({ select: { id: true, name: true } }),
    prisma.programme.findMany({ select: { id: true, name: true } }),
    prisma.course.findMany({ select: { id: true, name: true } }),
    prisma.user.findMany({
      where: { primaryRole: "STAFF_TEACHING" },
      select: { id: true, username: true },
    }),
    prisma.user.findMany({ select: { username: true } }),
  ]);

  const deptByName = new Map(departments.map((d) => [d.name.toLowerCase(), d.id]));
  const progByName = new Map(programmes.map((p) => [p.name.toLowerCase(), p.id]));
  const courseByName = new Map(courses.map((c) => [c.name.toLowerCase(), c.id]));
  const guideByUsername = new Map(staff.map((s) => [s.username.toLowerCase(), s.id]));
  const seenUsernames = new Set(existing.map((u) => u.username.toLowerCase()));

  const errors: RowError[] = [];
  const created: Array<{ username: string; name: string }> = [];

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    const csvRow = start + i + 1; // 1-based line in the file
    const username = cell(row, 1).toLowerCase();

    const fail = (error: string) => errors.push({ row: csvRow, username, error });

    const name = cell(row, 0);
    const email = cell(row, 2).toLowerCase();
    const password = cell(row, 3);
    const primaryRole = norm(cell(row, 4));
    const departmentName = cell(row, 5);
    const employmentType = norm(cell(row, 6));
    const designation = cell(row, 7) || null;
    const phone = cell(row, 8) || null;
    const programmeName = cell(row, 9);
    const courseName = cell(row, 10);
    const guideUsername = cell(row, 11).toLowerCase();

    if (!name) {
      fail("name is required");
      continue;
    }
    if (!username) {
      fail("username is required");
      continue;
    }
    if (seenUsernames.has(username)) {
      fail("username already exists");
      continue;
    }
    if (!password || password.length < 6) {
      fail("password is required (minimum 6 characters)");
      continue;
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      fail("email is not a valid address (or leave it blank)");
      continue;
    }
    if (!PRIMARY_ROLES.includes(primaryRole)) {
      fail(
        `primary_role must be one of ${PRIMARY_ROLES.join(" | ")} (got "${cell(row, 4)}")`
      );
      continue;
    }
    const departmentId = deptByName.get(departmentName.toLowerCase());
    if (!departmentId) {
      fail(`department "${departmentName}" was not found — add it in Departments first`);
      continue;
    }
    if (
      (primaryRole === "STAFF_TEACHING" || primaryRole === "STAFF_NON_TEACHING") &&
      !EMPLOYMENT_TYPES.includes(employmentType)
    ) {
      fail(
        `employment_type is required for staff — one of ${EMPLOYMENT_TYPES.join(" | ")}`
      );
      continue;
    }
    let programmeId: string | null = null;
    let courseId: string | null = null;
    if (primaryRole === "STUDENT") {
      const pId = progByName.get(programmeName.toLowerCase());
      const cId = courseByName.get(courseName.toLowerCase());
      if (!pId || !cId) {
        fail("programme and course are required for students (use exact names)");
        continue;
      }
      programmeId = pId;
      courseId = cId;
    }
    let guideId: string | null = null;
    if (primaryRole === "SCHOLAR") {
      guideId = guideByUsername.get(guideUsername) ?? null;
      if (!guideId) {
        fail("guide_username is required for scholars (a staff-teaching username)");
        continue;
      }
    }

    seenUsernames.add(username);
    const user = await prisma.user.create({
      data: {
        username,
        name,
        email: email || null,
        passwordHash: await hash(password, 10),
        role: "USER", // CSV imports regular users; promotion to Super Admin is manual
        primaryRole: primaryRole as never,
        employmentType: employmentType ? (employmentType as never) : null,
        designation,
        phone,
        departmentId,
        programmeId,
        courseId,
        guideId,
      },
      select: { id: true, username: true, name: true },
    });
    created.push({ username: user.username, name: user.name });
  }

  return NextResponse.json({
    created: created.length,
    failed: errors.length,
    errors,
    users: created,
  });
}
