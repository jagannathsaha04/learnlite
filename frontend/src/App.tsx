import { useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkMath from "remark-math";

type Level = "beginner" | "intermediate" | "advanced";
type Language = "English" | "Hindi" | "Bengali" | "Tamil";
type Subject = "general" | "Science" | "Math";
type Role = "user" | "assistant";

type Message = {
  id: string;
  role: Role;
  text: string;
  language?: Language;
  bookmarked?: boolean;
};

type StreamEvent =
  | { type: "token"; token: string }
  | {
    type: "done";
    language: Language;
    subject: Subject;
    level: Level;
    explain_simply: boolean;
    context_turns_used: number;
  }
  | { type: "error"; message: string };

type PersistedState = {
  messages: Message[];
  level: Level;
  language: Language;
  subject: Subject;
  explainSimply: boolean;
  voiceOutput: boolean;
};

const API = "http://127.0.0.1:8000";
const STORAGE_KEY = "learnlite_chat_v2";
const MAX_CLIENT_HISTORY = 12;
const MAX_QUESTION_CHARS = 600;

const starters = [
  "What is photosynthesis?",
  "Explain gravity in simple words",
  "Solve 2x + 5 = 15",
  "Derive quadratic formula",
];

const levelLabel: Record<Level, string> = {
  beginner: "Beginner",
  intermediate: "Student",
  advanced: "Advanced",
};

const defaultWelcome: Message[] = [
  {
    id: crypto.randomUUID(),
    role: "assistant",
    text: "Hi! I am LearnLite, your AI tutor. What would you like to learn today?",
    language: "English",
  },
];

function buildHistory(messages: Message[]) {
  return messages
    .filter((m) => (m.role === "user" || m.role === "assistant") && m.text.trim().length > 0)
    .slice(-MAX_CLIENT_HISTORY)
    .map((m) => ({
      role: m.role,
      content: m.text.trim().slice(0, 1200),
    }));
}

function parseSseEvents(block: string): StreamEvent[] {
  const events: StreamEvent[] = [];
  const lines = block.split("\n");
  const dataLine = lines.find((line) => line.startsWith("data: "));
  if (!dataLine) return events;
  try {
    events.push(JSON.parse(dataLine.slice(6)) as StreamEvent);
  } catch {
    // Ignore malformed frames.
  }
  return events;
}

function loadPersisted(): PersistedState | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PersistedState;
  } catch {
    return null;
  }
}

