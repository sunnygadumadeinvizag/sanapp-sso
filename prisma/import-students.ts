import "dotenv/config";
import { hash } from "bcryptjs";
import * as fs from "node:fs";
import * as path from "node:path";
import { prisma } from "../src/lib/prisma";
import { PrimaryRole, Gender } from "../src/generated/prisma/enums";

/**
 * Student import — loads a student information report CSV into sanapp_sso_db.
 *
 * - username = Roll No (the login userid)
 * - primaryRole = STUDENT, role = USER
 * - name, institutional email, personal email, phone, gender and roll number on
 *   dedicated columns; department / programme (degree) / course resolved by name
 * - Admission year and admission category (the social Category column) recorded
 * - Existing usernames are refreshed (profile only); password is never
 *   overwritten. A username that belongs to a non-STUDENT is left untouched.
 *
 * Run: pnpm tsx prisma/import-students.ts [path/to/students.csv]
 * Preview without writing: DRY_RUN=1 pnpm tsx prisma/import-students.ts <csv>
 */
const DEFAULT_PASSWORD = "password123";
const DRY_RUN = process.env.DRY_RUN === "1";

// Excel Department → SSO Department name (stage/prod canonical names).
const DEPT_MAP: Record<string, string> = {
  "Chemical Engineering": "Chemical Engineering",
  "Mechanical Engineering": "Mechanical Engineering",
  "Petroleum Engineering": "Petroleum Engineering and Earth Sciences",
  "Humanities and Sciences": "Humanities & Sciences",
  "Earth Sciences": "Earth Sciences",
};

// Degree Type → SSO Programme name.
const PROGRAMME_MAP: Record<string, string> = {
  "B.Tech": "B.Tech",
  MSc: "M.Sc",
  "M.Tech": "M.Tech",
  "Web M.Tech": "Web M.Tech",
};

// Category column → SSO admission category wording.
const CATEGORY_MAP: Record<string, string> = {
  GE: "GENERAL",
  GEN: "GENERAL",
  OB: "OBC",
  OBC: "OBC",
  "OBC-NCL": "OBC-NCL",
};

function s(v: unknown): string {
  return v == null ? "" : String(v).trim();
}

/** "Chemical Engineering (UG)" → "Chemical Engineering". */
function baseCourseName(raw: string): string {
  return s(raw).replace(/\s*\(.*\)\s*$/, "").trim();
}

