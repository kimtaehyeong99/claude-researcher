import asyncio
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session

from app.database import get_db, SessionLocal
from app.models.paper import Paper
from app.schemas.paper import PaperDetailResponse
from app.services.paper_service import PaperService

router = APIRouter()
paper_service = PaperService()


def run_deep_search_background(paper_id: str):
    """백그라운드에서 deep_search 실행"""
    db = SessionLocal()
    try:
        asyncio.run(paper_service.deep_search(db, paper_id))
    except Exception as e:
        print(f"[DeepSearch] Background task failed: {e}")
        paper = db.query(Paper).filter(Paper.paper_id == paper_id).first()
        if paper:
            paper.analysis_status = None
            db.commit()
    finally:
        db.close()


@router.post("/deep/{paper_id}", response_model=PaperDetailResponse)
async def deep_search(
    paper_id: str,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    """
    Perform deep search on a paper (Stage 3)

    - Generates detailed Korean analysis of the paper
    - Updates search_stage to 3
    - 백그라운드에서 비동기 처리 후 즉시 응답
    """
    paper = db.query(Paper).filter(Paper.paper_id == paper_id).first()
    if not paper:
        raise HTTPException(
            status_code=404,
            detail=f"Paper {paper_id} not found"
        )

    # 이미 분석 중인 경우
    if paper.analysis_status:
        raise HTTPException(
            status_code=400,
            detail=f"Paper {paper_id} is already being analyzed ({paper.analysis_status})"
        )

    # 분석 상태 설정
    paper.analysis_status = "deep_analyzing"
    db.commit()
    db.refresh(paper)

    # 백그라운드에서 분석 실행
    background_tasks.add_task(run_deep_search_background, paper_id)

    # 즉시 현재 상태 반환
    paper_data = paper_service.get_paper_detail(paper_id)

    response = PaperDetailResponse(
        id=paper.id,
        paper_id=paper.paper_id,
        arxiv_date=paper.arxiv_date,
        title=paper.title,
        search_stage=paper.search_stage,
        analysis_status=paper.analysis_status,
        is_favorite=paper.is_favorite,
        is_not_interested=paper.is_not_interested,
        citation_count=paper.citation_count,
        figure_url=paper.figure_url,
        created_at=paper.created_at,
        updated_at=paper.updated_at,
    )

    if paper_data:
        response.abstract_ko = paper_data.get("abstract_ko")
        response.detailed_analysis_ko = paper_data.get("detailed_analysis_ko")

    return response
