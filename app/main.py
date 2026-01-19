from fastapi import FastAPI
from app.routes import chat, image, resume

app = FastAPI()

# Include all routers
app.include_router(chat.router)
app.include_router(image.router)
app.include_router(resume.router)
