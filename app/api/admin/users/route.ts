import { NextRequest, NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { prisma } from "@/lib/prisma";

const PRIMARY_ROLES = [
  "STAFF_NON_TEACHING",
  "STAFF_TEACHING",
  "STUDENT",
  "SCHOLAR",
  "GUEST",
] as const;

const EMPLOYMENT_TYPES = [
  "REGULAR",
  "CONTRACTUAL",
  "VISITING",
  "OUTSOURCING",
  "PROJECT_STAFF",
  "OTHER",
] as const;

const GENDERS = ["MALE", "FEMALE", "OTHER"] as const;

const USER_SELECT = {
  id: true,
  username: true,
  name: true,
  email: true,
  role: true,
  primaryRole: true,
  employmentType: true,
  designation: true,
  phone: true,
  rollNo: true,
  empNo: true,
  gender: true,
  phCategory: true,
  nonInstituteEmail: true,
  emergencyPhone: true,
  departmentId: true,
  department: { select: { id: true, name: true } },
  programmeId: true,
  programme: { select: { id: true, name: true } },
  courseId: true,
  course: { select: { id: true, name: true } },
  guideId: true,
  guide: { select: { id: true, name: true } },
  isActive: true,
  isTest: true,
  avatar: true,
  profileLocked: true,
  createdAt: true,
} as const;

function authorized(request: NextRequest) {
  const key =
    request.nextUrl.searchParams.get("key") ??
    request.headers.get("x-admin-key") ??
    "";
  return key === process.env.SSO_ADMIN_KEY;
}

function unauthorized() {
  return NextResponse.json({ error: "unauthorized" }, { status: 401 });
}

/**
 * Normalize the identity fields shared by create/update.
 * Semantics: an ABSENT key becomes `undefined` (PATCH leaves it untouched),
 * while an explicit empty string / null becomes `null` (PATCH clears it).
 */
function normalize(body: Record<string, unknown>) {
  const username = typeof body.username === "string" ? body.username.trim() : undefined;
  const name = typeof body.name === "string" ? body.name.trim() : undefined;
  const email =
    typeof body.email === "string" ? body.email.trim().toLowerCase() : undefined;
  const password =
    typeof body.password === "string" && body.password.length > 0
      ? body.password
      : undefined;
  const role =
    body.role === "SUPER_ADMIN"
      ? "SUPER_ADMIN"
      : body.role === "USER"
        ? "USER"
        : undefined;
  const isActive =
    typeof body.isActive === "boolean" ? body.isActive : undefined;
  const profileLocked =
    typeof body.profileLocked === "boolean" ? body.profileLocked : undefined;

  const primaryRole =
    typeof body.primaryRole === "string" &&
    (PRIMARY_ROLES as readonly string[]).includes(body.primaryRole)
      ? (body.primaryRole as (typeof PRIMARY_ROLES)[number])
      : undefined;
  const employmentType =
    body.employmentType === null || body.employmentType === ""
      ? null // explicitly cleared
      : typeof body.employmentType === "string" &&
          (EMPLOYMENT_TYPES as readonly string[]).includes(body.employmentType)
        ? (body.employmentType as (typeof EMPLOYMENT_TYPES)[number])
        : undefined;
  const designation =
    typeof body.designation === "string" ? body.designation.trim() || null : undefined;
  const phone = typeof body.phone === "string" ? body.phone.trim() || null : undefined;
  const emergencyPhone =
    typeof body.emergencyPhone === "string"
      ? body.emergencyPhone.trim() || null
      : undefined;
  const rollNo =
    typeof body.rollNo === "string" ? body.rollNo.trim() || null : undefined;
  const empNo =
    typeof body.empNo === "string" ? body.empNo.trim() || null : undefined;
  const gender =
    body.gender === null || body.gender === ""
      ? null
      : typeof body.gender === "string" &&
          (GENDERS as readonly string[]).includes(body.gender.toUpperCase())
        ? (body.gender.toUpperCase() as (typeof GENDERS)[number])
        : undefined;
  const phCategory =
    typeof body.phCategory === "string"
      ? body.phCategory.trim().toUpperCase() || null
      : undefined;
  const nonInstituteEmail =
    typeof body.nonInstituteEmail === "string"
      ? body.nonInstituteEmail.trim().toLowerCase() || null
      : undefined;
  const refId = (v: unknown): string | null | undefined =>
    v === null || v === ""
      ? null // explicitly cleared
      : typeof v === "string"
        ? v
        : undefined; // absent
  const departmentId = refId(body.departmentId);
  const programmeId = refId(body.programmeId);
  const courseId = refId(body.courseId);
  const guideId = refId(body.guideId);

  return {
    username,
    name,
    email,
    password,
    role,
    isActive,
    profileLocked,
    primaryRole,
    employmentType,
    designation,
    phone,
    emergencyPhone,
    rollNo,
    empNo,
    gender,
    phCategory,
    nonInstituteEmail,
    departmentId,
    programmeId,
    courseId,
    guideId,
  };
}

/** Validate the profile required by the chosen primary role. */
function validateProfile(b: ReturnType<typeof normalize>) {
  if (!b.primaryRole) {
    return "primaryRole is required — every user must be identified with one primary role";
  }
  if (!b.departmentId) {
    return "departmentId is required — every user belongs to a department / section";
  }
  if (!b.gender) {
    return "gender is required — select Male, Female or Other";
  }
  if (!b.phCategory) {
    return "phCategory is required — select a category (NONE when not applicable)";
  }
  if (
    (b.primaryRole === "STAFF_TEACHING" || b.primaryRole === "STAFF_NON_TEACHING") &&
    !b.employmentType
  ) {
    return "employmentType is required for staff (teaching and non-teaching)";
  }
  if (
    (b.primaryRole === "STAFF_TEACHING" || b.primaryRole === "STAFF_NON_TEACHING") &&
    !b.empNo
  ) {
    return "empNo (employee number) is required for staff (teaching and non-teaching)";
  }
  if (b.primaryRole === "STUDENT" && (!b.programmeId || !b.courseId)) {
    return "programmeId and courseId are required for students";
  }
  if ((b.primaryRole === "STUDENT" || b.primaryRole === "SCHOLAR") && !b.rollNo) {
    return "rollNo (roll number) is required for students and scholars";
  }
  if (b.primaryRole === "SCHOLAR" && !b.guideId) {
    return "guideId is required for scholars";
  }
  if (b.nonInstituteEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.nonInstituteEmail)) {
    return "nonInstituteEmail is not a valid email address";
  }
  return null;
}

