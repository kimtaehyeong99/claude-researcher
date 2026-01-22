from pydantic import BaseModel
from datetime import date, datetime
from typing import Optional, List


class PaperBase(BaseModel):
    paper_id: str
    arxiv_date: Optional[date] = None
    title: Optional[str] = None


class PaperCreate(PaperBase):
    citation_count: int = 0


class PaperResponse(PaperBase):
    id: int
    search_stage: int
    is_favorite: bool
    is_not_interested: bool
    citation_count: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class PaperDetailResponse(PaperResponse):
    abstract_ko: Optional[str] = None  # 2단계: 초록 요약
    detailed_analysis_ko: Optional[str] = None  # 3단계: 전체 논문 분석


class PaperListResponse(BaseModel):
    papers: List[PaperResponse]
    total: int


class RegisterNewRequest(BaseModel):
    paper_id: str  # e.g., "2306.02437"


class RegisterCitationsRequest(BaseModel):
    paper_id: str  # e.g., "2306.02437"
    limit: int = 50  # Maximum number of citing papers to register
