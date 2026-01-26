from fastapi import APIRouter, Depends, HTTPException, Query, Header
from sqlalchemy.orm import Session
from typing import Optional, List

from app.database import get_db
from app.models.paper import Paper
from app.models.user_favorite import UserFavorite
from app.schemas.paper import PaperResponse, PaperDetailResponse, PaperListResponse
from app.services.paper_service import PaperService

router = APIRouter()
paper_service = PaperService()


def get_current_username(x_username: Optional[str] = Header(None)) -> Optional[str]:
    """HTTP 헤더에서 사용자명 추출 (URL 디코딩 포함)"""
    if x_username:
        from urllib.parse import unquote
        return unquote(x_username)
    return None


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
    username: Optional[str] = Depends(get_current_username),
):
    """
    Get list of papers with optional filters and sorting
    """
    from app.models.keyword import UserKeyword

    query = db.query(Paper)

    # Apply filters
    if stage is not None:
        query = query.filter(Paper.search_stage == stage)

    # 즐겨찾기 필터링 (사용자별) - 서브쿼리 중복 제거
    if favorite is not None and username:
        favorite_paper_ids = db.query(UserFavorite.paper_id).filter(
            UserFavorite.username == username
        ).subquery()

        if favorite:
            query = query.filter(Paper.paper_id.in_(favorite_paper_ids))
        else:
            query = query.filter(~Paper.paper_id.in_(favorite_paper_ids))

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

    # 사용자별 즐겨찾기 상태 반영
    if username:
        # 해당 사용자의 즐겨찾기 목록 조회
        user_favorites = set(
            f.paper_id for f in db.query(UserFavorite.paper_id).filter(
                UserFavorite.username == username
            ).all()
        )

        paper_responses = []
        for paper in papers:
            response = PaperResponse.model_validate(paper)
            response.is_favorite = paper.paper_id in user_favorites
            paper_responses.append(response)
    else:
        paper_responses = [PaperResponse.model_validate(paper) for paper in papers]

    return PaperListResponse(papers=paper_responses, total=total)


@router.get("/{paper_id}", response_model=PaperDetailResponse)
def get_paper(
    paper_id: str,
    db: Session = Depends(get_db),
    username: Optional[str] = Depends(get_current_username),
):
    """
    Get paper details including translated content
    """
    paper = db.query(Paper).filter(Paper.paper_id == paper_id).first()
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found")

    # 사용자별 즐겨찾기 상태 확인
    is_favorite = paper.is_favorite  # 기본값
    if username:
        existing = db.query(UserFavorite).filter(
            UserFavorite.username == username,
            UserFavorite.paper_id == paper_id
        ).first()
        is_favorite = existing is not None

    # Get additional data from JSON file
    paper_data = paper_service.get_paper_detail(paper_id)

    response = PaperDetailResponse(
        id=paper.id,
        paper_id=paper.paper_id,
        arxiv_date=paper.arxiv_date,
        title=paper.title,
        search_stage=paper.search_stage,
        analysis_status=paper.analysis_status,
        is_favorite=is_favorite,
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
def toggle_favorite(
    paper_id: str,
    db: Session = Depends(get_db),
    username: Optional[str] = Depends(get_current_username),
):
    """
    Toggle paper favorite status for a specific user
    """
    paper = db.query(Paper).filter(Paper.paper_id == paper_id).first()
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found")

    if username:
        # 사용자별 즐겨찾기 처리
        existing = db.query(UserFavorite).filter(
            UserFavorite.username == username,
            UserFavorite.paper_id == paper_id
        ).first()

        if existing:
            # 즐겨찾기 해제
            db.delete(existing)
            is_favorite = False
        else:
            # 즐겨찾기 추가
            new_favorite = UserFavorite(username=username, paper_id=paper_id)
            db.add(new_favorite)
            is_favorite = True

        db.commit()

        # 응답에 is_favorite 동적 설정
        response = PaperResponse.model_validate(paper)
        response.is_favorite = is_favorite
        return response
    else:
        # 기존 로직 (하위 호환성)
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
