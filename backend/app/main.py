from contextlib import asynccontextmanager
import time
import base64
from fastapi import FastAPI, Depends, status, Response
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response as StarletteResponse
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.config import settings
from app.database import engine, SessionLocal, Base, get_db
from app.models import User, UserRole
import app.models  # Register all models with Base metadata
from app.services.auth import hash_password

from app.routers import (
    auth,
    users,
    requests,
    folders,
    envs,
    audit,
    trash
)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # 1. Strict Cryptographic Key Startup Validations
    if not settings.SECRET_KEY or len(settings.SECRET_KEY) < 32 or settings.SECRET_KEY == "secret-key":
        raise RuntimeError(
            "[CRITICAL SECURITY ERROR] SECRET_KEY must be configured in .env and be at least 32 characters long! "
            "Never use default or empty keys in production."
        )

    if not settings.AES_KEY_BASE64:
        raise RuntimeError(
            "[CRITICAL SECURITY ERROR] AES_KEY_BASE64 must be configured in .env! "
            "A persistent 32-byte Base64 key is required to encrypt secrets."
        )
    try:
        decoded_aes = base64.b64decode(settings.AES_KEY_BASE64)
        if len(decoded_aes) != 32:
            raise ValueError(f"Decoded AES key must be exactly 32 bytes (got {len(decoded_aes)} bytes).")
    except Exception as e:
        raise RuntimeError(f"[CRITICAL SECURITY ERROR] Invalid AES_KEY_BASE64 in .env: {e}")

    # 2. Connect and verify/create database tables with retry (Neon serverless resilience)
    max_retries = 5
    for attempt in range(1, max_retries + 1):
        try:
            Base.metadata.create_all(bind=engine)
            # Idempotent migration for new columns on existing serverless tables
            with engine.connect() as conn:
                conn.execute(text("ALTER TABLE access_requests ADD COLUMN IF NOT EXISTS rejection_reason TEXT;"))
                conn.commit()
            print("[*] Neon PostgreSQL database connected and tables verified.")
            break
        except Exception as e:
            if attempt == max_retries:
                print(f"[!] Failed to connect to database after {max_retries} attempts.")
                raise e
            print(f"[*] Neon DB connection attempt {attempt}/{max_retries} failed ({e}). Retrying in 2s...")
            time.sleep(2)

    # 3. Bootstrap initial Admin from .env if no Admin exists
    db: Session = SessionLocal()
    try:
        existing_admin = db.query(User).filter(User.role == UserRole.ADMIN).first()
        if not existing_admin:
            admin_user = User(
                email=settings.INITIAL_ADMIN_EMAIL.lower(),
                full_name=settings.INITIAL_ADMIN_NAME,
                hashed_password=hash_password(settings.INITIAL_ADMIN_PASSWORD),
                role=UserRole.ADMIN,
                is_active=True
            )
            db.add(admin_user)
            db.commit()
            print(f"[*] Initial Admin account bootstrapped from .env: {settings.INITIAL_ADMIN_EMAIL}")
        else:
            print(f"[*] Existing Admin account found: {existing_admin.email}")
    except Exception as e:
        db.rollback()
        print(f"[!] Startup bootstrap error: {e}")
    finally:
        db.close()

    yield

app = FastAPI(
    title=settings.SERVICE_NAME,
    description="Zero-Knowledge, version-controlled environment secret management platform",
    version="1.0.0",
    lifespan=lifespan
)

# OWASP Recommended Security Headers Middleware
class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        response: StarletteResponse = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
        return response

app.add_middleware(SecurityHeadersMiddleware)

# Secure CORS Middleware (Configured strictly via .env)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API Routers
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(requests.router)
app.include_router(folders.router)
app.include_router(envs.router)
app.include_router(audit.router)
app.include_router(trash.router)

# Real Production Health Check (Pings database with SELECT 1)
@app.get("/api/health")
def health_check(db: Session = Depends(get_db)):
    try:
        db.execute(text("SELECT 1"))
        db_status = "connected"
    except Exception as e:
        return Response(
            content=f'{{"status":"unhealthy","database":"disconnected","error":"{str(e)}"}}',
            media_type="application/json",
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE
        )
    return {
        "status": "healthy",
        "service": settings.SERVICE_NAME,
        "environment": settings.ENVIRONMENT,
        "database": db_status
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
