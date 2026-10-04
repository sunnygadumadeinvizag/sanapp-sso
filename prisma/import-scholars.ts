import "dotenv/config";
import { hash } from "bcryptjs";
import * as fs from "node:fs";
import * as path from "node:path";
import { prisma } from "../src/lib/prisma";
import { PrimaryRole, Gender } from "../src/generated/prisma/enums";
import { Prisma } from "../src/generated/prisma/client";

/**
 * PhD scholars import — loads prisma/seed-data/scholars.json into sanapp_sso_db.
 *
 * - username = roll number (login userid)
 * - primaryRole = SCHOLAR
 * - admission fields on dedicated columns; remaining sheet columns in scholarData JSON
 * - Existing usernames are refreshed (profile only); password is never overwritten.
 *
 * Run: pnpm tsx prisma/import-scholars.ts
 */
const DEFAULT_PASSWORD = "password123";

// Excel Department → SSO Department name (stage/prod canonical names)
const DEPT_MAP: Record<string, string> = {
  "Chemical Engineering": "Chemical Engineering",
  "Mechanical Engineering": "Mechanical Engineering",
  "Petroleum Engineering and Earth Sciences": "Petroleum Engineering and Earth Sciences",
  "Petroleum Engineering": "Petroleum Engineering and Earth Sciences",
  "Humanities and Sciences": "Humanities & Sciences",
  "Earth Sciences": "Earth Sciences",
  Mathematics: "Mathematics",
};

// Columns promoted to dedicated User fields (not duplicated in scholarData)
const PROMOTED = new Set([
  "Roll No",
  "Name",
  "Login Email",
  "Mobile No",
  "Department",
  "Nature of Admission",
  "Choice of Specialization",
  "Admission Category (Category)",
  "Gender",
  "PH Disability",
  "Admission Year",
  "Admission Semester",
  "Profile Update Locked",
  "Emergency Contact No",
]);

type ScholarRow = Record<string, string | null>;

function s(v: unknown): string {
  return v == null ? "" : String(v).trim();
}

function mapGender(raw: string): Gender {
  const g = raw.toUpperCase();
  if (g === "F" || g === "FEMALE") return Gender.FEMALE;
  if (g === "O" || g === "OTHER" || g === "TRANSGENDER") return Gender.OTHER;
  return Gender.MALE;
}

function mapPh(raw: string): string {
  const v = s(raw).toUpperCase();
  if (!v || v === "NO" || v === "N" || v === "NONE") return "NONE";
  if (v === "YES" || v === "Y") return "OTHER";
  return v;
}

async function main() {
  const file = path.join(__dirname, "seed-data", "scholars.json");
  if (!fs.existsSync(file)) {
    console.error(`JSON not found: ${file}`);
    process.exit(1);
  }
  const rows: ScholarRow[] = JSON.parse(fs.readFileSync(file, "utf-8"));
  console.log(`Loaded ${rows.length} scholars from scholars.json`);

  const passwordHash = await hash(DEFAULT_PASSWORD, 10);

  // Departments (upsert canonical names)
  const deptNames = new Set<string>();
  for (const r of rows) {
    const excelDept = s(r["Department"]);
    const name = DEPT_MAP[excelDept] ?? excelDept;
    if (name) deptNames.add(name);
  }
  for (const name of deptNames) {
    await prisma.department.upsert({ where: { name }, update: {}, create: { name } });
  }
  const deptId = new Map<string, string>();
  for (const name of deptNames) {
    const d = await prisma.department.findUnique({ where: { name } });
    deptId.set(name, d!.id);
  }

  // PhD programme (for scholars)
  const programme = await prisma.programme.upsert({
    where: { name: "PhD" },
    update: {},
    create: { name: "PhD" },
  });

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const r of rows) {
    const rollNo = s(r["Roll No"]);
    const name = s(r["Name"]);
    if (!rollNo || !name) {
      console.warn("SKIP row missing roll/name");
      skipped++;
      continue;
    }

    const excelDept = s(r["Department"]);
    const deptName = DEPT_MAP[excelDept] ?? excelDept;
    const departmentId = deptId.get(deptName);
    if (!departmentId) {
      console.warn(`SKIP ${rollNo}: no department for ${excelDept}`);
      skipped++;
      continue;
    }

    const scholarData: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(r)) {
      if (PROMOTED.has(k)) continue;
      if (v == null || v === "") continue;
      scholarData[k] = v;
    }

    const data = {
      name,
      email: s(r["Login Email"]) || null,
      role: "USER",
      primaryRole: PrimaryRole.SCHOLAR,
      departmentId,
      programmeId: programme.id,
      courseId: null,
      guideId: null as string | null,
      rollNo,
      phone: s(r["Mobile No"]) || null,
      emergencyPhone: s(r["Emergency Contact No"]) || null,
      gender: mapGender(s(r["Gender"])),
      phCategory: mapPh(s(r["PH Disability"])),
      natureOfAdmission: s(r["Nature of Admission"]) || null,
      discipline: s(r["Choice of Specialization"]) || null,
      admissionYear: s(r["Admission Year"]) || null,
      admissionSemester: s(r["Admission Semester"]) || null,
      admissionCategory: s(r["Admission Category (Category)"]) || null,
      scholarData: Object.keys(scholarData).length
        ? (scholarData as Prisma.InputJsonValue)
        : Prisma.DbNull,
      profileLocked: s(r["Profile Update Locked"]).toUpperCase() === "YES",
      isActive: true,
      isTest: false,
    };

    const existing = await prisma.user.findUnique({ where: { username: rollNo } });
    if (existing) {
      await prisma.user.update({
        where: { username: rollNo },
        data: { ...data, passwordHash: undefined, role: undefined },
      });
      updated++;
    } else {
      await prisma.user.create({
        data: { ...data, username: rollNo, passwordHash },
      });
      created++;
    }
  }

  const scholars = await prisma.user.count({ where: { primaryRole: PrimaryRole.SCHOLAR } });
  console.log("-------------------------------");
  console.log(`Created ${created}, refreshed ${updated}, skipped ${skipped}`);
  console.log(`Total SCHOLAR users now: ${scholars}`);
  console.log(`Initial password for new scholars: ${DEFAULT_PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
