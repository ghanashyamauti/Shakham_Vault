from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, EmailStr, field_validator
from app.schemas.auth import UserOut

class UserCreate(BaseModel):
    email: EmailStr
    full_name: str
    password: str
    role: str  # ADMIN, LEAD, EMPLOYEE
    lead_ids: Optional[List[str]] = []  # Mandatory when Admin creates EMPLOYEE

    @field_validator("password")
    @classmethod
    def validate_password_strength(cls, v: str) -> str:
        if not v or len(v.strip()) < 8:
            raise ValueError("Password must be at least 8 characters long")
        return v

class ProfileUpdate(BaseModel):
    full_name: str

class PasswordChange(BaseModel):
    current_password: str
    new_password: str

class AdminPasswordReset(BaseModel):
    new_password: str

    @field_validator("new_password")
    @classmethod
    def validate_reset_password(cls, v: str) -> str:
        if not v or len(v.strip()) < 8:
            raise ValueError("Password must be at least 8 characters long")
        return v

class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    email: Optional[EmailStr] = None
    is_active: Optional[bool] = None
    role: Optional[str] = None
    password: Optional[str] = None

class AssignLeadsRequest(BaseModel):
    employee_id: str
    lead_ids: List[str]

class AccessRequestCreate(BaseModel):
    employee_id: str
    reason: Optional[str] = None

class AccessRequestReview(BaseModel):
    status: str  # APPROVED or REJECTED
    rejection_reason: Optional[str] = None

class AccessRequestOut(BaseModel):
    id: str
    lead_id: str
    lead: UserOut
    employee_id: str
    employee: UserOut
    status: str
    reason: Optional[str] = None
    rejection_reason: Optional[str] = None
    created_at: datetime
    reviewed_by_id: Optional[str] = None
    reviewed_by: Optional[UserOut] = None
    reviewed_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class EmployeeWithLeadsOut(UserOut):
    leads: List[UserOut] = []
