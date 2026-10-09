import os
import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select, func

from app.api.routes import auth, profile, balance, history, products, transactions
from app.core.security import hash_password
from app.db.session import engine, AsyncSessionLocal
from app.models.base import Base
from app.models.user import User

logger = logging.getLogger("uvicorn.error")

app = FastAPI(title="Transaction Dashboard API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api")
app.include_router(profile.router, prefix="/api")
app.include_router(balance.router, prefix="/api")
app.include_router(history.router, prefix="/api")
app.include_router(products.router, prefix="/api")
app.include_router(transactions.router, prefix="/api")


async def seed_first_user():
    async with AsyncSessionLocal() as db:
        count = (await db.execute(select(func.count(User.id)))).scalar_one()
        if count > 0:
            return
        username = os.getenv("SEED_USERNAME", "admin")
        password = os.getenv("SEED_PASSWORD", "admin12345")
        db.add(User(username=username, password_hash=hash_password(password)))
        await db.commit()
        logger.warning("Seeded first user '%s' (change via SEED_USERNAME/SEED_PASSWORD)", username)


@app.on_event("startup")
async def startup():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    await seed_first_user()

@app.get("/health")
async def health():
    return {"status": "ok"}
