# NexusAI Chatbot v4.0 🤖

An advanced full-stack AI chatbot application built with **FastAPI** and **React**, powered by **OpenAI** and **Supabase**. Features real-time streaming, user authentication, persistent chat history, and document upload with RAG (Retrieval Augmented Generation).

![NexusAI](https://img.shields.io/badge/NexusAI-v4.0-7c6af7?style=for-the-badge)
![FastAPI](https://img.shields.io/badge/FastAPI-0.129-009688?style=for-the-badge&logo=fastapi)
![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react)
![Supabase](https://img.shields.io/badge/Supabase-Database-3ECF8E?style=for-the-badge&logo=supabase)
![OpenAI](https://img.shields.io/badge/OpenAI-GPT--4o-412991?style=for-the-badge&logo=openai)

---

## ✨ Features

- ⚡ **Real-time streaming responses** via Server-Sent Events (SSE)
- 🔐 **User authentication** — login/signup with Supabase Auth
- 🧠 **Multiple GPT models** — GPT-4o, GPT-4o Mini, GPT-3.5 Turbo
- 🎭 **4 AI personas** — Default, Senior Engineer, Creative Writer, Data Analyst
- 💾 **Persistent chat history** — stored in Supabase PostgreSQL
- 📄 **Document upload + RAG** — upload PDFs/TXT and chat with them
- 🏷️ **Auto-generated session titles** — just like ChatGPT
- 🗑️ **Delete sessions** — full cleanup from database
- 📎 **ChatGPT-style file upload** — paperclip in the input bar
- 🌙 **Dark themed UI** — modern, responsive design

---

## 🗂️ Project Structure

```
fastapi-openai-chatbot/
├── main.py                  # FastAPI backend
├── requirements.txt         # Python dependencies
├── .env                     # Environment variables (never commit this)
├── .gitignore               # Git ignore rules
├── README.md                # This file
└── frontend/
    ├── src/
    │   ├── App.jsx          # Main React component
    │   ├── App.css          # All styles
    │   ├── main.jsx         # React entry point
    │   └── supabase.js      # Supabase client
    ├── package.json         # Node dependencies
    ├── index.html           # HTML entry point
    └── vite.config.js       # Vite configuration
```

---

## 🛠️ Prerequisites

Make sure you have the following installed:

| Tool | Version | Download |
|---|---|---|
| Python | 3.11+ | https://python.org |
| Node.js | 18+ | https://nodejs.org |
| npm | 9+ | Comes with Node.js |
| Git | Any | https://git-scm.com |

You will also need accounts at:
- **OpenAI** — https://platform.openai.com (for API key)
- **Supabase** — https://supabase.com (free tier is enough)

---

## 🚀 Local Installation — Step by Step

### Step 1 — Clone the Repository

```bash
git clone https://github.com/yalla-20-Vamsee/fastapi-openai-chatbot.git
cd fastapi-openai-chatbot
```

---

### Step 2 — Set Up Supabase

1. Go to **https://supabase.com** and create a free account
2. Click **New Project**, name it `nexusai`, set a password, click **Create**
3. Wait ~2 minutes for the project to be ready
4. Go to **SQL Editor** and run the following SQL:

```sql
-- Sessions table
create table sessions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id),
  label text,
  persona text default 'default',
  model text default 'gpt-4o-mini',
  created_at timestamp default now()
);

-- Messages table
create table messages (
  id uuid default gen_random_uuid() primary key,
  session_id uuid references sessions(id) on delete cascade,
  role text not null,
  content text not null,
  model text,
  created_at timestamp default now()
);

-- Documents table
create table documents (
  id uuid default gen_random_uuid() primary key,
  session_id uuid references sessions(id) on delete cascade,
  filename text not null,
  content text not null,
  created_at timestamp default now()
);

-- Disable RLS for all tables
alter table sessions disable row level security;
alter table messages disable row level security;
alter table documents disable row level security;
```

5. Go to **Settings → API** and copy:
   - **Project URL** (looks like `https://xxxxx.supabase.co`)
   - **anon public key** (long string starting with `eyJ...`)

---

### Step 3 — Set Up the Backend

```bash
# Create a Python virtual environment
python3.11 -m venv venv

# Activate it (Mac/Linux)
source venv/bin/activate

# Activate it (Windows)
venv\Scripts\activate

# Install dependencies
pip install --upgrade pip
pip install -r requirements.txt
```

Create a `.env` file in the root folder and add your credentials:

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-anon-public-key
```

---

### Step 4 — Set Up the Frontend

```bash
cd frontend
npm install
```

Open `src/supabase.js` and replace the placeholder values with your Supabase credentials:

```js
const SUPABASE_URL = "https://your-project.supabase.co"
const SUPABASE_KEY = "your-anon-public-key"
```

---

### Step 5 — Run the Application

You need **two terminals** running at the same time:

**Terminal 1 — Start the Backend:**
```bash
# From the root folder
source venv/bin/activate
python -m uvicorn main:app --port 8000
```

You should see:
```
INFO: Uvicorn running on http://127.0.0.1:8000
```

**Terminal 2 — Start the Frontend:**
```bash
# From the frontend folder
cd frontend
npm run dev
```

You should see:
```
VITE ready in xxx ms
Local: http://localhost:5173/
```

---

### Step 6 — Open the App

Go to **http://localhost:5173** in your browser.

1. **Sign up** for an account using your email
2. **Enter your OpenAI API key** in the sidebar (starts with `sk-`)
3. **Start chatting!**

---

## 📖 How to Use

### Basic Chat
- Type a message and press **Enter** to send
- Press **Shift+Enter** for a new line
- Toggle **Streaming on/off** in the input bar footer

### Switch Models
Select from the sidebar:
- **GPT-4o** — Most powerful, best for complex tasks
- **GPT-4o Mini** — Fast and efficient, great for most tasks
- **GPT-3.5 Turbo** — Lightweight and cost-effective

### Switch Personas
- 🤖 **Default** — General purpose assistant
- 💻 **Senior Engineer** — Code, debugging, technical explanations
- ✍️ **Creative Writer** — Stories, essays, creative content
- 📊 **Data Analyst** — Data insights, business strategy

### Upload Documents (RAG)
1. Click the **📎 paperclip** icon in the input bar
2. Upload a **PDF** or **TXT** file
3. Ask questions about the document
4. The AI will answer based on the document content

### Manage Sessions
- Click **+ New Chat** to start a fresh conversation
- Click any session in the sidebar to switch to it and load its history
- Hover over a session and click **✕** to delete it permanently

---

## 🔑 Environment Variables

| Variable | Description |
|---|---|
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_KEY` | Your Supabase anon public key |

> ⚠️ Never commit your `.env` file to GitHub. It is already in `.gitignore`.

> ⚠️ Your OpenAI API key is entered in the UI at runtime — it is never stored on the server.

---

## 📦 Tech Stack

### Backend
| Package | Purpose |
|---|---|
| FastAPI | Web framework |
| Uvicorn | ASGI server |
| OpenAI | AI completions & streaming |
| Supabase | Database & authentication |
| PyPDF2 | PDF text extraction |
| python-multipart | File upload handling |
| python-dotenv | Environment variable loading |

### Frontend
| Package | Purpose |
|---|---|
| React 18 | UI framework |
| Vite | Build tool & dev server |
| @supabase/supabase-js | Auth & database client |
| react-markdown | Markdown rendering |

---

## 🗺️ Roadmap

- [ ] Deploy to cloud (Vercel + Railway)
- [ ] Voice input/output
- [ ] Image generation
- [ ] Usage analytics dashboard
- [ ] Share conversations publicly
- [ ] Custom user-defined personas

---

## 🤝 Contributing

Pull requests are welcome! For major changes, please open an issue first to discuss what you would like to change.

---

## 📄 License

MIT License — feel free to use this project for personal or commercial purposes.

---

## 👨‍💻 Author

**Vamsee Yalla**
- GitHub: [@yalla-20-Vamsee](https://github.com/yalla-20-Vamsee)
- LinkedIn: [Vamsee Yalla](https://linkedin.com/in/vamsee-yalla)

---

> Built with ❤️ using [Claude](https://claude.ai) by Anthropic
