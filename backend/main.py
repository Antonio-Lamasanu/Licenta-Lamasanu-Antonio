from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import FRONTEND_ORIGIN
from db import init_db
from routers import admin, auth, chat, notes, profile, rhymes, saved_searches, scratchpad, syllables


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_ORIGIN],
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)

app.include_router(syllables.router)
app.include_router(rhymes.router)
app.include_router(auth.router)
app.include_router(admin.router)
app.include_router(notes.router)
app.include_router(saved_searches.router)
app.include_router(scratchpad.router)
app.include_router(chat.router)
app.include_router(profile.router)
