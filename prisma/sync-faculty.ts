import "dotenv/config";
import { hash } from "bcryptjs";
import { prisma } from "../src/lib/prisma";
import { PrimaryRole, EmploymentType, Gender } from "../src/generated/prisma/enums";

type FacultyDef = {
  name: string;
  urlPart: string;
  designationRaw: string;
  email?: string;
  empNo?: string;
};

/**
 * 41 teaching faculty parsed from https://iipe.ac.in/allfaculty on 2026-08-23
 * Names/designations/UrlParts are verbatim from the site.
 * Emails + empNo (user_code) are from sso_user_master.csv REG_MAIL / user_code
 * where available; 7 visiting/former faculty have no CSV row and get a
 * synthetic @iipe.ac.in address.
 */
const FACULTY: FacultyDef[] = [
  { name: "Arun Kumar Pujari", urlPart: "Mechanical/ArunKumarPujari", designationRaw: "Associate Professor, Mechanical Engineering Department", email: "arun.pujarimec@iipe.ac.in", empNo: "TS1005" },
  { name: "Atul Kumar Varma", urlPart: "Petroleum/AtulKumarVarma", designationRaw: "Visiting Research Professor, Department of Petroleum Engineering & Earth Sciences" },
  { name: "Balla Mounika", urlPart: "Chemical/BallaMounika", designationRaw: "Assistant Professor , Department of Chemical Engineering", email: "mounika.che@iipe.ac.in", empNo: "TS1021" },
  { name: "Chanchayya Gupta Chandaluri", urlPart: "Chemistry/ChanchayyaGuptaChandaluri", designationRaw: "Associate Professor, Department of Chemistry", email: "chchgupta.chm@iipe.ac.in", empNo: "TS1008" },
  { name: "Deepak Amban Mishra", urlPart: "Petroleum/DeepakAmbanMishra", designationRaw: "Associate Professor, Department of Petroleum Engineering & Earth Sciences", email: "dam.geo@iipe.ac.in", empNo: "TS1003" },
  { name: "Deepak Kumar", urlPart: "Mechanical/DEEPAKKUMAR", designationRaw: "Assistant Professor, Department of Mechanical Engineering", email: "dkumar@iipe.ac.in", empNo: "TS1035" },
  { name: "Dipankar Pal", urlPart: "Chemical/DipankarPal", designationRaw: "Associate professor, Department of Chemical Engineering", email: "dipankar.che@iipe.ac.in", empNo: "TS1019" },
  { name: "Elizabeth Eldho", urlPart: "English/ElizabethEldho", designationRaw: "Assistant Professor of Linguistics and English language", email: "elizabetheldho@iipe.ac.in", empNo: "TS1034" },
  { name: "Ganesh Kumar", urlPart: "Petroleum/GaneshKumar", designationRaw: "Assistant Professor, Department of Petroleum Engineering & Earth Sciences", email: "ganeshkumar@iipe.ac.in", empNo: "TS1038" },
  { name: "Geddada Nagesh", urlPart: "Electrical/GeddadaNagesh", designationRaw: "Associate Professor, Electrical Engineering", email: "nagesh.eee@iipe.ac.in", empNo: "TS1009" },
  { name: "Geetanjali Chauhan", urlPart: "Petroleum/GeetanjaliChauhan", designationRaw: "Assistant Professor, Department of Petroleum Engineering & Earth Sciences", email: "geetanjali.pe@iipe.ac.in", empNo: "TS1026" },
  { name: "Hemanth Kumar Tanneru", urlPart: "Chemical/HemanthKumarTanneru", designationRaw: "Associate Professor, Department of Chemical Engineering", email: "hemanth.che@iipe.ac.in", empNo: "TS1006" },
  { name: "Himangshu Kakati", urlPart: "Petroleum/HimangshuKakati", designationRaw: "Associate Professor , Department of Petroleum Engineering & Earth Sciences", email: "himangshu.petro@iipe.ac.in", empNo: "TS1014" },
  { name: "Juhi Chaudhary", urlPart: "Mathematics/JuhiChaudhary", designationRaw: "Assistant Professor (Mathematics)", email: "juhi.math@iipe.ac.in", empNo: "TS1037" },
  { name: "Kurada Venkata Krishnasri", urlPart: "Chemical/KuradaVenkataKrishnasri", designationRaw: "Assistant Professor , Department of Chemical Engineering", email: "krishnasri.che@iipe.ac.in", empNo: "TS1022" },
  { name: "Mandapaka Ravi Kiran", urlPart: "Chemical/MandapakaRaviKiran", designationRaw: "Assistant Professor , Department of Chemical Engineering", email: "ravikiran.che@iipe.ac.in", empNo: "TS1025" },
  { name: "Nilanjan Pal", urlPart: "Petroleum/NilanjanPal", designationRaw: "Assistant Professor, Department of Petroleum Engineering & Earth Sciences", email: "nilanjanpaul.pe@iipe.ac.in", empNo: "TS1028" },
  { name: "Polamarasetty Aparoy", urlPart: "Biology/PolamarasettyAparoy", designationRaw: "Associate Professor, Department of Biology", email: "aparoy.bio@iipe.ac.in", empNo: "TS1011" },
  { name: "Narender Pendkar", urlPart: "Petroleum/ProfNarenderPendkar", designationRaw: "Visiting Research Professor, Department of Petroleum Engineering & Earth Sciences" },
  { name: "Vijaya Kumar Kopparapu", urlPart: "Earthsciences/ProfVijayaKumarKopparapu", designationRaw: "Professor, Department of Earth Sciences", email: "vijaykumar.es@iipe.ac.in", empNo: "TS1029" },
  { name: "Rajat Jain", urlPart: "Petroleum/RajatJain", designationRaw: "Associate Professor, PE&ES , Department of Petroleum Engineering & Earth Sciences", email: "rajatjain.petro@iipe.ac.in", empNo: "TS1012" },
  { name: "Raka Mondal", urlPart: "Chemical/RakaMondal", designationRaw: "Associate Professor, Department of Chemical Engineering", email: "rakam.che@iipe.ac.in", empNo: "TS1016" },
  { name: "Ramunaidu Randhi", urlPart: "Mathematics/RamunaiduRandhi", designationRaw: "Associate Professor, Department of Mathematics", email: "ramu.math@iipe.ac.in", empNo: "TS1004" },
  { name: "Ranjan Pramanik", urlPart: "Petroleum/RanjanPramanik", designationRaw: "Associate Professor, Department of Petroleum Engineering & Earth Sciences", email: "ranjan.petro@iipe.ac.in", empNo: "TS1013" },
  { name: "Ranju M R", urlPart: "Mechanical/RanjuMR", designationRaw: "Visiting Assistant Professor(Grade II) Department of Mechanical Engineering" },
  { name: "Ravi Kumar Sonwani", urlPart: "Chemical/RaviKumarSonwani", designationRaw: "Assistant Professor, Department of Chemical Engineering", email: "ravikumar.che@iipe.ac.in", empNo: "TS1023" },
  { name: "Rishabh Tripathi", urlPart: "Petroleum/RishabhTripathi", designationRaw: "Visiting Assistant Professor, Department of Petroleum Engineering & Earth Sciences" },
  { name: "Roshan Kumar Singh", urlPart: "Petroleum/RoshanKumarSingh", designationRaw: "Assistant Professor in the Dept of Petroleum Engineering and Earth Sciences", email: "roshan_rms.es@iipe.ac.in", empNo: "TS1032" },
  { name: "Samala Rathan", urlPart: "Mathematics/SamalaRathan", designationRaw: "Associate Professor, Department of Mathematics", email: "rathans.math@iipe.ac.in", empNo: "TS1010" },
  { name: "Sandaram Buchaiah", urlPart: "Mechanical/SandaramBuchaiah", designationRaw: "Visiting Assistant Professor(Grade II)" },
  { name: "Santosh Kumar Senapati", urlPart: "Mechanical/SantoshKumarSenapati", designationRaw: "Assistant Professor, Department of Mechanical Engineering", email: "sk.senapati@iipe.ac.in", empNo: "TS1033" },
  { name: "Seekala Harita", urlPart: "Mechanical/SeekalaHarita", designationRaw: "Visiting Assistant Professor(Grade II)" },
  { name: "Seshagiri Rao Ambati", urlPart: "Chemical/SeshagiriRaoAmbati", designationRaw: "Professor, Department of Chemical Engineering", email: "seshagiri.che@iipe.ac.in", empNo: "TS1027" },
  { name: "Shalivahan", urlPart: "Petroleum/Shalivahan", designationRaw: "Visiting Assistant Professor (Mathematics)" },
  { name: "Sharon Hilarydoss", urlPart: "Mechanical/SharonHilarydoss", designationRaw: "Assistant Professor, Department of Mechanical Engineering", email: "sharon.mec@iipe.ac.in", empNo: "TS1030" },
  { name: "Sivasankar P", urlPart: "Petroleum/SivasankarP", designationRaw: "Associate Professor, Department of Petroleum Engineering & Earth Sciences", email: "sivasankar.petro@iipe.ac.in", empNo: "TS1017" },
  { name: "Somnath Ghosh", urlPart: "Chemistry/SomnathGhosh", designationRaw: "Associate Professor, Department of Chemistry", email: "somnath.chm@iipe.ac.in", empNo: "TS1002" },
  { name: "Sridhar Palla", urlPart: "Chemical/SridharPalla", designationRaw: "Assistant Professor, Department of Chemical Engineering", email: "sridharpalla.che@iipe.ac.in", empNo: "TS1024" },
  { name: "Subham Bose", urlPart: "Petroleum/SubhamBose", designationRaw: "Assistant Professor, Department of Petroleum Engineering & Earth Sciences", email: "subhampe36@iipe.ac.in", empNo: "TS1036" },
  { name: "Veerabhadra Rao C", urlPart: "CSE/VeerabhadraRaoC", designationRaw: "Associate Professor , Computer Science and Engineering", email: "cvrao1972.cse@iipe.ac.in", empNo: "TS1007" },
  { name: "Venkata Reddy P", urlPart: "Chemical/VenkataReddyP", designationRaw: "Associate Professor , Department of Chemical Engineering", email: "venkat_palleti.che@iipe.ac.in", empNo: "TS1020" },
];

