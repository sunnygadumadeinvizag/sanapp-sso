import { NextRequest, NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { prisma } from "@/lib/prisma";

const USER_SELECT = {
  id: true,
  username: true,
  name: true,
  email: true,
  role: true,
  isActive: true,
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

/** Normalize + validate the identity fields shared by create/update. */
function normalize(body: Record<string, unknown>) {
  const username = typeof body.username === "string" ? body.username.trim() : undefined;
  const name = typeof body.name === "string" ? body.name.trim() : undefined;
  const email =
    typeof body.email === "string" ? body.email.trim().toLowerCase() : undefined;
  const password =
    typeof body.password === "string" && body.password.length > 0
      ? body.password
      : undefined;
  const role = body.role === "SUPER_ADMIN" ? "SUPER_ADMIN" : "USER";
  const isActive =
    typeof body.isActive === "boolean" ? body.isActive : undefined;
  return { username, name, email, password, role, isActive };
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

  const exists = await prisma.user.findFirst({
    where: { OR: [{ username: body.username }, { email: body.email }] },
  });
  if (exists) {
    return NextResponse.json(
      { error: "A user with that username or email already exists" },
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

  if (body.username || body.email) {
    const clash = await prisma.user.findFirst({
      where: {
        NOT: { id },
        OR: [
          ...(body.username ? [{ username: body.username }] : []),
          ...(body.email ? [{ email: body.email }] : []),
        ],
      },
    });
    if (clash) {
      return NextResponse.json(
        { error: "A user with that username or email already exists" },
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
