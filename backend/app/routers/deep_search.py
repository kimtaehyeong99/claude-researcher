from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.paper import PaperDetailResponse
from app.services.paper_service import PaperService

router = APIRouter()
paper_service = PaperService()


@router.post("/deep/{paper_id}", response_model=PaperDetailResponse)
async def deep_search(
    paper_id: str,
    db: Session = Depends(get_db),
):
    """
    Perform deep search on a paper (Stage 3)

    - Includes all Stage 2 content (if not already done)
    - Generates detailed Korean analysis of the paper
    - Updates search_stage to 3
    """
    paper = await paper_service.deep_search(db, paper_id)

    if not paper:
        raise HTTPException(
            status_code=404,
            detail=f"Paper {paper_id} not found"
        )

    # Get full detail with all content
    paper_data = paper_service.get_paper_detail(paper_id)

    response = PaperDetailResponse(
        id=paper.id,
        paper_id=paper.paper_id,
        arxiv_date=paper.arxiv_date,
        title=paper.title,
        search_stage=paper.search_stage,
        is_favorite=paper.is_favorite,
        is_not_interested=paper.is_not_interested,
        citation_count=paper.citation_count,
        created_at=paper.created_at,
        updated_at=paper.updated_at,
    )

    if paper_data:
        response.abstract_ko = paper_data.get("abstract_ko")
        response.detailed_analysis_ko = paper_data.get("detailed_analysis_ko")

    return response
