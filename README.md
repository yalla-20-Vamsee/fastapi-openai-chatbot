# NexusAI Chatbot v2.0 — Advanced FastAPI + React

## What's New vs. the Original

| Feature | Original | v2.0 |
|---|---|---|
| UI | Basic HTML form | Stunning dark-theme React app |
| Streaming | ❌ | ✅ Server-Sent Events |
| Conversation memory | ❌ | ✅ Per-session history |
| Multiple models | ❌ | ✅ GPT-4o, GPT-4o Mini, GPT-3.5 |
| Personas | ❌ | ✅ 4 system personas |
| Session management | ❌ | ✅ Multi-session sidebar |
| Code rendering | ❌ | ✅ Inline + block code display |
| Copy to clipboard | ❌ | ✅ Per-message copy |

---

## Backend Setup

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

FastAPI docs: http://localhost:8000/docs

---

## Frontend Setup

```bash
# In your React project (Vite or CRA):
cp ChatbotApp.jsx src/App.jsx
npm run dev
```

Or paste the JSX directly into a claude.ai artifact to preview it.

---

## Key API Endpoints

| Method | Path | Description |
|---|---|---|
| POST | `/session/new` | Create a new chat session |
| GET | `/session/{id}/history` | Get message history |
| DELETE | `/session/{id}` | Clear a session |
| POST | `/chat` | Send a message (streaming or not) |
| GET | `/models` | List available models |
| GET | `/personas` | List available personas |

---

## Architecture

```
User → React Frontend (ChatbotApp.jsx)
         ↓ fetch /chat (SSE stream)
       FastAPI Backend (main.py)
         ↓ openai.AsyncOpenAI
       OpenAI API → streamed back up the chain
```

The backend stores session history **in-memory** (resets on restart).
For production, swap `sessions: dict` for Redis or a database.
