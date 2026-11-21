import hashlib
import difflib
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User, UserRole
from app.models.folder import Folder
from app.models.env_file import EnvFile, EnvCommit
from app.schemas.auth import UserOut
from app.schemas.env_file import (
    EnvFileCreate,
    EnvFileUpdate,
    EnvFileDuplicate,
    EnvCommitCreate,
    EnvFileOut,
    EnvCommitOut,
    EnvContentOut,
    DiffOut,
    DiffLine
)
from app.services.auth import get_current_user
from app.services.encryption import crypto_service
from app.services.audit import log_audit_event
from app.services.permissions import check_env_file_access, check_folder_access

router = APIRouter(prefix="/api/envs", tags=["Environment Files"])

def generate_commit_hash(content: str, author_id: str) -> str:
    timestamp = datetime.utcnow().isoformat()
    raw = f"{content}:{author_id}:{timestamp}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:8]

def build_commit_out(commit: EnvCommit) -> EnvCommitOut:
    author_out = UserOut.model_validate(commit.author) if commit.author else None
    return EnvCommitOut(
        id=commit.id,
        env_file_id=commit.env_file_id,
        author_id=commit.author_id,
        author=author_out,
        commit_message=commit.commit_message,
        commit_hash=commit.commit_hash,
        created_at=commit.created_at
    )

def build_env_file_out(env_file: EnvFile) -> EnvFileOut:
    owner_out = UserOut.model_validate(env_file.owner) if env_file.owner else None
    latest_c = env_file.commits[0] if env_file.commits else None
    latest_out = build_commit_out(latest_c) if latest_c else None
    return EnvFileOut(
        id=env_file.id,
        name=env_file.name,
        folder_id=env_file.folder_id,
        owner_id=env_file.owner_id,
        owner=owner_out,
        env_tag=env_file.env_tag,
        is_deleted=env_file.is_deleted,
        created_at=env_file.created_at,
        updated_at=env_file.updated_at,
        latest_commit=latest_out
    )

