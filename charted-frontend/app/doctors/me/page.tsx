"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { useMyDoctorProfile, useSaveDoctorProfile } from "@/lib/hooks";

export default function MyDoctorProfilePage() {
  return (
    <AppShell roles={["DOCTOR"]}>
      <Editor />
    </AppShell>
  );
}

function Editor() {
  const profileQ = useMyDoctorProfile();
  const hasProfile = !!profileQ.data?.doctor;
  const mode = hasProfile ? "update" : "create";
  const save = useSaveDoctorProfile(mode);

  const [specialization, setSpecialization] = useState("");
  const [experienceYears, setExperienceYears] = useState("0");
  const [qualification, setQualification] = useState("");
  const [bio, setBio] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const d = profileQ.data?.doctor;
    if (d) {
      setSpecialization(d.specialization);
      setExperienceYears(String(d.experience_years));
      setQualification(d.qualification ?? "");
      setBio(d.bio ?? "");
    }
  }, [profileQ.data]);

  const settled = !profileQ.isLoading; // 404 (no profile) resolves as isError

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(false);
    save.mutate(
      {
        specialization,
        experienceYears: Number(experienceYears) || 0,
        qualification: qualification || undefined,
        bio: bio || undefined,
      },
      { onSuccess: () => setSaved(true) }
    );
  };

  if (!settled) return <p className="small">Loading…</p>;

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="h1">My profile</h1>
      <p className="small mt-1">
        {hasProfile
          ? "Update the details patients see when booking."
          : "Publish your profile so patients can find and book you."}
      </p>

      <form className="card mt-6 p-6 space-y-4" onSubmit={submit}>
        <div>
          <label className="label">Specialization</label>
          <input
            className="input mt-1"
            value={specialization}
            onChange={(e) => setSpecialization(e.target.value)}
            placeholder="e.g. Cardiology"
            required
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Years of experience</label>
            <input
              className="input mt-1"
              type="number"
              min={0}
              max={70}
              value={experienceYears}
              onChange={(e) => setExperienceYears(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Qualification</label>
            <input
              className="input mt-1"
              value={qualification}
              onChange={(e) => setQualification(e.target.value)}
              placeholder="e.g. MD, DM"
            />
          </div>
        </div>
        <div>
          <label className="label">Bio</label>
          <textarea className="field mt-1" rows={4} value={bio} onChange={(e) => setBio(e.target.value)} />
        </div>

        {save.isError && (
          <p className="small" style={{ color: "var(--danger)" }}>
            {(save.error as Error).message}
          </p>
        )}
        {saved && (
          <p className="small" style={{ color: "var(--green)" }}>
            Profile saved.
          </p>
        )}

        <div className="flex justify-end">
          <button className="btn btn-primary" disabled={save.isPending}>
            {save.isPending ? "Saving…" : hasProfile ? "Save changes" : "Publish profile"}
          </button>
        </div>
      </form>
    </div>
  );
}
