import { useRef, useState } from "react";
import type { SpeechRecognitionEvent, SpeechRecognitionInstance } from "../types/speechRecognition";

const SpeechRecognitionClass =
  (typeof window !== "undefined" && (window.SpeechRecognition ?? window.webkitSpeechRecognition)) || null;

export function useSpeechToText(onTranscript: (text: string) => void) {
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const supported = SpeechRecognitionClass !== null;

  function start() {
    if (!SpeechRecognitionClass) return;

    const recognition = new SpeechRecognitionClass();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = "en-US";

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) onTranscript(result[0].transcript.trim());
      }
    };

    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);

    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  }

  function stop() {
    recognitionRef.current?.stop();
    setListening(false);
  }

  function toggle() {
    if (listening) stop();
    else start();
  }

  return { supported, listening, toggle };
}