@router.get("/folder/{folder_id}", response_model=List[EnvFileOut])
def get_env_files_in_folder(
    folder_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Lists all active env files in a folder"""
    folder = db.query(Folder).filter(Folder.id == folder_id, Folder.is_deleted == False).first()
    if not folder:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Folder not found")

    has_access, _ = check_folder_access(current_user, folder, db)
    if not has_access:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied to folder")

    files = db.query(EnvFile).filter(
        EnvFile.folder_id == folder_id,
        EnvFile.is_deleted == False
    ).order_by(EnvFile.name.asc()).all()

    return [build_env_file_out(f) for f in files]

@router.post("", response_model=EnvFileOut, status_code=status.HTTP_201_CREATED)
def create_env_file(
    env_in: EnvFileCreate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Creates a new .env file with initial content and initial commit"""
    folder = db.query(Folder).filter(Folder.id == env_in.folder_id, Folder.is_deleted == False).first()
    if not folder:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Folder not found")

    has_access, access_level = check_folder_access(current_user, folder, db)
    if not has_access or access_level not in ["OWNER", "WRITE"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Write permission required to create .env file in this folder")

    new_env = EnvFile(
        name=env_in.name.strip() or ".env",
        folder_id=folder.id,
        owner_id=folder.owner_id,
        env_tag=env_in.env_tag.lower()
    )
    db.add(new_env)
    db.commit()
    db.refresh(new_env)

    # Encrypt initial content using AES-256-GCM
    ciphertext_b64, nonce_b64 = crypto_service.encrypt(env_in.content or "")
    commit_hash = generate_commit_hash(env_in.content or "", current_user.id)

    initial_commit = EnvCommit(
        env_file_id=new_env.id,
        author_id=current_user.id,
        encrypted_content=ciphertext_b64,
        nonce=nonce_b64,
        commit_message=env_in.commit_message or "Initial commit",
        commit_hash=commit_hash
    )
    db.add(initial_commit)
    db.commit()
    db.refresh(new_env)

    log_audit_event(
        db=db,
        actor=current_user,
        action="CREATE_ENV_FILE",
        target_type="ENV_FILE",
        target_id=new_env.id,
        target_name=new_env.name,
        details={
            "folder_name": folder.name,
            "commit_hash": commit_hash,
            "commit_message": initial_commit.commit_message
        },
        ip_address=request.client.host if request.client else None
    )

    return build_env_file_out(new_env)

@router.get("/{env_file_id}", response_model=EnvContentOut)
def get_env_file_content(
    env_file_id: str,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Decrypts and returns the content of the latest commit.
    Logs VIEW_SECRET event for security audit.
    """
    env_file = db.query(EnvFile).filter(EnvFile.id == env_file_id, EnvFile.is_deleted == False).first()
    if not env_file:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Environment file not found")

    has_access, access_level = check_env_file_access(current_user, env_file, db)
    if not has_access:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied to this file")

    latest_commit = db.query(EnvCommit).filter(EnvCommit.env_file_id == env_file.id).order_by(EnvCommit.created_at.desc()).first()
    if not latest_commit:
        decrypted_content = ""
        c_hash = "00000000"
        c_msg = "No commits yet"
        c_date = env_file.created_at
        author_name = "Unknown"
        author_email = "unknown"
    else:
        decrypted_content = crypto_service.decrypt(latest_commit.encrypted_content, latest_commit.nonce)
        c_hash = latest_commit.commit_hash
        c_msg = latest_commit.commit_message
        c_date = latest_commit.created_at
        author_name = latest_commit.author.full_name if latest_commit.author else "System"
        author_email = latest_commit.author.email if latest_commit.author else "unknown"

    # Log secret view event
    log_audit_event(
        db=db,
        actor=current_user,
        action="VIEW_SECRET",
        target_type="ENV_FILE",
        target_id=env_file.id,
        target_name=env_file.name,
        details={"commit_hash": c_hash},
        ip_address=request.client.host if request.client else None
    )

    can_edit = access_level in ["OWNER", "WRITE"]

    return EnvContentOut(
        env_file_id=env_file.id,
        name=env_file.name,
        env_tag=env_file.env_tag,
        folder_id=env_file.folder_id,
        content=decrypted_content,
        commit_hash=c_hash,
        commit_message=c_msg,
        created_at=c_date,
        author_name=author_name,
        author_email=author_email,
        can_edit=can_edit
    )

@router.put("/{env_file_id}", response_model=EnvFileOut)
def update_env_file(
    env_file_id: str,
    env_in: EnvFileUpdate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Renames or moves an env file to a different folder"""
    env_file = db.query(EnvFile).filter(EnvFile.id == env_file_id, EnvFile.is_deleted == False).first()
    if not env_file:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")

    has_access, access_level = check_env_file_access(current_user, env_file, db)
    if not has_access or access_level not in ["OWNER", "WRITE"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Write permission required to edit file")

    old_name = env_file.name
    old_folder_id = env_file.folder_id
    actions_performed = []

    if env_in.name and env_in.name.strip():
        env_file.name = env_in.name.strip()
        actions_performed.append(f"rename from '{old_name}' to '{env_file.name}'")

    if env_in.env_tag and env_in.env_tag.strip():
        env_file.env_tag = env_in.env_tag.strip().lower()
        actions_performed.append(f"change tag to '{env_file.env_tag}'")

    if env_in.folder_id and env_in.folder_id != env_file.folder_id:
        target_folder = db.query(Folder).filter(Folder.id == env_in.folder_id, Folder.is_deleted == False).first()
        if not target_folder:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Destination folder not found")
        dest_access, dest_level = check_folder_access(current_user, target_folder, db)
        if not dest_access or dest_level not in ["OWNER", "WRITE"]:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Write permission required in destination folder")
        env_file.folder_id = target_folder.id
        actions_performed.append(f"move to folder '{target_folder.name}'")

    env_file.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(env_file)

    log_audit_event(
        db=db,
        actor=current_user,
        action="UPDATE_ENV_FILE",
        target_type="ENV_FILE",
        target_id=env_file.id,
        target_name=env_file.name,
        details={"changes": ", ".join(actions_performed), "old_folder_id": old_folder_id, "new_folder_id": env_file.folder_id},
        ip_address=request.client.host if request.client else None
    )

    return build_env_file_out(env_file)

@router.post("/{env_file_id}/duplicate", response_model=EnvFileOut, status_code=status.HTTP_201_CREATED)
def duplicate_env_file(
    env_file_id: str,
    dup_in: EnvFileDuplicate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Duplicates an existing .env file along with its latest decrypted content"""
    src_file = db.query(EnvFile).filter(EnvFile.id == env_file_id, EnvFile.is_deleted == False).first()
    if not src_file:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Source file not found")

    has_access, _ = check_env_file_access(current_user, src_file, db)
    if not has_access:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied to source file")

    target_folder_id = dup_in.target_folder_id or src_file.folder_id
    target_folder = db.query(Folder).filter(Folder.id == target_folder_id, Folder.is_deleted == False).first()
    if not target_folder:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Destination folder not found")

    dest_access, dest_level = check_folder_access(current_user, target_folder, db)
    if not dest_access or dest_level not in ["OWNER", "WRITE"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Write permission required in destination folder")

    # Name for duplicate - ensure unique naming in target folder
    existing_files = db.query(EnvFile.name).filter(EnvFile.folder_id == target_folder.id, EnvFile.is_deleted == False).all()
    existing_names = {f[0] for f in existing_files}

    if dup_in.new_name and dup_in.new_name.strip():
        new_name = dup_in.new_name.strip()
    else:
        base = src_file.name
        candidate = f"{base}.copy"
        counter = 1
        while candidate in existing_names:
            counter += 1
            candidate = f"{base}.copy{counter}"
        new_name = candidate

    # Get latest content
    latest_commit = db.query(EnvCommit).filter(EnvCommit.env_file_id == src_file.id).order_by(EnvCommit.created_at.desc()).first()
    latest_content = crypto_service.decrypt(latest_commit.encrypted_content, latest_commit.nonce) if latest_commit else ""

    # Create new file
    new_env = EnvFile(
        name=new_name,
        folder_id=target_folder.id,
        owner_id=target_folder.owner_id,
        env_tag=src_file.env_tag
    )
    db.add(new_env)
    db.commit()
    db.refresh(new_env)

    # Initial commit with copied content
    ciphertext_b64, nonce_b64 = crypto_service.encrypt(latest_content)
    commit_hash = generate_commit_hash(latest_content, current_user.id)
    initial_commit = EnvCommit(
        env_file_id=new_env.id,
        author_id=current_user.id,
        encrypted_content=ciphertext_b64,
        nonce=nonce_b64,
        commit_message=f"Duplicated from {src_file.name}",
        commit_hash=commit_hash
    )
    db.add(initial_commit)
    db.commit()
    db.refresh(new_env)

    log_audit_event(
        db=db,
        actor=current_user,
        action="DUPLICATE_ENV_FILE",
        target_type="ENV_FILE",
        target_id=new_env.id,
        target_name=new_env.name,
        details={"source_file_id": src_file.id, "source_file_name": src_file.name, "folder_id": target_folder.id},
        ip_address=request.client.host if request.client else None
    )

    return build_env_file_out(new_env)

@router.post("/{env_file_id}/copy-log")
def log_secret_copy(
    env_file_id: str,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Logs an audit event when the user copies secret content to clipboard"""
    env_file = db.query(EnvFile).filter(EnvFile.id == env_file_id).first()
    if not env_file:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")

    log_audit_event(
        db=db,
        actor=current_user,
        action="COPY_SECRET",
        target_type="ENV_FILE",
        target_id=env_file.id,
        target_name=env_file.name,
        details={"copied_to_clipboard": True},
        ip_address=request.client.host if request.client else None
    )
    return {"message": "Copy event logged"}

@router.post("/{env_file_id}/commit", response_model=EnvCommitOut)
def commit_env_file(
    env_file_id: str,
    commit_in: EnvCommitCreate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Saves a new Git-like commit snapshot for the .env file"""
    env_file = db.query(EnvFile).filter(EnvFile.id == env_file_id, EnvFile.is_deleted == False).first()
    if not env_file:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")

    has_access, access_level = check_env_file_access(current_user, env_file, db)
    if not has_access or access_level not in ["OWNER", "WRITE"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Write permission required to commit changes")

    # Encrypt with AES-256-GCM
    ciphertext_b64, nonce_b64 = crypto_service.encrypt(commit_in.content or "")
    commit_hash = generate_commit_hash(commit_in.content or "", current_user.id)

    commit = EnvCommit(
        env_file_id=env_file.id,
        author_id=current_user.id,
        encrypted_content=ciphertext_b64,
        nonce=nonce_b64,
        commit_message=commit_in.commit_message.strip() or "Updated environment variables",
        commit_hash=commit_hash
    )
    db.add(commit)
    env_file.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(commit)

    log_audit_event(
        db=db,
        actor=current_user,
        action="COMMIT_ENV",
        target_type="ENV_FILE",
        target_id=env_file.id,
        target_name=env_file.name,
        details={
            "commit_hash": commit_hash,
            "commit_message": commit.commit_message
        },
        ip_address=request.client.host if request.client else None
    )

    return build_commit_out(commit)

@router.get("/{env_file_id}/commits", response_model=List[EnvCommitOut])
def get_commit_history(
    env_file_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Returns chronological commit history (newest first)"""
    env_file = db.query(EnvFile).filter(EnvFile.id == env_file_id).first()
    if not env_file:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")

    has_access, _ = check_env_file_access(current_user, env_file, db)
    if not has_access:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    commits = db.query(EnvCommit).filter(EnvCommit.env_file_id == env_file.id).order_by(EnvCommit.created_at.desc()).all()
    return [build_commit_out(c) for c in commits]

@router.get("/{env_file_id}/commits/{commit_hash}", response_model=EnvContentOut)
def get_historical_commit_content(
    env_file_id: str,
    commit_hash: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Inspects the exact content of an older commit"""
    env_file = db.query(EnvFile).filter(EnvFile.id == env_file_id).first()
    if not env_file:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")

    has_access, access_level = check_env_file_access(current_user, env_file, db)
    if not has_access:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    commit = db.query(EnvCommit).filter(
        EnvCommit.env_file_id == env_file.id,
        EnvCommit.commit_hash == commit_hash
    ).first()
    if not commit:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Commit not found")

    content = crypto_service.decrypt(commit.encrypted_content, commit.nonce)
    author_name = commit.author.full_name if commit.author else "System"
    author_email = commit.author.email if commit.author else "unknown"

    return EnvContentOut(
        env_file_id=env_file.id,
        name=env_file.name,
        env_tag=env_file.env_tag,
        folder_id=env_file.folder_id,
        content=content,
        commit_hash=commit.commit_hash,
        commit_message=commit.commit_message,
        created_at=commit.created_at,
        author_name=author_name,
        author_email=author_email,
        can_edit=access_level in ["OWNER", "WRITE"]
    )

@router.post("/{env_file_id}/revert/{commit_hash}", response_model=EnvCommitOut)
def revert_to_commit(
    env_file_id: str,
    commit_hash: str,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Restores content from a historical commit as a new commit"""
    env_file = db.query(EnvFile).filter(EnvFile.id == env_file_id, EnvFile.is_deleted == False).first()
    if not env_file:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")

    has_access, access_level = check_env_file_access(current_user, env_file, db)
    if not has_access or access_level not in ["OWNER", "WRITE"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Write permission required to revert")

    target_commit = db.query(EnvCommit).filter(
        EnvCommit.env_file_id == env_file.id,
        EnvCommit.commit_hash == commit_hash
    ).first()
    if not target_commit:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Target commit not found")

    restored_content = crypto_service.decrypt(target_commit.encrypted_content, target_commit.nonce)
    ciphertext_b64, nonce_b64 = crypto_service.encrypt(restored_content)
    new_hash = generate_commit_hash(restored_content, current_user.id)

    new_commit = EnvCommit(
        env_file_id=env_file.id,
        author_id=current_user.id,
        encrypted_content=ciphertext_b64,
        nonce=nonce_b64,
        commit_message=f"Revert to commit {commit_hash}: '{target_commit.commit_message}'",
        commit_hash=new_hash
    )
    db.add(new_commit)
    env_file.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(new_commit)

    log_audit_event(
        db=db,
        actor=current_user,
        action="REVERT_ENV",
        target_type="ENV_FILE",
        target_id=env_file.id,
        target_name=env_file.name,
        details={"reverted_to_hash": commit_hash, "new_commit_hash": new_hash},
        ip_address=request.client.host if request.client else None
    )

    return build_commit_out(new_commit)

@router.get("/{env_file_id}/diff", response_model=DiffOut)
def get_commit_diff(
    env_file_id: str,
    from_hash: Optional[str] = None,
    to_hash: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Computes a GitHub-style line diff between two commits.
    If no hashes given, compares latest commit with its immediate predecessor.
    """
    env_file = db.query(EnvFile).filter(EnvFile.id == env_file_id).first()
    if not env_file:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")

    has_access, _ = check_env_file_access(current_user, env_file, db)
    if not has_access:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    commits = db.query(EnvCommit).filter(EnvCommit.env_file_id == env_file.id).order_by(EnvCommit.created_at.desc()).all()
    if not commits:
        return DiffOut(old_commit_hash=None, new_commit_hash="none", lines=[])

    if to_hash:
        new_commit = next((c for c in commits if c.commit_hash == to_hash), commits[0])
    else:
        new_commit = commits[0]

    if from_hash:
        old_commit = next((c for c in commits if c.commit_hash == from_hash), None)
    else:
        # Default to preceding commit
        idx = commits.index(new_commit)
        old_commit = commits[idx + 1] if idx + 1 < len(commits) else None

    new_content = crypto_service.decrypt(new_commit.encrypted_content, new_commit.nonce)
    old_content = crypto_service.decrypt(old_commit.encrypted_content, old_commit.nonce) if old_commit else ""

    old_lines = old_content.splitlines(keepends=False)
    new_lines = new_content.splitlines(keepends=False)

    diff_lines: List[DiffLine] = []
    matcher = difflib.SequenceMatcher(None, old_lines, new_lines)

    for tag, i1, i2, j1, j2 in matcher.get_opcodes():
        if tag == "equal":
            for i, line in enumerate(old_lines[i1:i2]):
                diff_lines.append(DiffLine(type="same", content=line, old_lineno=i1 + i + 1, new_lineno=j1 + i + 1))
        elif tag == "replace":
            for i, line in enumerate(old_lines[i1:i2]):
                diff_lines.append(DiffLine(type="del", content=line, old_lineno=i1 + i + 1, new_lineno=None))
            for j, line in enumerate(new_lines[j1:j2]):
                diff_lines.append(DiffLine(type="add", content=line, old_lineno=None, new_lineno=j1 + j + 1))
        elif tag == "delete":
            for i, line in enumerate(old_lines[i1:i2]):
                diff_lines.append(DiffLine(type="del", content=line, old_lineno=i1 + i + 1, new_lineno=None))
        elif tag == "insert":
            for j, line in enumerate(new_lines[j1:j2]):
                diff_lines.append(DiffLine(type="add", content=line, old_lineno=None, new_lineno=j1 + j + 1))

    return DiffOut(
        old_commit_hash=old_commit.commit_hash if old_commit else None,
        new_commit_hash=new_commit.commit_hash,
        lines=diff_lines
    )

@router.delete("/{env_file_id}")
def delete_env_file(
    env_file_id: str,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Soft-deletes env file (moves to trash)"""
    env_file = db.query(EnvFile).filter(EnvFile.id == env_file_id, EnvFile.is_deleted == False).first()
    if not env_file:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")

    has_access, access_level = check_env_file_access(current_user, env_file, db)
    if not has_access or access_level not in ["OWNER", "WRITE"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Write permission required to delete")

    env_file.is_deleted = True
    env_file.deleted_at = datetime.utcnow()
    db.commit()

    log_audit_event(
        db=db,
        actor=current_user,
        action="DELETE_ENV_FILE",
        target_type="ENV_FILE",
        target_id=env_file.id,
        target_name=env_file.name,
        details={"soft_delete": True},
        ip_address=request.client.host if request.client else None
    )

    return {"message": "File moved to trash"}

@router.post("/{env_file_id}/restore")
def restore_env_file(
    env_file_id: str,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Restores soft-deleted env file from trash"""
    env_file = db.query(EnvFile).filter(EnvFile.id == env_file_id, EnvFile.is_deleted == True).first()
    if not env_file:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found in trash")

    has_access, access_level = check_env_file_access(current_user, env_file, db)
    if not has_access or access_level not in ["OWNER", "WRITE"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Permission denied")

    # If containing folder is soft-deleted, restore folder as well so the restored file is visible
    parent_folder = db.query(Folder).filter(Folder.id == env_file.folder_id).first()
    if parent_folder and parent_folder.is_deleted:
        parent_folder.is_deleted = False
        parent_folder.deleted_at = None

    env_file.is_deleted = False
    env_file.deleted_at = None
    db.commit()

    log_audit_event(
        db=db,
        actor=current_user,
        action="RESTORE_ENV_FILE",
        target_type="ENV_FILE",
        target_id=env_file.id,
        target_name=env_file.name,
        details={"restored": True},
        ip_address=request.client.host if request.client else None
    )

    return {"message": "File restored successfully"}

@router.delete("/{env_file_id}/permanent")
def permanent_delete_env_file(
    env_file_id: str,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Permanently deletes env file"""
    env_file = db.query(EnvFile).filter(EnvFile.id == env_file_id).first()
    if not env_file:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")

    if current_user.role != UserRole.ADMIN and env_file.owner_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only Admin or Owner can permanently delete")

    file_name = env_file.name
    db.delete(env_file)
    db.commit()

    log_audit_event(
        db=db,
        actor=current_user,
        action="PERMANENT_DELETE_ENV_FILE",
        target_type="ENV_FILE",
        target_id=env_file_id,
        target_name=file_name,
        details={"permanent": True},
        ip_address=request.client.host if request.client else None
    )

    return {"message": "File permanently deleted"}
