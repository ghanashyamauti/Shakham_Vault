import os
import sys

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.database import engine, Base, SessionLocal
from app.models import (
    User,
    UserRole,
    EmployeeLead,
    AccessRequest,
    Folder,
    FolderPermission,
    EnvFile,
    EnvCommit,
    AuditLog
)
from app.config import settings
from app.services.auth import hash_password

def init_db():
    print("[*] Connecting to PostgreSQL and creating tables if not exists...")
    Base.metadata.create_all(bind=engine)
    print("[+] All database tables created/verified successfully!")

    db = SessionLocal()
    try:
        # Check if any admin already exists
        admin = db.query(User).filter(User.role == UserRole.ADMIN).first()
        if not admin:
            admin = User(
                email=settings.INITIAL_ADMIN_EMAIL.lower(),
                full_name=settings.INITIAL_ADMIN_NAME,
                hashed_password=hash_password(settings.INITIAL_ADMIN_PASSWORD),
                role=UserRole.ADMIN,
                is_active=True
            )
            db.add(admin)
            db.commit()
            print(f"[+] Initial Admin created successfully from .env: {admin.email}")
        else:
            print(f"[*] Admin user already exists: {admin.email}")
    except Exception as e:
        db.rollback()
        print(f"[!] Error creating initial admin: {e}")
        raise e
    finally:
        db.close()

if __name__ == "__main__":
    init_db()
