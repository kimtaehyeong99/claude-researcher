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
        self, paper_id: str, limit: int = 50
    ) -> List[Dict[str, Any]]:
        """
        Get papers that cite the given paper, sorted by citation count

        Args:
            paper_id: arXiv paper ID
            limit: Maximum number of citing papers to return

        Returns:
            List of citing papers sorted by citation count (descending)
        """
        semantic_id = self._arxiv_to_semantic_id(paper_id)
        all_citations = []
        offset = 0
        batch_size = 100  # Semantic Scholar API limit

        async with httpx.AsyncClient() as client:
            while True:
                try:
                    response = await client.get(
                        f"{self.BASE_URL}/paper/{semantic_id}/citations",
                        params={
                            "fields": "title,citationCount,externalIds,year,publicationDate",
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
                        external_ids = citing_paper.get("externalIds", {})
                        arxiv_id = external_ids.get("ArXiv")

                        if arxiv_id:  # Only include papers with arXiv ID
                            all_citations.append({
                                "paper_id": arxiv_id,
                                "title": citing_paper.get("title"),
                                "citation_count": citing_paper.get("citationCount", 0),
                                "year": citing_paper.get("year"),
                                "publication_date": citing_paper.get("publicationDate"),
                            })

                    offset += batch_size

                    # Stop if we have enough papers or no more results
                    if len(citations) < batch_size or len(all_citations) >= limit * 2:
                        break

                except httpx.RequestError:
                    break

        # Sort by citation count (descending) and return top N
        sorted_citations = sorted(
            all_citations,
            key=lambda x: x.get("citation_count", 0),
            reverse=True
        )

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
