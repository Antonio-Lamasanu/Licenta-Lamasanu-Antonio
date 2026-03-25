import { useEffect, useRef, useState } from "react";
import { updateNote } from "../api/notes";

type SaveStatus = "idle" | "saving" | "saved" | "error";

export function useAutoSave(
  noteId: number | null,
  title: string,
  content: string,
) {
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSaved = useRef<{ title: string; content: string } | null>(null);

  useEffect(() => {
    if (noteId === null) return;
    if (
      lastSaved.current !== null &&
      lastSaved.current.title === title &&
      lastSaved.current.content === content
    ) {
      return;
    }

    if (timerRef.current !== null) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(async () => {
      setSaveStatus("saving");
      try {
        await updateNote(noteId, title, content);
        lastSaved.current = { title, content };
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus("idle"), 1500);
      } catch {
        setSaveStatus("error");
      }
    }, 1000);

    return () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    };
  }, [noteId, title, content]);

  // Reset lastSaved when switching notes so the guard doesn't block the first save
  const setLastSaved = (t: string, c: string) => {
    lastSaved.current = { title: t, content: c };
  };

  return { saveStatus, setLastSaved };
}
