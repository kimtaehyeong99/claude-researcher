from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app.schemas.paper import (
    PaperResponse,
    RegisterNewRequest,
    RegisterCitationsRequest,
)
from app.services.paper_service import PaperService

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
    """
    paper = await paper_service.register_new_paper(db, request.paper_id, skip_citation=True)

    if not paper:
        raise HTTPException(
            status_code=404,
            detail=f"Paper {request.paper_id} not found on arXiv"
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
    """
    papers = await paper_service.register_citing_papers(
        db,
        request.paper_id,
        request.limit
    )

    if not papers:
        raise HTTPException(
            status_code=404,
            detail=f"No citing papers found for {request.paper_id}"
        )

    return papers
