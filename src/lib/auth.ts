import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { sql } from "./db";

const COOKIE = "distipline_session";

let ephemeralDevSecret: Uint8Array | undefined;

function secretKey() {
  const value =
    process.env.AUTH_SECRET?.trim() || process.env.SESSION_SECRET?.trim() || "";
  if (value) {
    return new TextEncoder().encode(value);
  }
  // Hosted / production must never sign cookies without a host-supplied secret.
  const hosted = Boolean(process.env.DATABASE_URL?.trim());
  if (process.env.NODE_ENV === "production" || hosted) {
    throw new Error("AUTH_SECRET is required");
  }
  // Local-only: random per-process secret (not a fixed string in the repo).
  ephemeralDevSecret ??= crypto.getRandomValues(new Uint8Array(32));
  return ephemeralDevSecret;
}

export type SessionUser = {
  id: string;
  email: string;
  displayName: string;
};

type UserRow = {
  id: string;
  email: string;
  display_name: string;
  password_hash: string;
};

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export async function createSession(user: SessionUser) {
  const token = await new SignJWT({
    sub: user.id,
    email: user.email,
    displayName: user.displayName,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secretKey());

  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function clearSession() {
  const jar = await cookies();
  jar.delete(COOKIE);
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey());
    if (typeof payload.sub !== "string" || typeof payload.email !== "string") {
      return null;
    }
    return {
      id: payload.sub,
      email: payload.email,
      displayName: typeof payload.displayName === "string" ? payload.displayName : "",
    };
  } catch {
    return null;
  }
}

export async function findUserByEmail(email: string) {
  const rows = await sql<UserRow>(
    "select id, email, display_name, password_hash from users where email = $1 limit 1",
    [email.toLowerCase()],
  );
  return rows[0] ?? null;
}

export async function findUserById(id: string) {
  const rows = await sql<UserRow>(
    "select id, email, display_name, password_hash from users where id = $1 limit 1",
    [id],
  );
  return rows[0] ?? null;
}

export async function createUser(input: {
  email: string;
  password: string;
  displayName: string;
}) {
  const id = crypto.randomUUID();
  const passwordHash = await hashPassword(input.password);
  await sql(
    `insert into users (id, email, password_hash, display_name)
     values ($1, $2, $3, $4)`,
    [id, input.email.toLowerCase(), passwordHash, input.displayName.trim()],
  );
  return {
    id,
    email: input.email.toLowerCase(),
    displayName: input.displayName.trim(),
  } satisfies SessionUser;
}

/** Authenticated password change for the signed-in user id only. */
export async function updatePasswordForUser(userId: string, password: string) {
  const passwordHash = await hashPassword(password);
  const rows = await sql<{ id: string }>(
    `update users
     set password_hash = $2
     where id = $1
     returning id`,
    [userId, passwordHash],
  );
  return rows.length > 0;
}

export function toSessionUser(row: UserRow): SessionUser {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
  };
}
