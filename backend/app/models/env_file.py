import uuid
from datetime import datetime
from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.database import Base

class EnvFile(Base):
    __tablename__ = "env_files"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(255), nullable=False, default=".env")
    folder_id = Column(String(36), ForeignKey("folders.id", ondelete="CASCADE"), nullable=False, index=True)
    owner_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    env_tag = Column(String(50), default="development")
    is_deleted = Column(Boolean, default=False, index=True)
    deleted_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    folder = relationship("Folder", back_populates="env_files")
    owner = relationship("User", foreign_keys=[owner_id])
    commits = relationship("EnvCommit", back_populates="env_file", cascade="all, delete-orphan", order_by="desc(EnvCommit.created_at)")

class EnvCommit(Base):
    __tablename__ = "env_commits"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    env_file_id = Column(String(36), ForeignKey("env_files.id", ondelete="CASCADE"), nullable=False, index=True)
    author_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    encrypted_content = Column(Text, nullable=False)
    nonce = Column(String(64), nullable=False)
    commit_message = Column(String(255), nullable=False, default="Initial commit")
    commit_hash = Column(String(16), nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    env_file = relationship("EnvFile", back_populates="commits")
    author = relationship("User", foreign_keys=[author_id])
