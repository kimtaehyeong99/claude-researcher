"""
ar5iv Service - arXiv 논문의 HTML 버전에서 Figure 이미지 추출
"""
import httpx
from bs4 import BeautifulSoup
from typing import Optional, List, Dict
import re


class Ar5ivService:
    """ar5iv.labs.arxiv.org 또는 arxiv.org에서 논문 Figure 이미지 URL을 추출하는 서비스"""

    AR5IV_BASE = "https://ar5iv.labs.arxiv.org"
    ARXIV_BASE = "https://arxiv.org"

    async def _fetch_first_figure_from_html(self, url: str, base_url: str, paper_id: str) -> Optional[str]:
        """HTML 페이지에서 첫 번째 figure 이미지 URL 추출 (공통 로직)"""
        async with httpx.AsyncClient(timeout=30.0, follow_redirects=False) as client:
            response = await client.get(url)

            # 리다이렉트 감지 (ar5iv가 지원 안하는 경우)
            if response.status_code in (301, 302, 307, 308):
                return None

            if response.status_code != 200:
                return None

            soup = BeautifulSoup(response.text, 'html.parser')

            # HTML에서 모든 img 태그를 순서대로 찾아서 첫 번째 유효한 figure 이미지 반환
            images = soup.find_all('img')
            for img in images:
                src = img.get('src', '')

                # figure 관련 이미지만 선택 (assets, figures, images 경로, 또는 x숫자.png/jpg 패턴)
                is_figure_path = 'assets' in src or 'figures' in src or 'images' in src
                is_figure_file = bool(re.match(r'^x\d+\.(png|jpg|jpeg|gif|webp)$', src.split('/')[-1], re.IGNORECASE))

                if not (is_figure_path or is_figure_file):
                    continue

                # 로고, 아이콘 등 제외
                if 'logo' in src.lower() or 'icon' in src.lower():
                    continue

                # 상대 경로를 절대 경로로 변환
                if src.startswith('/'):
                    full_url = f"{base_url}{src}"
                elif not src.startswith('http'):
                    full_url = f"{base_url}/html/{paper_id}/{src}"
                else:
                    full_url = src

                return full_url

            return None

    async def get_first_figure_url(self, paper_id: str) -> Optional[str]:
        """
        ar5iv 또는 arxiv HTML에서 첫 번째 figure 이미지 URL 추출
        (ar5iv 우선, 실패 시 arxiv.org fallback)

        Args:
            paper_id: arXiv 논문 ID (예: "2306.02437")

        Returns:
            첫 번째 figure 이미지의 전체 URL, 없으면 None
        """
        try:
            # 1. ar5iv 먼저 시도
            ar5iv_url = f"{self.AR5IV_BASE}/html/{paper_id}"
            print(f"[Ar5iv] Fetching: {ar5iv_url}")

            result = await self._fetch_first_figure_from_html(ar5iv_url, self.AR5IV_BASE, paper_id)
            if result:
                print(f"[Ar5iv] Found first image: {result}")
                return result

            # 2. ar5iv 실패 시 arxiv.org HTML fallback
            arxiv_url = f"{self.ARXIV_BASE}/html/{paper_id}"
            print(f"[Ar5iv] ar5iv failed, trying arxiv.org: {arxiv_url}")

            result = await self._fetch_first_figure_from_html(arxiv_url, self.ARXIV_BASE, paper_id)
            if result:
                print(f"[Ar5iv] Found first image from arxiv.org: {result}")
                return result

            print(f"[Ar5iv] No figure found: {paper_id}")
            return None

        except httpx.TimeoutException:
            print(f"[Ar5iv] Timeout: {paper_id}")
            return None
        except Exception as e:
            print(f"[Ar5iv] Error fetching {paper_id}: {e}")
            return None

    async def _fetch_all_figures_from_html(self, url: str, base_url: str, paper_id: str) -> List[Dict[str, str]]:
        """HTML 페이지에서 모든 figure 이미지 URL과 캡션 추출 (공통 로직)"""
        figures_list = []

        async with httpx.AsyncClient(timeout=30.0, follow_redirects=False) as client:
            response = await client.get(url)

            # 리다이렉트 감지
            if response.status_code in (301, 302, 307, 308):
                return []

            if response.status_code != 200:
                return []

            soup = BeautifulSoup(response.text, 'html.parser')

            # 모든 figure 태그 순회
            figures = soup.find_all('figure')
            figure_count = 0

            for figure in figures:
                img = figure.find('img')
                if not img or not img.get('src'):
                    continue

                src = img['src']

                # 상대 경로를 절대 경로로 변환
                if src.startswith('/'):
                    full_url = f"{base_url}{src}"
                elif not src.startswith('http'):
                    full_url = f"{base_url}/html/{paper_id}/{src}"
                else:
                    full_url = src

                # Figure 번호 추출
                figure_num = ""
                figcaption = figure.find('figcaption')
                caption_text = ""

                if figcaption:
                    # Figure 번호 태그에서 추출 (예: "Figure 1")
                    tag_span = figcaption.find('span', class_='ltx_tag')
                    if tag_span:
                        tag_text = tag_span.get_text(strip=True)
                        # "Figure 1" 또는 "Fig. 1" 패턴에서 번호 추출
                        match = re.search(r'(?:Figure|Fig\.?)\s*(\d+)', tag_text, re.IGNORECASE)
                        if match:
                            figure_num = match.group(1)

                    # 전체 캡션 텍스트 추출
                    caption_text = figcaption.get_text(separator=' ', strip=True)
                    # 캡션 길이 제한
                    if len(caption_text) > 500:
                        caption_text = caption_text[:500] + "..."

                # Figure 번호가 없으면 순서대로 번호 부여
                if not figure_num:
                    figure_count += 1
                    figure_num = str(figure_count)

                figures_list.append({
                    "figure_num": figure_num,
                    "url": full_url,
                    "caption": caption_text
                })

            return figures_list

    async def get_all_figures(self, paper_id: str) -> List[Dict[str, str]]:
        """
        ar5iv 또는 arxiv HTML에서 모든 figure 이미지 URL과 캡션 추출
        (ar5iv 우선, 실패 시 arxiv.org fallback)

        Args:
            paper_id: arXiv 논문 ID (예: "2306.02437")

        Returns:
            [
                {"figure_num": "1", "url": "https://...", "caption": "Figure 1: ..."},
                ...
            ]
        """
        try:
            # 1. ar5iv 먼저 시도
            ar5iv_url = f"{self.AR5IV_BASE}/html/{paper_id}"
            print(f"[Ar5iv] Fetching all figures from: {ar5iv_url}")

            figures_list = await self._fetch_all_figures_from_html(ar5iv_url, self.AR5IV_BASE, paper_id)
            if figures_list:
                print(f"[Ar5iv] Found {len(figures_list)} figures for {paper_id}")
                return figures_list

            # 2. ar5iv 실패 시 arxiv.org HTML fallback
            arxiv_url = f"{self.ARXIV_BASE}/html/{paper_id}"
            print(f"[Ar5iv] ar5iv failed, trying arxiv.org: {arxiv_url}")

            figures_list = await self._fetch_all_figures_from_html(arxiv_url, self.ARXIV_BASE, paper_id)
            if figures_list:
                print(f"[Ar5iv] Found {len(figures_list)} figures from arxiv.org for {paper_id}")
                return figures_list

            print(f"[Ar5iv] No figures found: {paper_id}")
            return []

        except httpx.TimeoutException:
            print(f"[Ar5iv] Timeout while fetching figures: {paper_id}")
            return []
        except Exception as e:
            print(f"[Ar5iv] Error fetching figures for {paper_id}: {e}")
            return []


# 싱글톤 인스턴스
ar5iv_service = Ar5ivService()
