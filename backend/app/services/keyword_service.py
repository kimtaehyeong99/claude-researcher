import json
import re
from pathlib import Path
from typing import List, Optional

from sqlalchemy.orm import Session

from app.config import settings
from app.models.keyword import UserKeyword
from app.models.paper import Paper


class KeywordService:
    """키워드 매칭 서비스"""

    def __init__(self):
        self.papers_dir = settings.PAPERS_DIR

    def _get_paper_abstract(self, paper_id: str) -> Optional[str]:
        """JSON 파일에서 논문 초록 조회"""
        clean_id = paper_id.replace("/", "_")
        file_path = self.papers_dir / f"{clean_id}.json"
        if not file_path.exists():
            return None
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                return data.get("abstract_en")
        except (json.JSONDecodeError, IOError):
            return None

    def match_keywords(self, text: str, keywords: List[str]) -> List[str]:
        """
        텍스트에서 키워드 매칭

        Args:
            text: 검색할 텍스트 (제목, 초록 등)
            keywords: 매칭할 키워드 목록

        Returns:
            매칭된 키워드 목록
        """
        if not text or not keywords:
            return []

        text_lower = text.lower()
        matched = []

        for keyword in keywords:
            # 대소문자 무시, 단어 경계 고려한 매칭
            pattern = re.compile(r'\b' + re.escape(keyword.lower()) + r'\b')
            if pattern.search(text_lower):
                matched.append(keyword)

        return matched

    def get_all_keywords(self, db: Session) -> List[str]:
        """모든 등록된 키워드 조회"""
        keywords = db.query(UserKeyword).all()
        return [k.keyword for k in keywords]

    def update_paper_keywords(self, db: Session, paper: Paper) -> List[str]:
        """
        논문의 매칭 키워드 업데이트 (제목 + 초록에서 검색)

        Args:
            db: 데이터베이스 세션
            paper: 논문 객체

        Returns:
            매칭된 키워드 목록
        """
        keywords = self.get_all_keywords(db)
        if not keywords:
            paper.matched_keywords = None
            return []

        # 제목 + 초록에서 키워드 매칭
        title = paper.title or ""
        abstract = self._get_paper_abstract(paper.paper_id) or ""
        combined_text = f"{title} {abstract}"

        matched = self.match_keywords(combined_text, keywords)

        if matched:
            paper.matched_keywords = json.dumps(matched, ensure_ascii=False)
        else:
            paper.matched_keywords = None

        return matched

    def batch_update_all_papers(self, db: Session) -> int:
        """
        모든 논문의 키워드 일괄 업데이트 (제목 + 초록에서 검색)

        Returns:
            업데이트된 논문 수
        """
        keywords = self.get_all_keywords(db)
        if not keywords:
            return 0

        papers = db.query(Paper).all()
        updated_count = 0

        for paper in papers:
            # 제목 + 초록에서 키워드 매칭
            title = paper.title or ""
            abstract = self._get_paper_abstract(paper.paper_id) or ""
            combined_text = f"{title} {abstract}"

            matched = self.match_keywords(combined_text, keywords)

            old_keywords = paper.matched_keywords
            new_keywords = json.dumps(matched, ensure_ascii=False) if matched else None

            if old_keywords != new_keywords:
                paper.matched_keywords = new_keywords
                updated_count += 1

        db.commit()
        return updated_count

    def get_paper_matched_keywords(self, paper: Paper) -> List[str]:
        """논문의 매칭된 키워드 목록 반환"""
        if not paper.matched_keywords:
            return []
        try:
            return json.loads(paper.matched_keywords)
        except json.JSONDecodeError:
            return []
