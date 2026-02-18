import { useState, useRef, useEffect, useCallback } from "react";
import "./App.css";
import ReactMarkdown from "react-markdown";

const API_BASE = "http://localhost:8000";

const MODELS = [
  { id: "gpt-4o", label: "GPT-4o" },
  { id: "gpt-4o-mini", label: "GPT-4o Mini" },
  { id: "gpt-3.5-turbo", label: "GPT-3.5 Turbo" },
];

const PERSONAS = [
  { id: "default", label: "🤖 Default Assistant", desc: "Helpful generalist" },
  { id: "coder",   label: "💻 Senior Engineer",   desc: "Code & technical depth" },
  { id: "creative",label: "✍️ Creative Writer",   desc: "Stories & imagination" },
  { id: "analyst", label: "📊 Data Analyst",      desc: "Data-driven insights" },
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

export default function ChatbotApp() {
  const [apiKey, setApiKey]         = useState("");
  const [showKey, setShowKey]       = useState(false);
  const [model, setModel]           = useState("gpt-4o-mini");
  const [persona, setPersona]       = useState("default");
  const [stream, setStream]         = useState(true);
  const [sessions, setSessions]     = useState([]);
  const [activeSession, setActiveSession] = useState(null);
  const [messages, setMessages]     = useState([]);
  const [input, setInput]           = useState("");
  const [loading, setLoading]       = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [error, setError]           = useState("");
  const [copied, setCopied]         = useState(null);
  const [msgCount, setMsgCount]     = useState(0);
  const messagesEnd = useRef(null);

  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingText]);

  const newSession = useCallback(() => {
    const sess = { id: `local-${Date.now()}`, label: `Chat ${sessions.length + 1}`, ts: Date.now() };
    setSessions(prev => [sess, ...prev]);
    setActiveSession(sess);
    setMessages([]);
    setMsgCount(0);
  }, [sessions.length]);

  useEffect(() => { newSession(); }, []);

  const sendMessage = useCallback(async (text) => {
    if (!text.trim() || loading) return;
    if (!apiKey) { setError("Please enter your OpenAI API key in the sidebar."); return; }
    setError("");
    setMessages(prev => [...prev, { role: "user", content: text, ts: Date.now() }]);
    setInput("");
    setLoading(true);
    setStreamingText("");
    setMsgCount(c => c + 1);

    try {
      const body = { message: text, session_id: activeSession?.id, model, persona, stream, api_key: apiKey };

      if (stream) {
        const resp = await fetch(`${API_BASE}/chat`, {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
        });
        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        let accumulated = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          for (const line of decoder.decode(value).split("\n").filter(l => l.startsWith("data: "))) {
            try {
              const json = JSON.parse(line.slice(6));
              if (json.delta) { accumulated += json.delta; setStreamingText(accumulated); }
              if (json.done) {
                setMessages(prev => [...prev, { role: "assistant", content: accumulated, ts: Date.now(), model }]);
                setStreamingText("");
                setMsgCount(c => c + 1);
              }
              if (json.error) setError(json.error);
            } catch {}
          }
        }
      } else {
        const resp = await fetch(`${API_BASE}/chat`, {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
        });
        const data = await resp.json();
        if (data.response) {
          setMessages(prev => [...prev, { role: "assistant", content: data.response, ts: Date.now(), model }]);
          setMsgCount(c => c + 1);
        } else { setError(data.detail || "Unknown error"); }
      }
    } catch (e) {
      setError(e.message || "Failed to connect to backend.");
    } finally { setLoading(false); }
  }, [loading, apiKey, activeSession, model, persona, stream]);

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input); }
  };

  const copyMsg = (text, idx) => {
    navigator.clipboard.writeText(text);
    setCopied(idx);
    setTimeout(() => setCopied(null), 1500);
  };

  const personaObj = PERSONAS.find(p => p.id === persona);

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="logo">
          <div className="logo-icon">✦</div>
          <span className="logo-text">NexusAI</span>
          <span className="logo-badge">v2.0</span>
        </div>

        <span className="sidebar-label">API Key</span>
        <div className="api-wrapper">
          <input className="api-input" type={showKey ? "text" : "password"} placeholder="sk-..."
            value={apiKey} onChange={e => setApiKey(e.target.value)} />
          <button className="api-toggle" onClick={() => setShowKey(s => !s)}>
            {showKey ? "🙈" : "👁"}
          </button>
        </div>

        <span className="sidebar-label">Model</span>
        <select className="model-select" value={model} onChange={e => setModel(e.target.value)}>
          {MODELS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
        </select>

        <span className="sidebar-label">Persona</span>
        <select className="persona-select" value={persona} onChange={e => setPersona(e.target.value)}>
          {PERSONAS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
        </select>

        <button className="new-chat-btn" onClick={newSession}>+ New Chat</button>

        <span className="sidebar-label">History</span>
        <div className="session-list">
          {sessions.map(s => (
            <div key={s.id} className={`session-item ${activeSession?.id === s.id ? "active" : ""}`}
              onClick={() => { setActiveSession(s); setMessages([]); }}>
              <span className="session-dot" />{s.label}
            </div>
          ))}
        </div>

        <div className="stats-bar">
          <div className="stat-row"><span>Messages</span><span className="stat-val">{msgCount}</span></div>
          <div className="stat-row"><span>Sessions</span><span className="stat-val">{sessions.length}</span></div>
          <div className="stat-row"><span>Model</span><span className="stat-val">{model}</span></div>
        </div>
      </aside>

      <main className="main">
        <div className="topbar">
          <div>
            <div className="topbar-title">{personaObj?.label}</div>
            <div className="topbar-sub">{personaObj?.desc} · {model}</div>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <button className="clear-btn" onClick={() => { setMessages([]); setMsgCount(0); }}>Clear</button>
            <div className="status-pill"><span className="status-dot" />Live</div>
          </div>
        </div>

        <div className="messages">
          {messages.length === 0 && !loading && (
            <div className="empty-state">
              <div className="empty-icon">✦</div>
              <div className="empty-title">Start a conversation</div>
              <div className="empty-sub">Ask anything — code, analysis, creative writing, or just chat.</div>
              <div className="quick-prompts">
                {QUICK_PROMPTS.map(q => (
                  <button key={q} className="quick-prompt" onClick={() => sendMessage(q)}>{q}</button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className={`msg-row ${msg.role === "user" ? "user" : ""}`}>
              <div className={`avatar ${msg.role === "user" ? "user-av" : "ai-av"}`}>
                {msg.role === "user" ? "U" : "✦"}
              </div>
              <div className={`bubble ${msg.role === "user" ? "user" : "ai"}`}>
                <ReactMarkdown>{msg.content}</ReactMarkdown>
                <div className="bubble-meta">
                  {msg.ts && <span>{formatTime(msg.ts)}</span>}
                  {msg.model && <span>· {msg.model}</span>}
                  {msg.role === "assistant" && (
                    <button className="copy-btn" onClick={() => copyMsg(msg.content, i)}>
                      {copied === i ? "✓ copied" : "copy"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}

          {(loading || streamingText) && (
            <div className="msg-row">
              <div className="avatar ai-av">✦</div>
              <div className="bubble ai">
                {streamingText
                  ? <><ReactMarkdown>{streamingText}</ReactMarkdown><span className="cursor">▋</span></>
                  : <div className="typing-indicator">
                      <span className="typing-dot"/><span className="typing-dot"/><span className="typing-dot"/>
                    </div>
                }
              </div>
            </div>
          )}
          <div ref={messagesEnd} />
        </div>

        <div className="input-area">
          {error && <div className="error-toast">⚠ {error}</div>}
          <div className="input-box">
            <textarea
              placeholder="Send a message… (Shift+Enter for newline)"
              value={input} rows={1}
              onChange={e => {
                setInput(e.target.value);
                e.target.style.height = "auto";
                e.target.style.height = Math.min(e.target.scrollHeight, 140) + "px";
              }}
              onKeyDown={handleKeyDown}
            />
            <button className="send-btn" onClick={() => sendMessage(input)} disabled={loading || !input.trim()}>
              {loading ? "⏳" : "↑"}
            </button>
          </div>
          <div className="input-footer">
            <span>Shift+Enter for newline · Enter to send</span>
            <label className="stream-toggle">
              <button className={`toggle ${stream ? "on" : ""}`} onClick={() => setStream(s => !s)} />
              Streaming {stream ? "on" : "off"}
            </label>
          </div>
        </div>
      </main>
    </div>
  );
}
