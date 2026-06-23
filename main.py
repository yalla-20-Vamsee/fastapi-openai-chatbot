#!/usr/bin/env python3
"""
NexusAI — Production Agentic AI System
Multi-agent orchestration with Anthropic SDK, RAG, and streaming backend
"""

import os
import json
import uuid
import asyncio
from typing import Optional, AsyncGenerator
from datetime import datetime

from fastapi import FastAPI, HTTPException, UploadFile, File, Form, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from dotenv import load_dotenv

import anthropic
from anthropic.types import MessageStreamEvent
from langgraph.graph import StateGraph, END
from langchain_anthropic import ChatAnthropic
from langchain_community.vectorstores import FAISS
from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain.schema import Document
from supabase import create_client
import PyPDF2
import io

# ─── Configuration ──────────────────────────────────────────────────────────
load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

# Initialize embeddings for RAG
embeddings_model = HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")

app = FastAPI(
    title="NexusAI API",
    version="5.0.0-agentic",
    description="Production Agentic AI System with Anthropic SDK, RAG, and Streaming"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Models ─────────────────────────────────────────────────────────────────
class ChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = None
    persona: str = "default"
    stream: bool = True
    use_reasoning: bool = False  # Use Sonnet with extended thinking
    use_rag: bool = True  # Retrieve context from documents

class RAGQuery(BaseModel):
    query: str
    session_id: str
    top_k: int = 5

class DocumentMetadata(BaseModel):
    session_id: str
    filename: str
    chunk_count: int

# ─── Agent System ───────────────────────────────────────────────────────────

AGENT_PERSONAS = {
    "default": {
        "system": "You are NexusAI, a helpful, intelligent assistant. Be concise, clear, and provide actionable insights.",
        "model": "claude-3-5-haiku-20241022",  # Fast, cost-effective for standard tasks
    },
    "reasoning": {
        "system": "You are an expert analyst. Reason through complex problems step-by-step with deep analysis.",
        "model": "claude-3-5-sonnet-20241022",  # Powerful for reasoning and code
    },
    "coder": {
        "system": "You are a senior software engineer. Provide clean, production-ready code with detailed explanations and best practices.",
        "model": "claude-3-5-sonnet-20241022",
    },
    "creative": {
        "system": "You are a creative storyteller. Generate imaginative, compelling narratives and artistic content.",
        "model": "claude-3-5-haiku-20241022",  # Fast for creative iteration
    },
    "analyst": {
        "system": "You are a data analyst and business strategist. Extract structured insights, identify patterns, and provide data-driven recommendations.",
        "model": "claude-3-5-sonnet-20241022",
    },
}

# ─── RAG Pipeline ───────────────────────────────────────────────────────────

async def build_rag_index(session_id: str, documents: list[dict]) -> Optional[FAISS]:
    """Build a FAISS vector index from uploaded documents."""
    if not documents:
        return None
    
    docs = []
    text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
    
    for doc in documents:
        chunks = text_splitter.split_text(doc["content"])
        for chunk in chunks:
            docs.append(Document(page_content=chunk, metadata={"source": doc["filename"]}))
    
    if not docs:
        return None
    
    try:
        index = FAISS.from_documents(docs, embeddings_model)
        return index
    except Exception as e:
        print(f"Error building RAG index: {e}")
        return None

async def retrieve_context(query: str, session_id: str, top_k: int = 5) -> str:
    """Retrieve relevant context from documents using semantic search."""
    try:
        docs_result = supabase.table("documents").select("id,filename,content").eq("session_id", session_id).execute()
        documents = docs_result.data if docs_result.data else []
        
        if not documents:
            return ""
        
        index = await build_rag_index(session_id, documents)
        if not index:
            return ""
        
        results = index.similarity_search(query, k=top_k)
        context = "\n\n".join([f"[{r.metadata['source']}] {r.page_content}" for r in results])
        return context
    except Exception as e:
        print(f"RAG retrieval error: {e}")
        return ""

# ─── Tool Use for Multi-Agent System ───────────────────────────────────────

def define_tools():
    """Define tools for agent use."""
    return [
        {
            "name": "retrieve_documents",
            "description": "Retrieve relevant documents for a query using semantic search",
            "input_schema": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "The query to search for in documents",
                    },
                    "session_id": {
                        "type": "string",
                        "description": "The session ID to search within",
                    },
                },
                "required": ["query", "session_id"],
            },
        },
        {
            "name": "save_memory",
            "description": "Save important context or facts to session memory for future use",
            "input_schema": {
                "type": "object",
                "properties": {
                    "key": {"type": "string", "description": "Memory key"},
                    "value": {"type": "string", "description": "Memory value"},
                    "session_id": {"type": "string", "description": "Session ID"},
                },
                "required": ["key", "value", "session_id"],
            },
        },
    ]

