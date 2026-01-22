import httpx
import xml.etree.ElementTree as ET
import fitz  # PyMuPDF
import io
import re
from typing import Optional, Dict, Any
from datetime import datetime


class ArxivService:
    """arXiv API 연동 서비스"""

    BASE_URL = "https://export.arxiv.org/api/query"

    @staticmethod
    def _parse_arxiv_id(paper_id: str) -> str:
        """Clean arxiv ID (remove version if present)"""
        # Handle formats like "2306.02437" or "2306.02437v1"
        return paper_id.split("v")[0]

    @staticmethod
    def _parse_date(date_str: str) -> Optional[datetime]:
        """Parse arxiv date string"""
        try:
            return datetime.fromisoformat(date_str.replace("Z", "+00:00"))
        except (ValueError, AttributeError):
            return None

    async def get_paper_info(self, paper_id: str) -> Optional[Dict[str, Any]]:
        """
        Get paper metadata from arXiv API

        Args:
            paper_id: arXiv paper ID (e.g., "2306.02437")

        Returns:
            Dictionary with paper info or None if not found
        """
        clean_id = self._parse_arxiv_id(paper_id)

        async with httpx.AsyncClient() as client:
            response = await client.get(
                self.BASE_URL,
                params={"id_list": clean_id},
                timeout=30.0
            )

            if response.status_code != 200:
                return None

            return self._parse_response(response.text, clean_id)

    def _parse_response(self, xml_content: str, paper_id: str) -> Optional[Dict[str, Any]]:
        """Parse arXiv API XML response"""
        # Define namespaces
        namespaces = {
            "atom": "http://www.w3.org/2005/Atom",
            "arxiv": "http://arxiv.org/schemas/atom"
        }

        root = ET.fromstring(xml_content)
        entry = root.find("atom:entry", namespaces)

        if entry is None:
            return None

        # Check if entry is valid (not an error)
        title_elem = entry.find("atom:title", namespaces)
        if title_elem is None or title_elem.text is None:
            return None

        title = " ".join(title_elem.text.split())  # Normalize whitespace

        # Get abstract
        summary_elem = entry.find("atom:summary", namespaces)
        abstract = ""
        if summary_elem is not None and summary_elem.text:
            abstract = " ".join(summary_elem.text.split())

        # Get published date
        published_elem = entry.find("atom:published", namespaces)
        published_date = None
        if published_elem is not None and published_elem.text:
            dt = self._parse_date(published_elem.text)
            if dt:
                published_date = dt.date()

        # Get authors
        authors = []
        for author in entry.findall("atom:author", namespaces):
            name_elem = author.find("atom:name", namespaces)
            if name_elem is not None and name_elem.text:
                authors.append(name_elem.text)

        # Get PDF link
        pdf_link = None
        for link in entry.findall("atom:link", namespaces):
            if link.get("title") == "pdf":
                pdf_link = link.get("href")
                break

        return {
            "paper_id": paper_id,
            "title": title,
            "abstract": abstract,
            "arxiv_date": published_date,
            "authors": authors,
            "pdf_url": pdf_link,
        }

    async def download_pdf(self, paper_id: str) -> Optional[bytes]:
        """Download PDF from arXiv"""
        clean_id = self._parse_arxiv_id(paper_id)
        pdf_url = f"https://arxiv.org/pdf/{clean_id}.pdf"

        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(
                    pdf_url,
                    timeout=60.0,
                    follow_redirects=True
                )
                if response.status_code == 200:
                    return response.content
            except httpx.RequestError:
                pass
        return None

    def extract_text_from_pdf(self, pdf_bytes: bytes) -> str:
        """Extract all text from PDF"""
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        text = ""
        for page in doc:
            text += page.get_text()
        doc.close()
        return text

    def extract_introduction_from_text(self, full_text: str) -> str:
        """Extract Introduction section from paper text"""
        # Common section headers that come after Introduction
        next_sections = [
            r'\n2\.?\s+',  # Section 2
            r'\nII\.?\s+',  # Roman numeral II
            r'\n2\s+[A-Z]',  # 2 followed by capital letter
            r'\nRelated\s+Work',
            r'\nBackground',
            r'\nPreliminar',
            r'\nMethod',
            r'\nApproach',
            r'\nProblem\s+(?:Setting|Formulation|Statement)',
        ]

        # Find Introduction start
        intro_patterns = [
            r'1\.?\s*Introduction',
            r'I\.?\s*Introduction',
            r'1\s+Introduction',
            r'\nIntroduction\n',
        ]

        intro_start = -1
        for pattern in intro_patterns:
            match = re.search(pattern, full_text, re.IGNORECASE)
            if match:
                intro_start = match.start()
                break

        if intro_start == -1:
            return ""

        # Find where Introduction ends
        intro_text = full_text[intro_start:]
        intro_end = len(intro_text)

        for pattern in next_sections:
            match = re.search(pattern, intro_text[100:], re.IGNORECASE)  # Skip first 100 chars
            if match:
                end_pos = match.start() + 100
                if end_pos < intro_end:
                    intro_end = end_pos

        introduction = intro_text[:intro_end].strip()

        # Clean up the text
        introduction = re.sub(r'\s+', ' ', introduction)
        introduction = introduction[:8000]  # Limit length

        return introduction

    async def get_paper_full_text(self, paper_id: str) -> Optional[str]:
        """
        Get paper full text from PDF

        Args:
            paper_id: arXiv paper ID

        Returns:
            Paper text content or None
        """
        pdf_bytes = await self.download_pdf(paper_id)
        if pdf_bytes:
            return self.extract_text_from_pdf(pdf_bytes)
        return None

    async def get_introduction(self, paper_id: str) -> Optional[str]:
        """
        Get Introduction section from paper PDF

        Args:
            paper_id: arXiv paper ID

        Returns:
            Introduction text or None
        """
        pdf_bytes = await self.download_pdf(paper_id)
        if not pdf_bytes:
            return None

        full_text = self.extract_text_from_pdf(pdf_bytes)
        introduction = self.extract_introduction_from_text(full_text)

        return introduction if introduction else None
