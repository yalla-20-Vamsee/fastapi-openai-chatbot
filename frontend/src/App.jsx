import { useState, useRef, useEffect, useCallback } from "react";
import "./App.css";
import ReactMarkdown from "react-markdown";
import { supabase } from "./supabase";

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
  "Analyze Tesla business model",
];

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// ── Auth Page ────────────────────────────────────────────────────────────────
function AuthPage({ onAuth }) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const handleSubmit = async () => {
    setError(""); setMessage(""); setLoading(true);
    try {
      if (isLogin) {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        onAuth(data.user);
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setMessage("Account created! Please check your email to confirm, then log in.");
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <div className="logo-icon">✦</div>
          <span className="logo-text">NexusAI</span>
          <span className="logo-badge">v3.0</span>
        </div>
        <h2 className="auth-title">{isLogin ? "Welcome back" : "Create account"}</h2>
        <p className="auth-sub">{isLogin ? "Sign in to your account" : "Sign up for free"}</p>

        {error && <div className="error-toast">⚠ {error}</div>}
        {message && <div className="success-toast">✅ {message}</div>}

        <input className="auth-input" type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
        <input className="auth-input" type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleSubmit()} />

        <button className="auth-btn" onClick={handleSubmit} disabled={loading}>
          {loading ? "Please wait..." : isLogin ? "Sign In" : "Sign Up"}
        </button>

        <p className="auth-switch">
          {isLogin ? "Don\'t have an account?" : "Already have an account?"}
          <button onClick={() => { setIsLogin(s => !s); setError(""); setMessage(""); }}>
            {isLogin ? " Sign Up" : " Sign In"}
          </button>
        </p>
      </div>
    </div>
  );
}

