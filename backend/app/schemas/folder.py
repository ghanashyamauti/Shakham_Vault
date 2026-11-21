from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel
from app.schemas.auth import UserOut
from app.schemas.env_file import EnvFileOut

class FolderCreate(BaseModel):
    name: str
    parent_id: Optional[str] = None
    owner_id: Optional[str] = None  # Admin can specify owner

class FolderUpdate(BaseModel):
    name: Optional[str] = None
    parent_id: Optional[str] = None

class FolderDuplicate(BaseModel):
    target_parent_id: Optional[str] = None
    new_name: Optional[str] = None

class FolderShareRequest(BaseModel):
    user_id: str
    access_level: str = "READ"  # READ or WRITE

class FolderPermissionOut(BaseModel):
    id: str
    folder_id: str
    user_id: str
    user: UserOut
    access_level: str
    granted_by_id: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True

class FolderOut(BaseModel):
    id: str
    name: str
    parent_id: Optional[str] = None
    owner_id: str
    owner: Optional[UserOut] = None
    is_deleted: bool
    created_at: datetime
    updated_at: datetime
    permissions: List[FolderPermissionOut] = []
    env_files_count: int = 0
    subfolders_count: int = 0
    current_user_access: Optional[str] = "OWNER"  # OWNER, WRITE, READ

    class Config:
        from_attributes = True

class WorkspaceTreeOut(BaseModel):
    folders: List[FolderOut]
    files: List[EnvFileOut]