const FOUR_DEPARTMENTS = [
  "Petroleum Engineering & Earth Sciences",
  "Chemical Engineering",
  "Mechanical Engineering",
  "Humanities and Sciences",
] as const;

function canonicalDept(f: FacultyDef): string {
  const prefix = f.urlPart.split("/")[0].toLowerCase();
  const d = f.designationRaw.toLowerCase();
  if (prefix === "chemical" || d.includes("chemical engineering")) return "Chemical Engineering";
  if (prefix === "petroleum" || prefix === "earthsciences" || d.includes("petroleum") || d.includes("earth sciences")) return "Petroleum Engineering & Earth Sciences";
  if (prefix === "mechanical" || prefix === "electrical") return "Mechanical Engineering";
  return "Humanities and Sciences";
}

function cleanDesignation(raw: string): string {
  const beforeComma = raw.split(",")[0].trim();
  const collapsed = beforeComma.replace(/\s+/g, " ").trim();
  return collapsed
    .replace(/^Prof\.?\s+/i, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\(Grade Ii\)/i, "(Grade II)")
    .replace(/\(Grade I\)/i, "(Grade I)");
}

function toUsername(f: FacultyDef): string {
  if (f.email) return f.email.split("@")[0].toLowerCase();
  const base = f.name
    .replace(/^Prof\.?\s+/i, "")
    .toLowerCase()
    .replace(/[^a-z]+/g, ".")
    .replace(/^\.+|\.+$/g, "")
    .replace(/\.\.+/g, ".");
  if (f.name === "Shalivahan") return "shalivahan.math";
  if (f.name === "Narender Pendkar") return "narender.pendkar";
  if (f.name === "Atul Kumar Varma") return "atul.varma";
  if (f.name === "Ranju M R") return "ranju.mr";
  if (f.name === "Rishabh Tripathi") return "rishabh.tripathi";
  if (f.name === "Sandaram Buchaiah") return "sandaram.buchaiah";
  if (f.name === "Seekala Harita") return "seekala.harita";
  return base;
}

