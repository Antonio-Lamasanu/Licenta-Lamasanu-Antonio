import { useRef, useState } from "react";
import ProfileSurvey, { type ProfileFormValue } from "./ProfileSurvey";
import { updateProfile } from "../api/chat";

interface OnboardingModalProps {
  onDone: () => void;
}

export default function OnboardingModal({ onDone }: OnboardingModalProps) {
  const valueRef = useRef<ProfileFormValue | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    const value = valueRef.current;
    if (!value) {
      onDone();
      return;
    }
    setSaving(true);
    try {
      await updateProfile(value);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
      onDone();
    }
  }

  return (
    <div className="modal-overlay">
      <div className="onboarding-card">
        <div className="onboarding-header">
          <h2 className="onboarding-title">Tell us about your songwriting</h2>
          <p className="onboarding-subtitle">
            This helps the AI chat tailor its suggestions to you. Skip anytime — you can fill
            this in later from Preferences.
          </p>
        </div>
        <ProfileSurvey initial={null} onChange={(v) => { valueRef.current = v; }} />
        <div className="onboarding-actions">
          <button className="onboarding-skip" onClick={onDone}>
            Skip for now
          </button>
          <button className="onboarding-save" onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : "Save & continue"}
          </button>
        </div>
      </div>
    </div>
  );
}
