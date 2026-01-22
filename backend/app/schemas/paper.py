import json
from pydantic import BaseModel, field_validator
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
    registered_by: Optional[str] = None  # 등록자 이름
    figure_url: Optional[str] = None  # 논문 첫 Figure 이미지 URL
    matched_keywords: Optional[List[str]] = None  # 매칭된 키워드 목록
    created_at: datetime
    updated_at: datetime

    # JSON 문자열로 저장된 matched_keywords를 자동으로 리스트로 변환
    @field_validator('matched_keywords', mode='before')
    @classmethod
    def parse_matched_keywords(cls, v):
        if v is None:
            return None
        if isinstance(v, str):
            try:
                return json.loads(v) if v else None
            except json.JSONDecodeError:
                return None
        return v

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
    registered_by: Optional[str] = None  # 등록자 이름 (e.g., "태형", "원호")


class RegisterCitationsRequest(BaseModel):
    paper_id: str  # e.g., "2306.02437"
    limit: int = 50  # Maximum number of citing papers to register
    registered_by: Optional[str] = None  # 등록자 이름
