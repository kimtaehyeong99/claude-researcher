import httpx
from typing import Optional


class OpenAlexService:
    """OpenAlex API 연동 서비스 - 빠른 인용수 조회"""

    BASE_URL = "https://api.openalex.org"
    TIMEOUT = 5.0  # seconds (매우 빠름)

    async def get_citation_count(self, paper_id: str) -> Optional[int]:
        """
        arXiv 논문의 인용수 조회 (OpenAlex - DOI 기반)

        Args:
            paper_id: arXiv paper ID (e.g., "2306.02437")

        Returns:
            Citation count or None if not found
        """
        # arXiv ID에서 버전 제거 후 DOI 형식으로 변환
        clean_id = paper_id.split("v")[0]
        doi = f"10.48550/arxiv.{clean_id}"

        async with httpx.AsyncClient() as client:
            try:
                # OpenAlex DOI 기반 조회 (매우 빠름)
                response = await client.get(
                    f"{self.BASE_URL}/works/doi:{doi}",
                    params={"select": "cited_by_count"},
                    headers={"User-Agent": "PaperResearcher/1.0 (mailto:contact@example.com)"},
                    timeout=self.TIMEOUT
                )

                if response.status_code == 200:
                    data = response.json()
                    citation_count = data.get("cited_by_count", 0)
                    print(f"[OpenAlex] Paper {paper_id} citation count: {citation_count}")
                    return citation_count
                else:
                    print(f"[OpenAlex] API error {response.status_code} for paper {paper_id}")
                    return None

            except httpx.RequestError as e:
                print(f"[OpenAlex] Request error for paper {paper_id}: {e}")
                return None
