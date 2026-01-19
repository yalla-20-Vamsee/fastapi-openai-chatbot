# FastAPI OpenAI Chatbot & Resume Analyzer

This project is a **FastAPI-based web application** that integrates OpenAI’s GPT models to provide:

1. **Chatbot** (with form and WebSocket-based streaming support)
2. **Image generation** from text prompts
3. **Resume analysis** (with optional streaming results)

The frontend is styled using **Bootstrap** and custom CSS.

---

## Features

### Chatbot
- Form-based chat using GPT-4
- WebSocket streaming chat using GPT-3.5 turbo
- Maintains chat history per session

### Image Generation
- Generate images using OpenAI’s image generation API
- Specify text prompts and get images

### Resume Analyzer
- Upload PDF or TXT resumes
- Get automated analysis:
  - Key skills
  - Suggested interview questions
- Optional WebSocket streaming for large resumes

### Styling
- Responsive layout using **Bootstrap**
- Custom CSS for modern look
- Shared layout with navigation across pages


## Project Structure

openai/
│
├─ app/
│ ├─ main.py # FastAPI app entry point
│ ├─ routes/
│ │ ├─ chat.py
│ │ ├─ image.py
│ │ ├─ resume.py
│ ├─ utils/
│ │ ├─ openai_client.py # OpenAI client setup
│ │ ├─ pdf_utils.py # PDF text extraction
│ ├─ templates/
│ │ ├─ layout.html
│ │ ├─ home.html
│ │ ├─ image.html
│ │ ├─ resume.html
│ │ └─ resume_stream.html
├─ static/
│ └─ css/
│ └─ style.css
├─ .env # Store OPENAI_API_KEY here
├─ requirements.txt
└─ README.md

