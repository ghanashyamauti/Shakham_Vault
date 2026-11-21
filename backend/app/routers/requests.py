from datetime import datetime
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User, UserRole, AccessRequest, EmployeeLead
from app.schemas.auth import UserOut
from app.schemas.user import AccessRequestCreate, AccessRequestReview, AccessRequestOut
from app.services.auth import get_current_user, require_lead_or_admin, require_admin
from app.services.audit import log_audit_event
from app.services.permissions import get_assigned_employee_ids_for_lead

router = APIRouter(prefix="/api/requests", tags=["Access Requests"])

@router.post("", response_model=AccessRequestOut, status_code=status.HTTP_201_CREATED)
def create_access_request(
    payload: AccessRequestCreate,
    request: Request,
    current_user: User = Depends(require_lead_or_admin),
    db: Session = Depends(get_db)
):
    """
    Lead requests access to an Employee. Request goes to Admin for approval.
    """
    if current_user.role != UserRole.LEAD:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Leads can submit employee access requests"
        )

    # Check employee exists
    target_emp = db.query(User).filter(User.id == payload.employee_id, User.role == UserRole.EMPLOYEE).first()
    if not target_emp:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee not found")

    # Check if already assigned
    existing_link = db.query(EmployeeLead).filter(
        EmployeeLead.employee_id == payload.employee_id,
        EmployeeLead.lead_id == current_user.id
    ).first()
    if existing_link:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You are already assigned to this employee"
        )

    # Check if pending request exists
    existing_req = db.query(AccessRequest).filter(
        AccessRequest.employee_id == payload.employee_id,
        AccessRequest.lead_id == current_user.id,
        AccessRequest.status == "PENDING"
    ).first()
    if existing_req:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A pending access request for this employee already exists"
        )

    access_req = AccessRequest(
        lead_id=current_user.id,
        employee_id=payload.employee_id,
        status="PENDING",
        reason=payload.reason
    )
    db.add(access_req)
    db.commit()
    db.refresh(access_req)

    log_audit_event(
        db=db,
        actor=current_user,
        action="REQUEST_ACCESS",
        target_type="ACCESS_REQUEST",
        target_id=access_req.id,
        target_name=target_emp.email,
        details={"reason": payload.reason, "employee_id": target_emp.id},
        ip_address=request.client.host if request.client else None
    )

    lead_out = UserOut.model_validate(current_user)
    emp_out = UserOut.model_validate(target_emp)

    return AccessRequestOut(
        id=access_req.id,
        lead_id=current_user.id,
        lead=lead_out,
        employee_id=target_emp.id,
        employee=emp_out,
        status=access_req.status,
        reason=access_req.reason,
        created_at=access_req.created_at
    )

@router.get("", response_model=List[AccessRequestOut])
def get_access_requests(
    current_user: User = Depends(require_lead_or_admin),
    db: Session = Depends(get_db)
):
    """
    Returns list of requests:
    - Admin: all requests across the company
    - Lead: requests created by this Lead
    """
    query = db.query(AccessRequest).order_by(AccessRequest.created_at.desc())
    if current_user.role == UserRole.LEAD:
        query = query.filter(AccessRequest.lead_id == current_user.id)

    requests = query.all()
    results = []
    for r in requests:
        lead_out = UserOut.model_validate(r.lead)
        emp_out = UserOut.model_validate(r.employee)
        reviewed_by_out = UserOut.model_validate(r.reviewed_by) if r.reviewed_by else None
        results.append(AccessRequestOut(
            id=r.id,
            lead_id=r.lead_id,
            lead=lead_out,
            employee_id=r.employee_id,
            employee=emp_out,
            status=r.status,
            reason=r.reason,
            rejection_reason=r.rejection_reason,
            created_at=r.created_at,
            reviewed_by_id=r.reviewed_by_id,
            reviewed_by=reviewed_by_out,
            reviewed_at=r.reviewed_at
        ))
    return results

@router.post("/{request_id}/review", response_model=AccessRequestOut)
def review_access_request(
    request_id: str,
    review_data: AccessRequestReview,
    request: Request,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """
    Admin reviews (approves/rejects) a Lead's request to access an Employee.
    """
    access_req = db.query(AccessRequest).filter(AccessRequest.id == request_id).first()
    if not access_req:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Request not found")

    new_status = review_data.status.upper()
    if new_status not in ["APPROVED", "REJECTED"]:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Status must be APPROVED or REJECTED")

    access_req.status = new_status
    access_req.reviewed_by_id = current_user.id
    access_req.reviewed_at = datetime.utcnow()

    # If REJECTED, rejection_reason is mandatory
    if new_status == "REJECTED":
        if not review_data.rejection_reason or not review_data.rejection_reason.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A rejection reason is required when rejecting an access request"
            )
        access_req.rejection_reason = review_data.rejection_reason.strip()

    # If APPROVED, establish the EmployeeLead link
    if new_status == "APPROVED":
        existing_link = db.query(EmployeeLead).filter(
            EmployeeLead.employee_id == access_req.employee_id,
            EmployeeLead.lead_id == access_req.lead_id
        ).first()
        if not existing_link:
            link = EmployeeLead(
                employee_id=access_req.employee_id,
                lead_id=access_req.lead_id,
                assigned_by_id=current_user.id
            )
            db.add(link)

    db.commit()
    db.refresh(access_req)

    log_audit_event(
        db=db,
        actor=current_user,
        action=f"ACCESS_{new_status}",
        target_type="ACCESS_REQUEST",
        target_id=access_req.id,
        target_name=access_req.employee.email,
        details={
            "lead_email": access_req.lead.email,
            "employee_email": access_req.employee.email,
            "status": new_status,
            "rejection_reason": access_req.rejection_reason if new_status == "REJECTED" else None
        },
        ip_address=request.client.host if request.client else None
    )

    lead_out = UserOut.model_validate(access_req.lead)
    emp_out = UserOut.model_validate(access_req.employee)
    admin_out = UserOut.model_validate(current_user)

    return AccessRequestOut(
        id=access_req.id,
        lead_id=access_req.lead_id,
        lead=lead_out,
        employee_id=access_req.employee_id,
        employee=emp_out,
        status=access_req.status,
        reason=access_req.reason,
        rejection_reason=access_req.rejection_reason,
        created_at=access_req.created_at,
        reviewed_by_id=access_req.reviewed_by_id,
        reviewed_by=admin_out,
        reviewed_at=access_req.reviewed_at
    )
