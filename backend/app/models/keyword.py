from sqlalchemy import Column, Integer, String, DateTime, UniqueConstraint
from sqlalchemy.sql import func

from app.database import Base


class UserKeyword(Base):
    """사용자 관심 키워드 테이블"""
    __tablename__ = "user_keywords"

    id = Column(Integer, primary_key=True, index=True)
    keyword = Column(String, nullable=False, index=True)  # unique 제거 - 카테고리별로 같은 키워드 허용
    category = Column(String, nullable=True, index=True)  # 키워드 카테고리 (예: "방법론", "도메인", "모델")
    color = Column(String, default="#3b82f6")  # 하이라이트 색상
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # 같은 카테고리 내에서만 키워드 중복 불가
    __table_args__ = (
        UniqueConstraint('keyword', 'category', name='uq_keyword_category'),
    )
