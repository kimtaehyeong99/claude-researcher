import asyncio
import httpx
from typing import List, Dict, Any, Optional, Literal
from datetime import date, timedelta


PeriodType = Literal["day", "week", "month"]


class HuggingFaceService:
    """HuggingFace Daily Papers API 연동 서비스"""

    BASE_URL = "https://huggingface.co/api/daily_papers"

    async def get_daily_papers(
        self,
        target_date: Optional[date] = None,
        period: PeriodType = "day"
    ) -> List[Dict[str, Any]]:
        """
        HuggingFace Daily Papers에서 논문 목록 가져오기

        Args:
            target_date: 특정 날짜 (None이면 오늘)
            period: 기간 ("day", "week", "month")

        Returns:
            논문 목록
        """
        if period == "week":
            return await self._get_papers_for_period(target_date, days=7)
        elif period == "month":
            return await self._get_papers_for_period(target_date, days=30)
        else:
            return await self._get_papers_from_api(target_date)

    async def _get_papers_from_api(
        self,
        target_date: Optional[date] = None
    ) -> List[Dict[str, Any]]:
        """Daily papers를 API에서 가져오기"""
        url = self.BASE_URL
        if target_date:
            url = f"{self.BASE_URL}?date={target_date.isoformat()}"

        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(url, timeout=30.0)
                if response.status_code == 200:
                    papers = response.json()
                    return self._parse_papers(papers)
            except Exception as e:
                print(f"[HuggingFaceService] Error fetching papers from API: {e}")

        return []

    async def _get_papers_for_period(
        self,
        target_date: Optional[date] = None,
        days: int = 7
    ) -> List[Dict[str, Any]]:
        """여러 날짜의 daily papers를 합쳐서 가져오기"""
        end_date = target_date or date.today()
        start_date = end_date - timedelta(days=days - 1)

        # 날짜 목록 생성
        dates = [start_date + timedelta(days=i) for i in range(days)]

        # 병렬로 각 날짜의 데이터 가져오기
        async with httpx.AsyncClient() as client:
            tasks = [
                self._fetch_single_day(client, d) for d in dates
            ]
            results = await asyncio.gather(*tasks, return_exceptions=True)

        # 결과 합치기 및 중복 제거
        seen_ids = set()
        all_papers = []

        for result in results:
            if isinstance(result, list):
                for paper in result:
                    paper_id = paper.get("paper_id")
                    if paper_id and paper_id not in seen_ids:
                        seen_ids.add(paper_id)
                        all_papers.append(paper)

        # upvotes 기준 정렬
        all_papers.sort(key=lambda x: x.get("upvotes", 0), reverse=True)

        return all_papers

    async def _fetch_single_day(
        self,
        client: httpx.AsyncClient,
        target_date: date
    ) -> List[Dict[str, Any]]:
        """단일 날짜의 papers 가져오기"""
        url = f"{self.BASE_URL}?date={target_date.isoformat()}"

        try:
            response = await client.get(url, timeout=30.0)
            if response.status_code == 200:
                papers = response.json()
                return self._parse_papers(papers)
        except Exception as e:
            print(f"[HuggingFaceService] Error fetching papers for {target_date}: {e}")

        return []

    def _parse_papers(self, raw_papers: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        API 응답을 파싱하여 필요한 필드만 추출

        Args:
            raw_papers: HuggingFace API 원본 응답

        Returns:
            정제된 논문 목록
        """
        parsed = []
        for item in raw_papers:
            paper = item.get("paper", {})

            parsed_paper = {
                "paper_id": paper.get("id", ""),
                "title": paper.get("title", ""),
                "summary": paper.get("summary", ""),
                "upvotes": paper.get("upvotes", 0),
                "ai_summary": paper.get("ai_summary", ""),
                "ai_keywords": paper.get("ai_keywords", []),
                "published_at": paper.get("publishedAt", ""),
                "github_repo": paper.get("githubRepo"),
                "github_stars": paper.get("githubStars"),
                "num_comments": item.get("numComments", 0),
                "thumbnail": item.get("thumbnail", ""),
            }

            # 제출자 정보
            submitted_by = item.get("submittedBy", {})
            if submitted_by:
                parsed_paper["submitted_by"] = {
                    "name": submitted_by.get("name", ""),
                    "fullname": submitted_by.get("fullname", ""),
                    "avatar_url": submitted_by.get("avatarUrl", ""),
                }

            # 저자 목록
            authors = paper.get("authors", [])
            parsed_paper["authors"] = [
                author.get("name", "") for author in authors if author.get("name")
            ]

            parsed.append(parsed_paper)

        return parsed
