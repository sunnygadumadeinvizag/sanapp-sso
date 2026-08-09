import { NextRequest, NextResponse } from "next/server";
import { toCsv } from "@/lib/csv";

export const runtime = "nodejs";

const HEADER = [
  "name",
  "username",
  "email",
  "password",
  "primary_role",
  "department",
  "employment_type",
  "designation",
  "phone",
  "programme",
  "course",
  "guide_username",
];

function authorized(request: NextRequest) {
  const key =
    request.nextUrl.searchParams.get("key") ??
    request.headers.get("x-admin-key") ??
    "";
  return key === process.env.SSO_ADMIN_KEY;
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // One example row per primary role so admins can see the expected shape.
  const csv = toCsv([
    HEADER,
    [
      "Arjun Mehta",
      "arjun.mehta",
      "arjun.mehta@iipe.ac.in",
      "ChangeMe@123",
      "STAFF_TEACHING",
      "Chemical Engineering",
      "REGULAR",
      "Associate Professor",
      "9876543210",
      "",
      "",
      "",
    ],
    [
      "Priya Singh",
      "priya.singh",
      "priya.singh@iipe.ac.in",
      "ChangeMe@123",
      "STUDENT",
      "Petroleum Engineering",
      "",
      "",
      "9876501234",
      "B.Tech",
      "Petroleum Engineering",
      "",
    ],
    [
      "Anita Desai",
      "anita.desai",
      "anita.desai@iipe.ac.in",
      "ChangeMe@123",
      "SCHOLAR",
      "Chemistry",
      "",
      "",
      "",
      "PhD",
      "",
      "sanyasi",
    ],
  ]);

  return new NextResponse(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": 'attachment; filename="iipe-users-template.csv"',
    },
  });
}
