from sqlalchemy import Column, Integer, String, Boolean, DateTime, Date
from sqlalchemy.sql import func

from app.database import Base


class Paper(Base):
    __tablename__ = "papers"

    id = Column(Integer, primary_key=True, index=True)
    paper_id = Column(String, unique=True, index=True, nullable=False)  # e.g., 2306.02437
    arxiv_date = Column(Date, nullable=True)
    title = Column(String, nullable=True)
    search_stage = Column(Integer, default=1)  # 1, 2, or 3
    is_favorite = Column(Boolean, default=False)
    is_not_interested = Column(Boolean, default=False)
    citation_count = Column(Integer, default=0)
    registered_by = Column(String, nullable=True)  # 등록자 이름 (e.g., "태형", "원호")
    figure_url = Column(String, nullable=True)  # 논문 첫 Figure 이미지 URL (ar5iv에서 추출)
    matched_keywords = Column(String, nullable=True)  # 매칭된 키워드 목록 (JSON 배열 문자열)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
