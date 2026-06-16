import { pool } from "./pool";
import type { Role } from "../lib/auth";

export type UserRow = {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  role: Role;
  phone: string | null;
  gender: string | null;
  age: number | null;
  is_active: boolean;
  created_at: string;
};

export type PublicUser = Omit<UserRow, "password_hash">;

export function toPublicUser(u: UserRow): PublicUser {
  const { password_hash, ...rest } = u;
  void password_hash;
  return rest;
}

export async function createUser(input: {
  name: string;
  email: string;
  passwordHash: string;
  role: Role;
  phone?: string | null;
  gender?: string | null;
  age?: number | null;
}): Promise<UserRow> {
  const { rows } = await pool.query<UserRow>(
    `insert into users (name, email, password_hash, role, phone, gender, age)
     values ($1, $2, $3, $4, $5, $6, $7) returning *`,
    [
      input.name,
      input.email,
      input.passwordHash,
      input.role,
      input.phone ?? null,
      input.gender ?? null,
      input.age ?? null,
    ]
  );
  return rows[0];
}

export async function getUserByEmail(email: string): Promise<UserRow | null> {
  const { rows } = await pool.query<UserRow>(
    `select * from users where lower(email) = lower($1)`,
    [email]
  );
  return rows[0] ?? null;
}

export async function getUserById(id: string): Promise<UserRow | null> {
  const { rows } = await pool.query<UserRow>(
    `select * from users where id = $1`,
    [id]
  );
  return rows[0] ?? null;
}

export async function listUsers(role?: Role): Promise<UserRow[]> {
  if (role) {
    const { rows } = await pool.query<UserRow>(
      `select * from users where role = $1 order by created_at desc`,
      [role]
    );
    return rows;
  }
  const { rows } = await pool.query<UserRow>(
    `select * from users order by created_at desc`
  );
  return rows;
}

export async function listPatients(): Promise<UserRow[]> {
  const { rows } = await pool.query<UserRow>(
    `select * from users where role = 'PATIENT' order by name asc`
  );
  return rows;
}

export async function updateUserRole(
  id: string,
  role: Role
): Promise<UserRow | null> {
  const { rows } = await pool.query<UserRow>(
    `update users set role = $2 where id = $1 returning *`,
    [id, role]
  );
  return rows[0] ?? null;
}

export async function setUserActive(
  id: string,
  isActive: boolean
): Promise<UserRow | null> {
  const { rows } = await pool.query<UserRow>(
    `update users set is_active = $2 where id = $1 returning *`,
    [id, isActive]
  );
  return rows[0] ?? null;
}
