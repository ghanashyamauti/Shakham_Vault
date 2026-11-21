import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.database import Base

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    actor_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    actor_name = Column(String(255), nullable=False)
    actor_email = Column(String(255), nullable=False)
    actor_role = Column(String(50), nullable=False)
    action = Column(String(100), nullable=False, index=True)
    target_type = Column(String(50), nullable=False, index=True)
    target_id = Column(String(36), nullable=True)
    target_name = Column(String(255), nullable=True)
    details = Column(Text, nullable=True)
    ip_address = Column(String(100), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    actor = relationship("User", foreign_keys=[actor_id])
