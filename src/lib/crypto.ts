import {
  SignJWT,
  jwtVerify,
  generateKeyPair,
  exportJWK,
  importJWK,
  type JWK,
} from "jose";
import { prisma } from "./prisma";

const SESSION_SECRET = new TextEncoder().encode(process.env.SSO_SESSION_SECRET!);
const SSO_BASE_URL = process.env.SSO_BASE_URL ?? "http://localhost:3000";
const KID = "iipe-sso-key-1";

export type UserClaims = {
  sub: string;
  username: string;
  name: string;
  email: string;
};

// ------------------------------------------------------------------
// SSO session cookie (HS256, opaque to apps — only SSO reads it)
// ------------------------------------------------------------------

export async function createSessionJwt(user: {
  id: string;
  username: string;
  name: string;
  email: string;
}): Promise<string> {
  return new SignJWT({ username: user.username, name: user.name, email: user.email })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuer("iipe-sso")
    .setIssuedAt()
    .setExpirationTime("8h")
    .sign(SESSION_SECRET);
}

export async function verifySessionJwt(token: string): Promise<UserClaims | null> {
  try {
    const { payload } = await jwtVerify(token, SESSION_SECRET, {
      issuer: "iipe-sso",
    });
    return {
      sub: payload.sub!,
      username: String(payload.username ?? ""),
      name: String(payload.name ?? ""),
      email: String(payload.email ?? ""),
    };
  } catch {
    return null;
  }
}

// ------------------------------------------------------------------
// RSA signing key (RS256) — generated once, persisted in sso_db
// ------------------------------------------------------------------

async function ensureSigningKey() {
  const existing = await prisma.signingKey.findUnique({ where: { id: "active" } });
  if (existing) return existing;

  const { publicKey, privateKey } = await generateKeyPair("RS256", {
    extractable: true,
  });
  const publicJwk = await exportJWK(publicKey);
  const privateJwk = await exportJWK(privateKey);

  return prisma.signingKey.create({
    data: {
      id: "active",
      privateJwk: privateJwk as unknown as object,
      publicJwk: publicJwk as unknown as object,
    },
  });
}

export async function getPublicJwk(): Promise<JWK> {
  const { publicJwk } = await ensureSigningKey();
  return publicJwk as unknown as JWK;
}

async function getPrivateKey() {
  const { privateJwk } = await ensureSigningKey();
  return importJWK(privateJwk as unknown as JWK, "RS256");
}

async function getPublicKey() {
  const { publicJwk } = await ensureSigningKey();
  return importJWK(publicJwk as unknown as JWK, "RS256");
}

// ------------------------------------------------------------------
// OIDC tokens handed to client applications (RS256, verifiable via JWKS)
// ------------------------------------------------------------------

export async function signIdToken(user: UserClaims, audience: string): Promise<string> {
  const key = await getPrivateKey();
  return new SignJWT({ username: user.username, name: user.name, email: user.email })
    .setProtectedHeader({ alg: "RS256", kid: KID })
    .setSubject(user.sub)
    .setIssuer(SSO_BASE_URL)
    .setAudience(audience)
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(key);
}

export async function signAccessToken(user: UserClaims, audience: string): Promise<string> {
  const key = await getPrivateKey();
  return new SignJWT({ scope: "openid profile email" })
    .setProtectedHeader({ alg: "RS256", kid: KID })
    .setSubject(user.sub)
    .setIssuer(SSO_BASE_URL)
    .setAudience(audience)
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(key);
}

export async function verifyAccessToken(token: string): Promise<UserClaims | null> {
  try {
    const key = await getPublicKey();
    const { payload } = await jwtVerify(token, key, {
      issuer: SSO_BASE_URL,
      algorithms: ["RS256"],
    });
    return {
      sub: payload.sub!,
      username: String(payload.username ?? ""),
      name: String(payload.name ?? ""),
      email: String(payload.email ?? ""),
    };
  } catch {
    return null;
  }
}
