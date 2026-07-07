import { useState, type RefObject } from "react";

const RHYME_WORD_CAP = 5;

interface SelectionMenuState {
  text: string;
  start: number;
  end: number;
  top: number;
  left: number;
}

interface UseSelectionMenuArgs {
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  wrapperRef: RefObject<HTMLDivElement | null>;
  lineRefs: RefObject<(HTMLDivElement | null)[]>;
  onSelectionChange?: (text: string) => void;
  onCursorChange?: (query: string) => void;
  onSendToChat?: (text: string) => void;
  onChangeThis?: (text: string, start: number, end: number) => void;
}

/** Owns the floating "Send to Chat / Change this" menu that appears on a word
 * selection inside the lyric textarea, plus the cursor-context rhyme query. */
export function useSelectionMenu({
  textareaRef,
  wrapperRef,
  lineRefs,
  onSelectionChange,
  onCursorChange,
  onSendToChat,
  onChangeThis,
}: UseSelectionMenuArgs) {
  const [selectionMenu, setSelectionMenu] = useState<SelectionMenuState | null>(null);

  function locateOffset(container: HTMLElement, offset: number): { node: Node; offset: number } | null {
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
    let remaining = offset;
    let last: Text | null = null;
    let node: Node | null;
    while ((node = walker.nextNode())) {
      const text = node as Text;
      const len = text.textContent?.length ?? 0;
      last = text;
      if (remaining <= len) return { node: text, offset: remaining };
      remaining -= len;
    }
    return last ? { node: last, offset: last.textContent?.length ?? 0 } : null;
  }

  function getSelectionRect(lineIdx: number, startInLine: number, endInLine: number): DOMRect | null {
    const container = lineRefs.current?.[lineIdx];
    if (!container) return null;
    const startLoc = locateOffset(container, startInLine);
    const endLoc = locateOffset(container, endInLine);
    if (!startLoc || !endLoc) return null;
    const range = document.createRange();
    range.setStart(startLoc.node, startLoc.offset);
    range.setEnd(endLoc.node, endLoc.offset);
    const rects = range.getClientRects();
    return rects.length > 0 ? rects[0] : range.getBoundingClientRect();
  }

  function computeMenuPosition(lineIdx: number, startInLine: number, endInLine: number) {
    const rect = getSelectionRect(lineIdx, startInLine, endInLine);
    const wrapperRect = wrapperRef.current?.getBoundingClientRect();
    if (!rect || !wrapperRect) return { top: 0, left: 0 };
    return {
      top: rect.top - wrapperRect.top - 8,
      left: rect.left - wrapperRect.left + rect.width / 2,
    };
  }

  function handleSelectionChange() {
    if (!onSelectionChange && !onCursorChange && !onSendToChat) return;
    const el = textareaRef.current;
    if (!el) return;
    const { selectionStart, value } = el;
    let { selectionEnd } = el;
    // Triple-click (and the new per-line select button) typically extends the
    // selection through the line's trailing newline - trim it so a whole-line
    // selection isn't mistaken for a genuine multi-line one below.
    if (selectionEnd > selectionStart && value[selectionEnd - 1] === "\n") {
      selectionEnd -= 1;
    }

    if (selectionStart === selectionEnd) {
      setSelectionMenu(null);
      onSelectionChange?.("");
      if (onCursorChange) {
        const lineStart = value.lastIndexOf("\n", selectionStart - 1) + 1;
        const textBefore = value.slice(lineStart, selectionStart);
        let beforeWords: string[] = textBefore.match(/\S+/g) ?? [];
        if (
          selectionStart > 0 &&
          selectionStart < value.length &&
          /\w/.test(value[selectionStart - 1]) &&
          /\w/.test(value[selectionStart])
        ) {
          beforeWords = beforeWords.slice(0, -1);
        }
        beforeWords = beforeWords.slice(-3);
        onCursorChange(beforeWords.length > 0 ? beforeWords.join(" ") : "");
      }
      return;
    }

    const selected = value.slice(selectionStart, selectionEnd);
    if (selected.includes("\n")) { setSelectionMenu(null); return; }

    let words: string[] = selected.match(/\S+/g) ?? [];
    if (words.length === 0) { setSelectionMenu(null); return; }

    let trimmedStart = selectionStart;
    let trimmedEnd = selectionEnd;

    if (
      selectionStart > 0 &&
      /\w/.test(value[selectionStart - 1]) &&
      /\S/.test(selected[0])
    ) {
      words = words.slice(1);
      trimmedStart = selectionStart + (selected.match(/^\S+\s*/)?.[0].length ?? 0);
    }

    if (
      selectionEnd < value.length &&
      /\w/.test(value[selectionEnd]) &&
      /\S/.test(selected[selected.length - 1])
    ) {
      words = words.slice(0, -1);
      const tail = value.slice(trimmedStart, selectionEnd);
      trimmedEnd = trimmedStart + (tail.match(/\s*\S+$/)?.index ?? tail.length);
    }

    if (words.length === 0) { setSelectionMenu(null); return; }
    const query = words.join(" ");
    if (query.length < 2) { setSelectionMenu(null); return; }

    const rhymeWords = words.length > RHYME_WORD_CAP ? words.slice(-RHYME_WORD_CAP) : words;
    onSelectionChange?.(rhymeWords.join(" "));

    if (onSendToChat) {
      const lineStart = value.lastIndexOf("\n", trimmedStart - 1) + 1;
      const lineIdx = (value.slice(0, trimmedStart).match(/\n/g) ?? []).length;
      const { top, left } = computeMenuPosition(lineIdx, trimmedStart - lineStart, trimmedEnd - lineStart);
      setSelectionMenu({ text: query, start: trimmedStart, end: trimmedEnd, top, left });
    }
  }

  function handleChangeThis() {
    if (!selectionMenu) return;
    const { text, start, end } = selectionMenu;
    setSelectionMenu(null);
    onChangeThis?.(text, start, end);
  }

  // Selects a whole line by index and opens the same selection-action menu that a
  // manual click-drag or triple-click would - avoids relying on browser selection
  // quirks (like triple-click's inconsistent handling of the trailing newline) for
  // the common "act on this whole line" case.
  function handleSelectLine(lineIdx: number) {
    const el = textareaRef.current;
    if (!el) return;
    const allLines = el.value.split("\n");
    if (lineIdx >= allLines.length) return;
    let start = 0;
    for (let i = 0; i < lineIdx; i++) start += allLines[i].length + 1;
    const end = start + allLines[lineIdx].length;
    if (start === end) return;
    el.focus();
    el.setSelectionRange(start, end);
    handleSelectionChange();
  }

  function dismissSelectionMenu() {
    setSelectionMenu(null);
  }

  return { selectionMenu, handleSelectionChange, handleChangeThis, handleSelectLine, dismissSelectionMenu };
}
