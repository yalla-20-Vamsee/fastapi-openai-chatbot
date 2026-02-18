
from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional
import openai, uuid, json, time, os
from dotenv import load_dotenv
from supabase import create_client
import PyPDF2
import io

load_dotenv()
supabase = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_KEY"))

app = FastAPI(title="NexusAI API", version="4.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

MODELS = {"gpt-4o": 4096, "gpt-4o-mini": 4096, "gpt-3.5-turbo": 4096}
PERSONAS = {
    "default": "You are a helpful, knowledgeable AI assistant. Be concise, clear, and friendly.",
    "coder": "You are an expert software engineer. Provide clean, well-commented code and detailed technical explanations.",
    "creative": "You are a creative writing assistant. Be imaginative, expressive, and help craft compelling narratives.",
    "analyst": "You are a data analyst and business strategist. Provide structured, data-driven insights.",
}

class ChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = None
    model: str = "gpt-4o-mini"
    persona: str = "default"
    stream: bool = True
    api_key: str

@app.get("/")
def root():
    return {"status": "ok", "version": "4.0.0"}

@app.post("/session/new")
def new_session(persona: str = "default", model: str = "gpt-4o-mini"):
    sid = str(uuid.uuid4())
    supabase.table("sessions").insert({"id": sid, "label": "Chat", "persona": persona, "model": model}).execute()
    return {"session_id": sid}

@app.get("/sessions")
def get_all_sessions():
    result = supabase.table("sessions").select("*").order("created_at", desc=True).execute()
    return {"sessions": result.data}

@app.get("/session/{session_id}/history")
def get_history(session_id: str):
    result = supabase.table("messages").select("*").eq("session_id", session_id).order("created_at").execute()
    return {"messages": result.data}

@app.delete("/session/{session_id}")
def clear_session(session_id: str):
    supabase.table("messages").delete().eq("session_id", session_id).execute()
    supabase.table("sessions").delete().eq("id", session_id).execute()
    return {"cleared": True}

@app.post("/upload")
async def upload_document(
    file: UploadFile = File(...),
    session_id: str = Form(...),
    api_key: str = Form(...)
):
    try:
        contents = await file.read()
        text = ""

        # Extract text based on file type
        if file.filename.endswith(".pdf"):
            pdf_reader = PyPDF2.PdfReader(io.BytesIO(contents))
            for page in pdf_reader.pages:
                text += page.extract_text() + "\n"
        elif file.filename.endswith(".txt"):
            text = contents.decode("utf-8")
        else:
            raise HTTPException(status_code=400, detail="Only PDF and TXT files supported")

        # Store document content in Supabase
        supabase.table("documents").insert({
            "session_id": session_id,
            "filename": file.filename,
            "content": text[:50000],  # limit to 50k chars
        }).execute()

        return {"success": True, "filename": file.filename, "chars": len(text)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/documents/{session_id}")
def get_documents(session_id: str):
    result = supabase.table("documents").select("id,filename,created_at").eq("session_id", session_id).execute()
    return {"documents": result.data}

@app.delete("/document/{document_id}")
def delete_document(document_id: str):
    supabase.table("documents").delete().eq("id", document_id).execute()
    return {"deleted": True}

@app.post("/session/{session_id}/rename")
async def rename_session(session_id: str, api_key: str, message: str):
    try:
        client = openai.AsyncOpenAI(api_key=api_key)
        response = await client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{
                "role": "user",
                "content": f"Generate a very short 3-5 word title for a chat that starts with this message: '{message}'. Reply with ONLY the title, no quotes, no punctuation at the end."
            }],
            max_tokens=20
        )
        title = response.choices[0].message.content.strip()
        supabase.table("sessions").update({"label": title}).eq("id", session_id).execute()
        return {"title": title}
    except Exception as e:
        return {"title": "New Chat"}

@app.post("/chat")
async def chat(req: ChatRequest):
    if req.model not in MODELS:
        raise HTTPException(status_code=400, detail="Unknown model")
    sid = req.session_id or str(uuid.uuid4())
    system_prompt = PERSONAS.get(req.persona, PERSONAS["default"])

    # Check for uploaded documents in this session
    docs = supabase.table("documents").select("filename,content").eq("session_id", sid).execute()
    if docs.data:
        doc_context = "\n\n".join([
            f"--- Document: {d['filename']} ---\n{d['content'][:10000]}"
            for d in docs.data
        ])
        system_prompt += f"\n\nThe user has uploaded the following documents. Use them to answer questions:\n\n{doc_context}"

    history = supabase.table("messages").select("role,content").eq("session_id", sid).order("created_at").execute()
    messages = [{"role": "system", "content": system_prompt}]
    messages += [{"role": m["role"], "content": m["content"]} for m in history.data]
    messages += [{"role": "user", "content": req.message}]

    supabase.table("messages").insert({"session_id": sid, "role": "user", "content": req.message, "model": req.model}).execute()
    client = openai.AsyncOpenAI(api_key=req.api_key)

    if req.stream:
        async def generate():
            full = ""
            try:
                stream = await client.chat.completions.create(model=req.model, messages=messages, stream=True, max_tokens=MODELS[req.model])
                async for chunk in stream:
                    delta = chunk.choices[0].delta.content or ""
                    full += delta
                    yield "data: " + json.dumps({"delta": delta, "session_id": sid}) + "\n\n"
                supabase.table("messages").insert({"session_id": sid, "role": "assistant", "content": full, "model": req.model}).execute()
                yield "data: " + json.dumps({"done": True, "session_id": sid}) + "\n\n"
            except Exception as e:
                yield "data: " + json.dumps({"error": str(e)}) + "\n\n"
        return StreamingResponse(generate(), media_type="text/event-stream")
    else:
        try:
            response = await client.chat.completions.create(model=req.model, messages=messages, max_tokens=MODELS[req.model])
            content = response.choices[0].message.content
            supabase.table("messages").insert({"session_id": sid, "role": "assistant", "content": content, "model": req.model}).execute()
            return {"response": content, "session_id": sid}
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))
