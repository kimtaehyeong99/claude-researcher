from fastapi import APIRouter, Depends, Query, Path
from sqlalchemy.orm import Session
from typing import Optional

from app.database import get_db
from app.models.paper import Paper
from app.schemas.paper import TopicSearchResponse, SearchResultPaper, AISearchRequest, AISearchResponse
from app.services.semantic_service import SemanticScholarService
from app.services.ai_search_service import AISearchService

router = APIRouter()
semantic_service = SemanticScholarService()
ai_search_service = AISearchService()


@router.get("/citations-preview", response_model=TopicSearchResponse)
async def preview_citing_papers(
    paper_id: str = Query(..., description="인용 대상 논문의 arXiv ID"),
    limit: int = Query(50, ge=1, le=100, description="최대 결과 수"),
    sort: str = Query("citationCount", description="정렬: citationCount, publicationDate"),
    year_from: Optional[int] = Query(None, description="이 연도 이후 논문만 (예: 2020)"),
    db: Session = Depends(get_db),
):
    """
    인용 논문 미리보기 (등록하지 않음)

    - **paper_id**: 인용 대상 논문의 arXiv ID (필수)
    - **limit**: 최대 결과 수 (기본 50, 최대 100)
    - **sort**: 정렬 기준 (citationCount=인용수순, publicationDate=최신순)
    - **year_from**: 이 연도 이후 논문만 검색 (선택)
    """
    # Semantic Scholar에서 인용 논문 가져오기
    papers = await semantic_service.get_citing_papers(
        paper_id=paper_id,
        limit=limit,
        sort=sort,
        year_from=year_from,
    )

    # 이미 등록된 논문 및 관심 없음 논문 확인
    citing_paper_ids = [p["paper_id"] for p in papers]
    existing = set()
    not_interested = set()
    if citing_paper_ids:
        db_papers = db.query(Paper.paper_id, Paper.is_not_interested).filter(
            Paper.paper_id.in_(citing_paper_ids)
        ).all()
        for pid, is_not_interested in db_papers:
            existing.add(pid)
            if is_not_interested:
                not_interested.add(pid)

    # 응답 생성 (관심 없음 논문 제외)
    result_papers = [
        SearchResultPaper(
            paper_id=p["paper_id"],
            title=p.get("title"),
            authors=p.get("authors", []),
            year=p.get("year"),
            citation_count=p.get("citation_count", 0),
            abstract=p.get("abstract"),
            already_registered=p["paper_id"] in existing,
        )
        for p in papers
        if p["paper_id"] not in not_interested
    ]

    return TopicSearchResponse(
        papers=result_papers,
        total=len(result_papers),
        query=f"Citations of {paper_id}",
    )


@router.get("", response_model=TopicSearchResponse)
async def search_papers_by_topic(
    query: str = Query(..., min_length=2, description="검색어"),
    limit: int = Query(50, ge=1, le=100, description="최대 결과 수"),
    sort: str = Query("publicationDate", description="정렬: publicationDate, citationCount, relevance"),
    year_from: Optional[int] = Query(None, description="이 연도 이후 논문만 (예: 2020)"),
    db: Session = Depends(get_db),
):
    """
    주제/키워드로 논문 검색 (arXiv 논문만, 등록하지 않음)

    - **query**: 검색어 (필수)
    - **limit**: 최대 결과 수 (기본 50, 최대 100)
    - **sort**: 정렬 기준 (publicationDate=최신순, citationCount=인용수순, relevance=관련도순)
    - **year_from**: 이 연도 이후 논문만 검색 (선택)
    """
    # Semantic Scholar 검색
    papers = await semantic_service.search_papers_by_topic(
        query=query,
        limit=limit,
        sort=sort,
        year_from=year_from,
    )

    # 이미 등록된 논문 및 관심 없음 논문 확인
    paper_ids = [p["paper_id"] for p in papers]
    existing = set()
    not_interested = set()
    if paper_ids:
        db_papers = db.query(Paper.paper_id, Paper.is_not_interested).filter(
            Paper.paper_id.in_(paper_ids)
        ).all()
        for pid, is_not_interested in db_papers:
            existing.add(pid)
            if is_not_interested:
                not_interested.add(pid)

    # 응답 생성 (관심 없음 논문 제외)
    result_papers = [
        SearchResultPaper(
            paper_id=p["paper_id"],
            title=p.get("title"),
            authors=p.get("authors", []),
            year=p.get("year"),
            citation_count=p.get("citation_count", 0),
            abstract=p.get("abstract"),
            already_registered=p["paper_id"] in existing,
        )
        for p in papers
        if p["paper_id"] not in not_interested
    ]

    return TopicSearchResponse(
        papers=result_papers,
        total=len(result_papers),
        query=query,
    )


@router.post("/ai-search", response_model=AISearchResponse)
async def ai_search_papers(
    request: AISearchRequest,
    db: Session = Depends(get_db),
):
    """
    AI 기반 논문 검색 (Claude를 활용한 지능형 검색)

    - **query**: 자연어 검색 쿼리 (예: "로봇 모방학습 데이터 증강 기술")
    - **limit**: 최대 결과 수 (기본 20)
    - **year_from**: 이 연도 이후 논문만 검색 (선택)

    Claude가 검색어를 분석하여 키워드를 확장하고,
    검색 결과를 관련성으로 재순위합니다.
    """
    # AI 검색 실행
    result = await ai_search_service.search_with_ai(
        user_query=request.query,
        limit=request.limit,
        year_from=request.year_from,
    )

    papers = result.get("papers", [])
    expanded_keywords = result.get("expanded_keywords", [])
    search_intent = result.get("search_intent", "")

    # 이미 등록된 논문 및 관심 없음 논문 확인
    paper_ids = [p["paper_id"] for p in papers]
    existing = set()
    not_interested = set()
    if paper_ids:
        db_papers = db.query(Paper.paper_id, Paper.is_not_interested).filter(
            Paper.paper_id.in_(paper_ids)
        ).all()
        for pid, is_not_interested in db_papers:
            existing.add(pid)
            if is_not_interested:
                not_interested.add(pid)

    # 응답 생성 (관심 없음 논문 제외)
    result_papers = [
        SearchResultPaper(
            paper_id=p["paper_id"],
            title=p.get("title"),
            authors=p.get("authors", []),
            year=p.get("year"),
            citation_count=p.get("citation_count", 0),
            abstract=p.get("abstract"),
            already_registered=p["paper_id"] in existing,
        )
        for p in papers
        if p["paper_id"] not in not_interested
    ]

    return AISearchResponse(
        papers=result_papers,
        total=len(result_papers),
        query=request.query,
        expanded_keywords=expanded_keywords,
        search_intent=search_intent,
    )
