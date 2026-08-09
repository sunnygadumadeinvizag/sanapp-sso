import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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

export async function GET(request: NextRequest) {
  if (!authorized(request)) return unauthorized();

  const departments = await prisma.department.findMany({
    select: {
      id: true,
      name: true,
      headId: true,
      head: { select: { id: true, name: true, username: true } },
      _count: { select: { users: true } },
      createdAt: true,
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ departments });
}

export async function POST(request: NextRequest) {
  if (!authorized(request)) return unauthorized();

  const body = await request.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const headId = typeof body.headId === "string" && body.headId ? body.headId : null;

  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const exists = await prisma.department.findUnique({ where: { name } });
  if (exists) {
    return NextResponse.json(
      { error: "A department with that name already exists" },
      { status: 409 }
    );
  }

  const department = await prisma.department.create({
    data: { name, headId },
    select: { id: true, name: true, headId: true },
  });

  return NextResponse.json({ department }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  if (!authorized(request)) return unauthorized();

  const body = await request.json().catch(() => ({}));
  const id = typeof body.id === "string" ? body.id : "";
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const existing = await prisma.department.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "department not found" }, { status: 404 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : undefined;
  if (name) {
    const clash = await prisma.department.findUnique({ where: { name } });
    if (clash && clash.id !== id) {
      return NextResponse.json(
        { error: "A department with that name already exists" },
        { status: 409 }
      );
    }
  }

  const headId =
    typeof body.headId === "string" && body.headId ? body.headId : null;

  const department = await prisma.department.update({
    where: { id },
    data: {
      ...(name ? { name } : {}),
      ...(body.headId !== undefined ? { headId } : {}),
    },
    select: { id: true, name: true, headId: true },
  });

  return NextResponse.json({ department });
}

export async function DELETE(request: NextRequest) {
  if (!authorized(request)) return unauthorized();

  const body = await request.json().catch(() => ({}));
  const id = request.nextUrl.searchParams.get("id") ?? (body as { id?: string }).id;
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const existing = await prisma.department.findUnique({
    where: { id: String(id) },
    include: { _count: { select: { users: true } } },
  });
  if (!existing) {
    return NextResponse.json({ error: "department not found" }, { status: 404 });
  }
  if (existing._count.users > 0) {
    return NextResponse.json(
      { error: "Cannot delete a department that still has members. Move or remove its users first." },
      { status: 409 }
    );
  }

  await prisma.department.delete({ where: { id: String(id) } });
  return NextResponse.json({ ok: true, deleted: existing.name });
}
