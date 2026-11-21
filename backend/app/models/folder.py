import uuid
from datetime import datetime
from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship, backref
from app.database import Base

class Folder(Base):
    __tablename__ = "folders"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(255), nullable=False)
    parent_id = Column(String(36), ForeignKey("folders.id", ondelete="CASCADE"), nullable=True, index=True)
    owner_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    is_deleted = Column(Boolean, default=False, index=True)
    deleted_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    owner = relationship("User", foreign_keys=[owner_id])
    parent = relationship("Folder", remote_side=[id], backref=backref("subfolders", cascade="all, delete-orphan"))
    permissions = relationship("FolderPermission", back_populates="folder", cascade="all, delete-orphan")
    env_files = relationship("EnvFile", back_populates="folder", cascade="all, delete-orphan")

class FolderPermission(Base):
    __tablename__ = "folder_permissions"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    folder_id = Column(String(36), ForeignKey("folders.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    access_level = Column(String(10), nullable=False, default="READ")  # READ or WRITE
    granted_by_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    folder = relationship("Folder", back_populates="permissions")
    user = relationship("User", foreign_keys=[user_id])
    granted_by = relationship("User", foreign_keys=[granted_by_id])