function mapGender(raw: string): Gender {
  const g = s(raw).toUpperCase();
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

/** Minimal RFC 4180 CSV reader — quotes, escaped quotes, CRLF, commas. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += ch;
      i++;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (ch === ",") {
      row.push(field);
      field = "";
      i++;
      continue;
    }
    if (ch === "\r") {
      i++;
      continue;
    }
    if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      i++;
      continue;
    }
    field += ch;
    i++;
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

async function main() {
  const argPath = process.argv[2] || process.env.STUDENTS_CSV;
  const file = argPath
    ? path.resolve(argPath)
    : path.join(__dirname, "seed-data", "students.csv");
  if (!fs.existsSync(file)) {
    console.error(`CSV not found: ${file}`);
    process.exit(1);
  }

  const raw = fs.readFileSync(file, "utf-8").replace(/^\uFEFF/, "");
  const table = parseCsv(raw).filter((r) => r.some((c) => s(c) !== ""));
  if (table.length < 2) {
    console.error("CSV has no data rows");
    process.exit(1);
  }
  const header = table[0].map((h) => s(h));
  const col = (name: string): number => {
    const idx = header.indexOf(name);
    if (idx < 0) throw new Error(`CSV is missing the "${name}" column`);
    return idx;
  };
  const cell = (row: string[], name: string): string => s(row[col(name)]);
  const rows = table.slice(1);
  console.log(`Loaded ${rows.length} student rows from ${file}${DRY_RUN ? " (DRY RUN)" : ""}`);

  const passwordHash = DRY_RUN ? "" : await hash(DEFAULT_PASSWORD, 10);

  // Departments / programmes / courses referenced by the file.
  const deptNames = new Set<string>();
  const programmeNames = new Set<string>();
  const courseNames = new Set<string>();
  for (const r of rows) {
    const dept = DEPT_MAP[cell(r, "Department")] ?? cell(r, "Department");
    if (dept) deptNames.add(dept);
    const prog = PROGRAMME_MAP[cell(r, "Degree Type")] ?? cell(r, "Degree Type");
    if (prog) programmeNames.add(prog);
    const course = baseCourseName(cell(r, "Course"));
    if (course) courseNames.add(course);
  }

  const deptIds = new Map<string, string>();
  const programmeIds = new Map<string, string>();
  const courseIds = new Map<string, string>();

  for (const name of deptNames) {
    if (!DRY_RUN) {
      const d = await prisma.department.upsert({ where: { name }, update: {}, create: { name } });
      deptIds.set(name, d.id);
    } else {
      const d = await prisma.department.findUnique({ where: { name } });
      deptIds.set(name, d?.id ?? "dry");
    }
  }
  for (const name of programmeNames) {
    if (!DRY_RUN) {
      const p = await prisma.programme.upsert({ where: { name }, update: {}, create: { name } });
      programmeIds.set(name, p.id);
    } else {
      const p = await prisma.programme.findUnique({ where: { name } });
      programmeIds.set(name, p?.id ?? "dry");
    }
  }
  for (const name of courseNames) {
    if (!DRY_RUN) {
      const c = await prisma.course.upsert({ where: { name }, update: {}, create: { name } });
      courseIds.set(name, c.id);
    } else {
      const c = await prisma.course.findUnique({ where: { name } });
      courseIds.set(name, c?.id ?? "dry");
    }
  }

  let created = 0;
  let updated = 0;
  let skipped = 0;
  let conflict = 0;

  for (const r of rows) {
    const rollNo = cell(r, "Roll No");
    const name = cell(r, "Student Name");
    if (!rollNo || !name) {
      console.warn("SKIP row missing roll/name");
      skipped++;
      continue;
    }

    const deptName = DEPT_MAP[cell(r, "Department")] ?? cell(r, "Department");
    const progName = PROGRAMME_MAP[cell(r, "Degree Type")] ?? cell(r, "Degree Type");
    const courseName = baseCourseName(cell(r, "Course"));
    const departmentId = deptName ? deptIds.get(deptName) ?? null : null;
    const programmeId = progName ? programmeIds.get(progName) ?? null : null;
    const courseIdV = courseName ? courseIds.get(courseName) ?? null : null;
    if (!departmentId || !programmeId || !courseIdV) {
      console.warn(`SKIP ${rollNo}: unresolved department/programme/course`);
      skipped++;
      continue;
    }

    const category = cell(r, "Category").toUpperCase();
    const data = {
      name,
      email: cell(r, "Institutional Email") || null,
      nonInstituteEmail: cell(r, "Personal Email") || null,
      role: "USER",
      primaryRole: PrimaryRole.STUDENT,
      departmentId,
      programmeId,
      courseId: courseIdV,
      rollNo,
      phone: cell(r, "Student Phone") || null,
      gender: mapGender(cell(r, "Gender")),
      phCategory: mapPh(cell(r, "PH Status")),
      admissionYear: cell(r, "Admission Year") || null,
      admissionCategory: (CATEGORY_MAP[category] ?? category) || null,
      isActive: true,
      isTest: false,
    };

    const existing = await prisma.user.findUnique({ where: { username: rollNo } });
    if (existing) {
      if (existing.primaryRole !== PrimaryRole.STUDENT) {
        console.warn(
          `SKIP ${rollNo}: username already belongs to a ${existing.primaryRole} — not overwriting`
        );
        conflict++;
        continue;
      }
      if (!DRY_RUN) {
        await prisma.user.update({
          where: { username: rollNo },
          data: { ...data, passwordHash: undefined, role: undefined },
        });
      }
      updated++;
    } else {
      if (!DRY_RUN) {
        await prisma.user.create({ data: { ...data, username: rollNo, passwordHash } });
      }
      created++;
    }
  }

  const students = await prisma.user.count({ where: { primaryRole: PrimaryRole.STUDENT } });
  console.log("-------------------------------");
  console.log(`Created ${created}, refreshed ${updated}, skipped ${skipped}, conflicts ${conflict}`);
  console.log(`Departments: ${[...deptNames].join(", ")}`);
  console.log(`Programmes: ${[...programmeNames].join(", ")}`);
  console.log(`Courses: ${[...courseNames].join(", ")}`);
  console.log(`Total STUDENT users now: ${students}`);
  if (!DRY_RUN) console.log(`Initial password for new students: ${DEFAULT_PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
