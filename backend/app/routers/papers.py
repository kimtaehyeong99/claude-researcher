from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional, List

from app.database import get_db
from app.models.paper import Paper
from app.schemas.paper import PaperResponse, PaperDetailResponse, PaperListResponse
from app.services.paper_service import PaperService

router = APIRouter()
paper_service = PaperService()


@router.get("", response_model=PaperListResponse)
def get_papers(
    db: Session = Depends(get_db),
    stage: Optional[int] = Query(None, description="Filter by search stage (1, 2, or 3)"),
    favorite: Optional[bool] = Query(None, description="Filter by favorite status"),
    not_interested: Optional[bool] = Query(None, description="Filter by not interested status"),
    hide_not_interested: Optional[bool] = Query(True, description="Hide not interested papers"),
    keyword: Optional[str] = Query(None, description="Search in title"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
):
    """
    Get list of papers with optional filters
    """
    query = db.query(Paper)

    # Apply filters
    if stage is not None:
        query = query.filter(Paper.search_stage == stage)

    if favorite is not None:
        query = query.filter(Paper.is_favorite == favorite)

    if not_interested is not None:
        query = query.filter(Paper.is_not_interested == not_interested)
    elif hide_not_interested:
        query = query.filter(Paper.is_not_interested == False)

    if keyword:
        query = query.filter(Paper.title.ilike(f"%{keyword}%"))

    # Get total count
    total = query.count()

    # Apply pagination and ordering
    papers = query.order_by(Paper.created_at.desc()).offset(skip).limit(limit).all()

    return PaperListResponse(papers=papers, total=total)


@router.get("/{paper_id}", response_model=PaperDetailResponse)
def get_paper(paper_id: str, db: Session = Depends(get_db)):
    """
    Get paper details including translated content
    """
    paper = db.query(Paper).filter(Paper.paper_id == paper_id).first()
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found")

    # Get additional data from JSON file
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


@router.patch("/{paper_id}/favorite", response_model=PaperResponse)
def toggle_favorite(paper_id: str, db: Session = Depends(get_db)):
    """
    Toggle paper favorite status
    """
    paper = db.query(Paper).filter(Paper.paper_id == paper_id).first()
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found")

    paper.is_favorite = not paper.is_favorite
    db.commit()
    db.refresh(paper)

    return paper


@router.patch("/{paper_id}/not-interested", response_model=PaperResponse)
def toggle_not_interested(paper_id: str, db: Session = Depends(get_db)):
    """
    Toggle paper not interested status
    """
    paper = db.query(Paper).filter(Paper.paper_id == paper_id).first()
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found")

    paper.is_not_interested = not paper.is_not_interested
    db.commit()
    db.refresh(paper)

    return paper


@router.patch("/{paper_id}/update-citation", response_model=PaperResponse)
async def update_citation_count(paper_id: str, db: Session = Depends(get_db)):
    """
    Update citation count from Semantic Scholar
    """
    paper = await paper_service.update_citation_count(db, paper_id)
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found or update failed")

    return paper


@router.delete("/{paper_id}")
def delete_paper(paper_id: str, db: Session = Depends(get_db)):
    """
    Delete a paper from database and file system
    """
    paper = db.query(Paper).filter(Paper.paper_id == paper_id).first()
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found")

    # Delete from database
    db.delete(paper)
    db.commit()

    # Delete JSON file
    file_path = paper_service._get_paper_file_path(paper_id)
    if file_path.exists():
        file_path.unlink()

    return {"message": "Paper deleted successfully"}
