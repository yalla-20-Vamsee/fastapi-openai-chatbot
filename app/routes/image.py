from fastapi import APIRouter, Request, Form
from fastapi.templating import Jinja2Templates
from fastapi.responses import HTMLResponse
from typing import Annotated
from app.utils.openai_client import openai

router = APIRouter()
templates = Jinja2Templates(directory="app/templates")

@router.get("/image", response_class=HTMLResponse)
async def image_page(request: Request):
    return templates.TemplateResponse("image.html", {"request": request})

@router.post("/image", response_class=HTMLResponse)
async def create_image(
    request: Request,
    user_input: Annotated[str, Form()]
):
    response = openai.images.generate(
        prompt=user_input,
        n=1,
        size="256x256"
    )
    image_url = response.data[0].url

    return templates.TemplateResponse(
        "image.html",
        {"request": request, "image_url": image_url}
    )
