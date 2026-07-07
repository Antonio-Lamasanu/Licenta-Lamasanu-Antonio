import { useEffect, useState } from "react";
import { fetchScratchpad, pinScratchpadWord, unpinScratchpadWord } from "../api/scratchpad";

export function useScratchpad() {
  const [scratchpadWords, setScratchpadWords] = useState<string[]>([]);
  const [scratchpadOpen, setScratchpadOpen] = useState(false);

  useEffect(() => {
    fetchScratchpad()
      .then((words) => setScratchpadWords(words.map((w) => w.word)))
      .catch(console.error);
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

  return { scratchpadWords, scratchpadOpen, setScratchpadOpen, addToScratchpad, removeFromScratchpad };
}
