from datetime import datetime
import hashlib
from typing import List, Optional, Set, Dict
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy import func
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User, UserRole
from app.models.folder import Folder, FolderPermission
from app.models.env_file import EnvFile, EnvCommit
from app.schemas.auth import UserOut
from app.schemas.folder import (
    FolderCreate,
    FolderUpdate,
    FolderDuplicate,
    FolderShareRequest,
    FolderOut,
    FolderPermissionOut,
    WorkspaceTreeOut
)
from app.routers.envs import build_env_file_out
from app.services.auth import get_current_user
from app.services.audit import log_audit_event
from app.services.encryption import crypto_service
from app.services.permissions import (
    check_folder_access,
    get_assigned_employee_ids_for_lead,
    can_access_user_data
)

router = APIRouter(prefix="/api/folders", tags=["Folders"])

def build_folder_out(
    folder: Folder,
    current_user: User,
    db: Session,
    cached_assigned_lead_ids: Optional[Set[str]] = None,
    sub_count_map: Optional[Dict[str, int]] = None,
    env_count_map: Optional[Dict[str, int]] = None
) -> FolderOut:
    if current_user.role == UserRole.ADMIN:
        access_level = "WRITE"
    elif folder.owner_id == current_user.id:
        access_level = "OWNER"
    elif current_user.role == UserRole.LEAD and cached_assigned_lead_ids is not None and folder.owner_id in cached_assigned_lead_ids:
        access_level = "WRITE"
    else:
        has_access, access_level = check_folder_access(current_user, folder, db)
    
    # Subfolders and env files count from map if provided, else single count
    sub_count = sub_count_map.get(folder.id, 0) if sub_count_map is not None else db.query(Folder).filter(Folder.parent_id == folder.id, Folder.is_deleted == False).count()
    env_count = env_count_map.get(folder.id, 0) if env_count_map is not None else db.query(EnvFile).filter(EnvFile.folder_id == folder.id, EnvFile.is_deleted == False).count()
    
    # Permissions list
    perms_out = []
    for p in folder.permissions:
        perms_out.append(FolderPermissionOut(
            id=p.id,
            folder_id=p.folder_id,
            user_id=p.user_id,
            user=UserOut.model_validate(p.user),
            access_level=p.access_level,
            granted_by_id=p.granted_by_id,
            created_at=p.created_at
        ))

    owner_out = UserOut.model_validate(folder.owner) if folder.owner else None

    return FolderOut(
        id=folder.id,
        name=folder.name,
        parent_id=folder.parent_id,
        owner_id=folder.owner_id,
        owner=owner_out,
        is_deleted=folder.is_deleted,
        created_at=folder.created_at,
        updated_at=folder.updated_at,
        permissions=perms_out,
        env_files_count=env_count,
        subfolders_count=sub_count,
        current_user_access=access_level
    )

