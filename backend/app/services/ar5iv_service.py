"""
ar5iv Service - arXiv 논문의 HTML 버전에서 Figure 이미지 추출
"""
import httpx
from bs4 import BeautifulSoup
from typing import Optional


class Ar5ivService:
    """ar5iv.labs.arxiv.org에서 논문 Figure 이미지 URL을 추출하는 서비스"""

    BASE_URL = "https://ar5iv.labs.arxiv.org"

    async def get_first_figure_url(self, paper_id: str) -> Optional[str]:
        """
        ar5iv HTML에서 첫 번째 figure 이미지 URL 추출

        Args:
            paper_id: arXiv 논문 ID (예: "2306.02437")

        Returns:
            첫 번째 figure 이미지의 전체 URL, 없으면 None
        """
        try:
            url = f"{self.BASE_URL}/html/{paper_id}"
            print(f"[Ar5iv] Fetching: {url}")

            async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
                response = await client.get(url)

                if response.status_code != 200:
                    print(f"[Ar5iv] Page not found: {paper_id} (status: {response.status_code})")
                    return None

                soup = BeautifulSoup(response.text, 'html.parser')

                # figure 태그 내 img 찾기
                figures = soup.find_all('figure')
                for figure in figures:
                    img = figure.find('img')
                    if img and img.get('src'):
                        src = img['src']

                        # 상대 경로를 절대 경로로 변환
                        if src.startswith('/'):
                            full_url = f"{self.BASE_URL}{src}"
                        elif not src.startswith('http'):
                            full_url = f"{self.BASE_URL}/html/{paper_id}/{src}"
                        else:
                            full_url = src

                        print(f"[Ar5iv] Found figure: {full_url}")
                        return full_url

                # figure 태그가 없으면 일반 img 태그에서 찾기 (assets/figures 경로)
                images = soup.find_all('img')
                for img in images:
                    src = img.get('src', '')
                    if 'assets' in src or 'figures' in src or 'images' in src:
                        if src.startswith('/'):
                            full_url = f"{self.BASE_URL}{src}"
                        elif not src.startswith('http'):
                            full_url = f"{self.BASE_URL}/html/{paper_id}/{src}"
                        else:
                            full_url = src

                        print(f"[Ar5iv] Found image: {full_url}")
                        return full_url

                print(f"[Ar5iv] No figure found: {paper_id}")
                return None

        except httpx.TimeoutException:
            print(f"[Ar5iv] Timeout: {paper_id}")
            return None
        except Exception as e:
            print(f"[Ar5iv] Error fetching {paper_id}: {e}")
            return None


# 싱글톤 인스턴스
ar5iv_service = Ar5ivService()
