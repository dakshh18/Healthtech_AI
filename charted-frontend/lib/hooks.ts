import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";
import type {
  SoapNote,
  Visit,
  VisitDetail,
  VersionsResponse,
  DoctorProfile,
  DoctorListing,
  Appointment,
  AppointmentStatus,
  Prescription,
  PrescriptionItem,
  PatientHistory,
  User,
  Role,
  AdminStats,
  AdminAuditEntry,
} from "@/types";

export const useVisits = () =>
  useQuery({
    queryKey: ["visits"],
    queryFn: () => api.get<{ visits: Visit[] }>("/api/visits"),
  });

export const useVisit = (id: string) =>
  useQuery({
    queryKey: ["visit", id],
    queryFn: () => api.get<VisitDetail>(`/api/visits/${id}`),
  });

export const useVersions = (id: string) =>
  useQuery({
    queryKey: ["versions", id],
    queryFn: () => api.get<VersionsResponse>(`/api/visits/${id}/versions`),
  });

export const useCreateVisit = () =>
  useMutation({
    mutationFn: (input: { transcript: string } | FormData) =>
      input instanceof FormData
        ? api.postForm<{ visit: Visit; note: SoapNote }>("/api/visits", input)
        : api.post<{ visit: Visit; note: SoapNote }>("/api/visits", input),
  });

export const useSaveNote = (id: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (soap: SoapNote) =>
      api.patch<{ note: { soap: SoapNote; version: number; source: string } }>(
        `/api/visits/${id}/note`,
        { soap }
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["visit", id] });
      qc.invalidateQueries({ queryKey: ["versions", id] });
    },
  });
};

export const useApprove = (id: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<{ visit: Visit }>(`/api/visits/${id}/approve`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["visit", id] });
      qc.invalidateQueries({ queryKey: ["visits"] });
      qc.invalidateQueries({ queryKey: ["versions", id] });
    },
  });
};

// ---- Doctors ----

export const useDoctors = () =>
  useQuery({
    queryKey: ["doctors"],
    queryFn: () => api.get<{ doctors: DoctorListing[] }>("/api/doctors"),
  });

export const useMyDoctorProfile = (enabled = true) =>
  useQuery({
    queryKey: ["doctor", "me"],
    enabled,
    retry: false,
    queryFn: () => api.get<{ doctor: DoctorProfile }>("/api/doctors/me"),
  });

type DoctorProfileInput = {
  specialization?: string;
  experienceYears?: number;
  qualification?: string;
  bio?: string;
};

export const useSaveDoctorProfile = (mode: "create" | "update") => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: DoctorProfileInput) =>
      mode === "create"
        ? api.post<{ doctor: DoctorProfile }>("/api/doctors/me", input)
        : api.patch<{ doctor: DoctorProfile }>("/api/doctors/me", input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["doctor", "me"] });
      qc.invalidateQueries({ queryKey: ["doctors"] });
    },
  });
};

// ---- Appointments ----

export const useAppointments = () =>
  useQuery({
    queryKey: ["appointments"],
    queryFn: () => api.get<{ appointments: Appointment[] }>("/api/appointments"),
  });

export const useBookAppointment = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { doctorId: string; scheduledAt: string; reason?: string }) =>
      api.post<{ appointment: Appointment }>("/api/appointments", input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["appointments"] }),
  });
};

// confirm | reject | cancel
export const useAppointmentAction = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, action }: { id: string; action: "confirm" | "reject" | "cancel" }) =>
      api.post<{ appointment: Appointment }>(`/api/appointments/${id}/${action}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["appointments"] }),
  });
};

export const useStartAppointment = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, transcript }: { id: string; transcript: string }) =>
      api.post<{ appointment: Appointment; visit: Visit; note: SoapNote }>(
        `/api/appointments/${id}/start`,
        { transcript }
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["appointments"] });
      qc.invalidateQueries({ queryKey: ["visits"] });
    },
  });
};

// ---- Prescriptions ----

export const usePrescriptions = () =>
  useQuery({
    queryKey: ["prescriptions"],
    queryFn: () => api.get<{ prescriptions: Prescription[] }>("/api/prescriptions"),
  });

export const useIssuePrescription = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { visitId: string; items?: PrescriptionItem[]; notes?: string }) =>
      api.post<{ prescription: Prescription }>("/api/prescriptions", input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["prescriptions"] }),
  });
};

// ---- Patients ----

export const usePatients = () =>
  useQuery({
    queryKey: ["patients"],
    queryFn: () => api.get<{ patients: User[] }>("/api/patients"),
  });

export const usePatientHistory = (id: string) =>
  useQuery({
    queryKey: ["patient-history", id],
    queryFn: () => api.get<PatientHistory>(`/api/patients/${id}/history`),
  });

// ---- Admin ----

export const useAdminUsers = (role?: Role) =>
  useQuery({
    queryKey: ["admin-users", role ?? "all"],
    queryFn: () =>
      api.get<{ users: User[] }>(`/api/admin/users${role ? `?role=${role}` : ""}`),
  });

export const useAdminStats = () =>
  useQuery({
    queryKey: ["admin-stats"],
    queryFn: () => api.get<{ stats: AdminStats }>("/api/admin/stats"),
  });

export const useAdminAudit = () =>
  useQuery({
    queryKey: ["admin-audit"],
    queryFn: () => api.get<{ audit: AdminAuditEntry[] }>("/api/admin/audit?limit=50"),
  });

export const useSetUserRole = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, role }: { id: string; role: Role }) =>
      api.patch<{ user: User }>(`/api/admin/users/${id}/role`, { role }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-users"] }),
  });
};

export const useSetUserStatus = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.patch<{ user: User }>(`/api/admin/users/${id}/status`, { isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-users"] }),
  });
};
