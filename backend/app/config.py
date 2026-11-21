import os
from typing import List
from pydantic_settings import BaseSettings
from dotenv import load_dotenv

# Explicitly load .env from backend directory
load_dotenv(dotenv_path=os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env"))

class Settings(BaseSettings):
    # Environment & Service
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "production")
    SERVICE_NAME: str = os.getenv("SERVICE_NAME", "Shakham Vault API")

    # Database Configuration
    DATABASE_URL: str = os.getenv("DATABASE_URL", "")
    DB_POOL_SIZE: int = int(os.getenv("DB_POOL_SIZE", "10"))
    DB_MAX_OVERFLOW: int = int(os.getenv("DB_MAX_OVERFLOW", "20"))
    DB_POOL_RECYCLE: int = int(os.getenv("DB_POOL_RECYCLE", "300"))

    # JWT Authentication Configuration
    SECRET_KEY: str = os.getenv("SECRET_KEY", "")
    ALGORITHM: str = os.getenv("ALGORITHM", "HS256")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "1440"))

    # AES-256-GCM Master Encryption Key & Optional Fallback Keys for Zero-Downtime Rotation (from .env)
    AES_KEY_BASE64: str = os.getenv("AES_KEY_BASE64", "")
    FALLBACK_AES_KEYS: str = os.getenv("FALLBACK_AES_KEYS", "")

    # CORS Allowed Origins (Comma-separated string, or * for all origins)
    ALLOWED_ORIGINS: str = os.getenv(
        "ALLOWED_ORIGINS",
        "http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173,http://127.0.0.1:3000"
    )

    # Security & Rate Limiting Controls
    AUTH_RATE_LIMIT_PER_MINUTE: int = int(os.getenv("AUTH_RATE_LIMIT_PER_MINUTE", "10"))
    MAX_PAYLOAD_SIZE_MB: int = int(os.getenv("MAX_PAYLOAD_SIZE_MB", "2"))

    # Initial Super Admin Credentials (used only on first clean bootstrap)
    INITIAL_ADMIN_EMAIL: str = os.getenv("INITIAL_ADMIN_EMAIL", "admin@envkeeper.com")
    INITIAL_ADMIN_PASSWORD: str = os.getenv("INITIAL_ADMIN_PASSWORD", "Admin@123456")
    INITIAL_ADMIN_NAME: str = os.getenv("INITIAL_ADMIN_NAME", "Super Admin")

    @property
    def cors_origins_list(self) -> List[str]:
        return [origin.strip() for origin in self.ALLOWED_ORIGINS.split(",") if origin.strip()]

    @property
    def all_aes_keys_list(self) -> List[str]:
        """Returns ordered list of all active and fallback AES keys configured in .env"""
        keys = []
        if self.AES_KEY_BASE64:
            keys.extend([k.strip() for k in self.AES_KEY_BASE64.split(",") if k.strip()])
        if self.FALLBACK_AES_KEYS:
            keys.extend([k.strip() for k in self.FALLBACK_AES_KEYS.split(",") if k.strip()])
        # Deduplicate while preserving configured order
        seen = set()
        deduped = []
        for k in keys:
            if k not in seen:
                seen.add(k)
                deduped.append(k)
        return deduped

    class Config:
        env_file = ".env"
        extra = "allow"

settings = Settings()
