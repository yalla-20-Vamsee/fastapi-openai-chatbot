from openai import OpenAI
from fastapi import FastAPI, Form, Request, WebSocket
from typing import Annotated
from fastapi.templating import Jinja2Templates
from fastapi.responses import HTMLResponse
import os
from dotenv import load_dotenv

# --------------------------
# Load environment variables
# --------------------------
load_dotenv()

# --------------------------
# Initialize OpenAI client
# --------------------------
openai = OpenAI(api_key=os.getenv("OPENAI_API_SECRET_KEY"))

# --------------------------
# Initialize FastAPI
# --------------------------
app = FastAPI()

# --------------------------
# Templates folder
# --------------------------
templates = Jinja2Templates(directory="templates")

# --------------------------
# Store chat history for display
# --------------------------
chat_responses = []

# --------------------------
# System prompt for AI behavior
# --------------------------
chat_log = [
    {"role": "system", "content": "You tell jokes."}
]

# --------------------------
# Home page (GET) - Form Chat
# --------------------------
@app.get("/", response_class=HTMLResponse)
async def chat_page(request: Request):
    return templates.TemplateResponse(
        "home.html", {"request": request, "chat_responses": chat_responses}
    )

# --------------------------
# Form-based Chat (POST)
# --------------------------
@app.post("/", response_class=HTMLResponse)
async def chat_post(request: Request, user_input: Annotated[str, Form()]):
    chat_log.append({"role": "user", "content": user_input})
    chat_responses.append(user_input)

    # GPT-4 response
    response = openai.chat.completions.create(
        model="gpt-4",
        messages=chat_log,
        temperature=0.6
    )

    bot_response = response.choices[0].message.content
    chat_log.append({"role": "assistant", "content": bot_response})
    chat_responses.append(bot_response)

    return templates.TemplateResponse(
        "home.html", {"request": request, "chat_responses": chat_responses}
    )

# --------------------------
# WebSocket Chat (Streaming GPT-3.5)
# --------------------------
@app.websocket("/ws")
async def chat_ws(websocket: WebSocket):
    await websocket.accept()

    while True:
        try:
            user_input = await websocket.receive_text()
            chat_log.append({"role": "user", "content": user_input})
            chat_responses.append(user_input)

            # GPT-3.5 streaming response
            response = openai.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=chat_log,
                temperature=0.6,
                stream=True
            )

            ai_response = ""
            for chunk in response:
                # Access content attribute directly
                delta = chunk.choices[0].delta.content
                if delta:
                    ai_response += delta
                    await websocket.send_text(delta)

            chat_log.append({"role": "assistant", "content": ai_response})
            chat_responses.append(ai_response)

        except Exception as e:
            await websocket.send_text(f"Error: {str(e)}")
            break

# --------------------------
# Image Page (GET)
# --------------------------
@app.get("/image", response_class=HTMLResponse)
async def image_page(request: Request):
    return templates.TemplateResponse("image.html", {"request": request})

# --------------------------
# Image Generation (POST)
# --------------------------
@app.post("/image", response_class=HTMLResponse)
async def create_image(request: Request, user_input: Annotated[str, Form()]):
    response = openai.images.generate(
        prompt=user_input,
        n=1,
        size="256x256"
    )
    image_url = response.data[0].url

    return templates.TemplateResponse(
        "image.html", {"request": request, "image_url": image_url}
    )
