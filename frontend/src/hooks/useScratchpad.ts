import { useEffect, useRef, useState } from "react";
import {
  fetchScratchpad,
  fetchScratchpadText,
  pinScratchpadWord,
  saveScratchpadText,
  unpinScratchpadWord,
} from "../api/scratchpad";

export function useScratchpad() {
  const [scratchpadWords, setScratchpadWords] = useState<string[]>([]);
  const [scratchpadText, setScratchpadTextState] = useState("");
  const [scratchpadOpen, setScratchpadOpen] = useState(false);
  const lastSavedText = useRef<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetchScratchpad()
      .then((words) => setScratchpadWords(words.map((w) => w.word)))
      .catch(console.error);
    fetchScratchpadText()
      .then((text) => {
        setScratchpadTextState(text);
        lastSavedText.current = text;
      })
      .catch(console.error);
    return () => {
      if (saveTimer.current !== null) clearTimeout(saveTimer.current);
    };
  }, []);

  function addToScratchpad(word: string) {
    setScratchpadWords((prev) => (prev.includes(word) ? prev : [...prev, word]));
    setScratchpadOpen(true);
    pinScratchpadWord(word).catch(console.error);
  }

  function removeFromScratchpad(word: string) {
    setScratchpadWords((prev) => prev.filter((w) => w !== word));
    unpinScratchpadWord(word).catch(console.error);
  }

  function setScratchpadText(text: string) {
    setScratchpadTextState(text);
    if (saveTimer.current !== null) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      if (lastSavedText.current === text) return;
      saveScratchpadText(text)
        .then(() => {
          lastSavedText.current = text;
        })
        .catch(console.error);
    }, 1000);
  }

  return {
    scratchpadWords,
    scratchpadText,
    setScratchpadText,
    scratchpadOpen,
    setScratchpadOpen,
    addToScratchpad,
    removeFromScratchpad,
  };
}
