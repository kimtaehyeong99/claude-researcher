from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.paper import PaperDetailResponse
from app.services.paper_service import PaperService

router = APIRouter()
paper_service = PaperService()


@router.post("/simple/{paper_id}", response_model=PaperDetailResponse)
async def simple_search(
    paper_id: str,
    db: Session = Depends(get_db),
):
    """
    Perform simple search on a paper (Stage 2)

    - Translates Abstract to Korean
    - Translates Introduction to Korean (if available)
    - Updates search_stage to 2
    """
    paper = await paper_service.simple_search(db, paper_id)

    if not paper:
        raise HTTPException(
            status_code=404,
            detail=f"Paper {paper_id} not found"
        )

    # Get full detail with translated content
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

    return response