async def process_tool_use(tool_name: str, tool_input: dict, session_id: str) -> str:
    """Process tool calls from the agent."""
    if tool_name == "retrieve_documents":
        context = await retrieve_context(
            tool_input.get("query", ""),
            tool_input.get("session_id", session_id),
            top_k=5
        )
        return context or "No documents found for this query."
    
    elif tool_name == "save_memory":
        try:
            supabase.table("session_memory").insert({
                "session_id": tool_input.get("session_id", session_id),
                "key": tool_input.get("key"),
                "value": tool_input.get("value"),
                "created_at": datetime.now().isoformat(),
            }).execute()
            return f"Saved '{tool_input['key']}' to memory."
        except Exception as e:
            return f"Memory save failed: {str(e)}"
    
    return "Unknown tool"

# ─── Streaming with Tool Use ────────────────────────────────────────────────

async def stream_agentic_response(
    session_id: str,
    messages: list[dict],
    persona: str = "default",
    use_rag: bool = True,
) -> AsyncGenerator[str, None]:
    """Stream agentic response with tool use and ReAct loop."""
    
    config = AGENT_PERSONAS.get(persona, AGENT_PERSONAS["default"])
    model = config["model"]
    system_prompt = config["system"]
    
    # Add RAG context if enabled
    if use_rag and messages:
        user_query = messages[-1].get("content", "")
        rag_context = await retrieve_context(user_query, session_id, top_k=3)
        if rag_context:
            system_prompt += f"\n\n[Retrieved Context]\n{rag_context}"
    
    # ReAct loop: Reason → Act → Observe
    iteration = 0
    max_iterations = 5
    
    while iteration < max_iterations:
        iteration += 1
        
        # Get response from agent
        response = client.messages.create(
            model=model,
            max_tokens=4096,
            system=system_prompt,
            tools=define_tools(),
            messages=messages,
        )
        
        # Process response
        if response.stop_reason == "end_turn":
            # Final response
            for block in response.content:
                if hasattr(block, "text"):
                    yield f"data: {json.dumps({'delta': block.text})}\n\n"
            break
        
        elif response.stop_reason == "tool_use":
            # Handle tool calls
            for block in response.content:
                if block.type == "text":
                    yield f"data: {json.dumps({'delta': block.text})}\n\n"
                
                elif block.type == "tool_use":
                    tool_result = await process_tool_use(
                        block.name,
                        block.input,
                        session_id
                    )
                    
                    # Add tool result to conversation
                    messages.append({"role": "assistant", "content": response.content})
                    messages.append({
                        "role": "user",
                        "content": [{
                            "type": "tool_result",
                            "tool_use_id": block.id,
                            "content": tool_result,
                        }]
                    })
        else:
            break
    
    yield "data: {\"done\": true}\n\n"

# ─── REST API Endpoints ─────────────────────────────────────────────────────

@app.get("/")
def root():
    return {
        "name": "NexusAI",
        "version": "5.0.0-agentic",
        "status": "running",
        "features": [
            "Multi-agent system with tool use",
            "Semantic RAG with FAISS",
            "Real-time streaming",
            "ReAct loop reasoning",
            "Haiku for synthesis / Sonnet for reasoning",
        ],
    }

@app.post("/session/new")
async def new_session(persona: str = "default"):
    """Create a new chat session."""
    sid = str(uuid.uuid4())
    try:
        supabase.table("sessions").insert({
            "id": sid,
            "persona": persona,
            "created_at": datetime.now().isoformat(),
        }).execute()
    except Exception as e:
        print(f"Session creation error: {e}")
    
    return {"session_id": sid, "persona": persona}

@app.get("/sessions")
def get_sessions():
    """List all sessions."""
    try:
        result = supabase.table("sessions").select("*").order("created_at", desc=True).execute()
        return {"sessions": result.data}
    except Exception as e:
        return {"sessions": [], "error": str(e)}

