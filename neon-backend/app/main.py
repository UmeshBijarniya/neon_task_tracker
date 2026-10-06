from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import CORS_ORIGINS
from app.database import get_db
from app.routers import auth, tasks, users
from app.seed import seed_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    db = get_db()
    await seed_db(db)
    yield


app = FastAPI(title="Neon Classes Task Tracker API", lifespan=lifespan)

if "*" in CORS_ORIGINS:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )
else:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=CORS_ORIGINS,
        allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$",
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )


app.include_router(auth.router)
app.include_router(users.router)
app.include_router(tasks.router)


@app.get("/health")
async def health():
    return {"status": "ok"}
