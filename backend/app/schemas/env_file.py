from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, field_validator
from app.config import settings
from app.schemas.auth import UserOut

class EnvFileCreate(BaseModel):
    name: str = ".env"
    folder_id: str
    env_tag: str = "development"
    content: str = ""
    commit_message: str = "Initial commit"

    @field_validator("content")
    @classmethod
    def validate_content_size(cls, v: str) -> str:
        max_bytes = settings.MAX_PAYLOAD_SIZE_MB * 1024 * 1024
        if len(v.encode("utf-8")) > max_bytes:
            raise ValueError(f"Content exceeds maximum allowed size of {settings.MAX_PAYLOAD_SIZE_MB}MB")
        return v

class EnvFileUpdate(BaseModel):
    name: Optional[str] = None
    env_tag: Optional[str] = None
    folder_id: Optional[str] = None

class EnvFileDuplicate(BaseModel):
    target_folder_id: Optional[str] = None
    new_name: Optional[str] = None

class EnvCommitCreate(BaseModel):
    content: str
    commit_message: str = "Update environment variables"

    @field_validator("content")
    @classmethod
    def validate_content_size(cls, v: str) -> str:
        max_bytes = settings.MAX_PAYLOAD_SIZE_MB * 1024 * 1024
        if len(v.encode("utf-8")) > max_bytes:
            raise ValueError(f"Content exceeds maximum allowed size of {settings.MAX_PAYLOAD_SIZE_MB}MB")
        return v

class EnvCommitOut(BaseModel):
    id: str
    env_file_id: str
    author_id: Optional[str] = None
    author: Optional[UserOut] = None
    commit_message: str
    commit_hash: str
    created_at: datetime

    class Config:
        from_attributes = True

class EnvFileOut(BaseModel):
    id: str
    name: str
    folder_id: str
    owner_id: str
    owner: Optional[UserOut] = None
    env_tag: str
    is_deleted: bool
    created_at: datetime
    updated_at: datetime
    latest_commit: Optional[EnvCommitOut] = None

    class Config:
        from_attributes = True

class EnvContentOut(BaseModel):
    env_file_id: str
    name: str
    env_tag: str
    folder_id: str
    content: str
    commit_hash: str
    commit_message: str
    created_at: datetime
    author_name: str
    author_email: str
    can_edit: bool = True

class DiffLine(BaseModel):
    type: str  # "same", "add", "del"
    content: str
    old_lineno: Optional[int] = None
    new_lineno: Optional[int] = None

class DiffOut(BaseModel):
    old_commit_hash: Optional[str] = None
    new_commit_hash: str
    lines: List[DiffLine]