@app.get("/session/{session_id}/history")
def get_history(session_id: str):
    """Get chat history for a session."""
    try:
        result = supabase.table("messages").select("*").eq("session_id", session_id).order("created_at").execute()
        return {"messages": result.data}
    except Exception as e:
        return {"messages": [], "error": str(e)}

@app.delete("/session/{session_id}")
def delete_session(session_id: str):
    """Delete a session and all associated data."""
    try:
        supabase.table("messages").delete().eq("session_id", session_id).execute()
        supabase.table("documents").delete().eq("session_id", session_id).execute()
        supabase.table("session_memory").delete().eq("session_id", session_id).execute()
        supabase.table("sessions").delete().eq("id", session_id).execute()
        return {"deleted": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/upload")
async def upload_document(
    file: UploadFile = File(...),
    session_id: str = Form(...),
):
    """Upload a document for RAG."""
    try:
        contents = await file.read()
        text = ""
        
        # Extract text
        if file.filename.endswith(".pdf"):
            pdf_reader = PyPDF2.PdfReader(io.BytesIO(contents))
            for page in pdf_reader.pages:
                text += page.extract_text() + "\n"
        elif file.filename.endswith(".txt"):
            text = contents.decode("utf-8")
        else:
            raise HTTPException(status_code=400, detail="Only PDF and TXT supported")
        
        # Store in Supabase
        supabase.table("documents").insert({
            "session_id": session_id,
            "filename": file.filename,
            "content": text[:500000],
            "created_at": datetime.now().isoformat(),
        }).execute()
        
        return {
            "success": True,
            "filename": file.filename,
            "size": len(text),
            "message": "Document indexed for RAG"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/documents/{session_id}")
def list_documents(session_id: str):
    """List documents in a session."""
    try:
        result = supabase.table("documents").select("id,filename,created_at").eq("session_id", session_id).execute()
        return {"documents": result.data}
    except Exception as e:
        return {"documents": [], "error": str(e)}

@app.delete("/document/{document_id}")
def delete_document(document_id: str):
    """Delete a document."""
    try:
        supabase.table("documents").delete().eq("id", document_id).execute()
        return {"deleted": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/chat")
async def chat(req: ChatRequest):
    """Stream agentic response with tool use and RAG."""
    if not req.session_id:
        req.session_id = str(uuid.uuid4())
    
    # Get chat history
    try:
        history_result = supabase.table("messages").select("role,content").eq("session_id", req.session_id).order("created_at").execute()
        history_msgs = history_result.data if history_result.data else []
    except:
        history_msgs = []
    
    # Build message list
    messages = [{"role": m["role"], "content": m["content"]} for m in history_msgs]
    messages.append({"role": "user", "content": req.message})
    
    # Save user message
    try:
        supabase.table("messages").insert({
            "session_id": req.session_id,
            "role": "user",
            "content": req.message,
            "created_at": datetime.now().isoformat(),
        }).execute()
    except Exception as e:
        print(f"Error saving message: {e}")
    
    if req.stream:
        return StreamingResponse(
            stream_agentic_response(
                req.session_id,
                messages,
                persona=req.persona,
                use_rag=req.use_rag,
            ),
            media_type="text/event-stream"
        )
    else:
        # Non-streaming response
        async def get_response():
            full_response = ""
            async for chunk in stream_agentic_response(
                req.session_id,
                messages,
                persona=req.persona,
                use_rag=req.use_rag,
            ):
                if "delta" in chunk:
                    try:
                        data = json.loads(chunk.split("data: ")[1])
                        full_response += data.get("delta", "")
                    except:
                        pass
            return full_response
        
        response_text = await get_response()
        
        # Save assistant response
        try:
            supabase.table("messages").insert({
                "session_id": req.session_id,
                "role": "assistant",
                "content": response_text,
                "created_at": datetime.now().isoformat(),
            }).execute()
        except Exception as e:
            print(f"Error saving response: {e}")
        
        return {"response": response_text, "session_id": req.session_id}

@app.post("/rag/query")
async def rag_query(req: RAGQuery):
    """Direct RAG query endpoint."""
    context = await retrieve_context(req.query, req.session_id, top_k=req.top_k)
    return {"query": req.query, "context": context}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
