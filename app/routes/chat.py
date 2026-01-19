from fastapi import APIRouter, Request, WebSocket, Form
from fastapi.templating import Jinja2Templates
from fastapi.responses import HTMLResponse
from typing import Annotated
from app.utils.openai_client import openai

router = APIRouter()
templates = Jinja2Templates(directory="app/templates")

chat_log_form = [{"role": "system", "content": "You tell jokes."}]
chat_log_ws = [{"role": "system", "content": "You tell jokes."}]
chat_responses_form = []

# ---------------- Form Chat ----------------
@router.get("/", response_class=HTMLResponse)
async def chat_page(request: Request):
    return templates.TemplateResponse(
        "home.html",
        {"request": request, "chat_responses": chat_responses_form}
    )

@router.post("/", response_class=HTMLResponse)
async def chat_post(
    request: Request,
    user_input: Annotated[str, Form()]
):
    chat_log_form.append({"role": "user", "content": user_input})
    chat_responses_form.append(user_input)

    response = openai.chat.completions.create(
        model="gpt-4",
        messages=chat_log_form,
        temperature=0.6
    )

    bot_response = response.choices[0].message.content
    chat_log_form.append({"role": "assistant", "content": bot_response})
    chat_responses_form.append(bot_response)

    return templates.TemplateResponse(
        "home.html",
        {"request": request, "chat_responses": chat_responses_form}
    )

# ---------------- WebSocket Chat ----------------
@router.websocket("/ws")
async def chat_ws(websocket: WebSocket):
    await websocket.accept()
    while True:
        try:
            user_input = await websocket.receive_text()
            chat_log_ws.append({"role": "user", "content": user_input})

            response = openai.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=chat_log_ws,
                temperature=0.6,
                stream=True
            )

            ai_response = ""
            for chunk in response:
                delta = getattr(chunk.choices[0].delta, "content", None)
                if delta:
                    ai_response += delta
                    await websocket.send_text(delta)

            chat_log_ws.append({"role": "assistant", "content": ai_response})

        except Exception as e:
            await websocket.send_text(f"Error: {str(e)}")
            break
