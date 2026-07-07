import { useEffect, useRef, useState } from "react";
import { createNote, deleteNote as apiDeleteNote, fetchNotes, searchNotes, updateNote } from "../api/notes";
import type { Note } from "../types/note";
import { useAutoSave } from "./useAutoSave";

/**
 * Owns the notes list + the currently active note's editable fields, including
 * auto-save and auto-title derivation. `onActiveNoteChange` fires whenever the
 * active note is switched to a *different* note (select/new) so callers can
 * reset state that's scoped to "which note is open" (e.g. active rhyme-group
 * filters) - it does not fire when the active note is cleared to none.
 */
export function useNotes(onActiveNoteChange?: () => void) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [activeNoteId, setActiveNoteId] = useState<number | null>(null);
  const [activeTitle, setActiveTitle] = useState("");
  const [activeContent, setActiveContent] = useState("");
  const [sidebarSearch, setSidebarSearch] = useState("");
  const titleIsManual = useRef(false);
  const { saveStatus, setLastSaved } = useAutoSave(activeNoteId, activeTitle, activeContent);

  useEffect(() => {
    fetchNotes()
      .then((loaded) => {
        setNotes(loaded);
        if (loaded.length > 0) {
          const first = loaded[0];
          setActiveNoteId(first.id);
          setActiveTitle(first.title);
          setActiveContent(first.content);
          setLastSaved(first.title, first.content);
          titleIsManual.current = first.title.trim() !== "";
        }
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (sidebarSearch.trim()) {
        searchNotes(sidebarSearch).then(setNotes).catch(console.error);
      } else {
        fetchNotes().then(setNotes).catch(console.error);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [sidebarSearch]);

  function selectNote(id: number) {
    const note = notes.find((n) => n.id === id);
    if (!note) return;
    setActiveNoteId(note.id);
    setActiveTitle(note.title);
    setActiveContent(note.content);
    setLastSaved(note.title, note.content);
    titleIsManual.current = note.title.trim() !== "";
    onActiveNoteChange?.();
  }

  async function newNote() {
    const note = await createNote("", "");
    setNotes((prev) => [note, ...prev]);
    setActiveNoteId(note.id);
    setActiveTitle(note.title);
    setActiveContent(note.content);
    setLastSaved(note.title, note.content);
    titleIsManual.current = false;
    onActiveNoteChange?.();
    return note;
  }

  async function removeNote(id: number) {
    await apiDeleteNote(id);
    const remaining = notes.filter((n) => n.id !== id);
    setNotes(remaining);
    if (activeNoteId === id) {
      if (remaining.length > 0) {
        selectNote(remaining[0].id);
      } else {
        setActiveNoteId(null);
        setActiveTitle("");
        setActiveContent("");
      }
    }
  }

  async function renameNote(id: number, title: string) {
    const note = notes.find((n) => n.id === id);
    if (!note) return;
    await updateNote(id, title, note.content);
    setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, title } : n)));
    if (activeNoteId === id) {
      setActiveTitle(title);
      titleIsManual.current = title.trim() !== "";
    }
  }

  function handleContentChange(content: string) {
    setActiveContent(content);
    if (!titleIsManual.current) {
      const firstLine = content.split("\n").find((l) => l.trim().length > 0) ?? "";
      const words = firstLine.trim().split(/\s+/).filter(Boolean);
      const autoTitle = words.length
        ? words.slice(0, 6).join(" ") + (words.length > 6 ? "…" : "")
        : "";
      setActiveTitle(autoTitle);
      if (activeNoteId !== null) {
        setNotes((prev) =>
          prev.map((n) => (n.id === activeNoteId ? { ...n, title: autoTitle } : n))
        );
      }
    }
  }

  function handleTitleChange(title: string) {
    setActiveTitle(title);
    titleIsManual.current = title.trim() !== "";
    if (activeNoteId !== null) {
      setNotes((prev) =>
        prev.map((n) => (n.id === activeNoteId ? { ...n, title } : n))
      );
    }
  }

  const lineCount = activeContent
    ? activeContent.split("\n").filter((l) => l.trim().length > 0).length
    : 0;

  return {
    notes,
    activeNoteId,
    activeTitle,
    activeContent,
    setActiveContent,
    sidebarSearch,
    setSidebarSearch,
    saveStatus,
    lineCount,
    selectNote,
    newNote,
    removeNote,
    renameNote,
    handleContentChange,
    handleTitleChange,
  };
}
