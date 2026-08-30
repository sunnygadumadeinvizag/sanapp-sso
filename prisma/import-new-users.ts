import "dotenv/config";
import { hash } from "bcryptjs";
import { randomBytes } from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import { prisma } from "../src/lib/prisma";
import { PrimaryRole, EmploymentType, Gender } from "../src/generated/prisma/enums";

/**
 * Creates logins for the users listed in prisma/seed-data/new-users.json.
 * Users that already exist (by username) are skipped untouched.
 * A random password is generated per user; the generated credentials are
 * written as CSV to the path given as the first CLI argument
 * (never committed — always outside the repository).
 */

function randomPassword(len = 12): string {
  const chars = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(len);
  let out = "";
  for (let i = 0; i < len; i++) out += chars[bytes[i] % chars.length];
  return out;
}

type NewUser = {
  username: string;
  name: string;
  email: string;
  gender: string;
  primaryRole: string;
  employmentType?: string;
  designation?: string;
  department: string;
  empNo?: string;
};

async function main() {
  const outPath = process.argv[2];
  const file = path.join(__dirname, "seed-data", "new-users.json");
  const users: NewUser[] = JSON.parse(fs.readFileSync(file, "utf-8"));
  console.log(`Loaded ${users.length} users from new-users.json`);

  const lines = ["username,name,email,password"];
  let created = 0;
  let skipped = 0;

  for (const u of users) {
    const existing = await prisma.user.findUnique({ where: { username: u.username } });
    if (existing) {
      console.log(`SKIP (exists): ${u.username} — ${existing.name}`);
      skipped++;
      continue;
    }

    const dept = await prisma.department.upsert({
      where: { name: u.department },
      update: {},
      create: { name: u.department },
    });

    const password = randomPassword();
    const passwordHash = await hash(password, 10);

    await prisma.user.create({
      data: {
        username: u.username,
        name: u.name,
        email: u.email,
        passwordHash,
        role: "USER",
        primaryRole: u.primaryRole as PrimaryRole,
        employmentType: (u.employmentType as EmploymentType) ?? undefined,
        designation: u.designation ?? null,
        departmentId: dept.id,
        empNo: u.empNo ?? null,
        gender: u.gender as Gender,
        phCategory: "NONE",
        isActive: true,
        isTest: false,
      },
    });

    lines.push(`${u.username},"${u.name}",${u.email},${password}`);
    console.log(`CREATED: ${u.username} — ${u.name} (${u.department})`);
    created++;
  }

  if (outPath && created > 0) {
    fs.writeFileSync(outPath, lines.join("\n") + "\n");
    console.log(`Credentials written to ${outPath}`);
  }

  console.log("-------------------------------");
  console.log(`Created: ${created}, skipped (already present): ${skipped}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
