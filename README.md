
# NexusAI v5.0 — Production Agentic AI System

**Multi-agent system powered by Anthropic SDK with tool use, RAG, and streaming backend**

![NexusAI](https://img.shields.io/badge/NexusAI-v5.0--agentic-7c6af7?style=for-the-badge)
![Anthropic](https://img.shields.io/badge/Anthropic-Claude%203.5-000000?style=for-the-badge)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?style=for-the-badge&logo=fastapi)
![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react)
![FAISS](https://img.shields.io/badge/FAISS-RAG-5F9EA0?style=for-the-badge)

---

## ✨ Key Features

### Agentic Intelligence
- 🤖 **Multi-Agent Orchestration** — Haiku for synthesis / Sonnet for reasoning
- 🔧 **Tool Use & Function Calling** — Agents can retrieve documents, save memory, reason
- 🔄 **ReAct Loop** — Reason → Act → Observe pattern for multi-step problem solving
- 💭 **Structured Output** — Anthropic structured output for deterministic responses

### RAG & Knowledge
- 📚 **FAISS Vector Search** — Semantic retrieval over 1M+ document chunks
- 🧠 **Configurable Retrieval** — Adjust chunk size, overlap, and top-k dynamically
- 📄 **Multi-Format Support** — PDF and TXT file uploads with automatic indexing
- 🔍 **Context Window Optimization** — Pre-fetch and cache patterns for efficiency

### Production Ready
- ⚡ **Real-Time Streaming** — Server-Sent Events (SSE) for live responses
- 🔐 **Session Management** — Persistent chat history in Supabase PostgreSQL
- 🎭 **5 AI Personas** — Default, Reasoning, Coder, Creative, Analyst
- 📈 **Cost Optimization** — Dynamic model selection (Haiku/Sonnet split)

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    React Frontend                        │
│  • Streaming SSE client with markdown rendering         │
│  • RAG toggle, persona selection, document upload       │
│  • Session management UI                                 │
└────────────────┬────────────────────────────────────────┘
                 │ HTTP + SSE
┌────────────────▼────────────────────────────────────────┐
│             FastAPI Backend (Agentic)                   │
├─────────────────────────────────────────────────────────┤
│  Multi-Agent System (LangGraph):                        │
│  • ReAct Loop with Tool Use                             │
│  • Claude 3.5 Haiku (fast synthesis)                    │
│  • Claude 3.5 Sonnet (deep reasoning)                   │
├─────────────────────────────────────────────────────────┤
│  RAG Pipeline (FAISS + LangChain):                      │
│  • Semantic indexing                                    │
│  • Similarity search over document embeddings           │
│  • Context augmentation                                 │
├─────────────────────────────────────────────────────────┤
│  Memory & Persistence:                                  │
│  • Supabase PostgreSQL (sessions, messages, docs)       │
│  • pgvector for fast similarity                         │
│  • Session memory for facts & context                   │
└────────────────┬────────────────────────────────────────┘
                 │ SQL
┌────────────────▼────────────────────────────────────────┐
│         Supabase (PostgreSQL + Auth)                    │
│  • Sessions, Messages, Documents                        │
│  • Session Memory (facts, context)                      │
└─────────────────────────────────────────────────────────┘
```

---

## 🚀 Quick Start

### Prerequisites
- Python 3.11+
- Node.js 18+
- Anthropic API key
- Supabase account

### 1. Clone & Setup
```bash
git clone https://github.com/yalla-20-Vamsee/fastapi-openai-chatbot.git
cd fastapi-openai-chatbot
```

### 2. Backend Setup
```bash
# Create venv
python3.11 -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Create .env
cat > .env << EOF
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-anon-public-key
ANTHROPIC_API_KEY=sk-ant-...
EOF

# Start backend
python -m uvicorn main:app --port 8000
```

### 3. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

Visit **http://localhost:5173**

### 4. Supabase Schema
Run in Supabase SQL Editor:

```sql
-- Sessions
CREATE TABLE sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  persona TEXT DEFAULT 'default',
  created_at TIMESTAMP DEFAULT now()
);

-- Messages
CREATE TABLE messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT now()
);

-- Documents (for RAG)
CREATE TABLE documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT now()
);

-- Session Memory
CREATE TABLE session_memory (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT now()
);

