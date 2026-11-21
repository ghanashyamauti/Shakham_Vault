import json
from sqlalchemy.orm import Session
from app.models.audit import AuditLog
from app.models.user import User

def log_audit_event(
    db: Session,
    actor: User,
    action: str,
    target_type: str,
    target_id: str = None,
    target_name: str = None,
    details: dict = None,
    ip_address: str = None
):
    """
    Logs an action to the audit_logs table.
    """
    try:
        details_str = json.dumps(details) if details else None
        audit = AuditLog(
            actor_id=actor.id if actor else None,
            actor_name=actor.full_name if actor else "System",
            actor_email=actor.email if actor else "system@envkeeper.com",
            actor_role=actor.role if actor else "SYSTEM",
            action=action,
            target_type=target_type,
            target_id=str(target_id) if target_id else None,
            target_name=target_name,
            details=details_str,
            ip_address=ip_address
        )
        db.add(audit)
        db.commit()
    except Exception as e:
        db.rollback()
        print(f"[Audit Log Error] Failed to write audit event: {e}")
