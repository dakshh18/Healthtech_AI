import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";
import type {
  SoapNote,
  Visit,
  VisitDetail,
  VersionsResponse,
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

// Create a visit from a pasted transcript or an audio file (record/upload).
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
