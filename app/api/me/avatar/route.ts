import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import { join } from "node:path";
import { prisma } from "@/lib/prisma";
import { verifySessionJwt } from "@/lib/crypto";
import { getLockedProfileRoles, profileLockReason } from "@/lib/profilePolicy";

const MAX_BYTES = 2 * 1024 * 1024; // 2 MB

const ALLOWED: Record<string, { ext: string; magic: (b: Uint8Array) => boolean }> = {
  "image/png": {
    ext: "png",
    magic: (b) => b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47,
  },
  "image/jpeg": {
    ext: "jpg",
    magic: (b) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  },
  "image/gif": {
    ext: "gif",
    magic: (b) => b.length > 6 && b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38,
  },
  "image/webp": {
    ext: "webp",
    magic: (b) =>
      b.length > 12 &&
      b[0] === 0x52 &&
      b[1] === 0x49 &&
      b[2] === 0x46 &&
      b[3] === 0x46 &&
      b[8] === 0x57 &&
      b[9] === 0x45 &&
      b[10] === 0x42 &&
      b[11] === 0x50,
  },
};

/** Best-effort removal of the previous avatar file (ignores missing files). */
async function removeAvatarFile(avatarPath: string | null) {
  if (!avatarPath) return;
  const name = avatarPath.split("/").pop();
  if (!name) return;
  try {
    await unlink(join(process.cwd(), "public", "uploads", "avatars", name));
  } catch {
    // file already gone — fine
  }
}

async function requireUser() {
  const store = await cookies();
  const session = store.get("sso_session")?.value ?? "";
  const claims = await verifySessionJwt(session);
  if (!claims) return null;
  return prisma.user.findUnique({ where: { id: claims.sub } });
}

export async function POST(request: NextRequest) {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "not signed in" }, { status: 401 });
  }

  const lockedRoles = await getLockedProfileRoles();
  const lockReason = profileLockReason(user, lockedRoles);
  if (lockReason) {
    return NextResponse.json({ error: lockReason }, { status: 403 });
  }

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Please choose an image file" }, { status: 400 });
  }

  const type = file.type;
  const allowed = ALLOWED[type];
  if (!allowed) {
    return NextResponse.json(
      { error: "Unsupported image type — use PNG, JPEG, GIF or WebP" },
      { status: 400 }
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "Image is too large — maximum size is 2 MB" },
      { status: 400 }
    );
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!allowed.magic(bytes)) {
    return NextResponse.json(
      { error: "The file does not look like a valid image" },
      { status: 400 }
    );
  }

  const dir = join(process.cwd(), "public", "uploads", "avatars");
  await mkdir(dir, { recursive: true });
  const filename = `${user.id}.${allowed.ext}`;
  await writeFile(join(dir, filename), bytes);

  const avatar = `/uploads/avatars/${filename}`;
  await removeAvatarFile(user.avatar);
  await prisma.user.update({ where: { id: user.id }, data: { avatar } });

  return NextResponse.json({ avatar });
}

export async function DELETE() {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "not signed in" }, { status: 401 });
  }
  if (!user.avatar) {
    return NextResponse.json({ error: "No profile picture to remove" }, { status: 400 });
  }

  const lockedRoles = await getLockedProfileRoles();
  const lockReason = profileLockReason(user, lockedRoles);
  if (lockReason) {
    return NextResponse.json({ error: lockReason }, { status: 403 });
  }

  await removeAvatarFile(user.avatar);
  await prisma.user.update({ where: { id: user.id }, data: { avatar: null } });
  return NextResponse.json({ avatar: null });
}
