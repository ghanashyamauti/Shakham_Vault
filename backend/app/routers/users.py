from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User, UserRole, EmployeeLead
from app.schemas.auth import UserOut
from app.schemas.user import UserCreate, UserUpdate, AssignLeadsRequest, EmployeeWithLeadsOut, AdminPasswordReset
from app.models.folder import FolderPermission
from app.models.user import AccessRequest
from app.services.auth import get_current_user, require_lead_or_admin, require_admin, hash_password
from app.services.audit import log_audit_event
from app.services.permissions import (
    get_assigned_employee_ids_for_lead,
    get_assigned_leads_for_employee,
    can_access_user_data
)

router = APIRouter(prefix="/api/users", tags=["Users"])

@router.get("/leads", response_model=List[UserOut])
def get_all_leads(
    current_user: User = Depends(require_lead_or_admin),
    db: Session = Depends(get_db)
):
    """Returns list of all Leads (used by Admin/Lead when creating/assigning)"""
    leads = db.query(User).filter(User.role == UserRole.LEAD, User.is_active == True).all()
    return [UserOut.model_validate(l) for l in leads]

@router.get("", response_model=List[EmployeeWithLeadsOut])
def get_users(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Returns user directory based on role:
    - Admin: all users in company
    - Lead: assigned employees + all other employees (for request flow)
    - Employee: 403 (employees only see their own profile via /auth/me)
    """
    if current_user.role == UserRole.EMPLOYEE:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Employees do not have access to the user directory"
        )

    result = []
    if current_user.role == UserRole.ADMIN:
        users = db.query(User).order_by(User.created_at.desc()).all()
        for u in users:
            leads = []
            if u.role == UserRole.EMPLOYEE:
                leads = [UserOut.model_validate(lead) for lead in get_assigned_leads_for_employee(u.id, db)]
            u_out = UserOut.model_validate(u)
            result.append(EmployeeWithLeadsOut(**u_out.model_dump(), leads=leads))

    elif current_user.role == UserRole.LEAD:
        # Lead sees their assigned employees + other employees available to request access
        assigned_ids = set(get_assigned_employee_ids_for_lead(current_user.id, db))
        all_employees = db.query(User).filter(User.role == UserRole.EMPLOYEE).all()
        for emp in all_employees:
            leads = [UserOut.model_validate(lead) for lead in get_assigned_leads_for_employee(emp.id, db)]
            u_out = UserOut.model_validate(emp)
            result.append(EmployeeWithLeadsOut(**u_out.model_dump(), leads=leads))

    return result

@router.post("", response_model=EmployeeWithLeadsOut, status_code=status.HTTP_201_CREATED)
def create_user(
    user_in: UserCreate,
    request: Request,
    current_user: User = Depends(require_lead_or_admin),
    db: Session = Depends(get_db)
):
    """
    User creation with strict role boundaries:
    - Admin can create LEAD or EMPLOYEE. If creating EMPLOYEE, lead_ids is mandatory!
    - Lead can ONLY create EMPLOYEE. (Automatically assigned to this Lead)
    """
    target_role = user_in.role.upper()
    if target_role not in [UserRole.LEAD, UserRole.EMPLOYEE]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Role must be either LEAD or EMPLOYEE"
        )

    # Lead cannot create another Lead or Admin
    if current_user.role == UserRole.LEAD:
        if target_role != UserRole.EMPLOYEE:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Leads can only create Employees"
            )

    # Admin creating an Employee MUST assign at least one Lead
    if current_user.role == UserRole.ADMIN and target_role == UserRole.EMPLOYEE:
        if not user_in.lead_ids or len(user_in.lead_ids) == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Assigning at least one Lead is mandatory when creating an Employee"
            )

    # Check if email is already taken
    existing = db.query(User).filter(User.email == user_in.email.lower()).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with this email already exists"
        )

    # Create new user
    new_user = User(
        email=user_in.email.lower(),
        full_name=user_in.full_name,
        hashed_password=hash_password(user_in.password),
        role=target_role,
        is_active=True,
        created_by_id=current_user.id
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    assigned_leads = []
    # Handle Lead assignment for Employee
    if target_role == UserRole.EMPLOYEE:
        effective_lead_ids = set()
        if current_user.role == UserRole.LEAD:
            effective_lead_ids.add(current_user.id)
        elif current_user.role == UserRole.ADMIN and user_in.lead_ids:
            # Verify each lead exists and has role LEAD
            for lid in user_in.lead_ids:
                lead_obj = db.query(User).filter(User.id == lid, User.role == UserRole.LEAD).first()
                if lead_obj:
                    effective_lead_ids.add(lead_obj.id)

        for lid in effective_lead_ids:
            el = EmployeeLead(
                employee_id=new_user.id,
                lead_id=lid,
                assigned_by_id=current_user.id
            )
            db.add(el)
        db.commit()

        assigned_leads = [UserOut.model_validate(lead) for lead in get_assigned_leads_for_employee(new_user.id, db)]

    # Audit log
    client_ip = request.client.host if request.client else "unknown"
    log_audit_event(
        db=db,
        actor=current_user,
        action="USER_CREATED",
        target_type="USER",
        target_id=new_user.id,
        target_name=new_user.email,
        details={
            "role": new_user.role,
            "full_name": new_user.full_name,
            "assigned_leads": [l.email for l in assigned_leads]
        },
        ip_address=client_ip
    )

    u_out = UserOut.model_validate(new_user)
    return EmployeeWithLeadsOut(**u_out.model_dump(), leads=assigned_leads)

@router.put("/{user_id}", response_model=UserOut)
def update_user(
    user_id: str,
    user_update: UserUpdate,
    request: Request,
    current_user: User = Depends(require_lead_or_admin),
    db: Session = Depends(get_db)
):
    target_user = db.query(User).filter(User.id == user_id).first()
    if not target_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    # Lead can only modify their assigned employee
    if current_user.role == UserRole.LEAD:
        if target_user.role != UserRole.EMPLOYEE:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Leads can only edit employees")
        assigned = get_assigned_employee_ids_for_lead(current_user.id, db)
        if target_user.id not in assigned:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Permission denied for this employee")

    if user_update.full_name is not None and user_update.full_name.strip():
        target_user.full_name = user_update.full_name.strip()

    if user_update.email is not None and user_update.email.lower() != target_user.email:
        # Check uniqueness
        dup = db.query(User).filter(User.email == user_update.email.lower()).first()
        if dup and dup.id != target_user.id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email is already registered to another user")
        target_user.email = user_update.email.lower()

    if user_update.is_active is not None:
        target_user.is_active = user_update.is_active

    if user_update.role is not None:
        if current_user.role != UserRole.ADMIN:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only Admins can change user roles")
        target_role = user_update.role.upper()
        if target_role not in [UserRole.ADMIN, UserRole.LEAD, UserRole.EMPLOYEE]:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid role specified")
        target_user.role = target_role

    if user_update.password is not None and user_update.password.strip():
        if len(user_update.password) < 6:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Password must be at least 6 characters")
        target_user.hashed_password = hash_password(user_update.password)

    db.commit()
    db.refresh(target_user)

    log_audit_event(
        db=db,
        actor=current_user,
        action="USER_UPDATED",
        target_type="USER",
        target_id=target_user.id,
        target_name=target_user.email,
        details={"full_name": target_user.full_name, "email": target_user.email, "role": target_user.role, "is_active": target_user.is_active},
        ip_address=request.client.host if request.client else None
    )

    return UserOut.model_validate(target_user)

@router.post("/{user_id}/reset-password")
def reset_user_password(
    user_id: str,
    payload: AdminPasswordReset,
    request: Request,
    current_user: User = Depends(require_lead_or_admin),
    db: Session = Depends(get_db)
):
    """Admin resets any user password; Lead resets assigned employee password"""
    target_user = db.query(User).filter(User.id == user_id).first()
    if not target_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    if current_user.role == UserRole.LEAD:
        if target_user.role != UserRole.EMPLOYEE:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Leads can only reset passwords for employees")
        assigned = get_assigned_employee_ids_for_lead(current_user.id, db)
        if target_user.id not in assigned:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Permission denied for this employee")

    if not payload.new_password or len(payload.new_password) < 6:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Password must be at least 6 characters")

    target_user.hashed_password = hash_password(payload.new_password)
    db.commit()

    log_audit_event(
        db=db,
        actor=current_user,
        action="RESET_PASSWORD",
        target_type="USER",
        target_id=target_user.id,
        target_name=target_user.email,
        details={"reset_by": current_user.email, "role": current_user.role},
        ip_address=request.client.host if request.client else None
    )

    return {"message": f"Password reset successfully for {target_user.full_name}"}

@router.delete("/{user_id}")
def delete_user(
    user_id: str,
    request: Request,
    current_user: User = Depends(require_lead_or_admin),
    db: Session = Depends(get_db)
):
    """Admin can delete any user (except self); Lead can delete assigned employees"""
    if user_id == current_user.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="You cannot delete your own account")

    target_user = db.query(User).filter(User.id == user_id).first()
    if not target_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    if current_user.role == UserRole.LEAD:
        if target_user.role != UserRole.EMPLOYEE:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Leads can only delete employees")
        assigned = get_assigned_employee_ids_for_lead(current_user.id, db)
        if target_user.id not in assigned:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Permission denied for this employee")

    target_name = target_user.full_name
    target_email = target_user.email

    # Clean up associations safely
    db.query(EmployeeLead).filter((EmployeeLead.employee_id == user_id) | (EmployeeLead.lead_id == user_id)).delete()
    db.query(FolderPermission).filter(FolderPermission.user_id == user_id).delete()
    db.query(AccessRequest).filter((AccessRequest.lead_id == user_id) | (AccessRequest.employee_id == user_id)).delete()

    db.delete(target_user)
    db.commit()

    log_audit_event(
        db=db,
        actor=current_user,
        action="USER_DELETED",
        target_type="USER",
        target_id=user_id,
        target_name=target_email,
        details={"deleted_user": target_name, "deleted_by": current_user.email},
        ip_address=request.client.host if request.client else None
    )

    return {"message": f"User {target_name} ({target_email}) has been permanently deleted"}

@router.post("/{user_id}/assign-leads", response_model=EmployeeWithLeadsOut)
def assign_leads_to_employee(
    user_id: str,
    payload: AssignLeadsRequest,
    request: Request,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Admin assigns or updates Leads for an Employee"""
    emp = db.query(User).filter(User.id == user_id, User.role == UserRole.EMPLOYEE).first()
    if not emp:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee not found")

    if not payload.lead_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Employee must have at least one assigned Lead"
        )

    # Remove existing associations
    db.query(EmployeeLead).filter(EmployeeLead.employee_id == emp.id).delete()

    for lid in set(payload.lead_ids):
        lead_user = db.query(User).filter(User.id == lid, User.role == UserRole.LEAD).first()
        if lead_user:
            db.add(EmployeeLead(
                employee_id=emp.id,
                lead_id=lead_user.id,
                assigned_by_id=current_user.id
            ))
    db.commit()

    assigned_leads = [UserOut.model_validate(lead) for lead in get_assigned_leads_for_employee(emp.id, db)]

    log_audit_event(
        db=db,
        actor=current_user,
        action="LEADS_ASSIGNED",
        target_type="USER",
        target_id=emp.id,
        target_name=emp.email,
        details={"assigned_lead_ids": payload.lead_ids},
        ip_address=request.client.host if request.client else None
    )

    u_out = UserOut.model_validate(emp)
    return EmployeeWithLeadsOut(**u_out.model_dump(), leads=assigned_leads)
