from fastapi import APIRouter, Request, Form, WebSocket, UploadFile, File
from fastapi.templating import Jinja2Templates
from fastapi.responses import HTMLResponse
from app.utils.openai_client import openai
from app.utils.pdf_utils import extract_text_from_pdf

router = APIRouter()
templates = Jinja2Templates(directory="app/templates")

# Resume upload page
@router.get("/resume", response_class=HTMLResponse)
async def resume_page(request: Request):
    return templates.TemplateResponse("resume.html", {"request": request})

# Analyze uploaded resume
@router.post("/resume", response_class=HTMLResponse)
async def analyze_uploaded_resume(request: Request, file: UploadFile = File(...)):
    if file.filename.endswith(".pdf"):
        resume_text = extract_text_from_pdf(file.file)
    else:
        resume_text = await file.read()
        resume_text = resume_text.decode("utf-8")

    prompt = f"""
Analyze this resume and return in bullet points:
1. Key skills
2. Suggested interview questions

Resume Content:
{resume_text}
"""

    response = openai.chat.completions.create(
        model="gpt-4",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.6
    )
    analysis = response.choices[0].message.content
    return templates.TemplateResponse("resume.html", {"request": request, "analysis": analysis, "filename": file.filename})

# WebSocket streaming resume analysis
@router.get("/resume_stream", response_class=HTMLResponse)
async def resume_stream_page(request: Request):
    return templates.TemplateResponse("resume_stream.html", {"request": request})

@router.websocket("/ws/resume")
async def resume_stream_ws(websocket: WebSocket):
    await websocket.accept()
    while True:
        try:
            resume_text = await websocket.receive_text()
            prompt = f"""
Analyze this resume and return in bullet points:
1. Key skills
2. Suggested interview questions

Resume Content:
{resume_text}
"""
            response = openai.chat.completions.create(
                model="gpt-4",
                messages=[{"role": "user", "content": prompt}],
                temperature=0.6,
                stream=True
            )

            analysis_text = ""
            for chunk in response:
                delta = getattr(chunk.choices[0].delta, "content", None)
                if delta:
                    analysis_text += delta
                    await websocket.send_text(delta)
        except Exception as e:
            await websocket.send_text(f"Error: {str(e)}")
            break
