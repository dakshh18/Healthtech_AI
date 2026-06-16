// Mirrors the backend SoapNote contract (charted-backend/src/schema/soap.ts).

export type IcdCode = {
  code: string;
  description: string;
  confidence: number;
  rationale: string;
};

export type Flag = {
  section: "subjective" | "objective" | "assessment" | "plan";
  reason: string;
};

export type SoapNote = {
  chiefComplaint: string;
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  medications: string[];
  allergies: string[];
  vitals: {
    tempC: number | null;
    hr: number | null;
    bp: string | null;
  };
  icdCodes: IcdCode[];
  flags: Flag[];
};

export type Demographics = {
  name: string | null;
  age: number | null;
  sex: "male" | "female" | null;
  phone: string | null;
  dob: string | null;
};

export type Visit = {
  id: string;
  patient_ref: string;
  status: "draft" | "approved";
  audio_seconds: number | null;
  demographics: Demographics | null;
  created_at: string;
};

export type VisitDetail = {
  visit: Visit;
  redactedTranscript: string | null;
  note: { soap: SoapNote; version: number; source: "ai" | "clinician" } | null;
};

export type NoteVersion = {
  version: number;
  source: "ai" | "clinician";
  author: string;
  createdAt: string;
  soap: SoapNote;
};

export type AuditEntry = {
  action: "transcribed" | "structured" | "edited" | "approved";
  actor: string;
  detail: unknown;
  createdAt: string;
};

export type VersionsResponse = {
  versions: NoteVersion[];
  audit: AuditEntry[];
};

// ---- HMS expansion (auth, doctors, appointments, prescriptions, admin) ----

export type Role = "PATIENT" | "DOCTOR" | "ADMIN";

export type User = {
  id: string;
  name: string;
  email: string;
  role: Role;
  phone: string | null;
  gender: string | null;
  age: number | null;
  is_active: boolean;
  created_at: string;
};

export type DoctorProfile = {
  id: string;
  user_id: string;
  specialization: string;
  experience_years: number;
  qualification: string | null;
  bio: string | null;
  created_at: string;
  updated_at: string;
};

export type DoctorListing = {
  user_id: string;
  name: string;
  email: string;
  specialization: string;
  experience_years: number;
  qualification: string | null;
  bio: string | null;
};

export type AppointmentStatus =
  | "PENDING"
  | "CONFIRMED"
  | "REJECTED"
  | "CANCELLED"
  | "COMPLETED";

export type Appointment = {
  id: string;
  patient_id: string;
  doctor_id: string;
  scheduled_at: string;
  reason: string | null;
  status: AppointmentStatus;
  visit_id: string | null;
  created_at: string;
  updated_at: string;
  patient_name?: string;
  doctor_name?: string;
};

export type PrescriptionItem = {
  name: string;
  dosage?: string | null;
  frequency?: string | null;
  duration?: string | null;
  instructions?: string | null;
};

export type Prescription = {
  id: string;
  visit_id: string;
  patient_id: string | null;
  doctor_id: string | null;
  items: PrescriptionItem[];
  notes: string | null;
  created_at: string;
  patient_name?: string | null;
  doctor_name?: string | null;
};

export type TimelineEvent = {
  type: "appointment" | "visit" | "prescription";
  at: string;
  status: string | null;
  title: string;
  refId: string;
};

export type PatientHistory = {
  patient: User;
  counts: { visits: number; appointments: number; prescriptions: number };
  timeline: TimelineEvent[];
  visits: {
    id: string;
    status: string;
    createdAt: string;
    doctorName: string | null;
    chiefComplaint: string | null;
    assessment: string | null;
    latestVersion: number | null;
  }[];
  appointments: Appointment[];
  prescriptions: Prescription[];
};

export type AdminStats = {
  usersByRole: Record<string, number>;
  visitsByStatus: Record<string, number>;
  appointmentsByStatus: Record<string, number>;
  prescriptions: number;
};

export type AdminAuditEntry = {
  action: string;
  actor: string;
  visitId: string | null;
  detail: unknown;
  createdAt: string;
};
