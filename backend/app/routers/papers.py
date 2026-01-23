from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional, List

from app.database import get_db
from app.models.paper import Paper
from app.schemas.paper import PaperResponse, PaperDetailResponse, PaperListResponse
from app.services.paper_service import PaperService

router = APIRouter()
paper_service = PaperService()


@router.get("/registered-by", response_model=List[str])
def get_registered_by_list(db: Session = Depends(get_db)):
    """
    Get list of distinct registered_by values for filtering
    """
    result = db.query(Paper.registered_by).distinct().filter(
        Paper.registered_by.isnot(None),
        Paper.registered_by != ""
    ).order_by(Paper.registered_by).all()
    return [r[0] for r in result]


@router.get("", response_model=PaperListResponse)
def get_papers(
    db: Session = Depends(get_db),
    stage: Optional[int] = Query(None, description="Filter by search stage (1, 2, or 3)"),
    favorite: Optional[bool] = Query(None, description="Filter by favorite status"),
    not_interested: Optional[bool] = Query(None, description="Filter by not interested status"),
    hide_not_interested: Optional[bool] = Query(True, description="Hide not interested papers"),
    keyword: Optional[str] = Query(None, description="Search in title"),
    matched_category: Optional[str] = Query(None, description="Filter by matched keyword category"),
    no_category_match: Optional[bool] = Query(None, description="Filter papers with no category match"),
    registered_by: Optional[str] = Query(None, description="Filter by registered_by"),
    sort_by: str = Query("created_at", description="Sort by: created_at, arxiv_date, search_stage, or citation_count"),
    sort_order: str = Query("desc", description="Sort order: asc or desc"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
):
    """
    Get list of papers with optional filters and sorting
    """
    from app.models.keyword import UserKeyword

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

    # 등록자 필터링
    if registered_by:
        query = query.filter(Paper.registered_by == registered_by)

    # 카테고리 필터링
    if matched_category:
        # 해당 카테고리의 키워드 목록 조회
        category_keywords = db.query(UserKeyword).filter(
            UserKeyword.category == matched_category
        ).all()
        keyword_list = [kw.keyword for kw in category_keywords]
        if keyword_list:
            # matched_keywords JSON에 해당 키워드가 포함된 논문만 필터
            from sqlalchemy import or_
            conditions = [Paper.matched_keywords.ilike(f'%"{kw}"%') for kw in keyword_list]
            query = query.filter(or_(*conditions))
        else:
            # 해당 카테고리에 키워드가 없으면 결과 없음
            query = query.filter(False)

    if no_category_match:
        # 모든 등록된 키워드 조회
        all_keywords = db.query(UserKeyword).all()
        keyword_list = [kw.keyword for kw in all_keywords]
        if keyword_list:
            # matched_keywords가 null이거나 어떤 키워드도 포함하지 않는 논문
            from sqlalchemy import or_, and_
            no_match_conditions = []
            for kw in keyword_list:
                no_match_conditions.append(~Paper.matched_keywords.ilike(f'%"{kw}"%'))
            query = query.filter(
                or_(
                    Paper.matched_keywords.is_(None),
                    and_(*no_match_conditions)
                )
            )

    # Get total count
    total = query.count()

    # Apply sorting
    sort_columns = {
        "created_at": Paper.created_at,
        "arxiv_date": Paper.arxiv_date,
        "search_stage": Paper.search_stage,
        "citation_count": Paper.citation_count,
    }

    sort_column = sort_columns.get(sort_by, Paper.created_at)

    if sort_order.lower() == "asc":
        papers = query.order_by(sort_column.asc()).offset(skip).limit(limit).all()
    else:
        papers = query.order_by(sort_column.desc()).offset(skip).limit(limit).all()

    # Pydantic validator가 자동으로 matched_keywords JSON 파싱 처리
    paper_responses = [PaperResponse.model_validate(paper) for paper in papers]
    return PaperListResponse(papers=paper_responses, total=total)


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
        analysis_status=paper.analysis_status,
        is_favorite=paper.is_favorite,
        is_not_interested=paper.is_not_interested,
        citation_count=paper.citation_count,
        registered_by=paper.registered_by,
        figure_url=paper.figure_url,
        created_at=paper.created_at,
        updated_at=paper.updated_at,
    )

    if paper_data:
        response.abstract_ko = paper_data.get("abstract_ko")
        response.detailed_analysis_ko = paper_data.get("detailed_analysis_ko")
        # JSON 파일에 figure_url이 있으면 사용 (DB보다 우선)
        if paper_data.get("figure_url"):
            response.figure_url = paper_data.get("figure_url")

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


@router.post("/bulk/not-interested")
def bulk_not_interested(paper_ids: List[str], db: Session = Depends(get_db)):
    """
    Mark multiple papers as not interested
    """
    # 단일 쿼리로 모든 논문 조회 (N+1 문제 해결)
    papers = db.query(Paper).filter(Paper.paper_id.in_(paper_ids)).all()
    updated_count = len(papers)

    for paper in papers:
        paper.is_not_interested = True

    db.commit()
    return {"message": f"{updated_count}개 논문이 관심없음 처리되었습니다.", "count": updated_count}


@router.post("/bulk/delete")
def bulk_delete(paper_ids: List[str], db: Session = Depends(get_db)):
    """
    Delete multiple papers from database and file system
    """
    # 단일 쿼리로 모든 논문 조회 (N+1 문제 해결)
    papers = db.query(Paper).filter(Paper.paper_id.in_(paper_ids)).all()
    deleted_count = len(papers)

    for paper in papers:
        # Delete JSON file
        file_path = paper_service._get_paper_file_path(paper.paper_id)
        if file_path.exists():
            file_path.unlink()

        # Delete from database
        db.delete(paper)

    db.commit()
    return {"message": f"{deleted_count}개 논문이 삭제되었습니다.", "count": deleted_count}


@router.post("/bulk/restore")
def bulk_restore(paper_ids: List[str], db: Session = Depends(get_db)):
    """
    Restore multiple papers from not interested
    """
    # 단일 쿼리로 모든 논문 조회 (N+1 문제 해결)
    papers = db.query(Paper).filter(Paper.paper_id.in_(paper_ids)).all()
    restored_count = len(papers)

    for paper in papers:
        paper.is_not_interested = False

    db.commit()
    return {"message": f"{restored_count}개 논문이 복원되었습니다.", "count": restored_count}
