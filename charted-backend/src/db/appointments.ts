import { pool } from "./pool";

export type AppointmentStatus =
  | "PENDING"
  | "CONFIRMED"
  | "REJECTED"
  | "CANCELLED"
  | "COMPLETED";

export type AppointmentRow = {
  id: string;
  patient_id: string;
  doctor_id: string;
  scheduled_at: string;
  reason: string | null;
  status: AppointmentStatus;
  visit_id: string | null;
  created_at: string;
  updated_at: string;
};

// Adds the participant names for display in list views.
export type AppointmentListing = AppointmentRow & {
  patient_name: string;
  doctor_name: string;
};

export async function createAppointment(input: {
  patientId: string;
  doctorId: string;
  scheduledAt: string;
  reason?: string | null;
}): Promise<AppointmentRow> {
  const { rows } = await pool.query<AppointmentRow>(
    `insert into appointments (patient_id, doctor_id, scheduled_at, reason)
     values ($1, $2, $3, $4) returning *`,
    [input.patientId, input.doctorId, input.scheduledAt, input.reason ?? null]
  );
  return rows[0];
}

export async function getAppointmentById(
  id: string
): Promise<AppointmentRow | null> {
  const { rows } = await pool.query<AppointmentRow>(
    `select * from appointments where id = $1`,
    [id]
  );
  return rows[0] ?? null;
}

const LISTING_SELECT = `
  select a.*, p.name as patient_name, d.name as doctor_name
  from appointments a
  join users p on p.id = a.patient_id
  join users d on d.id = a.doctor_id`;

export async function listAppointmentsForPatient(
  patientId: string
): Promise<AppointmentListing[]> {
  const { rows } = await pool.query<AppointmentListing>(
    `${LISTING_SELECT} where a.patient_id = $1 order by a.scheduled_at desc`,
    [patientId]
  );
  return rows;
}

export async function listAppointmentsForDoctor(
  doctorId: string
): Promise<AppointmentListing[]> {
  const { rows } = await pool.query<AppointmentListing>(
    `${LISTING_SELECT} where a.doctor_id = $1 order by a.scheduled_at desc`,
    [doctorId]
  );
  return rows;
}

export async function listAllAppointments(): Promise<AppointmentListing[]> {
  const { rows } = await pool.query<AppointmentListing>(
    `${LISTING_SELECT} order by a.scheduled_at desc`
  );
  return rows;
}

export async function updateAppointmentStatus(
  id: string,
  status: AppointmentStatus
): Promise<AppointmentRow | null> {
  const { rows } = await pool.query<AppointmentRow>(
    `update appointments set status = $2, updated_at = now()
     where id = $1 returning *`,
    [id, status]
  );
  return rows[0] ?? null;
}

// The bridge: attach the generated visit and advance the status in one write.
export async function linkAppointmentVisit(
  id: string,
  visitId: string,
  status: AppointmentStatus
): Promise<AppointmentRow | null> {
  const { rows } = await pool.query<AppointmentRow>(
    `update appointments set visit_id = $2, status = $3, updated_at = now()
     where id = $1 returning *`,
    [id, visitId, status]
  );
  return rows[0] ?? null;
}
