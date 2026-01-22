from fastapi import APIRouter, Query
from typing import Optional, Literal
from datetime import date

from app.schemas.trending import TrendingPapersResponse, TrendingPaper
from app.services.huggingface_service import HuggingFaceService

router = APIRouter()
hf_service = HuggingFaceService()


@router.get("/daily", response_model=TrendingPapersResponse)
async def get_daily_papers(
    target_date: Optional[date] = Query(None, alias="date", description="특정 날짜 (YYYY-MM-DD)"),
    period: Literal["day", "week", "month"] = Query("day", description="기간 (day, week, month)")
):
    """
    HuggingFace Daily Papers 가져오기

    - 오늘의 인기 논문 목록 반환
    - date 파라미터로 특정 날짜 조회 가능
    - period 파라미터로 일간/주간/월간 선택 가능
    """
    papers = await hf_service.get_daily_papers(target_date, period)

    # 날짜 결정
    result_date = target_date.isoformat() if target_date else date.today().isoformat()

    return TrendingPapersResponse(
        papers=[TrendingPaper(**p) for p in papers],
        date=result_date,
        total=len(papers),
        period=period
    )
