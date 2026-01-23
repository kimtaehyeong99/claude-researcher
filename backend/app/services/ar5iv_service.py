"""
ar5iv Service - arXiv 논문의 HTML 버전에서 Figure 이미지 추출
"""
import httpx
from bs4 import BeautifulSoup
from typing import Optional, List, Dict
import re


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

    async def get_all_figures(self, paper_id: str) -> List[Dict[str, str]]:
        """
        ar5iv HTML에서 모든 figure 이미지 URL과 캡션 추출

        Args:
            paper_id: arXiv 논문 ID (예: "2306.02437")

        Returns:
            [
                {"figure_num": "1", "url": "https://...", "caption": "Figure 1: ..."},
                ...
            ]
        """
        figures_list = []

        try:
            url = f"{self.BASE_URL}/html/{paper_id}"
            print(f"[Ar5iv] Fetching all figures from: {url}")

            async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
                response = await client.get(url)

                if response.status_code != 200:
                    print(f"[Ar5iv] Page not found: {paper_id} (status: {response.status_code})")
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
                        full_url = f"{self.BASE_URL}{src}"
                    elif not src.startswith('http'):
                        full_url = f"{self.BASE_URL}/html/{paper_id}/{src}"
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

                print(f"[Ar5iv] Found {len(figures_list)} figures for {paper_id}")
                return figures_list

        except httpx.TimeoutException:
            print(f"[Ar5iv] Timeout while fetching figures: {paper_id}")
            return []
        except Exception as e:
            print(f"[Ar5iv] Error fetching figures for {paper_id}: {e}")
            return []


# 싱글톤 인스턴스
ar5iv_service = Ar5ivService()
