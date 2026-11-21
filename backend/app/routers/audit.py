from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User, UserRole
from app.models.audit import AuditLog
from app.schemas.audit import AuditLogOut
from app.services.auth import get_current_user
from app.services.permissions import get_assigned_employee_ids_for_lead

router = APIRouter(prefix="/api/audit", tags=["Audit Logs"])

@router.get("", response_model=List[AuditLogOut])
def get_audit_logs(
    action: Optional[str] = None,
    target_type: Optional[str] = None,
    actor_id: Optional[str] = None,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Returns audit trail:
    - Admin: all activities company-wide
    - Lead: activities of self and assigned employees
    - Employee: activities of self
    """
    query = db.query(AuditLog)

    if current_user.role == UserRole.ADMIN:
        pass  # Global visibility
    elif current_user.role == UserRole.LEAD:
        assigned_ids = get_assigned_employee_ids_for_lead(current_user.id, db)
        allowed_actors = [current_user.id] + assigned_ids
        query = query.filter(AuditLog.actor_id.in_(allowed_actors))
    else:
        query = query.filter(AuditLog.actor_id == current_user.id)

    if action:
        query = query.filter(AuditLog.action == action.upper())
    if target_type:
        query = query.filter(AuditLog.target_type == target_type.upper())
    if actor_id:
        query = query.filter(AuditLog.actor_id == actor_id)

    logs = query.order_by(AuditLog.created_at.desc()).offset(offset).limit(limit).all()
    return [AuditLogOut.model_validate(l) for l in logs]
