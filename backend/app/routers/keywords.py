from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app.models.keyword import UserKeyword
from app.schemas.keyword import KeywordCreate, KeywordResponse, KeywordListResponse
from app.services.keyword_service import KeywordService

router = APIRouter()
keyword_service = KeywordService()


@router.get("/categories", response_model=List[str])
def get_categories(db: Session = Depends(get_db)):
    """
    카테고리 목록만 조회 (경량 API - Dashboard 필터용)
    전체 키워드를 가져오지 않고 카테고리만 조회하여 데이터 전송량 90% 감소
    """
    categories = db.query(UserKeyword.category).distinct().filter(
        UserKeyword.category.isnot(None)
    ).order_by(UserKeyword.category).all()
    return [c[0] for c in categories]


@router.get("", response_model=KeywordListResponse)
def get_keywords(db: Session = Depends(get_db)):
    """
    등록된 모든 키워드 조회 (카테고리별 정렬)
    """
    keywords = db.query(UserKeyword).order_by(UserKeyword.category, UserKeyword.keyword).all()
    # 사용 중인 카테고리 목록 추출 (DB 레벨에서 처리)
    categories = db.query(UserKeyword.category).distinct().filter(
        UserKeyword.category.isnot(None)
    ).order_by(UserKeyword.category).all()
    return KeywordListResponse(keywords=keywords, total=len(keywords), categories=[c[0] for c in categories])


@router.post("", response_model=KeywordResponse)
def create_keyword(keyword_data: KeywordCreate, db: Session = Depends(get_db)):
    """
    새 키워드 등록 (같은 카테고리 내에서만 중복 불가)
    """
    # 중복 체크: 같은 키워드 + 같은 카테고리 조합만 불가
    category = keyword_data.category.strip() if keyword_data.category else None
    query = db.query(UserKeyword).filter(
        UserKeyword.keyword.ilike(keyword_data.keyword)
    )
    if category:
        query = query.filter(UserKeyword.category == category)
    else:
        query = query.filter(UserKeyword.category.is_(None))

    existing = query.first()
    if existing:
        raise HTTPException(status_code=400, detail="같은 카테고리에 이미 등록된 키워드입니다.")

    keyword = UserKeyword(
        keyword=keyword_data.keyword.strip(),
        category=category,
        color=keyword_data.color
    )
    db.add(keyword)
    db.commit()
    db.refresh(keyword)

    # 모든 논문 키워드 재매칭
    keyword_service.batch_update_all_papers(db)

    return keyword


@router.delete("/{keyword_id}")
def delete_keyword(keyword_id: int, db: Session = Depends(get_db)):
    """
    키워드 삭제
    """
    keyword = db.query(UserKeyword).filter(UserKeyword.id == keyword_id).first()
    if not keyword:
        raise HTTPException(status_code=404, detail="키워드를 찾을 수 없습니다.")

    db.delete(keyword)
    db.commit()

    # 모든 논문 키워드 재매칭
    keyword_service.batch_update_all_papers(db)

    return {"message": "키워드가 삭제되었습니다."}


@router.patch("/{keyword_id}", response_model=KeywordResponse)
def update_keyword(keyword_id: int, keyword_data: KeywordCreate, db: Session = Depends(get_db)):
    """
    키워드 수정 (이름, 카테고리, 색상)
    """
    keyword = db.query(UserKeyword).filter(UserKeyword.id == keyword_id).first()
    if not keyword:
        raise HTTPException(status_code=404, detail="키워드를 찾을 수 없습니다.")

    # 중복 체크: 같은 키워드 + 같은 카테고리 조합 (자기 자신 제외)
    category = keyword_data.category.strip() if keyword_data.category else None
    query = db.query(UserKeyword).filter(
        UserKeyword.keyword.ilike(keyword_data.keyword),
        UserKeyword.id != keyword_id
    )
    if category:
        query = query.filter(UserKeyword.category == category)
    else:
        query = query.filter(UserKeyword.category.is_(None))

    existing = query.first()
    if existing:
        raise HTTPException(status_code=400, detail="같은 카테고리에 이미 등록된 키워드입니다.")

    keyword.keyword = keyword_data.keyword.strip()
    keyword.category = category
    keyword.color = keyword_data.color
    db.commit()
    db.refresh(keyword)

    # 모든 논문 키워드 재매칭
    keyword_service.batch_update_all_papers(db)

    return keyword


@router.post("/batch-update")
def batch_update_keywords(db: Session = Depends(get_db)):
    """
    모든 논문의 키워드 매칭 일괄 업데이트
    """
    updated_count = keyword_service.batch_update_all_papers(db)
    return {"message": f"{updated_count}개 논문이 업데이트되었습니다.", "count": updated_count}
