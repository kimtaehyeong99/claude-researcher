from sqlalchemy import Column, Integer, String, DateTime, UniqueConstraint
from sqlalchemy.sql import func

from app.database import Base


class UserFavorite(Base):
    """사용자별 즐겨찾기 관계 테이블"""
    __tablename__ = "user_favorites"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, nullable=False, index=True)
    paper_id = Column(String, nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        UniqueConstraint('username', 'paper_id', name='uq_user_paper_favorite'),
    )
