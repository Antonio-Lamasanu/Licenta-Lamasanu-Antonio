import { useEffect, useMemo, useRef, useState } from "react";
import type { LyricEditorHandle } from "../components/LyricEditor";
import {
  createChatSession,
  deleteChatSession,
  fetchChatSessions,
  fetchChatTurns,
  renameChatSession,
  streamChatTurn,
  type ChatSession,
  type ChatTurn,
} from "../api/chat";
import { locateEditRange } from "../utils/editRange";
import { buildEditDisplayPrompt, buildEditWirePrompt, extractRewrite } from "../utils/editMarkers";
import type { ChatDock } from "./useChatDock";

interface PendingSelectionEdit {
  noteId: number;
  start: number;
  end: number;
  original: string;
  displayPrompt: string;
}

interface ActiveEditContext {
  sessionId: number;
  noteId: number;
  start: number;
  end: number;
  original: string;
}

export interface EditSuggestion {
  noteId: number;
  start: number;
  end: number;
  original: string;
  suggestion: string;
}

export interface ResolvedEdit {
  turnId: number;
  start: number;
  end: number;
  original: string;
  suggestion: string;
}

interface UseChatWorkflowArgs {
  activeNoteId: number | null;
  activeContent: string;
  setActiveContent: (updater: (prev: string) => string) => void;
  editorRef: React.RefObject<LyricEditorHandle | null>;
  activeTab: string;
  chatDock: ChatDock;
  openFloatingChat: () => void;
}

/** Owns chat sessions/turns and the "Change this" AI edit-suggestion workflow,
 * which is threaded through the active note's content to anchor/apply edits. */