// ── Main App ─────────────────────────────────────────────────────────────────
export default function ChatbotApp() {
  const [user, setUser]             = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
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
  const [documents, setDocuments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);
  const messagesEnd = useRef(null);

  // Check existing session on load
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setAuthLoading(false);
    });
    supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
  }, []);

  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingText]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSessions([]);
    setMessages([]);
    setActiveSession(null);
  };

  const newSession = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const res = await fetch(`${API_BASE}/session/new?persona=${persona}&model=${model}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
      });
      const data = await res.json();
      const sess = { id: data.session_id, label: `Chat ${sessions.length + 1}`, ts: Date.now() };
      setSessions(prev => [sess, ...prev]);
      setActiveSession(sess);
      setMessages([]);
      setMsgCount(0);
    } catch {
      const sess = { id: crypto.randomUUID(), label: `Chat ${sessions.length + 1}`, ts: Date.now() };
      setSessions(prev => [sess, ...prev]);
      setActiveSession(sess);
      setMessages([]);
      setMsgCount(0);
    }
  }, [sessions.length, persona, model]);

  useEffect(() => {
    if (!user) return;
    fetch(`${API_BASE}/sessions`)
      .then(r => r.json())
      .then(data => {
        if (data.sessions && data.sessions.length > 0) {
          const loaded = data.sessions.map((s, i) => ({
            id: s.id,
            label: s.label || `Chat ${i + 1}`,
            ts: new Date(s.created_at).getTime()
          }));
          setSessions(loaded);
          setActiveSession(loaded[0]);
          fetch(`${API_BASE}/session/${loaded[0].id}/history`)
            .then(r => r.json())
            .then(d => setMessages((d.messages || []).map(m => ({
              role: m.role, content: m.content,
              ts: new Date(m.created_at).getTime(), model: m.model
            }))));
          fetch(`${API_BASE}/documents/${loaded[0].id}`)
            .then(r => r.json())
            .then(d => setDocuments(d.documents || []));
        } else {
          newSession();
        }
      })
      .catch(() => newSession());
  }, [user]);

  const sendMessage = useCallback(async (text) => {
    if (!text.trim() || loading) return;
    if (!apiKey) { setError("Please enter your OpenAI API key in the sidebar."); return; }
    setError("");
    setMessages(prev => [...prev, { role: "user", content: text, ts: Date.now() }]);
    // Auto-rename session on first message
    const isFirstMessage = messages.length === 0;
    setInput("");
    setLoading(true);
    setStreamingText("");
    setMsgCount(c => c + 1);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const body = { message: text, session_id: activeSession?.id, model, persona, stream, api_key: apiKey };

      if (stream) {
        const resp = await fetch(`${API_BASE}/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
          body: JSON.stringify(body),
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
                if (isFirstMessage && activeSession?.id) {
                  fetch(`${API_BASE}/session/${activeSession.id}/rename?api_key=${encodeURIComponent(apiKey)}&message=${encodeURIComponent(text)}`, { method: "POST" })
                    .then(r => r.json())
                    .then(d => {
                      if (d.title) {
                        setSessions(prev => prev.map(s => s.id === activeSession.id ? { ...s, label: d.title } : s));
                      }
                    });
                }
              }
              if (json.error) setError(json.error);
            } catch {}
          }
        }
      } else {
        const resp = await fetch(`${API_BASE}/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
          body: JSON.stringify(body),
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

  const uploadFile = async (file) => {
    if (!activeSession) { setError("Start a session first."); return; }
    if (!apiKey) { setError("Enter your API key first."); return; }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("session_id", activeSession.id);
      formData.append("api_key", apiKey);
      const resp = await fetch(`${API_BASE}/upload`, { method: "POST", body: formData });
      const data = await resp.json();
      if (data.success) {
        setDocuments(prev => [...prev, { filename: data.filename, chars: data.chars }]);
        setError("");
      } else { setError(data.detail || "Upload failed"); }
    } catch (e) { setError(e.message); }
    finally { setUploading(false); }
  };

  const deleteSession = async (e, sessionId) => {
    e.stopPropagation();
    try {
      await fetch(`${API_BASE}/session/${sessionId}`, { method: "DELETE" });
      setSessions(prev => prev.filter(s => s.id !== sessionId));
      if (activeSession?.id === sessionId) {
        setMessages([]);
        setDocuments([]);
        setActiveSession(null);
        const remaining = sessions.filter(s => s.id !== sessionId);
        if (remaining.length > 0) {
          setActiveSession(remaining[0]);
          const res = await fetch(`${API_BASE}/session/${remaining[0].id}/history`);
          const data = await res.json();
          setMessages((data.messages || []).map(m => ({
            role: m.role, content: m.content,
            ts: new Date(m.created_at).getTime(), model: m.model
          })));
        } else {
          newSession();
        }
      }
    } catch (e) { setError(e.message); }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input); }
  };

  const copyMsg = (text, idx) => {
    navigator.clipboard.writeText(text);
    setCopied(idx);
    setTimeout(() => setCopied(null), 1500);
  };

  const personaObj = PERSONAS.find(p => p.id === persona);

  if (authLoading) return <div className="auth-loading">✦ Loading...</div>;
  if (!user) return <AuthPage onAuth={setUser} />;

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="logo">
          <div className="logo-icon">✦</div>
          <span className="logo-text">NexusAI</span>
          <span className="logo-badge">v3.0</span>
        </div>

        <div className="user-info">
          <span className="user-email">👤 {user.email}</span>
          <button className="logout-btn" onClick={handleLogout}>Logout</button>
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
              onClick={async () => {
                setActiveSession(s);
                setMessages([]);
                setDocuments([]);
                try {
                  const res = await fetch(`${API_BASE}/session/${s.id}/history`);
                  const data = await res.json();
                  setMessages(data.messages.map(m => ({
                    role: m.role,
                    content: m.content,
                    ts: new Date(m.created_at).getTime(),
                    model: m.model
                  })));
                  const docsRes = await fetch(`${API_BASE}/documents/${s.id}`);
                  const docsData = await docsRes.json();
                  setDocuments(docsData.documents || []);
                } catch {}
              }}>
              <span className="session-dot" />{s.label}
              <button className="session-delete" onClick={(e) => deleteSession(e, s.id)}>✕</button>
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
          {documents.length > 0 && (
            <div className="doc-chips">
              {documents.map((d, i) => (
                <div key={i} className="doc-chip">📄 {d.filename}</div>
              ))}
            </div>
          )}
          <div className="input-box">
            <input ref={fileInputRef} type="file" accept=".pdf,.txt" style={{display:"none"}}
              onChange={e => e.target.files[0] && uploadFile(e.target.files[0])} />
            <button className="attach-btn" onClick={() => fileInputRef.current.click()} disabled={uploading} title="Upload PDF or TXT">
              {uploading ? "⏳" : "📎"}
            </button>
            <textarea placeholder="Send a message… (Shift+Enter for newline)"
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
