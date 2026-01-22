from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List


class KeywordBase(BaseModel):
    keyword: str
    category: Optional[str] = None  # 카테고리 (예: "방법론", "도메인", "모델")
    color: Optional[str] = "#3b82f6"


class KeywordCreate(KeywordBase):
    pass


class KeywordResponse(KeywordBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class KeywordListResponse(BaseModel):
    keywords: List[KeywordResponse]
    total: int
    categories: List[str]  # 사용 중인 카테고리 목록