function syntheticEmail(f: FacultyDef): string {
  if (f.email) return f.email.toLowerCase();
  const user = toUsername(f);
  return `${user}@iipe.ac.in`;
}

async function main() {
  const dbUrl = process.env.DATABASE_URL ?? "";
  const isProd = dbUrl.includes(":5433") || dbUrl.includes("intranet.iipe.ac.in");
  console.log(`Syncing faculty to ${isProd ? "PROD" : "DEV"}: ${dbUrl.replace(/:[^:@]*@/, ":***@")}`);

  const passwordHash = await hash("password123", 10);

  const deptIdByName = new Map<string, string>();

  for (const name of FOUR_DEPARTMENTS) {
    const dept = await prisma.department.upsert({
      where: { name },
      update: {},
      create: { name },
    });
    deptIdByName.set(name, dept.id);
    console.log(` dept OK: ${name} -> ${dept.id}`);
  }

  const aliasFixes: Array<[string, string]> = [
    ["Petroleum Engineering", "Petroleum Engineering & Earth Sciences"],
    ["Humanities & Sciences", "Humanities and Sciences"],
  ];
  for (const [from, to] of aliasFixes) {
    const old = await prisma.department.findUnique({ where: { name: from } });
    const target = await prisma.department.findUnique({ where: { name: to } });
    if (old && target && old.id !== target.id) {
      const moved = await prisma.user.updateMany({ where: { departmentId: old.id }, data: { departmentId: target.id } });
      if (moved.count > 0) console.log(` migrated ${moved.count} users from "${from}" -> "${to}"`);
      const stillUsed = await prisma.user.count({ where: { departmentId: old.id } });
      const isHead = await prisma.department.count({ where: { headId: { not: null }, id: old.id } });
      if (stillUsed === 0 && isHead === 0) {
        await prisma.department.delete({ where: { id: old.id } });
        console.log(` removed legacy department "${from}"`);
      } else {
        console.log(` keeping legacy "${from}" (${stillUsed} users, head=${isHead})`);
      }
    }
  }

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const f of FACULTY) {
    const deptName = canonicalDept(f);
    const deptId = deptIdByName.get(deptName)!;
    const designation = cleanDesignation(f.designationRaw);
    const employmentType: EmploymentType = /visiting/i.test(f.designationRaw) ? EmploymentType.VISITING : EmploymentType.REGULAR;
    const username = toUsername(f);
    const email = syntheticEmail(f);

    const existingByUsername = await prisma.user.findUnique({ where: { username } });
    const existingByEmail = email ? await prisma.user.findFirst({ where: { email } }) : null;
    const existing = existingByUsername ?? existingByEmail;

    if (existing && existing.username === "shalivahan" && f.name === "Shalivahan") {
      const dup = await prisma.user.findUnique({ where: { username: "shalivahan.math" } });
      if (!dup) {
        await prisma.user.create({
          data: {
            username: "shalivahan.math",
            email: "shalivahan.math@iipe.ac.in",
            name: "Shalivahan",
            passwordHash,
            role: "USER",
            primaryRole: PrimaryRole.STAFF_TEACHING,
            employmentType,
            designation,
            departmentId: deptId,
            gender: Gender.OTHER,
            phCategory: "NONE",
            isActive: true,
            isTest: false,
          },
        });
        created++;
        console.log(` + created ${username} (shalivahan.math) -> ${deptName} / ${designation}`);
      } else {
        await prisma.user.update({
          where: { id: dup.id },
          data: {
            name: "Shalivahan",
            email: "shalivahan.math@iipe.ac.in",
            designation,
            departmentId: deptId,
            primaryRole: PrimaryRole.STAFF_TEACHING,
            employmentType,
            gender: dup.gender ?? Gender.OTHER,
            phCategory: dup.phCategory ?? "NONE",
            isActive: true,
            isTest: false,
          },
        });
        updated++;
        console.log(` ~ updated shalivahan.math -> ${deptName} / ${designation}`);
      }
      continue;
    }

    if (existing) {
      const needsUpdate =
        existing.name !== f.name ||
        (existing.email ?? "").toLowerCase() !== email.toLowerCase() ||
        existing.designation !== designation ||
        existing.departmentId !== deptId ||
        existing.primaryRole !== PrimaryRole.STAFF_TEACHING ||
        existing.employmentType !== employmentType ||
        existing.empNo !== (f.empNo ?? existing.empNo) ||
        existing.isTest !== false;

      if (needsUpdate) {
        await prisma.user.update({
          where: { id: existing.id },
          data: {
            name: f.name,
            email,
            designation,
            departmentId: deptId,
            primaryRole: PrimaryRole.STAFF_TEACHING,
            employmentType,
            empNo: f.empNo ?? existing.empNo,
            gender: existing.gender ?? Gender.OTHER,
            phCategory: existing.phCategory ?? "NONE",
            isActive: true,
            isTest: false,
          },
        });
        updated++;
        console.log(` ~ updated ${username} -> ${deptName} / ${designation} (${email})`);
      } else {
        skipped++;
      }
    } else {
      if (username === "shalivahan") {
        skipped++;
        continue;
      }
      await prisma.user.create({
        data: {
          username,
          email,
          name: f.name,
          passwordHash,
          role: "USER",
          primaryRole: PrimaryRole.STAFF_TEACHING,
          employmentType,
          designation,
          departmentId: deptId,
          empNo: f.empNo ?? null,
          gender: Gender.OTHER,
          phCategory: "NONE",
          isActive: true,
          isTest: false,
        },
      });
      created++;
      console.log(` + created ${username} (${email}) -> ${deptName} / ${designation} [${f.empNo ?? ""}]`);
    }
  }

  const totalFaculty = await prisma.user.count({ where: { primaryRole: PrimaryRole.STAFF_TEACHING } });
  const totalUsers = await prisma.user.count();
  const deptCounts = await prisma.department.findMany({ include: { _count: { select: { users: true } } }, orderBy: { name: "asc" } });

  console.log("\nDone.");
  console.log(` Faculty created: ${created}, updated: ${updated}, unchanged: ${skipped}`);
  console.log(` Total STAFF_TEACHING: ${totalFaculty} / total users: ${totalUsers}`);
  console.log(" Departments:");
  for (const d of deptCounts) console.log(`  - ${d.name}: ${d._count.users} users`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
