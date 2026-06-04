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
