import os

base = os.path.expanduser("~/Downloads/files/frontend/src")
os.makedirs(base, exist_ok=True)

# ── App.jsx ──────────────────────────────────────────────────────────────────
app_jsx = '''import { useState, useRef, useEffect, useCallback } from "react";
import "./App.css";

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
  "Analyze Tesla\'s business model",
];

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function renderContent(text) {
  const parts = text.split(/(```[\\s\\S]*?```)/g);
  return parts.map((part, i) => {
    if (part.startsWith("```")) {
      const code = part.replace(/^```\\w*\\n?/, "").replace(/```$/, "");
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
          for (const line of decoder.decode(value).split("\\n").filter(l => l.startsWith("data: "))) {
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
                {renderContent(msg.content)}
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
                  ? <>{renderContent(streamingText)}<span className="cursor">▋</span></>
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
'''

# ── App.css ──────────────────────────────────────────────────────────────────
app_css = """@import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=DM+Mono:wght@300;400;500&display=swap');

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

:root {
  --bg: #0a0a0f; --surface: #111118; --panel: #16161f; --border: #22222f;
  --accent: #7c6af7; --accent2: #e87040; --accent3: #3dd68c;
  --text: #e8e8f0; --muted: #6b6b80; --user-bg: #1e1a3a; --ai-bg: #131320;
  --font: 'Syne', sans-serif; --mono: 'DM Mono', monospace;
}

body { font-family: var(--font); background: var(--bg); color: var(--text); height: 100vh; overflow: hidden; }

.app { display: grid; grid-template-columns: 280px 1fr; height: 100vh; }

.sidebar {
  background: var(--surface); border-right: 1px solid var(--border);
  display: flex; flex-direction: column; padding: 24px 16px; gap: 16px; overflow-y: auto;
}

.logo { display: flex; align-items: center; gap: 10px; padding: 0 8px 16px; border-bottom: 1px solid var(--border); }
.logo-icon {
  width: 36px; height: 36px; background: linear-gradient(135deg, var(--accent), var(--accent2));
  border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 18px;
}
.logo-text { font-size: 18px; font-weight: 700; letter-spacing: -0.5px; }
.logo-badge { font-size: 9px; font-family: var(--mono); background: var(--accent); padding: 2px 6px; border-radius: 4px; color: #fff; margin-left: auto; }

.sidebar-label { font-size: 10px; font-weight: 600; letter-spacing: 2px; text-transform: uppercase; color: var(--muted); padding: 0 8px; }

.model-select, .persona-select, .api-input {
  background: var(--panel); border: 1px solid var(--border); border-radius: 10px;
  color: var(--text); font-family: var(--font); font-size: 13px; padding: 10px 12px; width: 100%; outline: none; transition: border-color 0.2s;
}
.model-select:focus, .persona-select:focus, .api-input:focus { border-color: var(--accent); }
.api-input { font-family: var(--mono); font-size: 12px; }
.api-wrapper { position: relative; }
.api-toggle { position: absolute; right: 10px; top: 50%; transform: translateY(-50%); background: none; border: none; color: var(--muted); cursor: pointer; font-size: 14px; }

.new-chat-btn {
  background: linear-gradient(135deg, var(--accent), #5a4fd4); border: none; border-radius: 10px;
  color: #fff; font-family: var(--font); font-size: 13px; font-weight: 600; padding: 11px; cursor: pointer; transition: opacity 0.2s, transform 0.1s;
}
.new-chat-btn:hover { opacity: 0.9; transform: translateY(-1px); }

.session-list { display: flex; flex-direction: column; gap: 4px; flex: 1; }
.session-item { padding: 9px 12px; border-radius: 8px; cursor: pointer; font-size: 12px; color: var(--muted); transition: all 0.15s; border: 1px solid transparent; display: flex; align-items: center; gap: 8px; }
.session-item:hover { background: var(--panel); color: var(--text); }
.session-item.active { background: var(--panel); border-color: var(--border); color: var(--text); font-weight: 600; }
.session-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--accent); flex-shrink: 0; }

.stats-bar { margin-top: auto; background: var(--panel); border: 1px solid var(--border); border-radius: 10px; padding: 12px; font-family: var(--mono); font-size: 10px; color: var(--muted); display: flex; flex-direction: column; gap: 4px; }
.stat-row { display: flex; justify-content: space-between; }
.stat-val { color: var(--accent3); }

.main { display: flex; flex-direction: column; height: 100vh; overflow: hidden; }

.topbar { background: var(--surface); border-bottom: 1px solid var(--border); padding: 16px 28px; display: flex; align-items: center; justify-content: space-between; flex-shrink: 0; }
.topbar-title { font-size: 16px; font-weight: 700; }
.topbar-sub { font-size: 11px; color: var(--muted); font-family: var(--mono); margin-top: 2px; }

.clear-btn { background: none; border: 1px solid var(--border); border-radius: 8px; color: var(--muted); padding: 6px 12px; cursor: pointer; font-size: 12px; font-family: var(--font); }
.clear-btn:hover { color: var(--text); }

.status-pill { display: flex; align-items: center; gap: 6px; background: var(--panel); border: 1px solid var(--border); border-radius: 20px; padding: 5px 12px; font-size: 11px; font-family: var(--mono); }
.status-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--accent3); box-shadow: 0 0 8px var(--accent3); animation: pulse 2s infinite; }
@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }

.messages { flex: 1; overflow-y: auto; padding: 28px; display: flex; flex-direction: column; gap: 20px; scroll-behavior: smooth; }
.messages::-webkit-scrollbar { width: 4px; }
.messages::-webkit-scrollbar-thumb { background: var(--border); border-radius: 2px; }

.empty-state { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 16px; text-align: center; color: var(--muted); padding: 40px; }
.empty-icon { width: 80px; height: 80px; background: linear-gradient(135deg, var(--accent), var(--accent2)); border-radius: 24px; display: flex; align-items: center; justify-content: center; font-size: 36px; box-shadow: 0 20px 60px rgba(124,106,247,0.4); }
.empty-title { font-size: 22px; font-weight: 700; color: var(--text); }
.empty-sub { font-size: 13px; max-width: 320px; line-height: 1.6; }

.quick-prompts { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; margin-top: 8px; }
.quick-prompt { background: var(--panel); border: 1px solid var(--border); border-radius: 20px; padding: 7px 14px; font-size: 12px; cursor: pointer; color: var(--text); font-family: var(--font); transition: all 0.2s; }
.quick-prompt:hover { border-color: var(--accent); color: var(--accent); transform: translateY(-1px); }

.msg-row { display: flex; gap: 12px; animation: fadeSlide 0.3s ease; }
@keyframes fadeSlide { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
.msg-row.user { flex-direction: row-reverse; }

.avatar { width: 34px; height: 34px; border-radius: 10px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; font-size: 16px; font-weight: 700; }
.avatar.user-av { background: linear-gradient(135deg, var(--accent2), #c4522a); font-size: 13px; }
.avatar.ai-av { background: linear-gradient(135deg, var(--accent), #5a4fd4); }

.bubble { max-width: 68%; padding: 14px 18px; border-radius: 16px; font-size: 14px; line-height: 1.65; }
.bubble.user { background: var(--user-bg); border: 1px solid rgba(124,106,247,0.25); border-top-right-radius: 4px; }
.bubble.ai { background: var(--ai-bg); border: 1px solid var(--border); border-top-left-radius: 4px; }

.bubble-meta { font-size: 10px; color: var(--muted); font-family: var(--mono); margin-top: 6px; display: flex; align-items: center; gap: 8px; }
.bubble pre { background: #0d0d1a; border: 1px solid var(--border); border-radius: 8px; padding: 12px; margin: 8px 0; overflow-x: auto; font-family: var(--mono); font-size: 12px; }
.bubble code { font-family: var(--mono); font-size: 12px; background: rgba(124,106,247,0.15); padding: 2px 5px; border-radius: 4px; }

.copy-btn { background: none; border: none; cursor: pointer; color: var(--muted); font-size: 11px; font-family: var(--mono); padding: 2px 6px; border-radius: 4px; }
.copy-btn:hover { color: var(--accent); background: rgba(124,106,247,0.1); }

.cursor { opacity: 0.7; animation: pulse 1s infinite; }

.typing-indicator { display: flex; gap: 4px; align-items: center; padding: 4px 0; }
.typing-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--accent); animation: typingBounce 1.2s infinite; }
.typing-dot:nth-child(2) { animation-delay: 0.2s; }
.typing-dot:nth-child(3) { animation-delay: 0.4s; }
@keyframes typingBounce { 0%, 60%, 100% { transform: translateY(0); opacity: 0.4; } 30% { transform: translateY(-6px); opacity: 1; } }

.input-area { padding: 20px 28px 24px; background: var(--surface); border-top: 1px solid var(--border); flex-shrink: 0; }
.input-box { background: var(--panel); border: 1px solid var(--border); border-radius: 14px; display: flex; align-items: flex-end; gap: 10px; padding: 12px 14px; transition: border-color 0.2s; }
.input-box:focus-within { border-color: var(--accent); }
.input-box textarea { flex: 1; background: none; border: none; outline: none; color: var(--text); font-family: var(--font); font-size: 14px; resize: none; min-height: 22px; max-height: 140px; line-height: 1.5; padding: 0; }
.input-box textarea::placeholder { color: var(--muted); }

.send-btn { background: linear-gradient(135deg, var(--accent), #5a4fd4); border: none; border-radius: 9px; width: 36px; height: 36px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s; color: #fff; font-size: 16px; }
.send-btn:hover { transform: scale(1.05); opacity: 0.9; }
.send-btn:disabled { opacity: 0.4; cursor: not-allowed; transform: none; }

.input-footer { display: flex; justify-content: space-between; align-items: center; margin-top: 10px; font-size: 11px; font-family: var(--mono); color: var(--muted); }
.stream-toggle { display: flex; align-items: center; gap: 6px; cursor: pointer; }
.toggle { width: 30px; height: 16px; background: var(--border); border-radius: 8px; position: relative; cursor: pointer; border: none; transition: background 0.2s; }
.toggle.on { background: var(--accent); }
.toggle::after { content: ''; position: absolute; top: 2px; left: 2px; width: 12px; height: 12px; background: #fff; border-radius: 50%; transition: transform 0.2s; }
.toggle.on::after { transform: translateX(14px); }

.error-toast { background: rgba(220,60,60,0.15); border: 1px solid rgba(220,60,60,0.4); border-radius: 8px; padding: 10px 14px; font-size: 12px; color: #ff8080; font-family: var(--mono); margin-bottom: 10px; }

@media (max-width: 700px) { .app { grid-template-columns: 1fr; } .sidebar { display: none; } }
"""

with open(os.path.join(base, "App.jsx"), "w") as f:
    f.write(app_jsx)

with open(os.path.join(base, "App.css"), "w") as f:
    f.write(app_css)

print("✅ Done! Both files written successfully.")
print(f"   → {base}/App.jsx")
print(f"   → {base}/App.css")
