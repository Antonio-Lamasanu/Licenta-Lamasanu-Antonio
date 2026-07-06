import { useEffect, useRef, useState } from "react";
import ProfileSurvey, { type ProfileFormValue } from "./ProfileSurvey";
import { fetchProfile, updateProfile, type UserProfile } from "../api/chat";

interface PreferencesModalProps {
  onClose: () => void;
}

export default function PreferencesModal({ onClose }: PreferencesModalProps) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const valueRef = useRef<ProfileFormValue | null>(null);

  useEffect(() => {
    fetchProfile()
      .then(setProfile)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    const value = valueRef.current;
    if (!value) return;
    setSaving(true);
    setSaved(false);
    try {
      await updateProfile(value);
      setSaved(true);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="onboarding-card" onClick={(e) => e.stopPropagation()}>
        <div className="onboarding-header">
          <h2 className="onboarding-title">Songwriting preferences</h2>
          <p className="onboarding-subtitle">
            Used by the AI chat to tailor its suggestions. Change these anytime.
          </p>
        </div>
        {loading ? (
          <div style={{ padding: "24px 0", textAlign: "center", color: "var(--ink-4)" }}>
            Loading…
          </div>
        ) : (
          <ProfileSurvey initial={profile} onChange={(v) => { valueRef.current = v; }} />
        )}
        <div className="onboarding-actions">
          <button className="onboarding-skip" onClick={onClose}>
            Close
          </button>
          <button className="onboarding-save" onClick={handleSave} disabled={saving || loading}>
            {saving ? "Saving…" : saved ? "Saved ✓" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
