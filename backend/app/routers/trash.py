from typing import List, Dict, Any
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User, UserRole
from app.models.folder import Folder
from app.models.env_file import EnvFile
from app.services.auth import get_current_user
from app.services.permissions import get_assigned_employee_ids_for_lead

router = APIRouter(prefix="/api/trash", tags=["Trash / Recycle Bin"])

@router.get("")
def get_trash_items(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """Returns all soft-deleted folders and env files within user's scope"""
    folder_q = db.query(Folder).filter(Folder.is_deleted == True)
    env_q = db.query(EnvFile).filter(EnvFile.is_deleted == True)

    if current_user.role == UserRole.ADMIN:
        deleted_folders = folder_q.order_by(Folder.deleted_at.desc()).all()
        deleted_envs = env_q.order_by(EnvFile.deleted_at.desc()).all()
    elif current_user.role == UserRole.LEAD:
        assigned_ids = get_assigned_employee_ids_for_lead(current_user.id, db)
        allowed = [current_user.id] + assigned_ids
        deleted_folders = folder_q.filter(Folder.owner_id.in_(allowed)).order_by(Folder.deleted_at.desc()).all()
        deleted_envs = env_q.filter(EnvFile.owner_id.in_(allowed)).order_by(EnvFile.deleted_at.desc()).all()
    else:
        deleted_folders = folder_q.filter(Folder.owner_id == current_user.id).order_by(Folder.deleted_at.desc()).all()
        deleted_envs = env_q.filter(EnvFile.owner_id == current_user.id).order_by(EnvFile.deleted_at.desc()).all()

    return {
        "folders": [
            {
                "id": f.id,
                "name": f.name,
                "parent_id": f.parent_id,
                "owner_id": f.owner_id,
                "owner_name": f.owner.full_name if f.owner else "Unknown",
                "deleted_at": f.deleted_at,
            }
            for f in deleted_folders
        ],
        "env_files": [
            {
                "id": e.id,
                "name": e.name,
                "folder_id": e.folder_id,
                "folder_name": e.folder.name if e.folder else "Unknown",
                "owner_id": e.owner_id,
                "owner_name": e.owner.full_name if e.owner else "Unknown",
                "env_tag": e.env_tag,
                "deleted_at": e.deleted_at,
            }
            for e in deleted_envs
        ]
    }
