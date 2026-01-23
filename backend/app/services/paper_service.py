import json
from pathlib import Path
from typing import Optional, Dict, Any, List
from datetime import date

from sqlalchemy.orm import Session

from app.config import settings
from app.models.paper import Paper
from app.services.arxiv_service import ArxivService
from app.services.semantic_service import SemanticScholarService
from app.services.openalex_service import OpenAlexService
from app.services.claude_service import ClaudeService
from app.services.ar5iv_service import Ar5ivService
from app.services.keyword_service import KeywordService


class PaperService:
    """논문 처리 통합 서비스"""

    def __init__(self):
        self.arxiv = ArxivService()
        self.semantic = SemanticScholarService()
        self.openalex = OpenAlexService()
        self.claude = ClaudeService()
        self.ar5iv = Ar5ivService()
        self.keyword_service = KeywordService()
        self.papers_dir = settings.PAPERS_DIR

    def _get_paper_file_path(self, paper_id: str) -> Path:
        """Get path to paper JSON file"""
        clean_id = paper_id.replace("/", "_")
        return self.papers_dir / f"{clean_id}.json"

    def _load_paper_file(self, paper_id: str) -> Optional[Dict[str, Any]]:
        """Load paper data from JSON file"""
        file_path = self._get_paper_file_path(paper_id)
        if file_path.exists():
            with open(file_path, "r", encoding="utf-8") as f:
                return json.load(f)
        return None

    def _save_paper_file(self, paper_id: str, data: Dict[str, Any]) -> None:
        """Save paper data to JSON file"""
        file_path = self._get_paper_file_path(paper_id)
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2, default=str)

    async def register_new_paper(
        self, db: Session, paper_id: str, skip_citation: bool = False, registered_by: str = None
    ) -> Optional[Paper]:
        """
        Register a new paper (Stage 1)

        Args:
            db: Database session
            paper_id: arXiv paper ID
            skip_citation: 인용수 조회 건너뛰기 (빠른 등록)
            registered_by: 등록자 이름

        Returns:
            Created Paper object or None if failed
        """
        # Check if already exists
        existing = db.query(Paper).filter(Paper.paper_id == paper_id).first()
        if existing:
            return existing

        # Get paper info from arXiv
        arxiv_info = await self.arxiv.get_paper_info(paper_id)
        if not arxiv_info:
            return None

        # Get citation count from Semantic Scholar (선택적)
        citation_count = 0
        if not skip_citation:
            try:
                citation_count = await self.semantic.get_citation_count(paper_id)
            except Exception as e:
                print(f"[PaperService] Citation count fetch failed, using 0: {e}")

        # ar5iv에서 첫 번째 Figure 이미지 URL 추출
        figure_url = await self.ar5iv.get_first_figure_url(paper_id)

        # Create DB entry
        paper = Paper(
            paper_id=paper_id,
            title=arxiv_info.get("title"),
            arxiv_date=arxiv_info.get("arxiv_date"),
            search_stage=1,
            citation_count=citation_count,
            registered_by=registered_by,
            figure_url=figure_url,
        )
        db.add(paper)
        db.commit()
        db.refresh(paper)

        # Create paper file (Stage 1: basic info only)
        paper_data = {
            "paper_id": paper_id,
            "title": arxiv_info.get("title"),
            "arxiv_date": arxiv_info.get("arxiv_date"),
            "search_stage": 1,
            "authors": arxiv_info.get("authors", []),
            "abstract_en": arxiv_info.get("abstract"),
            "pdf_url": arxiv_info.get("pdf_url"),
            "figure_url": figure_url,
        }
        self._save_paper_file(paper_id, paper_data)

        # 키워드 매칭 (제목 + 초록)
        self.keyword_service.update_paper_keywords(db, paper)
        db.commit()
        db.refresh(paper)

        return paper

    async def register_citing_papers(
        self, db: Session, paper_id: str, limit: int = 50, registered_by: str = None
    ) -> List[Paper]:
        """
        Register papers that cite the given paper (Stage 1)
        Sorted by citation count, top N NEW papers (excluding existing ones in DB)

        Args:
            db: Database session
            paper_id: arXiv paper ID of the cited paper
            limit: Maximum number of NEW papers to register
            registered_by: 등록자 이름

        Returns:
            List of newly created Paper objects
        """
        # Get all existing paper_ids in DB
        existing_paper_ids = set(
            row[0] for row in db.query(Paper.paper_id).all()
        )
        print(f"[PaperService] Existing papers in DB: {len(existing_paper_ids)}")

        # Get more citing papers than needed to account for duplicates
        fetch_limit = limit * 3  # Fetch extra to filter out existing ones
        citing_papers = await self.semantic.get_citing_papers(paper_id, fetch_limit)
        print(f"[PaperService] Found {len(citing_papers)} citing papers from Semantic Scholar")

        registered = []
        for citing in citing_papers:
            # Stop if we have enough new papers
            if len(registered) >= limit:
                break

            citing_id = citing.get("paper_id")
            if not citing_id:
                continue

            # Skip if already exists in DB
            if citing_id in existing_paper_ids:
                print(f"[PaperService] Skipping {citing_id} (already exists)")
                continue

            # Get full info from arXiv
            print(f"[PaperService] Registering citing paper: {citing_id}")
            arxiv_info = await self.arxiv.get_paper_info(citing_id)

            # ar5iv에서 첫 번째 Figure 이미지 URL 추출
            figure_url = await self.ar5iv.get_first_figure_url(citing_id)

            # Create DB entry
            paper = Paper(
                paper_id=citing_id,
                title=citing.get("title") or (arxiv_info.get("title") if arxiv_info else None),
                arxiv_date=arxiv_info.get("arxiv_date") if arxiv_info else None,
                search_stage=1,
                citation_count=citing.get("citation_count", 0),
                registered_by=registered_by,
                figure_url=figure_url,
            )
            db.add(paper)

            # Create paper file
            paper_data = {
                "paper_id": citing_id,
                "title": paper.title,
                "arxiv_date": paper.arxiv_date,
                "search_stage": 1,
                "citation_count": citing.get("citation_count", 0),
                "figure_url": figure_url,
            }
            if arxiv_info:
                paper_data["authors"] = arxiv_info.get("authors", [])
                paper_data["abstract_en"] = arxiv_info.get("abstract")
                paper_data["pdf_url"] = arxiv_info.get("pdf_url")

            self._save_paper_file(citing_id, paper_data)
            registered.append(paper)
            existing_paper_ids.add(citing_id)  # Add to set to avoid duplicates within batch

        db.commit()

        # 등록된 논문들의 키워드 매칭 (batch 후)
        for paper in registered:
            self.keyword_service.update_paper_keywords(db, paper)
        db.commit()

        print(f"[PaperService] Successfully registered {len(registered)} new citing papers")
        return registered

    async def simple_search(self, db: Session, paper_id: str) -> Optional[Paper]:
        """
        Perform simple search (Stage 2): Abstract만 한국어로 정리
        - arxiv.org/abs/ 페이지의 Abstract 사용 (PDF 다운로드 없음)

        Args:
            db: Database session
            paper_id: arXiv paper ID

        Returns:
            Updated Paper object or None if failed
        """
        paper = db.query(Paper).filter(Paper.paper_id == paper_id).first()
        if not paper:
            return None

        # Load existing paper file
        paper_data = self._load_paper_file(paper_id)
        if not paper_data:
            return None

        # 분석 시작 상태 설정
        paper.analysis_status = "simple_analyzing"
        db.commit()

        try:
            # Get abstract if not present (from arXiv API, not PDF)
            abstract_en = paper_data.get("abstract_en")
            if not abstract_en:
                arxiv_info = await self.arxiv.get_paper_info(paper_id)
                if arxiv_info:
                    abstract_en = arxiv_info.get("abstract")
                    paper_data["abstract_en"] = abstract_en

            # Summarize abstract in Korean
            if abstract_en:
                abstract_ko = await self.claude.summarize_abstract(abstract_en)
                paper_data["abstract_ko"] = abstract_ko
            else:
                paper_data["abstract_ko"] = "(초록을 가져올 수 없습니다.)"

            # ar5iv에서 첫 번째 Figure 이미지 URL 추출 (없을 경우에만)
            if not paper.figure_url:
                figure_url = await self.ar5iv.get_first_figure_url(paper_id)
                if figure_url:
                    paper_data["figure_url"] = figure_url
                    paper.figure_url = figure_url

            # Update stage
            paper_data["search_stage"] = 2
            self._save_paper_file(paper_id, paper_data)

            # Update DB - 분석 완료
            paper.search_stage = 2
            paper.analysis_status = None
            db.commit()
            db.refresh(paper)

            return paper
        except Exception as e:
            # 분석 실패 시 상태 초기화
            paper.analysis_status = None
            db.commit()
            raise e

    async def deep_search(self, db: Session, paper_id: str) -> Optional[Paper]:
        """
        Perform deep search (Stage 3): PDF URL을 Claude에게 직접 전달하여 분석
        - Claude CLI가 PDF를 직접 읽고 분석 (텍스트 추출 문제 없음)

        Args:
            db: Database session
            paper_id: arXiv paper ID

        Returns:
            Updated Paper object or None if failed
        """
        paper = db.query(Paper).filter(Paper.paper_id == paper_id).first()
        if not paper:
            return None

        # Load existing paper file
        paper_data = self._load_paper_file(paper_id)
        if not paper_data:
            return None

        # 분석 시작 상태 설정
        paper.analysis_status = "deep_analyzing"
        db.commit()

        try:
            # Build PDF URL
            clean_id = paper_id.replace("/", "_").split("v")[0]
            pdf_url = f"https://arxiv.org/pdf/{clean_id}.pdf"

            # Get title and abstract from paper data
            title = paper_data.get("title", "")
            abstract = paper_data.get("abstract_en", "")

            # Claude에게 제목, 초록, PDF를 전달하여 분석
            detailed_analysis = await self.claude.analyze_full_paper_from_pdf(
                paper_id=paper_id,
                title=title,
                abstract=abstract,
                pdf_url=pdf_url
            )
            paper_data["detailed_analysis_ko"] = detailed_analysis

            # Update stage
            paper_data["search_stage"] = 3
            self._save_paper_file(paper_id, paper_data)

            # Update DB - 분석 완료
            paper.search_stage = 3
            paper.analysis_status = None
            db.commit()
            db.refresh(paper)

            return paper
        except Exception as e:
            # 분석 실패 시 상태 초기화
            paper.analysis_status = None
            db.commit()
            raise e

    def get_paper_detail(self, paper_id: str) -> Optional[Dict[str, Any]]:
        """
        Get full paper details from JSON file

        Args:
            paper_id: arXiv paper ID

        Returns:
            Paper data dictionary or None
        """
        return self._load_paper_file(paper_id)

    async def update_citation_count(self, db: Session, paper_id: str) -> Optional[Paper]:
        """
        Update citation count for a paper (OpenAlex 우선, 실패 시 Semantic Scholar)

        Args:
            db: Database session
            paper_id: arXiv paper ID

        Returns:
            Updated Paper object or None if failed
        """
        paper = db.query(Paper).filter(Paper.paper_id == paper_id).first()
        if not paper:
            return None

        try:
            # OpenAlex 먼저 시도 (빠름)
            citation_count = await self.openalex.get_citation_count(paper_id)

            # OpenAlex가 실패하거나 0인 경우 Semantic Scholar로 폴백
            # (최신 논문은 OpenAlex에 인용 정보가 늦게 반영됨)
            if citation_count is None or citation_count == 0:
                print(f"[PaperService] OpenAlex returned {citation_count}, trying Semantic Scholar...")
                semantic_count = await self.semantic.get_citation_count(paper_id)
                if semantic_count is not None and semantic_count > 0:
                    citation_count = semantic_count

            if citation_count is not None:
                paper.citation_count = citation_count
                db.commit()
                db.refresh(paper)
                print(f"[PaperService] Updated citation count for {paper_id}: {citation_count}")
                return paper
            else:
                print(f"[PaperService] Could not get citation count from any source")
                return None
        except Exception as e:
            print(f"[PaperService] Failed to update citation count: {e}")
            return None
