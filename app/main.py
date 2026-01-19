from fastapi import FastAPI
from app.routes import chat, image, resume
from fastapi.staticfiles import StaticFiles

app = FastAPI()

# Mount static folder
app.mount("/static", StaticFiles(directory="static"), name="static")



# Include all routers
app.include_router(chat.router)
app.include_router(image.router)
app.include_router(resume.router)
