import "dotenv/config";
import { hash } from "bcryptjs";
import * as fs from "node:fs";
import * as path from "node:path";
import { prisma } from "../src/lib/prisma";
import { PrimaryRole, EmploymentType, Gender } from "../src/generated/prisma/enums";

/**
 * IIPE user import — loads the real employee master list (user_details.csv) into sso_db.
 *
 * - Username (employee id) is the login username.
 * - Existing users NOT in the CSV are marked isTest=true (seed/demo data).
 * - Imported users are isTest=false and get the default initial password below.
 *
 * Run: pnpm tsx prisma/import-users.ts
 */
const DEFAULT_PASSWORD = "password123"; // initial password — change via My Account / forgot-password OTP

// department code (from the CSV) -> SSO Department name
const DEPT_MAP: Record<string, string> = {
  NONACAD: "Administration",
  "H&S": "Humanities & Sciences",
  ME: "Mechanical Engineering",
  CE: "Chemical Engineering",
  "PE&ES": "Petroleum Engineering",
  ESTB: "Estate & Services",
};

const TEACHING_RE = /professor|faculty fellow/i;

// Minimal RFC-4180 CSV parser (handles quoted fields with embedded newlines).
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.some((f) => f.length > 0)) rows.push(row);
      row = [];
    } else {
      field += c;
    }
  }
  row.push(field);
  if (row.some((f) => f.length > 0)) rows.push(row);
  return rows;
}

type CsvRow = Record<string, string>;

function toRows(text: string): CsvRow[] {
  const table = parseCsv(text);
  if (table.length < 2) return [];
  const header = table[0].map((h) => h.trim());
  return table.slice(1).map((cells) => {
    const r: CsvRow = {};
    header.forEach((h, i) => (r[h] = cells[i] ?? ""));
    return r;
  });
}

async function main() {
  const csvPath = path.join(__dirname, "seed-data", "user_details.csv");
  if (!fs.existsSync(csvPath)) {
    console.error(`CSV not found: ${csvPath}`);
    process.exit(1);
  }
  const rows = toRows(fs.readFileSync(csvPath, "utf-8"));
  console.log(`Loaded ${rows.length} rows from ${path.basename(csvPath)}`);

  const passwordHash = await hash(DEFAULT_PASSWORD, 10);

  // ---------------------------------------------------------------
  // Departments
  // ---------------------------------------------------------------
  for (const name of Object.values(DEPT_MAP)) {
    await prisma.department.upsert({ where: { name }, update: {}, create: { name } });
  }
  const deptId = new Map<string, string>();
  for (const [code, name] of Object.entries(DEPT_MAP)) {
    const d = await prisma.department.findUnique({ where: { name } });
    deptId.set(code, d!.id);
  }

  // ---------------------------------------------------------------
  // Import users (upsert by username — the employee id used to log in)
  // ---------------------------------------------------------------
  let created = 0;
  let updated = 0;
  let inactive = 0;
  let teaching = 0;
  let nonTeaching = 0;

  const usernames: string[] = [];
  for (const r of rows) {
    const username = r.username?.trim();
    if (!username) continue;
    usernames.push(username);

    const first = r.firstname?.trim() ?? "";
    const last = r.lastname?.trim() ?? "";
    const name = (first + (first && last ? " " : "") + last).trim();
    const designation = (r.designation ?? "").replace(/\s+/g, " ").trim();
    const isTeaching = TEACHING_RE.test(designation);
    const gender = r.gender?.trim().toUpperCase() === "F" ? Gender.FEMALE : Gender.MALE;

    const data = {
      name,
      email: r.email?.trim() || null,
      role: "USER",
      primaryRole: isTeaching ? PrimaryRole.STAFF_TEACHING : PrimaryRole.STAFF_NON_TEACHING,
      employmentType: EmploymentType.REGULAR,
      designation: designation || null,
      departmentId: deptId.get(r.dept_code?.trim() ?? "") ?? deptId.get("NONACAD")!,
      gender,
      phCategory: "NONE",
      isActive: (r.isactive ?? "").trim() === "True",
      isTest: false,
    };

    const existing = await prisma.user.findUnique({ where: { username } });
    if (existing) {
      // Profile refresh only — never touch password/role of an existing account.
      await prisma.user.update({
        where: { username },
        data: { ...data, passwordHash: undefined, role: undefined },
      });
      updated++;
    } else {
      await prisma.user.create({ data: { ...data, username, passwordHash } });
      created++;
    }
    if (!data.isActive) inactive++;
    if (isTeaching) teaching++;
    else nonTeaching++;
  }

  // ---------------------------------------------------------------
  // Everything not in the master list is test/seed data
  // ---------------------------------------------------------------
  const marked = await prisma.user.updateMany({
    where: { username: { notIn: usernames } },
    data: { isTest: true },
  });

  const total = await prisma.user.count();
  const real = await prisma.user.count({ where: { isTest: false } });
  const test = await prisma.user.count({ where: { isTest: true } });

  console.log("-------------------------------");
  console.log(`Created ${created}, refreshed ${updated}`);
  console.log(`Teaching: ${teaching}, Non-teaching: ${nonTeaching}`);
  console.log(`Inactive (isActive=false): ${inactive}`);
  console.log(`Marked as test data: ${marked.count}`);
  console.log(`Total users: ${total}  (real: ${real}, test: ${test})`);
  console.log(`Initial password for all imported users: ${DEFAULT_PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