export function useChatWorkflow({
  activeNoteId,
  activeContent,
  setActiveContent,
  editorRef,
  activeTab,
  chatDock,
  openFloatingChat,
}: UseChatWorkflowArgs) {
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [activeChatSessionId, setActiveChatSessionId] = useState<number | null>(null);
  const [chatTurns, setChatTurns] = useState<ChatTurn[]>([]);
  const [chatTurnsLoading, setChatTurnsLoading] = useState(false);
  const [chatSending, setChatSending] = useState(false);
  const [chatPendingUserText, setChatPendingUserText] = useState<string | null>(null);
  const [chatStreamingText, setChatStreamingText] = useState<string | null>(null);
  const [chatError, setChatError] = useState<string | null>(null);
  const [chatInject, setChatInject] = useState<{ text: string; seq: number } | null>(null);
  const [editSuggestions, setEditSuggestions] = useState<Map<number, EditSuggestion>>(new Map());
  const [userTurnDisplay, setUserTurnDisplay] = useState<Map<number, string>>(new Map());
  // Extracted rewrite text per assistant turn - kept forever (unlike editSuggestions,
  // which is cleared on accept/reject/staleness) so the bubble can always fall back to
  // clean copy-pasteable text instead of the raw <<<REWRITE>>> markers.
  const [assistantEditText, setAssistantEditText] = useState<Map<number, string>>(new Map());
  const pendingEditRef = useRef<PendingSelectionEdit | null>(null);
  const activeEditContextRef = useRef<ActiveEditContext | null>(null);
  // Sessions that have had the full note pasted in at least once - used only to decide
  // whether to show a soft "insert full note" hint before a "Change this" request, never
  // to block sending.
  const [noteContextSessions, setNoteContextSessions] = useState<Set<number>>(new Set());
  const [noteContextHint, setNoteContextHint] = useState(false);

  useEffect(() => {
    fetchChatSessions().then(setChatSessions).catch(console.error);
  }, []);

  useEffect(() => {
    if (activeChatSessionId === null) {
      setChatTurns([]);
      return;
    }
    setChatTurnsLoading(true);
    setChatError(null);
    fetchChatTurns(activeChatSessionId)
      .then(setChatTurns)
      .catch(console.error)
      .finally(() => setChatTurnsLoading(false));
  }, [activeChatSessionId]);

  function openChatSession(id: number) {
    setActiveChatSessionId(id);
    if (activeTab !== "chat" && chatDock.mode === "closed") {
      openFloatingChat();
    }
  }

  async function handleNewChatSession() {
    try {
      const session = await createChatSession();
      setChatSessions((prev) => [session, ...prev]);
      openChatSession(session.id);
    } catch (e) {
      console.error(e);
    }
  }

  async function handleDeleteChatSession(id: number) {
    try {
      await deleteChatSession(id);
      setChatSessions((prev) => prev.filter((s) => s.id !== id));
      if (activeChatSessionId === id) {
        setActiveChatSessionId(null);
      }
    } catch (e) {
      console.error(e);
    }
  }

  async function handleRenameChatSession(id: number, title: string) {
    try {
      const session = await renameChatSession(id, title);
      setChatSessions((prev) => prev.map((s) => (s.id === id ? session : s)));
    } catch (e) {
      console.error(e);
    }
  }

  async function handleSendChatMessage(content: string) {
    if (activeChatSessionId === null) return;
    const sessionId = activeChatSessionId;
    // Treat this as an edit-suggestion request if the sent text still starts with what
    // "Change this" generated - if the user deleted/replaced that part, send as a normal
    // message. Anything appended after it (e.g. a pasted-in full note via "Insert full
    // note") is passed through as extra context rather than breaking detection.
    const pending = pendingEditRef.current;
    const editMeta =
      pending && content.trim().startsWith(pending.displayPrompt.trim()) ? pending : null;
    pendingEditRef.current = null;
    const displayText = content;
    const extraContext = editMeta
      ? content.trim().slice(editMeta.displayPrompt.trim().length).trim() || undefined
      : undefined;
    const wireContent = editMeta ? buildEditWirePrompt(editMeta.original, extraContext) : content;
    setChatError(null);
    setChatSending(true);
    setChatPendingUserText(displayText);
    setChatStreamingText("");
    setNoteContextHint(false);
    try {
      await streamChatTurn(sessionId, wireContent, {
        onUserTurn: (turn) => {
          setChatTurns((prev) => [...prev, turn]);
          setChatPendingUserText(null);
          if (displayText.includes("Full note:\n")) {
            setNoteContextSessions((prev) => new Set(prev).add(sessionId));
          }
          if (editMeta) {
            setUserTurnDisplay((prev) => {
              const next = new Map(prev);
              next.set(turn.id, displayText);
              return next;
            });
            activeEditContextRef.current = {
              sessionId,
              noteId: editMeta.noteId,
              start: editMeta.start,
              end: editMeta.end,
              original: editMeta.original,
            };
          }
        },
        onDelta: (text) => {
          setChatStreamingText((prev) => (prev ?? "") + text);
        },
        onDone: (assistantTurn, sessionTitle) => {
          setChatTurns((prev) => [...prev, assistantTurn]);
          setChatStreamingText(null);
          if (sessionTitle) {
            setChatSessions((prev) =>
              prev.map((s) => (s.id === sessionId ? { ...s, title: sessionTitle } : s))
            );
          }
          const ctx = activeEditContextRef.current;
          if (ctx && ctx.sessionId === sessionId) {
            const rewrite = extractRewrite(assistantTurn.content);
            if (rewrite !== null) {
              setAssistantEditText((prev) => {
                const next = new Map(prev);
                next.set(assistantTurn.id, rewrite);
                return next;
              });
              setEditSuggestions((prev) => {
                const next = new Map(prev);
                next.set(assistantTurn.id, {
                  noteId: ctx.noteId,
                  start: ctx.start,
                  end: ctx.end,
                  original: ctx.original,
                  suggestion: rewrite,
                });
                return next;
              });
              activeEditContextRef.current = null;
            }
            // No markers found (e.g. the model asked a clarifying question) - leave the
            // context active so a later reply in this thread can still be picked up.
          }
        },
      });
    } catch (e) {
      setChatError(e instanceof Error ? e.message : "Failed to send message");
    } finally {
      setChatSending(false);
      setChatPendingUserText(null);
      setChatStreamingText(null);
    }
  }

  async function injectIntoChat(text: string, label?: string): Promise<number | null> {
    let sessionId = activeChatSessionId;
    if (sessionId === null) {
      try {
        const session = await createChatSession();
        setChatSessions((prev) => [session, ...prev]);
        sessionId = session.id;
        setActiveChatSessionId(sessionId);
      } catch (e) {
        console.error(e);
        return null;
      }
    }
    const injected = label ? `${label}:\n${text}` : text;
    setChatInject({ text: injected, seq: Date.now() });
    if (activeTab !== "chat" && chatDock.mode === "closed") {
      openFloatingChat();
    }
    return sessionId;
  }

  async function handleChangeThisRequest(text: string, start: number, end: number) {
    if (activeNoteId === null) return;
    const noteId = activeNoteId;
    const displayPrompt = buildEditDisplayPrompt(text);
    pendingEditRef.current = { noteId, start, end, original: text, displayPrompt };
    const sessionId = await injectIntoChat(displayPrompt);
    if (sessionId !== null && !noteContextSessions.has(sessionId)) {
      setNoteContextHint(true);
    }
  }

  function handleAcceptEditSuggestion(turnId: number) {
    const meta = editSuggestions.get(turnId);
    if (!meta || meta.noteId !== activeNoteId) return;
    const range = locateEditRange(activeContent, meta);
    if (!range) return;
    const [start, end] = range;
    if (activeTab === "write" && editorRef.current) {
      editorRef.current.replaceRange(start, end, meta.suggestion);
    } else {
      setActiveContent((prev) => prev.slice(0, start) + meta.suggestion + prev.slice(end));
    }
    setEditSuggestions((prev) => {
      const next = new Map(prev);
      next.delete(turnId);
      return next;
    });
  }

  function handleRejectEditSuggestion(turnId: number) {
    setEditSuggestions((prev) => {
      const next = new Map(prev);
      next.delete(turnId);
      return next;
    });
  }

  // Edit suggestions currently anchored in the active note's content - recomputed
  // live so a stale/moved anchor (note switched away and edited, range no longer
  // found) simply stops rendering, rather than needing explicit invalidation.
  const resolvedEdits: ResolvedEdit[] = useMemo(() => {
    const out: ResolvedEdit[] = [];
    for (const [turnId, meta] of editSuggestions) {
      if (meta.noteId !== activeNoteId) continue;
      const range = locateEditRange(activeContent, meta);
      if (!range) continue;
      out.push({ turnId, start: range[0], end: range[1], original: meta.original, suggestion: meta.suggestion });
    }
    return out;
  }, [editSuggestions, activeContent, activeNoteId]);
  const resolvedTurnIds = useMemo(() => new Set(resolvedEdits.map((e) => e.turnId)), [resolvedEdits]);

  return {
    chatSessions,
    activeChatSessionId,
    chatTurns,
    chatTurnsLoading,
    chatSending,
    chatPendingUserText,
    chatStreamingText,
    chatError,
    chatInject,
    editSuggestions,
    userTurnDisplay,
    assistantEditText,
    noteContextHint,
    setNoteContextHint,
    resolvedEdits,
    resolvedTurnIds,
    openChatSession,
    handleNewChatSession,
    handleDeleteChatSession,
    handleRenameChatSession,
    handleSendChatMessage,
    handleChangeThisRequest,
    handleAcceptEditSuggestion,
    handleRejectEditSuggestion,
    injectIntoChat,
  };
}
