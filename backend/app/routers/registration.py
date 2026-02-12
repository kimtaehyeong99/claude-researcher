from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app.schemas.paper import (
    PaperResponse,
    RegisterNewRequest,
    RegisterCitationsRequest,
    RegisterBulkRequest,
    BulkRegisterResponse,
)
from app.services.paper_service import PaperService, PaperRegistrationError

router = APIRouter()
paper_service = PaperService()


@router.post("/new", response_model=PaperResponse)
async def register_new_paper(
    request: RegisterNewRequest,
    db: Session = Depends(get_db),
):
    """
    Register a new paper (Stage 1)

    - Fetches paper info from arXiv
    - Skips citation count (to avoid rate limit, use citation registration instead)
    - Creates database entry and JSON file
    - Records who registered the paper
    """
    try:
        paper = await paper_service.register_new_paper(
            db,
            request.paper_id,
            skip_citation=True,
            registered_by=request.registered_by
        )
    except PaperRegistrationError as e:
        raise HTTPException(status_code=502, detail=e.message)

    if not paper:
        raise HTTPException(
            status_code=404,
            detail=f"arXiv에서 논문 {request.paper_id}을(를) 찾을 수 없습니다."
        )

    return paper


@router.post("/citations", response_model=List[PaperResponse])
async def register_citing_papers(
    request: RegisterCitationsRequest,
    db: Session = Depends(get_db),
):
    """
    Register papers that cite the given paper (Stage 1)

    - Fetches citing papers from Semantic Scholar
    - Sorts by citation count and takes top N (default 50)
    - Creates database entries and JSON files for each
    - Returns empty list if all citing papers already exist in database
    - Records who registered the papers
    """
    papers = await paper_service.register_citing_papers(
        db,
        request.paper_id,
        request.limit,
        registered_by=request.registered_by
    )

    # Return papers (even if empty - means all citing papers already exist)
    return papers


@router.post("/bulk", response_model=BulkRegisterResponse)
async def register_papers_bulk(
    request: RegisterBulkRequest,
    db: Session = Depends(get_db),
):
    """
    선택된 논문 일괄 등록

    - 여러 arXiv 논문 ID + 인용수를 한 번에 등록
    - 이미 등록된 논문은 스킵
    - 등록 성공/스킵/실패 개수 반환
    """
    papers_info = [{"paper_id": p.paper_id, "citation_count": p.citation_count} for p in request.papers]
    registered, skipped, failed = await paper_service.register_papers_bulk(
        db,
        papers_info,
        registered_by=request.registered_by,
    )

    return BulkRegisterResponse(
        registered=[PaperResponse.model_validate(p) for p in registered],
        skipped=skipped,
        failed=failed,
        message=f"{len(registered)}개 등록, {len(skipped)}개 스킵, {len(failed)}개 실패",
    )
