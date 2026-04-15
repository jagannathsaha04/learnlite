import { useMemo, useState } from "react";

type Level = "beginner" | "intermediate" | "advanced";
type Language = "English" | "Hindi" | "Bengali" | "Tamil";
type Subject = "general" | "Science" | "Math";
type Role = "user" | "assistant";

type Message = {
  id: string;
  role: Role;
  text: string;
  language?: Language;
};

type AskResponse = {
  answer: string;
  language: Language;
  subject: Subject;
  level: Level;
  explain_simply: boolean;
  offline: boolean;
};

const API = "http://127.0.0.1:8000";

const starters = [
  "What is photosynthesis?",
  "Explain gravity in simple words",
  "Solve 2x + 5 = 15",
  "Why is the sky blue?",
];

const levelLabel: Record<Level, string> = {
  beginner: "Beginner",
  intermediate: "Student",
  advanced: "Advanced",
};

function formatSteps(text: string): string[] {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  return lines.map((line) => line.replace(/^\d+[\.\)]\s*/, "").trim());
}

export default function App() {
  const [question, setQuestion] = useState("");
  const [level, setLevel] = useState<Level>("intermediate");
  const [language, setLanguage] = useState<Language>("English");
  const [subject, setSubject] = useState<Subject>("general");
  const [explainSimply, setExplainSimply] = useState(false);
  const [voiceOutput, setVoiceOutput] = useState(false);
  const [listening, setListening] = useState(false);
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: crypto.randomUUID(),
      role: "assistant",
      text: "Hi! I am LearnLite. Ask any Science or Math question, switch your level and language live, and learn fully offline.",
      language: "English",
    },
  ]);

  const voiceInputSupported = useMemo(() => {
    const maybeWindow = window as Window & {
      webkitSpeechRecognition?: unknown;
      SpeechRecognition?: unknown;
    };
    return Boolean(maybeWindow.webkitSpeechRecognition || maybeWindow.SpeechRecognition);
  }, []);

  const speak = (text: string, selectedLanguage: Language) => {
    if (!voiceOutput || !("speechSynthesis" in window)) {
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    const localeMap: Record<Language, string> = {
      English: "en-IN",
      Hindi: "hi-IN",
      Bengali: "bn-IN",
      Tamil: "ta-IN",
    };
    utterance.lang = localeMap[selectedLanguage];
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  };

  const startVoiceInput = () => {
    if (!voiceInputSupported) {
      return;
    }

    const maybeWindow = window as Window & {
      webkitSpeechRecognition?: new () => {
        lang: string;
        interimResults: boolean;
        maxAlternatives: number;
        onresult: (event: {
          results: ArrayLike<ArrayLike<{ transcript: string }>>;
        }) => void;
        onend: () => void;
        start: () => void;
      };
      SpeechRecognition?: new () => {
        lang: string;
        interimResults: boolean;
        maxAlternatives: number;
        onresult: (event: {
          results: ArrayLike<ArrayLike<{ transcript: string }>>;
        }) => void;
        onend: () => void;
        start: () => void;
      };
    };

    const SpeechRecognitionImpl =
      maybeWindow.SpeechRecognition || maybeWindow.webkitSpeechRecognition;
    if (!SpeechRecognitionImpl) {
      return;
    }

    const recognizer = new SpeechRecognitionImpl();
    const localeMap: Record<Language, string> = {
      English: "en-IN",
      Hindi: "hi-IN",
      Bengali: "bn-IN",
      Tamil: "ta-IN",
    };
    recognizer.lang = localeMap[language];
    recognizer.interimResults = false;
    recognizer.maxAlternatives = 1;
    setListening(true);
    recognizer.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setQuestion(transcript);
    };
    recognizer.onend = () => setListening(false);
    recognizer.start();
  };

  const sendMessage = async (prefill?: string) => {
    const q = (prefill ?? question).trim();
    if (!q || loading) {
      return;
    }

    setQuestion("");
    setLoading(true);
    setMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), role: "user", text: q },
    ]);

    try {
      const params = new URLSearchParams({
        question: q,
        level,
        subject,
        language,
        explain_simply: String(explainSimply),
      });

      const response = await fetch(`${API}/ask?${params}`, { method: "POST" });
      const data = (await response.json()) as AskResponse;

      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          text: data.answer,
          language: data.language,
        },
      ]);
      speak(data.answer, data.language);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          text: "Cannot reach backend/Ollama. Start LearnLite backend (`uvicorn app:app --reload`) and Ollama.",
          language: "English",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl p-4 md:p-6">
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <header className="flex items-center gap-3 border-b border-slate-200 px-5 py-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-600 text-lg text-white">
            L
          </div>
          <div>
            <h1 className="text-base font-semibold text-slate-900">LearnLite</h1>
            <p className="text-xs text-slate-500">Gemma 4 via Ollama (offline)</p>
          </div>
          <div className="ml-auto rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs text-emerald-700">
            Offline ready
          </div>
        </header>

        <div className="grid gap-3 border-b border-slate-200 bg-slate-50 p-4 md:grid-cols-2 xl:grid-cols-5">
          <div className="xl:col-span-2">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
              Level
            </p>
            <div className="flex flex-wrap gap-2">
              {(["beginner", "intermediate", "advanced"] as Level[]).map((lvl) => (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => setLevel(lvl)}
                  className={`rounded-full border px-3 py-1 text-xs ${
                    level === lvl
                      ? "border-emerald-600 bg-emerald-600 text-white"
                      : "border-slate-300 bg-white text-slate-700"
                  }`}
                >
                  {levelLabel[lvl]}
                </button>
              ))}
            </div>
          </div>

          <label className="flex flex-col gap-1 text-xs text-slate-500">
            Subject
            <select
              className="rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm text-slate-700"
              value={subject}
              onChange={(e) => setSubject(e.target.value as Subject)}
            >
              <option value="general">General</option>
              <option value="Science">Science</option>
              <option value="Math">Math</option>
            </select>
          </label>

          <label className="flex flex-col gap-1 text-xs text-slate-500">
            Language
            <select
              className="rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm text-slate-700"
              value={language}
              onChange={(e) => setLanguage(e.target.value as Language)}
            >
              <option value="English">English</option>
              <option value="Hindi">Hindi</option>
              <option value="Bengali">Bengali</option>
              <option value="Tamil">Tamil</option>
            </select>
          </label>

          <div className="space-y-2 text-xs text-slate-600">
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={explainSimply}
                onChange={(e) => setExplainSimply(e.target.checked)}
              />
              Explain Simply Mode
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={voiceOutput}
                onChange={(e) => setVoiceOutput(e.target.checked)}
              />
              Voice Output
            </label>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 border-b border-slate-200 px-4 py-3">
          {starters.map((item) => (
            <button
              key={item}
              type="button"
              className="rounded-full border border-slate-300 bg-slate-50 px-3 py-1 text-xs text-slate-700 hover:border-emerald-400 hover:bg-emerald-50"
              onClick={() => sendMessage(item)}
            >
              {item}
            </button>
          ))}
        </div>

        <section className="h-[420px] space-y-4 overflow-y-auto bg-white p-4">
          {messages.map((message) => {
            const steps = formatSteps(message.text);
            return (
              <div
                key={message.id}
                className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[82%] rounded-2xl px-4 py-3 text-sm ${
                    message.role === "user"
                      ? "rounded-br-md bg-emerald-600 text-white"
                      : "rounded-bl-md border border-slate-200 bg-white text-slate-800"
                  }`}
                >
                  {message.role === "assistant" && message.language && message.language !== "English" ? (
                    <div className="mb-2 inline-block rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                      {message.language}
                    </div>
                  ) : null}

                  <div className="space-y-2">
                    {steps.length > 1 ? (
                      steps.map((step, index) => (
                        <div key={step + index} className="flex gap-2">
                          <span className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-[10px] font-semibold text-emerald-700">
                            {index + 1}
                          </span>
                          <span>{step}</span>
                        </div>
                      ))
                    ) : (
                      <p>{message.text}</p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {loading ? (
            <div className="text-sm text-slate-500">Thinking...</div>
          ) : null}
        </section>

        <footer className="flex flex-wrap items-center gap-2 border-t border-slate-200 p-4">
          <input
            className="min-w-[240px] flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500"
            value={question}
            placeholder="Ask a question in any language..."
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                void sendMessage();
              }
            }}
          />
          <button
            type="button"
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-700"
            onClick={startVoiceInput}
            disabled={!voiceInputSupported}
            title={voiceInputSupported ? "Voice input" : "Speech recognition not supported"}
          >
            {listening ? "Listening..." : "Voice input"}
          </button>
          <button
            type="button"
            className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
            onClick={() => void sendMessage()}
          >
            Send
          </button>
        </footer>
      </section>
    </main>
  );
}
