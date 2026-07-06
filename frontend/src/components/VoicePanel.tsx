import { useState, useEffect, useRef } from "react";
import type { SpeechRecognitionEvent, SpeechRecognitionInstance } from "../types/speechRecognition";

interface VoicePanelProps {
  onTextReady: (text: string) => void;
}

const SpeechRecognitionClass =
  window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null;

export default function VoicePanel({ onTextReady }: VoicePanelProps) {
  const [supported] = useState(() => SpeechRecognitionClass !== null);
  const [listening, setListening] = useState(false);
  const [interimText, setInterimText] = useState("");
  const [finalLines, setFinalLines] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

  useEffect(() => {
    return () => { recognitionRef.current?.stop(); };
  }, []);

  function startListening() {
    if (!SpeechRecognitionClass) return;
    setError(null);
    setFinalLines([]);
    setInterimText("");

    const recognition = new SpeechRecognitionClass();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = "";
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          setFinalLines((prev) => [...prev, result[0].transcript.trim()]);
        } else {
          interim += result[0].transcript;
        }
      }
      setInterimText(interim);
    };

    recognition.onerror = () => {
      setError("Microphone error. Check browser permissions.");
      setListening(false);
    };

    recognition.onend = () => setListening(false);

    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  }

  function stopListening() {
    recognitionRef.current?.stop();
    setListening(false);
  }

  function handleInsert() {
    const text = [...finalLines, interimText].filter(Boolean).join("\n");
    if (text.trim()) onTextReady(text.trim());
  }

  if (!supported) {
    return (
      <main className="voice-pane">
        <div className="voice-unsupported">
          <p>Voice input is not supported in this browser.</p>
          <p>Use <strong>Chrome</strong> or <strong>Edge</strong> for Web Speech API support.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="voice-pane">
      <div className="voice-header">
        <h2 className="library-title">Voice Input</h2>
        <p className="voice-subtitle">Speak your lyrics — transcribed below. Chrome/Edge only.</p>
      </div>

      <div className="voice-controls">
        {!listening ? (
          <button className="voice-record-btn" onClick={startListening}>
            ● Start recording
          </button>
        ) : (
          <button className="voice-record-btn voice-record-btn--active" onClick={stopListening}>
            ■ Stop recording
          </button>
        )}
        {(finalLines.length > 0 || interimText) && (
          <button className="voice-insert-btn" onClick={handleInsert}>
            ↩ Insert into note
          </button>
        )}
      </div>

      {error && <p className="voice-error">{error}</p>}

      <div className="voice-transcript">
        {finalLines.map((line, i) => (
          <div key={i} className="voice-line voice-line--final">{line}</div>
        ))}
        {interimText && (
          <div className="voice-line voice-line--interim">{interimText}</div>
        )}
        {!listening && finalLines.length === 0 && !interimText && (
          <div className="voice-placeholder">Transcription will appear here…</div>
        )}
      </div>
    </main>
  );
}
