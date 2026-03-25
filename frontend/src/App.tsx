import { useState, useEffect } from "react";
import LyricEditor from "./components/LyricEditor";
import NotesSidebar from "./components/NotesSidebar";
import { useAutoSave } from "./hooks/useAutoSave";
import { fetchNotes, createNote, deleteNote } from "./api/notes";
import type { Note } from "./types/note";

export default function App() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [activeNoteId, setActiveNoteId] = useState<number | null>(null);
  const [activeTitle, setActiveTitle] = useState("");
  const [activeContent, setActiveContent] = useState("");

  const { saveStatus, setLastSaved } = useAutoSave(activeNoteId, activeTitle, activeContent);

  // Load notes on mount
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
        }
      })
      .catch(console.error);
  }, []);

  function handleSelectNote(id: number) {
    const note = notes.find((n) => n.id === id);
    if (!note) return;
    setActiveNoteId(note.id);
    setActiveTitle(note.title);
    setActiveContent(note.content);
    setLastSaved(note.title, note.content);
  }

  async function handleNewNote() {
    try {
      const note = await createNote("", "");
      setNotes((prev) => [note, ...prev]);
      setActiveNoteId(note.id);
      setActiveTitle(note.title);
      setActiveContent(note.content);
      setLastSaved(note.title, note.content);
    } catch (e) {
      console.error(e);
    }
  }

  async function handleDeleteNote(id: number) {
    try {
      await deleteNote(id);
      const remaining = notes.filter((n) => n.id !== id);
      setNotes(remaining);
      if (activeNoteId === id) {
        if (remaining.length > 0) {
          handleSelectNote(remaining[0].id);
        } else {
          setActiveNoteId(null);
          setActiveTitle("");
          setActiveContent("");
        }
      }
    } catch (e) {
      console.error(e);
    }
  }

  // Keep sidebar titles in sync when a save completes
  function handleTitleChange(title: string) {
    setActiveTitle(title);
    if (activeNoteId !== null) {
      setNotes((prev) =>
        prev.map((n) => (n.id === activeNoteId ? { ...n, title } : n))
      );
    }
  }

  return (
    <div className="min-h-screen bg-zinc-900 text-zinc-100 flex flex-col">
      <header className="border-b border-zinc-800 px-6 py-3 flex items-center gap-4 shrink-0">
        <h1 className="text-lg font-semibold tracking-tight">Rhymathic</h1>
        {saveStatus === "saving" && (
          <span className="text-xs text-zinc-500 ml-auto">Saving…</span>
        )}
        {saveStatus === "saved" && (
          <span className="text-xs text-zinc-500 ml-auto">Saved</span>
        )}
        {saveStatus === "error" && (
          <span className="text-xs text-red-400 ml-auto">Save failed</span>
        )}
      </header>

      <div className="flex flex-1 overflow-hidden">
        <NotesSidebar
          notes={notes}
          activeNoteId={activeNoteId}
          onSelectNote={handleSelectNote}
          onNewNote={handleNewNote}
          onDeleteNote={handleDeleteNote}
        />

        <main className="flex-1 overflow-y-auto px-8 pt-6">
          {activeNoteId === null ? (
            <div className="flex items-center justify-center h-full text-zinc-600 text-sm">
              Select a note or create a new one
            </div>
          ) : (
            <>
              <input
                className="w-full bg-transparent outline-none text-xl font-semibold text-zinc-100 placeholder-zinc-600 border-b border-zinc-700 pb-2 mb-6"
                placeholder="Untitled"
                value={activeTitle}
                onChange={(e) => handleTitleChange(e.target.value)}
              />
              <LyricEditor
                content={activeContent}
                onContentChange={setActiveContent}
              />
            </>
          )}
        </main>
      </div>
    </div>
  );
}
