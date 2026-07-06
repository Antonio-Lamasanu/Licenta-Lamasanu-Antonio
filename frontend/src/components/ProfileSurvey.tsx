import { useEffect, useState } from "react";
import type { UserProfile, UserProfileInput } from "../api/chat";

export type ProfileFormValue = UserProfileInput;

interface Option {
  value: string;
  label: string;
}

const GENRE_OPTIONS: Option[] = [
  { value: "hip-hop", label: "Hip-hop" },
  { value: "pop", label: "Pop" },
  { value: "r&b", label: "R&B" },
  { value: "rock", label: "Rock" },
  { value: "electronic", label: "Electronic" },
  { value: "folk", label: "Folk" },
  { value: "other", label: "Other" },
];

const EXPERIENCE_OPTIONS: Option[] = [
  { value: "professional", label: "Professional" },
  { value: "semi-pro", label: "Semi-pro" },
  { value: "amateur", label: "Amateur" },
];

const GOAL_OPTIONS: Option[] = [
  { value: "finish more songs", label: "Finish more songs" },
  { value: "improve lyric quality", label: "Improve lyric quality" },
  { value: "beat writer's block", label: "Beat writer's block" },
  { value: "release consistently", label: "Release consistently" },
];

const HARDEST_PART_OPTIONS: Option[] = [
  { value: "starting from scratch", label: "Starting from scratch" },
  { value: "writing verses and hooks", label: "Writing verses and hooks" },
  { value: "polishing flow and rhymes", label: "Polishing flow and rhymes" },
  { value: "finishing the whole song", label: "Finishing the whole song" },
];

const BLOCKER_OPTIONS: Option[] = [
  { value: "lack of time and consistency", label: "Lack of time and consistency" },
  { value: "no clear direction", label: "No clear direction" },
  { value: "perfectionism", label: "Perfectionism" },
  { value: "i don't know how to improve what i wrote", label: "I don't know how to improve what I wrote" },
];

const FRUSTRATION_OPTIONS: Option[] = [
  { value: "too many unfinished drafts", label: "Too many unfinished drafts" },
  { value: "writing takes too long", label: "Writing takes too long" },
  { value: "my lyrics are not strong enough", label: "My lyrics are not strong enough" },
  { value: "i keep delaying releases", label: "I keep delaying releases" },
];

interface ProfileSurveyProps {
  initial: UserProfile | null;
  onChange: (value: ProfileFormValue) => void;
}

export default function ProfileSurvey({ initial, onChange }: ProfileSurveyProps) {
  const [genres, setGenres] = useState<string[]>(initial?.genres ?? []);
  const [experienceLevel, setExperienceLevel] = useState<string | null>(initial?.experience_level ?? null);
  const [goal, setGoal] = useState<string | null>(initial?.goal ?? null);
  const [hardestPart, setHardestPart] = useState<string | null>(initial?.hardest_part ?? null);
  const [blocker, setBlocker] = useState<string | null>(initial?.blocker ?? null);
  const [frustration, setFrustration] = useState<string | null>(initial?.frustration ?? null);

  useEffect(() => {
    onChange({
      genres: genres.length > 0 ? genres : null,
      experience_level: experienceLevel,
      goal,
      hardest_part: hardestPart,
      blocker,
      frustration,
    });
    // onChange intentionally excluded — parents pass a fresh closure each render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [genres, experienceLevel, goal, hardestPart, blocker, frustration]);

  function toggleGenre(g: string) {
    setGenres((prev) => (prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]));
  }

  return (
    <div className="profile-survey">
      <div className="profile-question">
        <div className="profile-question-title">Which genres do you create most often?</div>
        <div className="profile-options profile-options--wrap">
          {GENRE_OPTIONS.map((o) => (
            <button
              key={o.value}
              type="button"
              className={`profile-option${genres.includes(o.value) ? " profile-option--selected" : ""}`}
              onClick={() => toggleGenre(o.value)}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      <SingleSelectQuestion
        title="Are you making music professionally or as an amateur?"
        options={EXPERIENCE_OPTIONS}
        value={experienceLevel}
        onChange={setExperienceLevel}
      />
      <SingleSelectQuestion
        title="What is your main goal right now?"
        options={GOAL_OPTIONS}
        value={goal}
        onChange={setGoal}
      />
      <SingleSelectQuestion
        title="Which part of writing is hardest for you?"
        options={HARDEST_PART_OPTIONS}
        value={hardestPart}
        onChange={setHardestPart}
      />
      <SingleSelectQuestion
        title="What blocks you most often?"
        options={BLOCKER_OPTIONS}
        value={blocker}
        onChange={setBlocker}
      />
      <SingleSelectQuestion
        title="What frustrates you most right now?"
        options={FRUSTRATION_OPTIONS}
        value={frustration}
        onChange={setFrustration}
      />
    </div>
  );
}

function SingleSelectQuestion({
  title,
  options,
  value,
  onChange,
}: {
  title: string;
  options: Option[];
  value: string | null;
  onChange: (v: string) => void;
}) {
  return (
    <div className="profile-question">
      <div className="profile-question-title">{title}</div>
      <div className="profile-options">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            className={`profile-option${value === o.value ? " profile-option--selected" : ""}`}
            onClick={() => onChange(o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
