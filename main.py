from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional
import openai, uuid, json, time
from collections import defaultdict

app = FastAPI(title="Advanced AI Chatbot API", version="2.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

sessions: dict = defaultdict(list)
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
def root(): return {"status": "ok", "version": "2.0.0"}

@app.post("/session/new")
def new_session(): 
    sid = str(uuid.uuid4())
    sessions[sid] = []
    return {"session_id": sid}

@app.get("/session/{session_id}/history")
def get_history(session_id: str):
    return {"messages": sessions.get(session_id, [])}

@app.delete("/session/{session_id}")
def clear_session(session_id: str):
    sessions.pop(session_id, None)
    return {"cleared": True}

@app.post("/chat")
async def chat(req: ChatRequest):
    if req.model not in MODELS:
        raise HTTPException(status_code=400, detail=f"Unknown model: {req.model}")
    sid = req.session_id or str(uuid.uuid4())
    system_prompt = PERSONAS.get(req.persona, PERSONAS["default"])
    messages = [{"role": "system", "content": system_prompt}] + [
        {"role": m["role"], "content": m["content"]} for m in sessions[sid]
    ] + [{"role": "user", "content": req.message}]
    sessions[sid].append({"role": "user", "content": req.message, "timestamp": time.time()})
    client = openai.AsyncOpenAI(api_key=req.api_key)

    if req.stream:
        async def generate():
            full = ""
            try:
                stream = await client.chat.completions.create(model=req.model, messages=messages, stream=True, max_tokens=MODELS[req.model])
                async for chunk in stream:
                    delta = chunk.choices[0].delta.content or ""
                    full += delta
                    yield f"data: {json.dumps({'delta': delta, 'session_id': sid})}\n\n"
                sessions[sid].append({"role": "assistant", "content": full, "timestamp": time.time(), "model": req.model})
                yield f"data: {json.dumps({'done': True, 'session_id': sid})}\n\n"
            except Exception as e:
                yield f"data: {json.dumps({'error': str(e)})}\n\n"
        return StreamingResponse(generate(), media_type="text/event-stream")
    else:
        try:
            response = await client.chat.completions.create(model=req.model, messages=messages, max_tokens=MODELS[req.model])
            content = response.choices[0].message.content
            sessions[sid].append({"role": "assistant", "content": content, "timestamp": time.time(), "model": req.model})
            return {"response": content, "session_id": sid}
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))