@router.get("/tree", response_model=WorkspaceTreeOut)
def get_workspace_tree(
    owner_id: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Superfast unified workspace endpoint:
    Returns ALL accessible folders and files in a single, high-performance query batch.
    """
    folder_query = db.query(Folder).filter(Folder.is_deleted == False)

    cached_assigned = set()
    if current_user.role == UserRole.LEAD:
        cached_assigned = set(get_assigned_employee_ids_for_lead(current_user.id, db))

    if owner_id:
        if not can_access_user_data(current_user, owner_id, db):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
        folder_query = folder_query.filter(Folder.owner_id == owner_id)
    else:
        if current_user.role == UserRole.ADMIN:
            pass  # Admin sees all active folders
        elif current_user.role == UserRole.LEAD:
            shared_folder_ids = [s[0] for s in db.query(FolderPermission.folder_id).filter(FolderPermission.user_id == current_user.id).all()]
            folder_query = folder_query.filter(
                (Folder.owner_id.in_([current_user.id] + list(cached_assigned))) | (Folder.id.in_(shared_folder_ids))
            )
        else:
            shared_folder_ids = [s[0] for s in db.query(FolderPermission.folder_id).filter(FolderPermission.user_id == current_user.id).all()]
            folder_query = folder_query.filter(
                (Folder.owner_id == current_user.id) | (Folder.id.in_(shared_folder_ids))
            )

    folders = folder_query.order_by(Folder.name.asc()).all()
    folder_ids = [f.id for f in folders]

    # Batch counts
    sub_counts: Dict[str, int] = {}
    env_counts: Dict[str, int] = {}
    if folder_ids:
        sub_raw = db.query(Folder.parent_id, func.count(Folder.id)).filter(Folder.parent_id.in_(folder_ids), Folder.is_deleted == False).group_by(Folder.parent_id).all()
        sub_counts = {str(row[0]): int(row[1]) for row in sub_raw if row[0]}

        env_raw = db.query(EnvFile.folder_id, func.count(EnvFile.id)).filter(EnvFile.folder_id.in_(folder_ids), EnvFile.is_deleted == False).group_by(EnvFile.folder_id).all()
        env_counts = {str(row[0]): int(row[1]) for row in env_raw if row[0]}

    folders_out = [
        build_folder_out(f, current_user, db, cached_assigned, sub_counts, env_counts)
        for f in folders
    ]

    # Fetch all active env files in these folders in 1 query
    files_out = []
    if folder_ids:
        files = db.query(EnvFile).filter(
            EnvFile.folder_id.in_(folder_ids),
            EnvFile.is_deleted == False
        ).order_by(EnvFile.name.asc()).all()
        files_out = [build_env_file_out(file) for file in files]

    return WorkspaceTreeOut(folders=folders_out, files=files_out)

@router.get("", response_model=List[FolderOut])
def get_folders(
    parent_id: Optional[str] = None,
    owner_id: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Returns folders accessible to the current user.
    - If owner_id is specified (Lead or Admin viewing an employee's folders)
    - If owner_id is None, shows user's own root folders + folders explicitly shared with them.
    """
    query = db.query(Folder).filter(Folder.is_deleted == False)

    if parent_id is not None:
        query = query.filter(Folder.parent_id == parent_id)
    else:
        query = query.filter(Folder.parent_id == None)

    if owner_id:
        # Check if caller can access owner_id's data
        if not can_access_user_data(current_user, owner_id, db):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied to requested user's folders")
        query = query.filter(Folder.owner_id == owner_id)
        folders = query.order_by(Folder.name.asc()).all()
    else:
        # If no specific owner requested:
        if current_user.role == UserRole.ADMIN:
            # Admin sees all root folders
            folders = query.order_by(Folder.name.asc()).all()
        elif current_user.role == UserRole.LEAD:
            # Lead sees own folders + folders of assigned employees + shared folders
            assigned_ids = get_assigned_employee_ids_for_lead(current_user.id, db)
            relevant_owners = [current_user.id] + assigned_ids
            # Also get folders where Lead has permission
            shared_folder_ids = db.query(FolderPermission.folder_id).filter(FolderPermission.user_id == current_user.id).all()
            shared_ids = [s[0] for s in shared_folder_ids]
            
            folders = query.filter(
                (Folder.owner_id.in_(relevant_owners)) | (Folder.id.in_(shared_ids))
            ).order_by(Folder.name.asc()).all()
        else:
            # Employee only sees own folders + folders shared with them
            shared_folder_ids = db.query(FolderPermission.folder_id).filter(FolderPermission.user_id == current_user.id).all()
            shared_ids = [s[0] for s in shared_folder_ids]
            folders = query.filter(
                (Folder.owner_id == current_user.id) | (Folder.id.in_(shared_ids))
            ).order_by(Folder.name.asc()).all()

    return [build_folder_out(f, current_user, db) for f in folders]

@router.post("", response_model=FolderOut, status_code=status.HTTP_201_CREATED)
def create_folder(
    folder_in: FolderCreate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Determine folder owner
    effective_owner_id = current_user.id
    if folder_in.owner_id and folder_in.owner_id != current_user.id:
        if current_user.role == UserRole.ADMIN:
            effective_owner_id = folder_in.owner_id
        elif current_user.role == UserRole.LEAD:
            assigned = get_assigned_employee_ids_for_lead(current_user.id, db)
            if folder_in.owner_id in assigned:
                effective_owner_id = folder_in.owner_id
            else:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot create folder for unassigned employee")
        else:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Employees cannot create folders for other users")

    # If parent_id specified, check permission on parent folder
    if folder_in.parent_id:
        parent = db.query(Folder).filter(Folder.id == folder_in.parent_id, Folder.is_deleted == False).first()
        if not parent:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Parent folder not found")
        has_access, access_level = check_folder_access(current_user, parent, db)
        if not has_access or access_level not in ["OWNER", "WRITE"]:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Write permission required on parent folder")
        # Inherit parent's owner if creating subfolder in someone else's shared folder
        effective_owner_id = parent.owner_id

    new_folder = Folder(
        name=folder_in.name.strip(),
        parent_id=folder_in.parent_id,
        owner_id=effective_owner_id
    )
    db.add(new_folder)
    db.commit()
    db.refresh(new_folder)

    log_audit_event(
        db=db,
        actor=current_user,
        action="CREATE_FOLDER",
        target_type="FOLDER",
        target_id=new_folder.id,
        target_name=new_folder.name,
        details={"parent_id": new_folder.parent_id, "owner_id": effective_owner_id},
        ip_address=request.client.host if request.client else None
    )

    return build_folder_out(new_folder, current_user, db)

def is_descendant_of(candidate_id: Optional[str], ancestor_id: str, db: Session) -> bool:
    """Returns True if candidate_id is ancestor_id or any nested descendant of ancestor_id"""
    curr = candidate_id
    visited = set()
    while curr and curr not in visited:
        if curr == ancestor_id:
            return True
        visited.add(curr)
        f = db.query(Folder.parent_id).filter(Folder.id == curr).first()
        if not f:
            break
        curr = f[0]
    return False

def duplicate_folder_tree(
    src_folder: Folder,
    target_parent_id: Optional[str],
    effective_owner_id: str,
    new_name: str,
    current_user: User,
    db: Session
) -> Folder:
    """Recursively duplicates a folder and all its child subfolders and env files"""
    new_folder = Folder(
        name=new_name,
        parent_id=target_parent_id,
        owner_id=effective_owner_id
    )
    db.add(new_folder)
    db.commit()
    db.refresh(new_folder)

    # Clone direct files
    src_files = db.query(EnvFile).filter(EnvFile.folder_id == src_folder.id, EnvFile.is_deleted == False).all()
    for sf in src_files:
        latest_commit = db.query(EnvCommit).filter(EnvCommit.env_file_id == sf.id).order_by(EnvCommit.created_at.desc()).first()
        content = crypto_service.decrypt(latest_commit.encrypted_content, latest_commit.nonce) if latest_commit else ""
        new_file = EnvFile(
            name=sf.name,
            folder_id=new_folder.id,
            owner_id=effective_owner_id,
            env_tag=sf.env_tag
        )
        db.add(new_file)
        db.commit()
        db.refresh(new_file)

        ct, nonce = crypto_service.encrypt(content)
        chash = hashlib.sha256(f"{content}:{current_user.id}:{datetime.utcnow().isoformat()}".encode("utf-8")).hexdigest()[:8]
        com = EnvCommit(
            env_file_id=new_file.id,
            author_id=current_user.id,
            commit_hash=chash,
            encrypted_content=ct,
            nonce=nonce,
            commit_message=f"Copied with folder {src_folder.name}"
        )
        db.add(com)

    db.commit()

    # Recursively duplicate all active child subfolders
    child_folders = db.query(Folder).filter(Folder.parent_id == src_folder.id, Folder.is_deleted == False).all()
    for child in child_folders:
        duplicate_folder_tree(child, new_folder.id, effective_owner_id, child.name, current_user, db)

    return new_folder

@router.put("/{folder_id}", response_model=FolderOut)
def update_folder(
    folder_id: str,
    folder_update: FolderUpdate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    folder = db.query(Folder).filter(Folder.id == folder_id, Folder.is_deleted == False).first()
    if not folder:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Folder not found")

    has_access, access_level = check_folder_access(current_user, folder, db)
    if not has_access or access_level not in ["OWNER", "WRITE"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Write permission required to edit folder")

    old_name = folder.name
    changes = []

    if folder_update.name and folder_update.name.strip():
        folder.name = folder_update.name.strip()
        changes.append(f"rename from '{old_name}' to '{folder.name}'")

    if folder_update.parent_id is not None:
        target_parent = None if folder_update.parent_id in ["", "root", "none", "null"] else folder_update.parent_id
        if target_parent != folder.parent_id:
            if target_parent == folder.id or (target_parent and is_descendant_of(target_parent, folder.id, db)):
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Folder cannot be moved into itself or its own subfolder")
            if target_parent:
                parent = db.query(Folder).filter(Folder.id == target_parent, Folder.is_deleted == False).first()
                if not parent:
                    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Destination parent folder not found")
                p_has, p_lvl = check_folder_access(current_user, parent, db)
                if not p_has or p_lvl not in ["OWNER", "WRITE"]:
                    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Write permission required in destination folder")
            folder.parent_id = target_parent
            changes.append(f"moved to parent {target_parent or 'root'}")

    folder.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(folder)

    log_audit_event(
        db=db,
        actor=current_user,
        action="UPDATE_FOLDER",
        target_type="FOLDER",
        target_id=folder.id,
        target_name=folder.name,
        details={"changes": ", ".join(changes), "old_name": old_name, "new_name": folder.name, "parent_id": folder.parent_id},
        ip_address=request.client.host if request.client else None
    )

    return build_folder_out(folder, current_user, db)

@router.post("/{folder_id}/duplicate", response_model=FolderOut, status_code=status.HTTP_201_CREATED)
def duplicate_folder(
    folder_id: str,
    dup_in: FolderDuplicate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Duplicates a folder and recursively clones all subfolders and active .env files"""
    src_folder = db.query(Folder).filter(Folder.id == folder_id, Folder.is_deleted == False).first()
    if not src_folder:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Source folder not found")

    has_access, _ = check_folder_access(current_user, src_folder, db)
    if not has_access:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied to source folder")

    target_parent_id = dup_in.target_parent_id
    if target_parent_id in ["", "root", "none", "null"]:
        target_parent_id = None

    effective_owner_id = current_user.id
    if target_parent_id:
        target_parent = db.query(Folder).filter(Folder.id == target_parent_id, Folder.is_deleted == False).first()
        if not target_parent:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Destination parent folder not found")
        dest_access, dest_lvl = check_folder_access(current_user, target_parent, db)
        if not dest_access or dest_lvl not in ["OWNER", "WRITE"]:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Write permission required in destination folder")
        effective_owner_id = target_parent.owner_id

    # Compute new folder name
    if dup_in.new_name and dup_in.new_name.strip():
        new_name = dup_in.new_name.strip()
    elif target_parent_id == src_folder.parent_id:
        new_name = f"{src_folder.name} (Copy)"
    else:
        new_name = src_folder.name

    new_folder = duplicate_folder_tree(
        src_folder=src_folder,
        target_parent_id=target_parent_id,
        effective_owner_id=effective_owner_id,
        new_name=new_name,
        current_user=current_user,
        db=db
    )

    log_audit_event(
        db=db,
        actor=current_user,
        action="DUPLICATE_FOLDER",
        target_type="FOLDER",
        target_id=new_folder.id,
        target_name=new_folder.name,
        details={"source_folder_id": src_folder.id, "source_folder_name": src_folder.name, "parent_id": target_parent_id},
        ip_address=request.client.host if request.client else None
    )

    return build_folder_out(new_folder, current_user, db)

@router.delete("/{folder_id}")
def delete_folder(
    folder_id: str,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Soft-delete folder and all nested subfolders and env files (moves to trash)"""
    folder = db.query(Folder).filter(Folder.id == folder_id, Folder.is_deleted == False).first()
    if not folder:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Folder not found")

    has_access, access_level = check_folder_access(current_user, folder, db)
    if not has_access or access_level not in ["OWNER", "WRITE"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Write permission required to delete folder")

    now = datetime.utcnow()

    # Collect all descendant folder IDs recursively
    descendant_ids = []
    queue = [folder.id]
    while queue:
        curr = queue.pop(0)
        children = [f[0] for f in db.query(Folder.id).filter(Folder.parent_id == curr, Folder.is_deleted == False).all()]
        descendant_ids.extend(children)
        queue.extend(children)

    all_folder_ids = [folder.id] + descendant_ids

    # Soft-delete all folders and all files inside them
    db.query(Folder).filter(Folder.id.in_(all_folder_ids)).update(
        {"is_deleted": True, "deleted_at": now}, synchronize_session=False
    )
    db.query(EnvFile).filter(EnvFile.folder_id.in_(all_folder_ids), EnvFile.is_deleted == False).update(
        {"is_deleted": True, "deleted_at": now}, synchronize_session=False
    )
    db.commit()

    log_audit_event(
        db=db,
        actor=current_user,
        action="DELETE_FOLDER",
        target_type="FOLDER",
        target_id=folder.id,
        target_name=folder.name,
        details={"soft_delete": True, "cascade_folders_count": len(all_folder_ids)},
        ip_address=request.client.host if request.client else None
    )

    return {"message": "Folder moved to trash"}

@router.post("/{folder_id}/restore")
def restore_folder(
    folder_id: str,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Restores folder and its contained subfolders and env files from trash"""
    folder = db.query(Folder).filter(Folder.id == folder_id, Folder.is_deleted == True).first()
    if not folder:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Folder not found in trash")

    if current_user.role != UserRole.ADMIN and folder.owner_id != current_user.id:
        if current_user.role == UserRole.LEAD:
            assigned = get_assigned_employee_ids_for_lead(current_user.id, db)
            if folder.owner_id not in assigned:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Permission denied")
        else:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Permission denied")

    # If parent folder is soft-deleted or missing, place restored folder at root so it is immediately accessible
    if folder.parent_id:
        parent = db.query(Folder).filter(Folder.id == folder.parent_id).first()
        if not parent or parent.is_deleted:
            folder.parent_id = None

    folder.is_deleted = False
    folder.deleted_at = None

    # Collect deleted descendant folders
    descendant_ids = []
    queue = [folder.id]
    while queue:
        curr = queue.pop(0)
        children = [f[0] for f in db.query(Folder.id).filter(Folder.parent_id == curr, Folder.is_deleted == True).all()]
        descendant_ids.extend(children)
        queue.extend(children)

    all_folder_ids = [folder.id] + descendant_ids
    db.query(Folder).filter(Folder.id.in_(all_folder_ids)).update(
        {"is_deleted": False, "deleted_at": None}, synchronize_session=False
    )
    db.query(EnvFile).filter(EnvFile.folder_id.in_(all_folder_ids)).update(
        {"is_deleted": False, "deleted_at": None}, synchronize_session=False
    )
    db.commit()

    log_audit_event(
        db=db,
        actor=current_user,
        action="RESTORE_FOLDER",
        target_type="FOLDER",
        target_id=folder.id,
        target_name=folder.name,
        details={"restored": True},
        ip_address=request.client.host if request.client else None
    )

    return {"message": "Folder restored successfully"}

@router.delete("/{folder_id}/permanent")
def permanent_delete_folder(
    folder_id: str,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Permanently delete folder (Admin or Lead owner)"""
    folder = db.query(Folder).filter(Folder.id == folder_id).first()
    if not folder:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Folder not found")

    if current_user.role != UserRole.ADMIN and folder.owner_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only Admin or Owner can permanently delete")

    folder_name = folder.name
    db.delete(folder)
    db.commit()

    log_audit_event(
        db=db,
        actor=current_user,
        action="PERMANENT_DELETE_FOLDER",
        target_type="FOLDER",
        target_id=folder_id,
        target_name=folder_name,
        details={"permanent": True},
        ip_address=request.client.host if request.client else None
    )

    return {"message": "Folder permanently deleted"}

@router.post("/{folder_id}/share", response_model=FolderPermissionOut)
def share_folder(
    folder_id: str,
    payload: FolderShareRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Admin or Lead owner shares a folder with an employee or lead (READ or WRITE)"""
    folder = db.query(Folder).filter(Folder.id == folder_id, Folder.is_deleted == False).first()
    if not folder:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Folder not found")

    # Only Admin or folder owner (or Lead of owner) can share
    if current_user.role != UserRole.ADMIN and folder.owner_id != current_user.id:
        if current_user.role == UserRole.LEAD:
            assigned = get_assigned_employee_ids_for_lead(current_user.id, db)
            if folder.owner_id not in assigned:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot share this folder")
        else:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only Admin or Lead can share folders")

    target_user = db.query(User).filter(User.id == payload.user_id).first()
    if not target_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Target user not found")

    access_level = payload.access_level.upper()
    if access_level not in ["READ", "WRITE"]:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Access level must be READ or WRITE")

    # Upsert permission
    perm = db.query(FolderPermission).filter(
        FolderPermission.folder_id == folder.id,
        FolderPermission.user_id == target_user.id
    ).first()

    if perm:
        perm.access_level = access_level
        perm.granted_by_id = current_user.id
    else:
        perm = FolderPermission(
            folder_id=folder.id,
            user_id=target_user.id,
            access_level=access_level,
            granted_by_id=current_user.id
        )
        db.add(perm)

    db.commit()
    db.refresh(perm)

    log_audit_event(
        db=db,
        actor=current_user,
        action="SHARE_FOLDER",
        target_type="FOLDER",
        target_id=folder.id,
        target_name=folder.name,
        details={"shared_with_email": target_user.email, "access_level": access_level},
        ip_address=request.client.host if request.client else None
    )

    return FolderPermissionOut(
        id=perm.id,
        folder_id=perm.folder_id,
        user_id=perm.user_id,
        user=UserOut.model_validate(target_user),
        access_level=perm.access_level,
        granted_by_id=perm.granted_by_id,
        created_at=perm.created_at
    )

@router.delete("/{folder_id}/share/{user_id}")
def revoke_folder_share(
    folder_id: str,
    user_id: str,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Revokes a user's permission to a shared folder"""
    perm = db.query(FolderPermission).filter(
        FolderPermission.folder_id == folder_id,
        FolderPermission.user_id == user_id
    ).first()
    if not perm:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Permission not found")

    folder = perm.folder
    if current_user.role != UserRole.ADMIN and folder.owner_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Permission denied")

    target_user_email = perm.user.email if perm.user else user_id
    db.delete(perm)
    db.commit()

    log_audit_event(
        db=db,
        actor=current_user,
        action="REVOKE_FOLDER_SHARE",
        target_type="FOLDER",
        target_id=folder_id,
        target_name=folder.name,
        details={"revoked_user_email": target_user_email},
        ip_address=request.client.host if request.client else None
    )

    return {"message": "Folder access revoked"}