export default function App() {
  const persisted = loadPersisted();
  const [messages, setMessages] = useState<Message[]>(
    persisted?.messages?.length ? persisted.messages : defaultWelcome
  );
  const [question, setQuestion] = useState("");
  const [level, setLevel] = useState<Level>(persisted?.level ?? "intermediate");
  const [language, setLanguage] = useState<Language>(persisted?.language ?? "English");
  const [subject, setSubject] = useState<Subject>(persisted?.subject ?? "general");
  const [explainSimply, setExplainSimply] = useState<boolean>(persisted?.explainSimply ?? false);
  const [voiceOutput, setVoiceOutput] = useState<boolean>(persisted?.voiceOutput ?? false);
  const [listening, setListening] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showBookmarksOnly, setShowBookmarksOnly] = useState(false);

  const voiceInputSupported = useMemo(() => {
    const maybeWindow = window as Window & {
      webkitSpeechRecognition?: unknown;
      SpeechRecognition?: unknown;
    };
    return Boolean(maybeWindow.webkitSpeechRecognition || maybeWindow.SpeechRecognition);
  }, []);

  useEffect(() => {
    const data: PersistedState = {
      messages,
      level,
      language,
      subject,
      explainSimply,
      voiceOutput,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [messages, level, language, subject, explainSimply, voiceOutput]);

  const speak = (text: string, selectedLanguage: Language) => {
    if (!voiceOutput || !("speechSynthesis" in window)) return;
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
    if (!voiceInputSupported) return;

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
    if (!SpeechRecognitionImpl) return;

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
    recognizer.onresult = (event) => setQuestion(event.results[0][0].transcript);
    recognizer.onend = () => setListening(false);
    recognizer.start();
  };

  const toggleBookmark = (id: string) => {
    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === id ? { ...msg, bookmarked: !msg.bookmarked } : msg
      )
    );
  };

  const newChat = () => {
    setMessages(defaultWelcome);
    setQuestion("");
    setShowBookmarksOnly(false);
  };

  const sendMessage = async (prefill?: string) => {
    const q = (prefill ?? question).trim();
    if (!q || loading) return;

    if (q.length > MAX_QUESTION_CHARS) {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          text: `Question too long. Keep it under ${MAX_QUESTION_CHARS} characters.`,
          language: "English",
        },
      ]);
      return;
    }

    setQuestion("");
    setLoading(true);
    const userMessage: Message = { id: crypto.randomUUID(), role: "user", text: q };
    const assistantId = crypto.randomUUID();
    const assistantPlaceholder: Message = {
      id: assistantId,
      role: "assistant",
      text: "",
      language,
    };
    const withUser = [...messages, userMessage];
    setMessages([...withUser, assistantPlaceholder]);

    try {
      const response = await fetch(`${API}/ask/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: q,
          level,
          subject,
          language,
          explain_simply: explainSimply,
          history: buildHistory(withUser),
        }),
      });

      if (!response.ok || !response.body) {
        throw new Error(`Request failed (${response.status})`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let rendered = "";
      let finalLanguage: Language = language;

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const blocks = buffer.split("\n\n");
        buffer = blocks.pop() ?? "";

        for (const block of blocks) {
          const events = parseSseEvents(block);
          for (const event of events) {
            if (event.type === "token") {
              rendered += event.token;
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantId ? { ...msg, text: msg.text + event.token } : msg
                )
              );
            } else if (event.type === "done") {
              finalLanguage = event.language;
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantId ? { ...msg, language: event.language } : msg
                )
              );
            } else if (event.type === "error") {
              throw new Error(event.message);
            }
          }
        }
      }

      if (!rendered.trim()) {
        throw new Error("Model returned an empty response.");
      }
      speak(rendered, finalLanguage);
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Unknown error";
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantId
            ? {
              ...msg,
              text: `Cannot reach backend/Ollama. ${detail}. Start backend (\`uvicorn app:app --reload\`) and Ollama.`,
              language: "English",
            }
            : msg
        )
      );
    } finally {
      setLoading(false);
    }
  };

  const visibleMessages = showBookmarksOnly
    ? messages.filter((msg) => msg.bookmarked)
    : messages;

  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl p-4 md:p-6">
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <header className="flex items-center gap-3 border-b border-slate-200 px-5 py-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-600 text-lg text-white">
            L
          </div>
          <div>
            <h1 className="text-base font-semibold text-slate-900">LearnLite</h1>
            <p className="text-xs text-slate-500">Offline + Streaming + Memory + KaTeX</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              className="rounded-lg border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
              onClick={() => setShowBookmarksOnly((v) => !v)}
            >
              {showBookmarksOnly ? "Show all" : "Bookmarks"}
            </button>
            <button
              type="button"
              className="rounded-lg border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
              onClick={newChat}
            >
              New chat
            </button>
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
                  className={`rounded-full border px-3 py-1 text-xs ${level === lvl
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
              onClick={() => void sendMessage(item)}
            >
              {item}
            </button>
          ))}
        </div>

        <section className="h-[430px] space-y-4 overflow-y-auto bg-white p-4">
          {visibleMessages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${message.role === "user"
                  ? "rounded-br-md bg-emerald-600 text-white"
                  : "rounded-bl-md border border-slate-200 bg-white text-slate-800"
                  }`}
              >
                <div className="mb-2 flex items-center gap-2">
                  {message.role === "assistant" &&
                    message.language &&
                    message.language !== "English" ? (
                    <div className="inline-block rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                      {message.language}
                    </div>
                  ) : null}
                  {message.role === "assistant" ? (
                    <button
                      type="button"
                      className="rounded border border-slate-300 px-2 py-0.5 text-[10px] text-slate-600 hover:bg-slate-50"
                      onClick={() => toggleBookmark(message.id)}
                    >
                      {message.bookmarked ? "Bookmarked" : "Bookmark"}
                    </button>
                  ) : null}
                </div>

                {message.role === "assistant" ? (
                  <div className="space-y-2 leading-7 [&_.katex-display]:overflow-x-auto [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-1">
                    <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                      {message.text || (loading ? "Streaming response..." : "")}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap">{message.text}</p>
                )}
              </div>
            </div>
          ))}

          {loading ? <div className="text-sm text-slate-500">Streaming response...</div> : null}
        </section>

        <footer className="flex flex-wrap items-center gap-2 border-t border-slate-200 p-4">
          <input
            className="min-w-[240px] flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500"
            value={question}
            placeholder="Ask a question in any language..."
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void sendMessage();
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
            className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
            onClick={() => void sendMessage()}
            disabled={loading}
          >
            Send
          </button>
        </footer>
      </section>
    </main>
  );
}
