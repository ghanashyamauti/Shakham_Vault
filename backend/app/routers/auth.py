from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User, UserRole
from app.schemas.auth import LoginRequest, TokenResponse, UserOut
from app.schemas.user import EmployeeWithLeadsOut, ProfileUpdate, PasswordChange
from app.services.auth import verify_password, hash_password, create_access_token, get_current_user
from app.services.audit import log_audit_event
from app.services.permissions import get_assigned_leads_for_employee
from app.services.rate_limiter import auth_limiter

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

@router.post("/login", response_model=TokenResponse)
def login(login_data: LoginRequest, request: Request, db: Session = Depends(get_db)):
    client_ip = request.client.host if request.client else "unknown"
    auth_limiter.check_rate_limit(f"login:{client_ip}")

    user = db.query(User).filter(User.email == login_data.email.lower()).first()
    if not user or not verify_password(login_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Account is inactive. Please contact your administrator."
        )

    access_token = create_access_token(data={"sub": user.id, "role": user.role})

    # Log audit event
    client_ip = request.client.host if request.client else "unknown"
    log_audit_event(
        db=db,
        actor=user,
        action="LOGIN",
        target_type="USER",
        target_id=user.id,
        target_name=user.email,
        details={"ip": client_ip},
        ip_address=client_ip
    )

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        user=UserOut.model_validate(user)
    )

@router.get("/me", response_model=EmployeeWithLeadsOut)
def get_current_user_profile(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    assigned_leads = []
    if current_user.role == UserRole.EMPLOYEE:
        assigned_leads = [UserOut.model_validate(lead) for lead in get_assigned_leads_for_employee(current_user.id, db)]
    
    user_out = UserOut.model_validate(current_user)
    return EmployeeWithLeadsOut(
        **user_out.model_dump(),
        leads=assigned_leads
    )

@router.put("/me/profile", response_model=UserOut)
def update_my_profile(
    payload: ProfileUpdate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Any authenticated user can update their own display name"""
    if not payload.full_name or not payload.full_name.strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Name cannot be empty")

    old_name = current_user.full_name
    current_user.full_name = payload.full_name.strip()
    db.commit()
    db.refresh(current_user)

    client_ip = request.client.host if request.client else "unknown"
    log_audit_event(
        db=db,
        actor=current_user,
        action="UPDATE_PROFILE",
        target_type="USER",
        target_id=current_user.id,
        target_name=current_user.email,
        details={"old_name": old_name, "new_name": current_user.full_name},
        ip_address=client_ip
    )

    return UserOut.model_validate(current_user)

@router.put("/me/password")
def change_my_password(
    payload: PasswordChange,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Any authenticated user can change their own password with current password verification"""
    client_ip = request.client.host if request.client else "unknown"
    auth_limiter.check_rate_limit(f"pwd_change:{current_user.id}")

    if not verify_password(payload.current_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect"
        )

    if not payload.new_password or len(payload.new_password) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password must be at least 6 characters long"
        )

    current_user.hashed_password = hash_password(payload.new_password)
    db.commit()

    client_ip = request.client.host if request.client else "unknown"
    log_audit_event(
        db=db,
        actor=current_user,
        action="CHANGE_PASSWORD",
        target_type="USER",
        target_id=current_user.id,
        target_name=current_user.email,
        details={"self_service": True},
        ip_address=client_ip
    )

    return {"message": "Password updated successfully"}