/** Confirm referenced department/programme/course/guide actually exist. */
async function referencesExist(b: ReturnType<typeof normalize>) {
  if (b.departmentId) {
    const d = await prisma.department.findUnique({ where: { id: b.departmentId } });
    if (!d) return "Selected department does not exist";
  }
  if (b.programmeId) {
    const p = await prisma.programme.findUnique({ where: { id: b.programmeId } });
    if (!p) return "Selected programme does not exist";
  }
  if (b.courseId) {
    const c = await prisma.course.findUnique({ where: { id: b.courseId } });
    if (!c) return "Selected course does not exist";
  }
  if (b.guideId) {
    const g = await prisma.user.findUnique({ where: { id: b.guideId } });
    if (!g || g.primaryRole !== "STAFF_TEACHING") {
      return "Guide must be an existing staff (teaching) user";
    }
  }
  return null;
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) return unauthorized();

  const users = await prisma.user.findMany({
    select: USER_SELECT,
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ users });
}

export async function POST(request: NextRequest) {
  if (!authorized(request)) return unauthorized();

  const body = normalize(await request.json().catch(() => ({})));
  if (!body.username || !body.name || !body.email || !body.password) {
    return NextResponse.json(
      { error: "username, name, email and password are required" },
      { status: 400 }
    );
  }

  const profileError = validateProfile(body);
  if (profileError) {
    return NextResponse.json({ error: profileError }, { status: 400 });
  }
  const refError = await referencesExist(body);
  if (refError) {
    return NextResponse.json({ error: refError }, { status: 400 });
  }

  // Usernames are unique; emails deliberately are NOT (shared inboxes allowed).
  const exists = await prisma.user.findUnique({ where: { username: body.username } });
  if (exists) {
    return NextResponse.json(
      { error: "A user with that username already exists" },
      { status: 409 }
    );
  }

  const user = await prisma.user.create({
    data: {
      username: body.username,
      name: body.name,
      email: body.email,
      passwordHash: await hash(body.password, 10),
      role: body.role,
      isActive: body.isActive ?? true,
      primaryRole: body.primaryRole,
      employmentType: body.employmentType,
      designation: body.designation,
      phone: body.phone,
      emergencyPhone: body.emergencyPhone,
      rollNo: body.rollNo,
      empNo: body.empNo,
      gender: body.gender,
      phCategory: body.phCategory,
      nonInstituteEmail: body.nonInstituteEmail,
      departmentId: body.departmentId,
      programmeId: body.programmeId,
      courseId: body.courseId,
      guideId: body.guideId,
    },
    select: USER_SELECT,
  });

  return NextResponse.json({ user }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  if (!authorized(request)) return unauthorized();

  const raw = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const id = typeof raw.id === "string" ? raw.id : "";
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const body = normalize(raw);

  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "user not found" }, { status: 404 });
  }

  // Validate the profile whenever the caller touches any part of it, using the
  // effective (merged) profile so untouched fields fall back to existing values.
  if (
    body.primaryRole !== undefined ||
    body.departmentId !== undefined ||
    body.gender !== undefined ||
    body.phCategory !== undefined ||
    body.rollNo !== undefined ||
    body.empNo !== undefined
  ) {
    const effective: ReturnType<typeof normalize> = {
      ...body,
      primaryRole: body.primaryRole ?? existing.primaryRole,
      departmentId:
        body.departmentId !== undefined ? body.departmentId : existing.departmentId,
      employmentType:
        body.employmentType !== undefined
          ? body.employmentType
          : existing.employmentType,
      programmeId:
        body.programmeId !== undefined ? body.programmeId : existing.programmeId,
      courseId:
        body.courseId !== undefined ? body.courseId : existing.courseId,
      guideId: body.guideId !== undefined ? body.guideId : existing.guideId,
      gender: body.gender !== undefined ? body.gender : existing.gender,
      phCategory:
        body.phCategory !== undefined ? body.phCategory : existing.phCategory,
      rollNo: body.rollNo !== undefined ? body.rollNo : existing.rollNo,
      empNo: body.empNo !== undefined ? body.empNo : existing.empNo,
      nonInstituteEmail:
        body.nonInstituteEmail !== undefined
          ? body.nonInstituteEmail
          : existing.nonInstituteEmail,
    };
    const profileError = validateProfile(effective);
    if (profileError) {
      return NextResponse.json({ error: profileError }, { status: 400 });
    }
    const refError = await referencesExist(effective);
    if (refError) {
      return NextResponse.json({ error: refError }, { status: 400 });
    }
  }

  if (body.username) {
    const clash = await prisma.user.findUnique({ where: { username: body.username } });
    if (clash && clash.id !== id) {
      return NextResponse.json(
        { error: "A user with that username already exists" },
        { status: 409 }
      );
    }
  }

  const user = await prisma.user.update({
    where: { id },
    data: {
      ...(body.name ? { name: body.name } : {}),
      ...(body.username ? { username: body.username } : {}),
      ...(body.email ? { email: body.email } : {}),
      ...(body.password ? { passwordHash: await hash(body.password, 10) } : {}),
      ...(body.role ? { role: body.role } : {}),
      ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
      ...(body.profileLocked !== undefined
        ? { profileLocked: body.profileLocked }
        : {}),
      ...(body.primaryRole !== undefined ? { primaryRole: body.primaryRole } : {}),
      ...(body.employmentType !== undefined
        ? { employmentType: body.employmentType }
        : {}),
      ...(body.designation !== undefined ? { designation: body.designation } : {}),
      ...(body.phone !== undefined ? { phone: body.phone } : {}),
      ...(body.emergencyPhone !== undefined
        ? { emergencyPhone: body.emergencyPhone }
        : {}),
      ...(body.rollNo !== undefined ? { rollNo: body.rollNo } : {}),
      ...(body.empNo !== undefined ? { empNo: body.empNo } : {}),
      ...(body.gender !== undefined ? { gender: body.gender } : {}),
      ...(body.phCategory !== undefined ? { phCategory: body.phCategory } : {}),
      ...(body.nonInstituteEmail !== undefined
        ? { nonInstituteEmail: body.nonInstituteEmail }
        : {}),
      ...(body.departmentId !== undefined ? { departmentId: body.departmentId } : {}),
      ...(body.programmeId !== undefined ? { programmeId: body.programmeId } : {}),
      ...(body.courseId !== undefined ? { courseId: body.courseId } : {}),
      ...(body.guideId !== undefined ? { guideId: body.guideId } : {}),
    },
    select: USER_SELECT,
  });

  return NextResponse.json({ user });
}

export async function DELETE(request: NextRequest) {
  if (!authorized(request)) return unauthorized();

  const body = await request.json().catch(() => ({}));
  const id =
    request.nextUrl.searchParams.get("id") ?? (body as { id?: string }).id;
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { id: String(id) } });
  if (!existing) {
    return NextResponse.json({ error: "user not found" }, { status: 404 });
  }

  await prisma.user.delete({ where: { id: String(id) } });
  return NextResponse.json({ ok: true, deleted: existing.username });
}
