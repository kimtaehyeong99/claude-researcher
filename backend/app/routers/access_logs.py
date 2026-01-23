from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, Request, HTTPException, Header
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.access_log import AccessLog
from app.models.user import User
from app.config import settings

router = APIRouter()


class LoginRequest(BaseModel):
    username: str


class AdminAuthRequest(BaseModel):
    password: str


class AccessLogResponse(BaseModel):
    id: int
    username: str
    login_time: datetime
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None

    class Config:
        from_attributes = True


class LoginResponse(BaseModel):
    status: str
    login_time: datetime
    username: str


def verify_admin_password(x_admin_password: Optional[str] = Header(None)):
    """관리자 비밀번호 검증"""
    if not x_admin_password or x_admin_password != settings.ADMIN_PASSWORD:
        raise HTTPException(status_code=401, detail="관리자 인증이 필요합니다")
    return True


@router.post("/verify-admin")
def verify_admin(auth: AdminAuthRequest):
    """관리자 비밀번호 확인"""
    if auth.password == settings.ADMIN_PASSWORD:
        return {"status": "ok", "message": "인증 성공"}
    raise HTTPException(status_code=401, detail="비밀번호가 틀렸습니다")


@router.post("/login", response_model=LoginResponse)
def log_login(
    login_data: LoginRequest,
    request: Request,
    db: Session = Depends(get_db)
):
    """프론트엔드 로그인 시 접속 기록 저장 및 사용자 등록"""
    # 사용자가 users 테이블에 없으면 자동 추가
    existing_user = db.query(User).filter(User.username == login_data.username).first()
    if not existing_user:
        new_user = User(username=login_data.username)
        db.add(new_user)
        db.commit()

    # 접속 로그 기록
    log = AccessLog(
        username=login_data.username,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent")
    )
    db.add(log)
    db.commit()
    db.refresh(log)

    return LoginResponse(
        status="ok",
        login_time=log.login_time,
        username=log.username
    )


@router.get("/logs", response_model=List[AccessLogResponse])
def get_access_logs(
    db: Session = Depends(get_db),
    limit: int = 100,
    username: Optional[str] = None,
    _: bool = Depends(verify_admin_password)
):
    """접속 로그 조회 (관리자 전용)"""
    query = db.query(AccessLog)

    if username:
        query = query.filter(AccessLog.username == username)

    logs = query.order_by(AccessLog.login_time.desc()).limit(limit).all()
    return logs


class UserResponse(BaseModel):
    id: int
    username: str
    created_at: datetime
    is_active: bool

    class Config:
        from_attributes = True


@router.get("/users", response_model=List[str])
def get_users(db: Session = Depends(get_db)):
    """등록된 사용자 목록 조회 (로그인 모달용 - 인증 불필요)"""
    result = db.query(User).filter(User.is_active == True).order_by(User.username).all()
    return [u.username for u in result]


@router.get("/users/all", response_model=List[UserResponse])
def get_all_users(
    db: Session = Depends(get_db),
    _: bool = Depends(verify_admin_password)
):
    """모든 사용자 상세 조회 (관리자 전용)"""
    return db.query(User).order_by(User.created_at.desc()).all()


@router.post("/users", response_model=UserResponse)
def create_user(
    user_data: LoginRequest,
    db: Session = Depends(get_db)
):
    """새 사용자 등록"""
    existing = db.query(User).filter(User.username == user_data.username).first()
    if existing:
        if not existing.is_active:
            # 비활성화된 사용자 재활성화
            existing.is_active = True
            db.commit()
            db.refresh(existing)
            return existing
        raise HTTPException(status_code=400, detail="이미 존재하는 사용자입니다")

    new_user = User(username=user_data.username)
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user


@router.delete("/users/{username}")
def deactivate_user(
    username: str,
    db: Session = Depends(get_db),
    _: bool = Depends(verify_admin_password)
):
    """사용자 비활성화 (관리자 전용)"""
    user = db.query(User).filter(User.username == username).first()
    if not user:
        raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다")

    user.is_active = False
    db.commit()
    return {"status": "ok", "message": f"{username} 사용자가 비활성화되었습니다"}
