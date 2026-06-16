import { pool } from "./pool";

export type PrescriptionItem = {
  name: string;
  dosage?: string | null;
  frequency?: string | null;
  duration?: string | null;
  instructions?: string | null;
};

export type PrescriptionRow = {
  id: string;
  visit_id: string;
  patient_id: string | null;
  doctor_id: string | null;
  items: PrescriptionItem[];
  notes: string | null;
  created_at: string;
};

// Adds participant names for display. Left joins because legacy visits may have
// no linked patient/doctor.
export type PrescriptionListing = PrescriptionRow & {
  patient_name: string | null;
  doctor_name: string | null;
};

export async function createPrescription(input: {
  visitId: string;
  patientId: string | null;
  doctorId: string | null;
  items: PrescriptionItem[];
  notes?: string | null;
}): Promise<PrescriptionRow> {
  const { rows } = await pool.query<PrescriptionRow>(
    `insert into prescriptions (visit_id, patient_id, doctor_id, items, notes)
     values ($1, $2, $3, $4, $5) returning *`,
    [
      input.visitId,
      input.patientId,
      input.doctorId,
      JSON.stringify(input.items),
      input.notes ?? null,
    ]
  );
  return rows[0];
}

export async function getPrescriptionById(
  id: string
): Promise<PrescriptionRow | null> {
  const { rows } = await pool.query<PrescriptionRow>(
    `select * from prescriptions where id = $1`,
    [id]
  );
  return rows[0] ?? null;
}

const LISTING_SELECT = `
  select rx.*, p.name as patient_name, d.name as doctor_name
  from prescriptions rx
  left join users p on p.id = rx.patient_id
  left join users d on d.id = rx.doctor_id`;

export async function listPrescriptionsForPatient(
  patientId: string
): Promise<PrescriptionListing[]> {
  const { rows } = await pool.query<PrescriptionListing>(
    `${LISTING_SELECT} where rx.patient_id = $1 order by rx.created_at desc`,
    [patientId]
  );
  return rows;
}

export async function listPrescriptionsForDoctor(
  doctorId: string
): Promise<PrescriptionListing[]> {
  const { rows } = await pool.query<PrescriptionListing>(
    `${LISTING_SELECT} where rx.doctor_id = $1 order by rx.created_at desc`,
    [doctorId]
  );
  return rows;
}

export async function listAllPrescriptions(): Promise<PrescriptionListing[]> {
  const { rows } = await pool.query<PrescriptionListing>(
    `${LISTING_SELECT} order by rx.created_at desc`
  );
  return rows;
}

export async function listPrescriptionsForVisit(
  visitId: string
): Promise<PrescriptionRow[]> {
  const { rows } = await pool.query<PrescriptionRow>(
    `select * from prescriptions where visit_id = $1 order by created_at desc`,
    [visitId]
  );
  return rows;
}
