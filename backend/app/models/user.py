import uuid
from datetime import datetime
from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.database import Base

class UserRole:
    ADMIN = "ADMIN"
    LEAD = "LEAD"
    EMPLOYEE = "EMPLOYEE"

class User(Base):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    email = Column(String(255), unique=True, index=True, nullable=False)
    full_name = Column(String(255), nullable=False)
    hashed_password = Column(String(255), nullable=False)
    role = Column(String(20), nullable=False, default=UserRole.EMPLOYEE)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    created_by_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    # Relationships
    created_by = relationship("User", remote_side=[id], foreign_keys=[created_by_id])

class EmployeeLead(Base):
    __tablename__ = "employee_leads"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    employee_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    lead_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    assigned_by_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    assigned_at = Column(DateTime, default=datetime.utcnow)

    employee = relationship("User", foreign_keys=[employee_id])
    lead = relationship("User", foreign_keys=[lead_id])
    assigned_by = relationship("User", foreign_keys=[assigned_by_id])

class AccessRequest(Base):
    __tablename__ = "access_requests"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    lead_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    employee_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    status = Column(String(20), default="PENDING")  # PENDING, APPROVED, REJECTED
    reason = Column(Text, nullable=True)
    rejection_reason = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    reviewed_by_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    reviewed_at = Column(DateTime, nullable=True)

    lead = relationship("User", foreign_keys=[lead_id])
    employee = relationship("User", foreign_keys=[employee_id])
    reviewed_by = relationship("User", foreign_keys=[reviewed_by_id])