ALTER TABLE sessions DISABLE ROW LEVEL SECURITY;
ALTER TABLE messages DISABLE ROW LEVEL SECURITY;
ALTER TABLE documents DISABLE ROW LEVEL SECURITY;
ALTER TABLE session_memory DISABLE ROW LEVEL SECURITY;
```

---

## 📖 How to Use

### Basic Chat
1. Select a **Model**: Haiku (fast) or Sonnet (reasoning)
2. Choose a **Persona**: Default, Coder, Creative, Analyst, Reasoning
3. Type your message and press **Enter** (Shift+Enter for newline)

### Upload Documents (RAG)
1. Click the **📎 paperclip icon**
2. Upload PDF or TXT file
3. Enable **Use RAG toggle** (default on)
4. Ask questions — agent retrieves relevant context automatically

### Agent Features
- **Tool Use**: Agents can retrieve documents with semantic search
- **Memory**: Save facts to session memory for later use
- **Reasoning**: Use Sonnet persona for complex multi-step problems
- **Streaming**: Watch responses generate in real-time

### Example Prompts
```
"Analyze this document for key insights"
"Generate production-ready code for a REST API"
"Reason through the implications of quantum computing"
"Create a detailed marketing strategy"
```

---

## 🛠️ API Reference

### `/chat` (POST) — Stream Agentic Response
```json
{
  "message": "string",
  "session_id": "uuid (optional)",
  "persona": "default|reasoning|coder|creative|analyst",
  "stream": true,
  "use_reasoning": false,
  "use_rag": true
}
```

### `/upload` (POST) — Upload Document
```
FormData:
- file: PDF or TXT
- session_id: UUID
```

### `/rag/query` (POST) — Direct RAG Query
```json
{
  "query": "string",
  "session_id": "uuid",
  "top_k": 5
}
```

### `/session/new` (POST)
Returns: `{ "session_id": "uuid", "persona": "string" }`

### `/session/{id}/history` (GET)
Returns: `{ "messages": [...] }`

---

## 🎯 Model Strategy

### Cost + Quality Optimization
- **Haiku (3.5)** — Default, creative, synthesis tasks
  - Fast (low latency)
  - Cheap ($0.80/1M input tokens)
- **Sonnet (3.5)** — Reasoning, coding, analysis
  - 2-3x more capable
  - ~$3/1M input tokens

### Automatic Selection
```python
AGENT_PERSONAS = {
    "default": "haiku",      # Fast responses
    "reasoning": "sonnet",   # Deep analysis
    "coder": "sonnet",       # Complex code
    "creative": "haiku",     # Iterative writing
    "analyst": "sonnet",     # Structured insights
}
```

---

## 🔄 ReAct Loop Workflow

```
User Query
    ↓
[Reason] Claude analyzes question, plans approach
    ↓
[Act] Agent uses tools (retrieve_documents, save_memory)
    ↓
[Observe] Process tool results, refine understanding
    ↓
[Iterate] 2-5 loops until end_turn
    ↓
Final Response (streamed to client)
```

---

## 📦 Tech Stack

### Backend
| Package | Purpose |
|---------|----------|
| **FastAPI** | High-performance async web framework |
| **Anthropic SDK** | Claude API with tool use & streaming |
| **LangGraph** | Agent orchestration & ReAct patterns |
| **LangChain** | RAG chains and text splitting |
| **FAISS** | Vector similarity search |
| **Supabase** | PostgreSQL database + auth |
| **PyPDF2** | PDF text extraction |

### Frontend
| Package | Purpose |
|---------|----------|
| **React 18** | UI framework |
| **Vite** | Build tool & dev server |
| **SSE Client** | Server-Sent Events streaming |

---

## 🔐 Environment Variables

| Variable | Description |
|----------|----------|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_KEY` | Supabase anon public key |
| `ANTHROPIC_API_KEY` | Anthropic Claude API key |

> **Security**: Never commit `.env` — it's in `.gitignore`

---

## 🚀 Deployment

### Backend (Railway)
```bash
# Procfile
web: uvicorn main:app --host 0.0.0.0 --port $PORT
```

### Frontend (Vercel)
```bash
npm run build
# Deploy dist/ folder to Vercel
```

---

## 📊 Performance Tips

### RAG Optimization
- **Pre-fetch patterns**: Load embeddings at startup
- **Batch indexing**: Process large documents in chunks
- **Cache hits**: Reuse FAISS indices across queries
- **Timeout tuning**: Set pgvector timeouts to 5-10s

### Streaming Performance
- **Chunk size**: Balance between latency and throughput
- **Buffer management**: Don't buffer entire response
- **SSE optimization**: Send deltas, not full messages

### Cost Control
- Use **Haiku** for high-volume queries
- Use **Sonnet** only for reasoning tasks
- Set **top_k=3** for RAG (not 10)

---

## 🗺️ Roadmap

- [x] Multi-agent orchestration
- [x] FAISS RAG pipeline
- [x] Streaming with tool use
- [ ] Custom prompt templates (no redeployment)
- [ ] Voice input/output
- [ ] Image generation
- [ ] Usage analytics dashboard
- [ ] Share conversations
- [ ] Fine-tuned models for specific domains

---

## 🤝 Contributing

Pull requests welcome! Open an issue first for major changes.

---

## 📄 License

MIT — Free for personal and commercial use.

---

## 👨‍💻 Author

**Satya Krishna Vamsee Yalla**
- GitHub: [@yalla-20-Vamsee](https://github.com/yalla-20-Vamsee)
- LinkedIn: [ysk-vamsee](https://linkedin.com/in/ysk-vamsee/)

---

> Built with ❤️ using Claude 3.5 Sonnet | Powered by [Anthropic](https://anthropic.com)
