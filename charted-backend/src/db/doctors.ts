import { pool } from "./pool";

export type DoctorRow = {
  id: string;
  user_id: string;
  specialization: string;
  experience_years: number;
  qualification: string | null;
  bio: string | null;
  created_at: string;
  updated_at: string;
};

// Public-facing doctor info for the browse list (joined with the user record).
export type DoctorListing = {
  user_id: string;
  name: string;
  email: string;
  specialization: string;
  experience_years: number;
  qualification: string | null;
  bio: string | null;
};

export async function getDoctorByUserId(
  userId: string
): Promise<DoctorRow | null> {
  const { rows } = await pool.query<DoctorRow>(
    `select * from doctors where user_id = $1`,
    [userId]
  );
  return rows[0] ?? null;
}

export async function createDoctorProfile(
  userId: string,
  input: {
    specialization: string;
    experienceYears: number;
    qualification?: string | null;
    bio?: string | null;
  }
): Promise<DoctorRow> {
  const { rows } = await pool.query<DoctorRow>(
    `insert into doctors (user_id, specialization, experience_years, qualification, bio)
     values ($1, $2, $3, $4, $5) returning *`,
    [
      userId,
      input.specialization,
      input.experienceYears,
      input.qualification ?? null,
      input.bio ?? null,
    ]
  );
  return rows[0];
}

// Partial update: omitted fields are left unchanged (coalesce keeps the old
// value when the parameter is null).
export async function updateDoctorProfile(
  userId: string,
  input: {
    specialization?: string;
    experienceYears?: number;
    qualification?: string | null;
    bio?: string | null;
  }
): Promise<DoctorRow | null> {
  const { rows } = await pool.query<DoctorRow>(
    `update doctors set
       specialization   = coalesce($2, specialization),
       experience_years = coalesce($3, experience_years),
       qualification    = coalesce($4, qualification),
       bio              = coalesce($5, bio),
       updated_at       = now()
     where user_id = $1
     returning *`,
    [
      userId,
      input.specialization ?? null,
      input.experienceYears ?? null,
      input.qualification ?? null,
      input.bio ?? null,
    ]
  );
  return rows[0] ?? null;
}

export async function listDoctors(): Promise<DoctorListing[]> {
  const { rows } = await pool.query<DoctorListing>(
    `select u.id as user_id, u.name, u.email,
            d.specialization, d.experience_years, d.qualification, d.bio
     from doctors d
     join users u on u.id = d.user_id
     order by u.name asc`
  );
  return rows;
}
