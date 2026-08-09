import "dotenv/config";
import { hash } from "bcryptjs";
import { generateKeyPair, exportJWK } from "jose";
import { prisma } from "../src/lib/prisma";

async function main() {
  console.log("Seeding sso_db …");

  const passwordHash = await hash("password123", 10);
  const adminHash = await hash("admin123", 10);

  const users = [
    {
      username: "sanyasi",
      email: "sanyasi.naidu@iipe.ac.in",
      name: "Sanyasi Naidu",
      passwordHash,
      role: "USER",
    },
    {
      username: "lakshmi",
      email: "lakshmi@iipe.ac.in",
      name: "Lakshmi Devi",
      passwordHash,
      role: "USER",
    },
    {
      username: "admin",
      email: "admin@iipe.ac.in",
      name: "System Administrator",
      passwordHash: adminHash,
      role: "SUPER_ADMIN",
    },
    {
      username: "ramesh",
      email: "ramesh.kumar@iipe.ac.in",
      name: "Ramesh Kumar",
      passwordHash,
      role: "USER",
    },
    {
      username: "geeta",
      email: "geeta.sharma@iipe.ac.in",
      name: "Geeta Sharma",
      passwordHash,
      role: "USER",
    },
    {
      username: "kiran",
      email: "kiran.rao@iipe.ac.in",
      name: "Kiran Rao",
      passwordHash,
      role: "USER",
    },
    {
      username: "venkat",
      email: "venkat.reddy@iipe.ac.in",
      name: "Venkat Reddy",
      passwordHash,
      role: "USER",
    },
  ];

  for (const u of users) {
    await prisma.user.upsert({
      where: { username: u.username },
      update: { ...u },
      create: { ...u },
    });
  }

  const clients = [
    {
      clientId: "iipe-main",
      clientSecret: "main_dev_client_secret",
      name: "Central Application Management",
      description: "IIPE Main — manages which users may access which applications",
      redirectUris: [
        "http://localhost:3001/auth/callback",
        "https://intranet.iipe.ac.in/main/auth/callback",
      ].join(","),
    },
    {
      clientId: "iipe-app1",
      clientSecret: "app1_dev_client_secret",
      name: "Academic ERP",
      description: "Independent application #1 (own database, own roles)",
      redirectUris: [
        "http://localhost:3002/auth/callback",
        "https://intranet.iipe.ac.in/app1/auth/callback",
      ].join(","),
    },
    {
      clientId: "iipe-app2",
      clientSecret: "app2_dev_client_secret",
      name: "Leave Management",
      description: "Independent application #2 (own database, own roles)",
      redirectUris: [
        "http://localhost:3003/auth/callback",
        "https://intranet.iipe.ac.in/app2/auth/callback",
      ].join(","),
    },
    {
      clientId: "iipe-app3",
      clientSecret: "app3_dev_client_secret",
      name: "PhD ERP",
      description: "Independent application #3 (own database, own roles)",
      redirectUris: [
        "http://localhost:3004/auth/callback",
        "https://intranet.iipe.ac.in/app3/auth/callback",
      ].join(","),
    },
  ];

  for (const c of clients) {
    await prisma.oidcClient.upsert({
      where: { clientId: c.clientId },
      update: { ...c },
      create: { ...c },
    });
  }

  // Ensure an RSA signing key exists for RS256 tokens / JWKS.
  const existingKey = await prisma.signingKey.findUnique({ where: { id: "active" } });
  if (!existingKey) {
    const { publicKey, privateKey } = await generateKeyPair("RS256", {
      extractable: true,
    });
    await prisma.signingKey.create({
      data: {
        id: "active",
        privateJwk: (await exportJWK(privateKey)) as unknown as object,
        publicJwk: (await exportJWK(publicKey)) as unknown as object,
      },
    });
  }

  console.log("sso_db seeded: 7 users, 4 OIDC clients (main, app1, app2, app3), signing key");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
