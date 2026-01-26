import httpx
import asyncio
from typing import Optional, Dict, Any, List


class SemanticScholarService:
    """Semantic Scholar API 연동 서비스"""

    BASE_URL = "https://api.semanticscholar.org/graph/v1"
    MAX_RETRIES = 2  # 새 논문 등록 시 빠르게 실패하도록
    RETRY_DELAY = 1.0  # seconds
    TIMEOUT = 10.0  # seconds

    @staticmethod
    def _arxiv_to_semantic_id(paper_id: str) -> str:
        """Convert arXiv ID to Semantic Scholar format"""
        clean_id = paper_id.split("v")[0]  # Remove version
        return f"ARXIV:{clean_id}"

    async def get_paper_info(self, paper_id: str) -> Optional[Dict[str, Any]]:
        """
        Get paper info from Semantic Scholar

        Args:
            paper_id: arXiv paper ID (e.g., "2306.02437")

        Returns:
            Dictionary with paper info including citation count
        """
        semantic_id = self._arxiv_to_semantic_id(paper_id)

        print(f"[SemanticScholar] Fetching paper info for {paper_id}...")
        async with httpx.AsyncClient() as client:
            for attempt in range(self.MAX_RETRIES):
                try:
                    response = await client.get(
                        f"{self.BASE_URL}/paper/{semantic_id}",
                        params={
                            "fields": "title,abstract,citationCount,year,authors,publicationDate"
                        },
                        timeout=self.TIMEOUT
                    )

                    if response.status_code == 200:
                        data = response.json()
                        return {
                            "paper_id": paper_id,
                            "title": data.get("title"),
                            "abstract": data.get("abstract"),
                            "citation_count": data.get("citationCount", 0),
                            "year": data.get("year"),
                            "publication_date": data.get("publicationDate"),
                            "authors": [
                                a.get("name") for a in data.get("authors", [])
                            ],
                        }
                    elif response.status_code == 429:  # Rate limited
                        wait_time = self.RETRY_DELAY * (attempt + 1)
                        print(f"[SemanticScholar] Rate limited, waiting {wait_time}s... (attempt {attempt + 1}/{self.MAX_RETRIES})")
                        await asyncio.sleep(wait_time)
                        continue
                    else:
                        print(f"[SemanticScholar] API error {response.status_code} for paper {paper_id}")
                        break
                except httpx.RequestError as e:
                    print(f"[SemanticScholar] Request error for paper {paper_id}: {e}")
                    if attempt < self.MAX_RETRIES - 1:
                        await asyncio.sleep(self.RETRY_DELAY)
                        continue
                    break

        return None

    async def get_citing_papers(
        self,
        paper_id: str,
        limit: int = 50,
        sort: str = "citationCount",
        year_from: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        """
        Get papers that cite the given paper

        Args:
            paper_id: arXiv paper ID
            limit: Maximum number of citing papers to return
            sort: 정렬 기준 ("citationCount", "publicationDate")
            year_from: 이 연도 이후 논문만 (선택)

        Returns:
            List of citing papers sorted by specified criteria
        """
        semantic_id = self._arxiv_to_semantic_id(paper_id)
        all_citations = []
        offset = 0
        batch_size = 100  # Semantic Scholar API limit

        print(f"[SemanticScholar] Fetching citing papers for {paper_id}, sort: {sort}, year_from: {year_from}")

        async with httpx.AsyncClient() as client:
            while True:
                try:
                    response = await client.get(
                        f"{self.BASE_URL}/paper/{semantic_id}/citations",
                        params={
                            "fields": "title,citationCount,externalIds,year,publicationDate,authors,abstract",
                            "limit": batch_size,
                            "offset": offset,
                        },
                        timeout=30.0
                    )

                    if response.status_code != 200:
                        break

                    data = response.json()
                    citations = data.get("data", [])

                    if not citations:
                        break

                    for citation in citations:
                        citing_paper = citation.get("citingPaper", {})
                        external_ids = citing_paper.get("externalIds") or {}
                        arxiv_id = external_ids.get("ArXiv")

                        if arxiv_id:  # Only include papers with arXiv ID
                            paper_year = citing_paper.get("year")

                            # 연도 필터 적용
                            if year_from and paper_year and paper_year < year_from:
                                continue

                            all_citations.append({
                                "paper_id": arxiv_id,
                                "title": citing_paper.get("title"),
                                "citation_count": citing_paper.get("citationCount", 0),
                                "year": paper_year,
                                "publication_date": citing_paper.get("publicationDate"),
                                "authors": [a.get("name") for a in (citing_paper.get("authors") or [])],
                                "abstract": citing_paper.get("abstract"),
                            })

                    offset += batch_size

                    # Stop if we have enough papers or no more results
                    if len(citations) < batch_size or len(all_citations) >= limit * 2:
                        break

                except httpx.RequestError:
                    break

        # 정렬 적용
        if sort == "citationCount":
            sorted_citations = sorted(
                all_citations,
                key=lambda x: x.get("citation_count", 0),
                reverse=True
            )
        elif sort == "publicationDate":
            sorted_citations = sorted(
                all_citations,
                key=lambda x: x.get("publication_date") or "0000-00-00",
                reverse=True
            )
        else:
            sorted_citations = all_citations

        print(f"[SemanticScholar] Found {len(sorted_citations)} citing papers")

        return sorted_citations[:limit]

    async def get_citation_count(self, paper_id: str) -> int:
        """
        Get citation count for a paper

        Args:
            paper_id: arXiv paper ID

        Returns:
            Citation count or 0 if not found
        """
        info = await self.get_paper_info(paper_id)
        if info:
            citation_count = info.get("citation_count", 0)
            print(f"[SemanticScholar] Paper {paper_id} citation count: {citation_count}")
            return citation_count
        print(f"[SemanticScholar] Could not get citation count for paper {paper_id}, returning 0")
        return 0

    async def search_papers_by_topic(
        self,
        query: str,
        limit: int = 50,
        sort: str = "publicationDate",
        year_from: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        """
        주제/키워드로 논문 검색 (arXiv 논문만)

        Args:
            query: 검색어
            limit: 최대 결과 수
            sort: 정렬 기준 ("publicationDate", "citationCount", "relevance")
            year_from: 이 연도 이후 논문만 (선택)

        Returns:
            arXiv ID가 있는 논문 목록
        """
        all_papers = []
        offset = 0
        batch_size = 100  # API 최대값

        print(f"[SemanticScholar] Searching papers for query: '{query}', sort: {sort}")

        async with httpx.AsyncClient() as client:
            while len(all_papers) < limit:
                try:
                    params = {
                        "query": query,
                        "fields": "title,citationCount,year,authors,externalIds,publicationDate,abstract",
                        "limit": batch_size,
                        "offset": offset,
                    }

                    # 연도 필터 적용
                    if year_from:
                        params["year"] = f"{year_from}-"

                    response = await client.get(
                        f"{self.BASE_URL}/paper/search",
                        params=params,
                        timeout=30.0
                    )

                    if response.status_code == 429:  # Rate limited
                        print(f"[SemanticScholar] Rate limited, waiting {self.RETRY_DELAY}s...")
                        await asyncio.sleep(self.RETRY_DELAY)
                        continue
                    elif response.status_code != 200:
                        print(f"[SemanticScholar] Search API error: {response.status_code}")
                        break

                    data = response.json()
                    papers = data.get("data", [])

                    if not papers:
                        break

                    # arXiv ID 있는 논문만 필터링
                    for paper in papers:
                        external_ids = paper.get("externalIds") or {}
                        arxiv_id = external_ids.get("ArXiv")

                        if arxiv_id:
                            all_papers.append({
                                "paper_id": arxiv_id,
                                "title": paper.get("title"),
                                "authors": [a.get("name") for a in (paper.get("authors") or [])],
                                "year": paper.get("year"),
                                "publication_date": paper.get("publicationDate"),
                                "citation_count": paper.get("citationCount") or 0,
                                "abstract": paper.get("abstract"),
                            })

                            if len(all_papers) >= limit:
                                break

                    offset += batch_size

                    # 더 이상 결과가 없으면 종료
                    if len(papers) < batch_size:
                        break

                except httpx.RequestError as e:
                    print(f"[SemanticScholar] Request error during search: {e}")
                    break

        print(f"[SemanticScholar] Found {len(all_papers)} arXiv papers")

        # 정렬 적용
        if sort == "citationCount":
            all_papers.sort(key=lambda x: x.get("citation_count", 0), reverse=True)
        elif sort == "publicationDate":
            all_papers.sort(
                key=lambda x: x.get("publication_date") or "0000-00-00",
                reverse=True
            )
        # relevance는 API 기본값이므로 추가 정렬 불필요

        return all_papers[:limit]
