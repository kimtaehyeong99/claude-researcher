"""
AI Search Service - Claude를 활용한 지능형 논문 검색
"""
import asyncio
import json
import re
from typing import Optional, List, Dict, Any

from app.services.claude_service import ClaudeService
from app.services.semantic_service import SemanticScholarService


class AISearchService:
    """Claude를 활용한 하이브리드 논문 검색 서비스"""

    def __init__(self):
        self.claude = ClaudeService()
        self.semantic = SemanticScholarService()

    async def search_with_ai(
        self,
        user_query: str,
        limit: int = 20,
        year_from: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        AI 기반 논문 검색

        Args:
            user_query: 사용자의 자연어 검색 쿼리
            limit: 반환할 최대 논문 수
            year_from: 이 연도 이후 논문만 검색

        Returns:
            {
                "papers": [...],
                "expanded_keywords": [...],
                "search_intent": "...",
                "query": "..."
            }
        """
        print(f"[AISearch] Starting AI search: {user_query[:50]}...")

        # Step 1: Claude로 검색어 확장
        expanded_result = await self._expand_query(user_query)
        keywords = expanded_result.get("keywords", [user_query])
        search_intent = expanded_result.get("search_intent", "")

        print(f"[AISearch] Expanded keywords: {keywords}")
        print(f"[AISearch] Search intent: {search_intent}")

        # Step 2: Semantic Scholar에서 여러 키워드로 검색
        raw_papers = await self._multi_keyword_search(
            keywords,
            limit_per_keyword=max(limit, 30),
            year_from=year_from
        )

        print(f"[AISearch] Found {len(raw_papers)} papers from Semantic Scholar")

        if not raw_papers:
            return {
                "papers": [],
                "expanded_keywords": keywords,
                "search_intent": search_intent,
                "query": user_query
            }

        # Step 3: Claude로 관련성 재순위
        ranked_papers = await self._rank_by_relevance(
            user_query,
            search_intent,
            raw_papers,
            limit
        )

        print(f"[AISearch] Ranked and selected {len(ranked_papers)} papers")

        return {
            "papers": ranked_papers,
            "expanded_keywords": keywords,
            "search_intent": search_intent,
            "query": user_query
        }

    async def _expand_query(self, user_query: str) -> Dict[str, Any]:
        """
        Claude를 사용하여 사용자 쿼리를 검색 키워드로 확장

        Args:
            user_query: 사용자의 자연어 쿼리

        Returns:
            {"keywords": [...], "search_intent": "..."}
        """
        prompt = f"""당신은 로봇 공학 및 AI 분야의 논문 검색 전문가입니다.

사용자의 연구 질문:
"{user_query}"

위 질문을 분석하여:
1. 사용자가 찾고자 하는 핵심 연구 주제를 파악하세요
2. 해당 주제에 관련된 영어 학술 검색 키워드 3-5개를 생성하세요
3. 키워드는 Semantic Scholar API 검색에 적합한 형태여야 합니다
4. 일반적인 키워드와 구체적인 키워드를 섞어주세요

응답 형식 (JSON만, 다른 설명 없이):
{{"keywords": ["keyword1", "keyword2", "keyword3"], "search_intent": "사용자가 찾고자 하는 것에 대한 1줄 요약"}}"""

        try:
            result = await self.claude._run_claude_cli(prompt, max_retries=2)
            # JSON 추출 시도
            parsed = self._extract_json(result)
            if parsed and "keywords" in parsed:
                return parsed
        except Exception as e:
            print(f"[AISearch] Query expansion failed: {e}")

        # 폴백: 원본 쿼리 사용
        return {
            "keywords": [user_query],
            "search_intent": user_query
        }

    async def _multi_keyword_search(
        self,
        keywords: List[str],
        limit_per_keyword: int = 30,
        year_from: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        """
        여러 키워드로 병렬 검색 후 중복 제거

        Args:
            keywords: 검색 키워드 리스트
            limit_per_keyword: 키워드당 검색 결과 수
            year_from: 연도 필터

        Returns:
            중복 제거된 논문 리스트
        """
        # 병렬로 검색 실행
        tasks = [
            self.semantic.search_papers_by_topic(
                query=kw,
                limit=limit_per_keyword,
                sort="citationCount",
                year_from=year_from
            )
            for kw in keywords[:5]  # 최대 5개 키워드
        ]

        results = await asyncio.gather(*tasks, return_exceptions=True)

        # 중복 제거 (paper_id 기준)
        seen_ids = set()
        unique_papers = []

        for result in results:
            if isinstance(result, Exception):
                print(f"[AISearch] Search error: {result}")
                continue

            for paper in result:
                paper_id = paper.get("paper_id")
                if paper_id and paper_id not in seen_ids:
                    seen_ids.add(paper_id)
                    unique_papers.append(paper)

        return unique_papers

    async def _rank_by_relevance(
        self,
        user_query: str,
        search_intent: str,
        papers: List[Dict[str, Any]],
        limit: int
    ) -> List[Dict[str, Any]]:
        """
        Claude를 사용하여 논문을 관련성으로 재순위

        Args:
            user_query: 원본 사용자 쿼리
            search_intent: 검색 의도 요약
            papers: 검색된 논문 리스트
            limit: 반환할 논문 수

        Returns:
            관련성 순으로 정렬된 논문 리스트
        """
        if len(papers) <= limit:
            # 논문 수가 적으면 재순위 없이 반환
            return papers

        # 상위 30개만 Claude에게 평가 요청 (토큰 절약)
        papers_to_rank = papers[:30]

        # 논문 정보 포매팅
        papers_list = []
        for i, p in enumerate(papers_to_rank):
            abstract = p.get("abstract", "")
            if abstract and len(abstract) > 300:
                abstract = abstract[:300] + "..."

            papers_list.append(
                f"{i+1}. ID: {p.get('paper_id')}\n"
                f"   제목: {p.get('title', 'N/A')}\n"
                f"   초록: {abstract or 'N/A'}"
            )

        papers_text = "\n\n".join(papers_list)

        prompt = f"""사용자의 연구 질문:
"{user_query}"

검색 의도: {search_intent}

다음 논문들을 사용자의 검색 의도와의 관련성으로 평가해주세요.
각 논문의 제목과 초록을 보고 1-10점 점수를 매기세요.

평가 기준:
- 10점: 사용자가 정확히 찾던 내용
- 7-9점: 매우 관련 있음
- 4-6점: 부분적으로 관련 있음
- 1-3점: 관련 적음

논문 목록:
{papers_text}

응답 형식 (JSON만, 다른 설명 없이):
{{"ranked": [{{"paper_id": "xxx", "score": 9}}, ...]}}"""

        try:
            result = await self.claude._run_claude_cli(prompt, max_retries=2)
            parsed = self._extract_json(result)

            if parsed and "ranked" in parsed:
                # 점수 기반 정렬
                score_map = {
                    r["paper_id"]: r.get("score", 0)
                    for r in parsed["ranked"]
                }

                # 점수로 정렬
                ranked_papers = sorted(
                    papers_to_rank,
                    key=lambda p: score_map.get(p.get("paper_id"), 0),
                    reverse=True
                )

                return ranked_papers[:limit]

        except Exception as e:
            print(f"[AISearch] Ranking failed: {e}")

        # 폴백: 인용수 기준 정렬
        return sorted(
            papers,
            key=lambda p: p.get("citation_count", 0),
            reverse=True
        )[:limit]

    def _extract_json(self, text: str) -> Optional[Dict]:
        """
        텍스트에서 JSON 추출

        Args:
            text: Claude 응답 텍스트

        Returns:
            파싱된 JSON 딕셔너리 또는 None
        """
        if not text:
            return None

        # 방법 1: 전체 텍스트가 JSON인 경우
        try:
            return json.loads(text.strip())
        except json.JSONDecodeError:
            pass

        # 방법 2: JSON 블록 추출 (```json ... ```)
        json_match = re.search(r'```(?:json)?\s*([\s\S]*?)\s*```', text)
        if json_match:
            try:
                return json.loads(json_match.group(1))
            except json.JSONDecodeError:
                pass

        # 방법 3: { } 블록 추출
        brace_match = re.search(r'\{[\s\S]*\}', text)
        if brace_match:
            try:
                return json.loads(brace_match.group(0))
            except json.JSONDecodeError:
                pass

        return None


# 싱글톤 인스턴스
ai_search_service = AISearchService()
