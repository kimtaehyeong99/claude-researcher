import asyncio
import httpx
import tempfile
from pathlib import Path
from typing import Optional
from bs4 import BeautifulSoup
import fitz  # PyMuPDF


class ClaudeService:
    """Claude CLI 기반 번역 및 분석 서비스 (Pro 구독 사용)"""

    def __init__(self):
        pass

    async def _run_claude_cli(self, prompt: str, max_retries: int = 3) -> str:
        """
        Claude CLI를 호출하여 응답을 받음

        Args:
            prompt: Claude에게 보낼 프롬프트
            max_retries: 최대 재시도 횟수

        Returns:
            Claude의 응답 텍스트
        """
        for attempt in range(max_retries):
            try:
                process = await asyncio.create_subprocess_exec(
                    "claude",
                    "--print",
                    stdin=asyncio.subprocess.PIPE,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE,
                )

                stdout, stderr = await asyncio.wait_for(
                    process.communicate(input=prompt.encode('utf-8')),
                    timeout=300  # 5분 타임아웃
                )

                if process.returncode == 0:
                    return stdout.decode('utf-8').strip()
                else:
                    print(f"[ClaudeCLI] Error (attempt {attempt + 1}/{max_retries}): {stderr.decode('utf-8')}")
                    if attempt < max_retries - 1:
                        await asyncio.sleep(2)

            except asyncio.TimeoutError:
                print(f"[ClaudeCLI] Timeout (attempt {attempt + 1}/{max_retries})")
                if attempt < max_retries - 1:
                    await asyncio.sleep(2)
            except Exception as e:
                print(f"[ClaudeCLI] Exception (attempt {attempt + 1}/{max_retries}): {e}")
                if attempt < max_retries - 1:
                    await asyncio.sleep(2)

        return ""

    async def summarize_abstract(self, abstract: str) -> str:
        """
        2단계: Abstract를 한국어로 자연스럽게 정리

        Args:
            abstract: 영문 초록

        Returns:
            한국어로 정리된 초록
        """
        if not abstract:
            return ""

        prompt = f"""다음 논문 초록(Abstract)을 한국어로 자연스럽게 정리해주세요.
핵심 내용을 파악하기 쉽게 요약하고, 전문 용어는 영어를 괄호 안에 병기해주세요.

수식이 포함되면 다음 형식을 따라주세요:
- 텍스트 중간의 수식: $수식$ (예: $E = mc^2$)
- 별도 줄의 수식: $$수식$$ (예: $$max_x f(x)$$)

초록:
{abstract}

한국어 정리:"""

        print("[ClaudeCLI] Summarizing abstract...")
        result = await self._run_claude_cli(prompt)
        print("[ClaudeCLI] Abstract summary complete")
        return result

    async def analyze_full_paper_from_pdf(
        self,
        paper_id: str,
        title: str,
        abstract: str,
        pdf_url: str
    ) -> str:
        """
        3단계: PDF URL에서 다운로드하여 텍스트 추출 후 Claude CLI로 상세 분석
        이전 방식과 유사하게 제목+초록+본문을 종합적으로 분석

        Args:
            paper_id: arXiv 논문 ID
            title: 논문 제목
            abstract: 논문 초록
            pdf_url: PDF URL (예: https://arxiv.org/pdf/2306.02437.pdf)

        Returns:
            한국어로 상세 정리된 분석
        """
        print(f"[ClaudeCLI] Downloading PDF from {pdf_url}...")

        # PDF 다운로드
        pdf_bytes = None
        try:
            async with httpx.AsyncClient(timeout=60.0, follow_redirects=True) as client:
                response = await client.get(pdf_url)
                if response.status_code == 200:
                    pdf_bytes = response.content
        except Exception as e:
            print(f"[ClaudeCLI] Failed to download PDF: {e}")
            return "(PDF 다운로드에 실패했습니다.)"

        if not pdf_bytes:
            return "(PDF를 가져올 수 없습니다.)"

        # PDF에서 텍스트 추출
        print("[ClaudeCLI] Extracting text from PDF...")
        try:
            doc = fitz.open(stream=pdf_bytes, filetype="pdf")
            full_text = ""
            for page in doc:
                full_text += page.get_text()
            doc.close()
        except Exception as e:
            print(f"[ClaudeCLI] Failed to extract text: {e}")
            return "(PDF 텍스트 추출에 실패했습니다.)"

        if not full_text:
            return "(PDF에서 텍스트를 추출할 수 없습니다.)"

        # 텍스트 길이 제한
        max_length = 200000  # 20만 자 (프롬프트 오버헤드 고려)
        if len(full_text) > max_length:
            full_text = full_text[:max_length]

        prompt = f"""다음 논문을 상세히 분석하여 한국어로 정리해주세요.

**논문 제목**: {title}
**ArXiv ID**: {paper_id}

**초록**:
{abstract}

**본문 (일부)**:
{full_text}

---

다음 형식으로 작성해주세요:

### 연구 배경 및 문제 정의
(이 연구가 해결하고자 하는 문제와 배경을 설명)

### 주요 기여점
(이 논문의 핵심 기여와 새로운 점을 bullet point로 정리)

### 제안 방법론
(논문에서 제안하는 방법론의 핵심 내용을 상세히 설명)

### 실험 및 결과
(실험 설정과 주요 결과를 정리)

### 핵심 인사이트
(이 논문의 주요 발견사항과 시사점)

### 한줄 요약
(논문의 핵심을 한 문장으로 요약)

---

중요: 수식이나 수학적 표현을 포함할 때는 다음 형식을 따라주세요:
- 텍스트 중간의 수식: $수식$ (예: $E = mc^2$)
- 별도 줄의 수식: $$수식$$ (예: $$\\max_x f(x)$$)
- 언더스코어(_)는 첨자를 나타냅니다. 예: $a_i$, $\\rho_{\\pi_E}$
- 백슬래시(\\)는 LaTeX 명령어에 사용됩니다. 예: \\max, \\sum, \\frac

전문 용어는 영어를 괄호 안에 병기해주세요."""

        print("[ClaudeCLI] Analyzing paper...")
        result = await self._run_claude_cli(prompt, max_retries=2)

        if result:
            print("[ClaudeCLI] Full paper analysis complete")
            return result
        else:
            return "(논문 분석에 실패했습니다.)"
