from typing import Tuple, Optional, List
from sqlalchemy.orm import Session
from app.models.user import User, UserRole, EmployeeLead
from app.models.folder import Folder, FolderPermission
from app.models.env_file import EnvFile

def get_assigned_employee_ids_for_lead(lead_id: str, db: Session) -> List[str]:
    """Returns list of employee IDs assigned to this lead"""
    links = db.query(EmployeeLead.employee_id).filter(EmployeeLead.lead_id == lead_id).all()
    return [l[0] for l in links]

def get_assigned_leads_for_employee(employee_id: str, db: Session) -> List[User]:
    """Returns list of Lead Users assigned to this employee"""
    links = db.query(EmployeeLead).filter(EmployeeLead.employee_id == employee_id).all()
    lead_ids = [l.lead_id for l in links]
    if not lead_ids:
        return []
    return db.query(User).filter(User.id.in_(lead_ids)).all()

def can_access_user_data(current_user: User, target_user_id: str, db: Session) -> bool:
    """Checks if current user is allowed to view target user's records"""
    if current_user.role == UserRole.ADMIN:
        return True
    if current_user.id == target_user_id:
        return True
    if current_user.role == UserRole.LEAD:
        assigned_ids = get_assigned_employee_ids_for_lead(current_user.id, db)
        return target_user_id in assigned_ids
    return False

def check_folder_access(current_user: User, folder: Folder, db: Session) -> Tuple[bool, Optional[str]]:
    """
    Checks access to a folder.
    Returns: (has_access: bool, access_level: 'OWNER' | 'WRITE' | 'READ' | None)
    """
    if folder.is_deleted:
        # Only admin, owner, or assigned Lead can see soft-deleted in recycle bin
        if current_user.role == UserRole.ADMIN or current_user.id == folder.owner_id:
            return True, "OWNER"
        if current_user.role == UserRole.LEAD:
            assigned_ids = get_assigned_employee_ids_for_lead(current_user.id, db)
            if folder.owner_id in assigned_ids:
                return True, "WRITE"
        return False, None

    # Admin has universal access
    if current_user.role == UserRole.ADMIN:
        return True, "WRITE"

    # Direct Owner
    if folder.owner_id == current_user.id:
        return True, "OWNER"

    # Lead can manage folders of assigned employees
    if current_user.role == UserRole.LEAD:
        assigned_ids = get_assigned_employee_ids_for_lead(current_user.id, db)
        if folder.owner_id in assigned_ids:
            return True, "WRITE"

    # Check direct folder permission
    direct_perm = db.query(FolderPermission).filter(
        FolderPermission.folder_id == folder.id,
        FolderPermission.user_id == current_user.id
    ).first()
    if direct_perm:
        return True, direct_perm.access_level

    # Check inherited permissions from parent folders
    curr_parent_id = folder.parent_id
    visited = set()
    while curr_parent_id and curr_parent_id not in visited:
        visited.add(curr_parent_id)
        parent_perm = db.query(FolderPermission).filter(
            FolderPermission.folder_id == curr_parent_id,
            FolderPermission.user_id == current_user.id
        ).first()
        if parent_perm:
            return True, parent_perm.access_level
        
        parent_folder = db.query(Folder).filter(Folder.id == curr_parent_id).first()
        if not parent_folder:
            break
        curr_parent_id = parent_folder.parent_id

    return False, None

def check_env_file_access(current_user: User, env_file: EnvFile, db: Session) -> Tuple[bool, Optional[str]]:
    """
    Checks access to an env file via its containing folder.
    """
    folder = db.query(Folder).filter(Folder.id == env_file.folder_id).first()
    if not folder:
        # Fallback check on env_file owner
        if current_user.role == UserRole.ADMIN:
            return True, "WRITE"
        if env_file.owner_id == current_user.id:
            return True, "OWNER"
        if current_user.role == UserRole.LEAD:
            assigned = get_assigned_employee_ids_for_lead(current_user.id, db)
            if env_file.owner_id in assigned:
                return True, "WRITE"
        return False, None

    return check_folder_access(current_user, folder, db)
