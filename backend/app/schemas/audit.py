from datetime import datetime
from typing import Optional
from pydantic import BaseModel

class AuditLogOut(BaseModel):
    id: str
    actor_id: Optional[str] = None
    actor_name: str
    actor_email: str
    actor_role: str
    action: str
    target_type: str
    target_id: Optional[str] = None
    target_name: Optional[str] = None
    details: Optional[str] = None
    ip_address: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True
