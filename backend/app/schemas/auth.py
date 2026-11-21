from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class UserOut(BaseModel):
    id: str
    email: str
    full_name: str
    role: str
    is_active: bool
    created_at: datetime
    created_by_id: Optional[str] = None

    class Config:
        from_attributes = True

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut
