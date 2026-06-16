import "dotenv/config";
import bcrypt from "bcryptjs";
import jwt, { type SignOptions } from "jsonwebtoken";

export type Role = "PATIENT" | "DOCTOR" | "ADMIN";

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
};

const DEV_FALLBACK_SECRET = "dev-insecure-secret-change-me";
const SECRET = process.env.JWT_SECRET ?? DEV_FALLBACK_SECRET;
const EXPIRES_IN = process.env.JWT_EXPIRES_IN ?? "7d";
const SALT_ROUNDS = 10;

if (SECRET === DEV_FALLBACK_SECRET) {
  if (process.env.NODE_ENV === "production") {
    throw new Error("JWT_SECRET must be set in production");
  }
  console.warn(
    "⚠️  JWT_SECRET is not set — using an insecure dev fallback. Set it in .env."
  );
}

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export function signToken(user: AuthUser): string {
  const options: SignOptions = {
    expiresIn: EXPIRES_IN as unknown as SignOptions["expiresIn"],
  };
  return jwt.sign(
    { sub: user.id, email: user.email, name: user.name, role: user.role },
    SECRET,
    options
  );
}

export function verifyToken(token: string): AuthUser {
  const payload = jwt.verify(token, SECRET) as jwt.JwtPayload;
  return {
    id: String(payload.sub),
    email: String(payload.email),
    name: String(payload.name),
    role: payload.role as Role,
  };
}
