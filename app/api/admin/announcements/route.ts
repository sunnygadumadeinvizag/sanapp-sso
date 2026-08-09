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

const SELECT = {
  id: true,
  type: true,
  title: true,
  body: true,
  published: true,
  createdAt: true,
  updatedAt: true,
} as const;

export async function GET(request: NextRequest) {
  if (!authorized(request)) return unauthorized();

  const announcements = await prisma.announcement.findMany({
    select: SELECT,
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ announcements });
}

export async function POST(request: NextRequest) {
  if (!authorized(request)) return unauthorized();

  const body = await request.json().catch(() => ({}));
  const type = body.type === "ALERT" ? "ALERT" : "UPDATE";
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const text = typeof body.body === "string" ? body.body.trim() : "";
  const published = typeof body.published === "boolean" ? body.published : true;

  if (!title || !text) {
    return NextResponse.json(
      { error: "title and body are required" },
      { status: 400 }
    );
  }

  const announcement = await prisma.announcement.create({
    data: { type, title, body: text, published },
    select: SELECT,
  });

  return NextResponse.json({ announcement }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  if (!authorized(request)) return unauthorized();

  const body = await request.json().catch(() => ({}));
  const id = typeof body.id === "string" ? body.id : "";
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const existing = await prisma.announcement.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "announcement not found" }, { status: 404 });
  }

  const data: {
    type?: "UPDATE" | "ALERT";
    title?: string;
    body?: string;
    published?: boolean;
  } = {};
  if (body.type === "ALERT" || body.type === "UPDATE") data.type = body.type;
  if (typeof body.title === "string" && body.title.trim()) data.title = body.title.trim();
  if (typeof body.body === "string" && body.body.trim()) data.body = body.body.trim();
  if (typeof body.published === "boolean") data.published = body.published;

  const announcement = await prisma.announcement.update({
    where: { id },
    data,
    select: SELECT,
  });

  return NextResponse.json({ announcement });
}

export async function DELETE(request: NextRequest) {
  if (!authorized(request)) return unauthorized();

  const body = await request.json().catch(() => ({}));
  const id =
    request.nextUrl.searchParams.get("id") ?? (body as { id?: string }).id;
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const existing = await prisma.announcement.findUnique({ where: { id: String(id) } });
  if (!existing) {
    return NextResponse.json({ error: "announcement not found" }, { status: 404 });
  }

  await prisma.announcement.delete({ where: { id: String(id) } });
  return NextResponse.json({ ok: true, deleted: existing.title });
}
