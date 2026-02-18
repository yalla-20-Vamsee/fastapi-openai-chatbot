import { useState, useRef, useEffect, useCallback } from "react";

/* KEEP YOUR CSS EXACTLY THE SAME ABOVE THIS LINE */
/* (I am not repeating it here to save space — do not change it) */

// ─── Helpers ────────────────────────────────────────────────────────────────
const API_BASE = "http://localhost:8000";

const MODELS = [
  { id: "gpt-4o", label: "GPT-4o" },
  { id: "gpt-4o-mini", label: "GPT-4o Mini" },
  { id: "gpt-3.5-turbo", label: "GPT-3.5 Turbo" },
];

const PERSONAS = [
  { id: "default", label: "🤖 Default Assistant", desc: "Helpful generalist" },
  { id: "coder", label: "💻 Senior Engineer", desc: "Code & technical depth" },
  { id: "creative", label: "✍️ Creative Writer", desc: "Stories & imagination" },
  { id: "analyst", label: "📊 Data Analyst", desc: "Data-driven insights" },
];

const QUICK_PROMPTS = [
  "Explain quantum computing simply",
  "Write a Python web scraper",
  "Give me a bedtime story",
  "Analyze Tesla's business model",
];

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function renderContent(text) {
  const parts = text.split(/(```[\s\S]*?```)/g);
  return parts.map((part, i) => {
    if (part.startsWith("```")) {
      const code = part.replace(/^```\w*\n?/, "").replace(/```$/, "");
      return <pre key={i}>{code}</pre>;
    }
    const inline = part.split(/(`[^`]+`)/g);
    return (
      <span key={i}>
        {inline.map((s, j) =>
          s.startsWith("`") && s.endsWith("`")
            ? <code key={j}>{s.slice(1, -1)}</code>
            : s
        )}
      </span>
    );
  });
}

// ─── Component ───────────────────────────────────────────────────────────────
export default function ChatbotApp() {
  const [model, setModel] = useState("gpt-4o-mini");
  const [persona, setPersona] = useState("default");
  const [stream, setStream] = useState(true);

  const [sessions, setSessions] = useState([]);
  const [activeSession, setActiveSession] = useState(null);
  const [messages, setMessages] = useState([]);

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(null);
  const [msgCount, setMsgCount] = useState(0);

  const messagesEnd = useRef(null);

  const scrollToBottom = () =>
    messagesEnd.current?.scrollIntoView({ behavior: "smooth" });

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingText]);

  // ─── Load Session History ─────────────────────────────
  const loadSession = async (id) => {
    try {
      const res = await fetch(`${API_BASE}/session/${id}/history`);
      const data = await res.json();
      setMessages(data.messages || []);
    } catch {
      setMessages([]);
    }
  };

  // ─── Create New Session ───────────────────────────────
  const newSession = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/session/new`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ persona }),
      });

      const data = await res.json();

      const sess = {
        id: data.session_id,
        label: `Chat ${sessions.length + 1}`,
        ts: Date.now(),
      };

      setSessions((prev) => [sess, ...prev]);
      setActiveSession(sess);
      setMessages([]);
    } catch {
      const sess = {
        id: `local-${Date.now()}`,
        label: `Chat ${sessions.length + 1}`,
        ts: Date.now(),
      };
      setSessions((prev) => [sess, ...prev]);
      setActiveSession(sess);
      setMessages([]);
    }
  }, [persona, sessions.length]);

  useEffect(() => {
    newSession();
  }, []);

  // ─── Send Message ─────────────────────────────────────
  const sendMessage = useCallback(
    async (text) => {
      if (!text.trim() || loading) return;

      setError("");

      const userMsg = { role: "user", content: text, ts: Date.now() };
      setMessages((prev) => [...prev, userMsg]);
      setInput("");
      setLoading(true);
      setStreamingText("");
      setMsgCount((c) => c + 1);

      try {
        const body = {
          message: text,
          session_id: activeSession?.id,
          model,
          persona,
          stream,
        };

        if (stream) {
          const resp = await fetch(`${API_BASE}/chat`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });

          const reader = resp.body.getReader();
          const decoder = new TextDecoder();
          let accumulated = "";

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value);
            const lines = chunk
              .split("\n")
              .filter((l) => l.startsWith("data: "));

            for (const line of lines) {
              try {
                const json = JSON.parse(line.slice(6));

                if (json.delta) {
                  accumulated += json.delta;
                  setStreamingText(accumulated);
                }

                if (json.done) {
                  setMessages((prev) => [
                    ...prev,
                    {
                      role: "assistant",
                      content: accumulated,
                      ts: Date.now(),
                      model,
                    },
                  ]);
                  setStreamingText("");
                  setMsgCount((c) => c + 1);
                }

                if (json.error) setError(json.error);
              } catch {}
            }
          }
        } else {
          const resp = await fetch(`${API_BASE}/chat`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });

          const data = await resp.json();

          if (data.response) {
            setMessages((prev) => [
              ...prev,
              {
                role: "assistant",
                content: data.response,
                ts: Date.now(),
                model,
              },
            ]);
            setMsgCount((c) => c + 1);
          } else {
            setError(data.detail || "Unknown error");
          }
        }
      } catch (e) {
        setError(
          e.message || "Failed to connect to backend. Make sure FastAPI is running."
        );
      } finally {
        setLoading(false);
      }
    },
    [loading, activeSession, model, persona, stream]
  );

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const copyMsg = (text, idx) => {
    navigator.clipboard.writeText(text);
    setCopied(idx);
    setTimeout(() => setCopied(null), 1500);
  };

  const clearSession = async () => {
    if (!activeSession) return;
    setMessages([]);
    setMsgCount(0);
    try {
      await fetch(`${API_BASE}/session/${activeSession.id}`, {
        method: "DELETE",
      });
    } catch {}
  };

  const personaObj = PERSONAS.find((p) => p.id === persona);

  return (
    <>
      <style>{css}</style>
      <div className="app">
        <aside className="sidebar">
          <div className="logo">
            <div className="logo-icon">✦</div>
            <span className="logo-text">NexusAI</span>
            <span className="logo-badge">v2.0</span>
          </div>

          <span className="sidebar-label">Model</span>
          <select
            className="model-select"
            value={model}
            onChange={(e) => setModel(e.target.value)}
          >
            {MODELS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>

          <span className="sidebar-label">Persona</span>
          <select
            className="persona-select"
            value={persona}
            onChange={(e) => setPersona(e.target.value)}
          >
            {PERSONAS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>

          <button className="new-chat-btn" onClick={newSession}>
            <span>+</span> New Chat
          </button>

          <span className="sidebar-label">History</span>
          <div className="session-list">
            {sessions.map((s) => (
              <div
                key={s.id}
                className={`session-item ${
                  activeSession?.id === s.id ? "active" : ""
                }`}
                onClick={() => {
                  setActiveSession(s);
                  loadSession(s.id);
                }}
              >
                <span className="session-dot" />
                {s.label}
              </div>
            ))}
          </div>
        </aside>

        {/* MAIN AREA (unchanged from your original UI) */}
        {/* Keep the rest of your JSX exactly the same */}
      </div>
    </>
  );
}
