import { useState, useRef, useEffect, useCallback } from "react";

// ─── Configuration ──────────────────────────────────────────────────────────
const API_BASE = "http://localhost:8000";

const MODELS = [
  { id: "default", label: "⚡ Haiku (Fast)", desc: "Cost-effective, real-time" },
  { id: "reasoning", label: "🧠 Sonnet (Reasoning)", desc: "Deep analysis, structured output" },
];

const PERSONAS = [
  { id: "default", label: "🤖 NexusAI", desc: "General-purpose assistant" },
  { id: "reasoning", label: "🧠 Analyst", desc: "Complex reasoning" },
  { id: "coder", label: "💻 Engineer", desc: "Code & technical" },
  { id: "creative", label: "✍️ Creator", desc: "Storytelling & art" },
  { id: "analyst", label: "📊 Strategist", desc: "Data-driven insights" },
];

const QUICK_PROMPTS = [
  "Explain quantum computing with RAG context",
  "Analyze uploaded document for insights",
  "Generate production-ready code",
  "Reason through a complex problem",
];

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function renderMarkdown(text) {
  // Simple markdown rendering
  const parts = text.split(/(```[\s\S]*?```)/g);
  return parts.map((part, i) => {
    if (part.startsWith(""")) {
      const code = part.replace(/^```(\w*\n?)?/, "").replace(/```$/, "");
      const lang = part.match(/^```(\w+)?/)?.[1] || "text";
      return (
        <pre key={i} className="code-block">
          <code>{code}</code>
        </pre>
      );
    }
    
    const inline = part.split(/(`[^`]+`|\*\*[^*]+\*\*|__[^_]+__|_[^_]+_)/g);
    return (
      <span key={i}>
        {inline.map((s, j) =>
          s.startsWith(""") && s.endsWith(""") ? (
            <code key={j}>{s.slice(1, -1)}</code>
          ) : s.startsWith("**") || s.startsWith("__") ? (
            <strong key={j}>{s.slice(2, -2)}</strong>
          ) : s.startsWith("_") && !s.startsWith("__") ? (
            <em key={j}>{s.slice(1, -1)}</em>
          ) : (
            s
          )
        )}
      </span>
    );
  });
}

// ─── CSS Styles ─────────────────────────────────────────────────────────────

const css = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif;
    background: #0f0f0f;
    color: #e0e0e0;
    line-height: 1.6;
  }
  
  .app {
    display: flex;
    height: 100vh;
    background: linear-gradient(135deg, #0f0f0f 0%, #1a1a2e 100%);
  }
  
  /* Sidebar */
  .sidebar {
    width: 280px;
    background: rgba(20, 20, 35, 0.95);
    border-right: 1px solid rgba(100, 100, 150, 0.2);
    display: flex;
    flex-direction: column;
    padding: 20px;
    overflow-y: auto;
    gap: 20px;
  }
  
  .logo {
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: bold;
    font-size: 18px;
    background: linear-gradient(135deg, #7c6af7 0%, #6a5aec 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
  
  .logo-icon { font-size: 24px; }
  .logo-badge { font-size: 10px; opacity: 0.6; }
  
  .sidebar-label {
    font-size: 12px;
    font-weight: 600;
    color: #7c6af7;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-top: 12px;
  }
  
  select {
    width: 100%;
    padding: 10px 12px;
    background: rgba(60, 60, 100, 0.3);
    border: 1px solid rgba(100, 100, 150, 0.3);
    border-radius: 6px;
    color: #e0e0e0;
    font-size: 14px;
    cursor: pointer;
    transition: all 0.2s;
  }
  
  select:hover { border-color: rgba(124, 106, 247, 0.5); }
  select:focus { outline: none; border-color: #7c6af7; }
  
  .new-chat-btn {
    width: 100%;
    padding: 12px;
    background: linear-gradient(135deg, #7c6af7 0%, #6a5aec 100%);
    border: none;
    border-radius: 6px;
    color: white;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
  }
  
  .new-chat-btn:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(124, 106, 247, 0.3); }
  
  .session-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    max-height: 400px;
    overflow-y: auto;
  }
  
  .session-item {
    padding: 10px 12px;
    background: rgba(60, 60, 100, 0.2);
    border: 1px solid rgba(100, 100, 150, 0.2);
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    gap: 8px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  
  .session-item:hover { background: rgba(60, 60, 100, 0.4); }
  .session-item.active {
    background: rgba(124, 106, 247, 0.2);
    border-color: #7c6af7;
  }
  
  .session-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #7c6af7;
    flex-shrink: 0;
  }
  
  /* Main Chat Area */
  .chat-container {
    flex: 1;
    display: flex;
    flex-direction: column;
    background: #0f0f0f;
  }
  
  .messages-area {
    flex: 1;
    overflow-y: auto;
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  
  .message {
    display: flex;
    gap: 12px;
    animation: slideIn 0.3s ease;
  }
  
  @keyframes slideIn {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
  }
  
  .message.user { justify-content: flex-end; }
  .message.assistant { justify-content: flex-start; }
  
  .message-bubble {
    max-width: 70%;
    padding: 12px 16px;
    border-radius: 12px;
    word-wrap: break-word;
    line-height: 1.5;
  }
  
  .message.user .message-bubble {
    background: linear-gradient(135deg, #7c6af7 0%, #6a5aec 100%);
    color: white;
    border-radius: 12px 4px 12px 12px;
  }
  
  .message.assistant .message-bubble {
    background: rgba(60, 60, 100, 0.4);
    border: 1px solid rgba(100, 100, 150, 0.3);
    border-radius: 4px 12px 12px 12px;
    color: #e0e0e0;
  }
  
  .message-time { font-size: 11px; opacity: 0.5; margin-top: 4px; }
  
  .code-block {
    background: rgba(20, 20, 35, 0.8);
    border-left: 3px solid #7c6af7;
    padding: 12px;
    border-radius: 4px;
    overflow-x: auto;
    margin: 8px 0;
    font-size: 13px;
  }
  
  code { font-family: "Courier New", monospace; }
  
  /* Input Area */
  .input-area {
    padding: 16px 20px;
    border-top: 1px solid rgba(100, 100, 150, 0.2);
    background: rgba(20, 20, 35, 0.8);
    display: flex;
    gap: 12px;
  }
  
  .input-wrapper {
    flex: 1;
    display: flex;
    gap: 8px;
    align-items: flex-end;
  }
  
  textarea {
    flex: 1;
    padding: 10px 12px;
    background: rgba(60, 60, 100, 0.3);
    border: 1px solid rgba(100, 100, 150, 0.3);
    border-radius: 6px;
    color: #e0e0e0;
    font-family: inherit;
    font-size: 14px;
    resize: none;
    max-height: 120px;
    transition: all 0.2s;
  }
  
  textarea:focus {
    outline: none;
    border-color: #7c6af7;
    background: rgba(60, 60, 100, 0.5);
  }
  
  .send-btn, .file-btn {
    padding: 10px 16px;
    background: linear-gradient(135deg, #7c6af7 0%, #6a5aec 100%);
    border: none;
    border-radius: 6px;
    color: white;
    cursor: pointer;
    font-weight: 600;
    transition: all 0.2s;
    flex-shrink: 0;
  }
  
  .send-btn:hover, .file-btn:hover { transform: translateY(-2px); }
  .send-btn:disabled { opacity: 0.5; cursor: not-allowed; }
  
  .file-btn { padding: 10px 12px; }
  
  #file-input { display: none; }
  
  .input-footer {
    display: flex;
    gap: 8px;
    font-size: 12px;
    color: #999;
    margin-top: 8px;
    align-items: center;
  }
  
  .toggle {
    display: flex;
    align-items: center;
    gap: 6px;
    cursor: pointer;
  }
  
  .toggle input {
    width: 14px;
    height: 14px;
    cursor: pointer;
  }
  
  /* Scrollbar */
  ::-webkit-scrollbar {
    width: 6px;
  }
  
  ::-webkit-scrollbar-track {
    background: rgba(60, 60, 100, 0.1);
  }
  
  ::-webkit-scrollbar-thumb {
    background: rgba(124, 106, 247, 0.3);
    border-radius: 3px;
  }
  
  ::-webkit-scrollbar-thumb:hover {
    background: rgba(124, 106, 247, 0.5);
  }
  
  /* Responsive */
  @media (max-width: 768px) {
    .app { flex-direction: column; }
    .sidebar { width: 100%; max-height: 150px; }
    .message-bubble { max-width: 90%; }
  }
`;

// ─── Main Component ─────────────────────────────────────────────────────────

export default function NexusAI() {
  const [model, setModel] = useState("default");
  const [persona, setPersona] = useState("default");
  const [sessions, setSessions] = useState([]);
  const [activeSession, setActiveSession] = useState(null);
  const [messages, setMessages] = useState([]);
  
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState("");
  const [error, setError] = useState("");
  const [useRAG, setUseRAG] = useState(true);
  
  const messagesEnd = useRef(null);
  const fileInputRef = useRef(null);
  
  // Auto-scroll
  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streaming]);
  
  // Initialize session
  useEffect(() => {
    createSession();
  }, []);
  
  const createSession = useCallback(async () => {
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
    } catch (e) {
      setError("Failed to create session");
    }
  }, [sessions.length, persona]);
  
  const loadSession = async (sid) => {
    try {
      const res = await fetch(`${API_BASE}/session/${sid}/history`);
      const data = await res.json();
      setMessages(data.messages || []);
    } catch {
      setMessages([]);
    }
  };
  
  const sendMessage = useCallback(
    async (text) => {
      if (!text.trim() || loading) return;
      
      setError("");
      setMessages((prev) => [...prev, { role: "user", content: text }]);
      setInput("");
      setLoading(true);
      setStreaming("");
      
      try {
        const body = {
          message: text,
          session_id: activeSession?.id,
          persona,
          stream: true,
          use_rag: useRAG,
        };
        
        const resp = await fetch(`${API_BASE}/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        
        if (!resp.body) throw new Error("No response body");
        
        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        let accumulated = "";
        
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split("\n").filter((l) => l.startsWith("data: "));
          
          for (const line of lines) {
            try {
              const json = JSON.parse(line.slice(6));
              if (json.delta) {
                accumulated += json.delta;
                setStreaming(accumulated);
              }
              if (json.done) {
                setMessages((prev) => [
                  ...prev,
                  { role: "assistant", content: accumulated },
                ]);
                setStreaming("");
              }
            } catch {}
          }
        }
      } catch (e) {
        setError(e.message || "Connection failed");
      } finally {
        setLoading(false);
      }
    },
    [loading, activeSession, persona, useRAG]
  );
  
  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };
  
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !activeSession) return;
    
    const formData = new FormData();
    formData.append("file", file);
    formData.append("session_id", activeSession.id);
    
    try {
      const res = await fetch(`${API_BASE}/upload`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      setMessages((prev) => [
        ...prev,
        {
          role: "system",
          content: `📄 Uploaded: ${data.filename} (${data.size} chars indexed)`,
        },
      ]);
    } catch (e) {
      setError("Upload failed");
    }
    
    fileInputRef.current.value = "";
  };
  
  const clearSession = async () => {
    if (!activeSession) return;
    try {
      await fetch(`${API_BASE}/session/${activeSession.id}`, { method: "DELETE" });
      setSessions((prev) => prev.filter((s) => s.id !== activeSession.id));
      setMessages([]);
      createSession();
    } catch {
      setError("Failed to clear session");
    }
  };
  
  const displayMessages = [
    ...messages,
    ...(streaming ? [{ role: "assistant", content: streaming, streaming: true }] : []),
  ];
  
  return (
    <>
      <style>{css}</style>
      <div className="app">
        <aside className="sidebar">
          <div className="logo">
            <div className="logo-icon">⚡</div>
            <span className="logo-text">NexusAI</span>
            <span className="logo-badge">v5.0</span>
          </div>
          
          <div>
            <span className="sidebar-label">Model</span>
            <select value={model} onChange={(e) => setModel(e.target.value)}>
              {MODELS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
          
          <div>
            <span className="sidebar-label">Persona</span>
            <select value={persona} onChange={(e) => setPersona(e.target.value)}>
              {PERSONAS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
          
          <button className="new-chat-btn" onClick={createSession}>
            <span>+</span> New Chat
          </button>
          
          <div>
            <span className="sidebar-label">Session History</span>
            <div className="session-list">
              {sessions.map((s) => (
                <div
                  key={s.id}
                  className={`session-item ${activeSession?.id === s.id ? "active" : ""}`}
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
          </div>
        </aside>
        
        <div className="chat-container">
          <div className="messages-area">
            {displayMessages.length === 0 ? (
              <div style={{ textAlign: "center", opacity: 0.5, marginTop: "20%" }}>
                <div style={{ fontSize: "40px", marginBottom: "10px" }}>⚡</div>
                <div>Start a conversation or upload documents for RAG analysis</div>
              </div>
            ) : (
              displayMessages.map((msg, i) => (
                <div key={i} className={`message ${msg.role}`}>
                  <div>
                    <div className="message-bubble">
                      {msg.role === "system" ? (
                        msg.content
                      ) : (
                        renderMarkdown(msg.content)
                      )}
                    </div>
                    <div className="message-time">{formatTime(msg.ts || Date.now())}</div>
                  </div>
                </div>
              ))
            )}
            <div ref={messagesEnd} />
          </div>
          
          {error && (
            <div style={{ padding: "10px 20px", background: "rgba(200, 50, 50, 0.2)", color: "#ff6b6b" }}>
              {error}
            </div>
          )}
          
          <div className="input-area">
            <input type="file" ref={fileInputRef} onChange={handleFileUpload} id="file-input" />
            <div className="input-wrapper">
              <button
                className="file-btn"
                onClick={() => fileInputRef.current?.click()}
                title="Upload PDF or TXT"
              >
                📎
              </button>
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type your message (Shift+Enter for new line)..."
                disabled={loading}
                rows="1"
              />
              <button
                className="send-btn"
                onClick={() => sendMessage(input)}
                disabled={loading || !input.trim()}
              >
                {loading ? "..." : "Send"}
              </button>
            </div>
          </div>
          
          <div className="input-footer">
            <label className="toggle">
              <input
                type="checkbox"
                checked={useRAG}
                onChange={(e) => setUseRAG(e.target.checked)}
              />
              Use RAG
            </label>
            <button
              onClick={clearSession}
              style={{
                marginLeft: "auto",
                padding: "4px 8px",
                background: "rgba(200, 50, 50, 0.2)",
                border: "1px solid rgba(200, 50, 50, 0.4)",
                borderRadius: "4px",
                color: "#ff6b6b",
                cursor: "pointer",
                fontSize: "12px",
              }}
            >
              Clear
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
