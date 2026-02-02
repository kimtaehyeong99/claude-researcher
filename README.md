# Paper Researcher

논문 검색 사이트 - arXiv 논문을 수집하고 Claude CLI를 활용하여 한국어로 정리/분석합니다.

## 주요 기능

### 3단계 논문 처리 시스템

| 단계 | 설명 | 내용 |
|------|------|------|
| **1단계** | 논문 등록 | paper_id, 제목, 날짜, 인용수 |
| **2단계** | 간단 서칭 | Abstract 한국어 요약 (arXiv API 사용) |
| **3단계** | 딥 서칭 | PDF 전체 내용 한국어 상세 분석 |

### 추가 기능

- **인용 논문 등록**: 특정 논문을 인용한 논문들 자동 수집 (인용수 기준 상위 50개)
- **즐겨찾기**: 중요 논문 북마크
- **관심없음**: 관심 없는 논문 숨기기 (되돌리기 가능)
- **키워드 검색**: 제목 기반 검색
- **단계별 필터링**: 1단계/2단계/3단계별 논문 분류 보기
- **HuggingFace Daily Papers**: 최신 인기 논문 조회 및 등록
- **논문 Figure 추출**: ar5iv에서 첫 번째 Figure 이미지 자동 추출
- **키워드 필터링**: 관심 키워드 등록 및 자동 매칭 (카테고리별 관리)
- **카테고리 필터**: 키워드 카테고리별 논문 필터링

## 기술 스택

- **Backend**: FastAPI (Python)
- **Frontend**: React + TypeScript (Vite)
- **Database**: SQLite
- **논문 소스**: arXiv API, Semantic Scholar API
- **AI 분석**: Claude CLI (Pro 구독 사용)
- **PDF 파싱**: PyMuPDF

## 설치 방법

### 1. 사전 요구사항

- Python 3.10+
- Node.js 18+
- Claude CLI 설치 및 로그인 (`claude` 명령어 사용 가능해야 함)

### 2. 프로젝트 클론

```bash
# 서브모듈 포함하여 클론
git clone --recurse-submodules https://github.com/kimtaehyeong99/claude-researcher.git
cd claude-researcher

# 이미 클론한 경우 서브모듈 초기화
git submodule update --init
```

### 3. 백엔드 설정

```bash
cd backend

# 가상환경 생성 및 활성화
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# 의존성 설치
pip install -r requirements.txt
```

### 4. 프론트엔드 설정

```bash
cd frontend

# 의존성 설치
npm install

# API 서버 주소 설정 (.env 파일 수정)
# VITE_API_URL을 백엔드 서버 IP로 변경
nano .env
# 예: VITE_API_URL=http://192.168.50.184:8000/api
```

## 실행 방법

### 백엔드 서버 실행

```bash
cd backend
source venv/bin/activate  # Windows: venv\Scripts\activate
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

백엔드 API 문서: http://localhost:8000/docs

### 프론트엔드 서버 실행

```bash
cd frontend
npm run dev
```

웹 UI: http://localhost:5173

## 사용 방법

### 1. 새 논문 등록 (1단계)

1. 왼쪽 사이드바에서 **"새 논문 등록"** 선택
2. arXiv 논문 번호 입력 (예: `2306.02437`)
3. **"등록"** 버튼 클릭
4. 논문 기본 정보가 DB에 저장됨

### 2. 인용 논문 등록 (1단계)

1. 왼쪽 사이드바에서 **"인용 논문 등록"** 선택
2. 기준이 되는 arXiv 논문 번호 입력
3. 등록할 논문 수 설정 (기본: 50개)
4. **"등록"** 버튼 클릭
5. 해당 논문을 인용한 논문들이 인용수 순으로 등록됨
   - 이미 DB에 있는 논문은 제외됨

### 3. 간단 서칭 (2단계)

1. 논문 목록에서 논문 제목 클릭하여 상세 페이지 이동
2. **"2단계: 간단 서칭"** 버튼 클릭
3. Abstract가 한국어로 요약됨 (PDF 다운로드 없이 빠르게 처리)

### 4. 딥 서칭 (3단계)

1. 논문 상세 페이지에서 **"3단계: 딥 서칭"** 버튼 클릭
2. PDF 전체를 다운로드하여 상세 분석 생성
3. 연구 배경, 핵심 기여, 방법론, 실험 결과, 한계점 등 포함

### 5. 논문 관리

- **즐겨찾기**: 논문 목록에서 별 아이콘 클릭
- **관심없음**: 논문 목록에서 🚫 버튼 클릭
- **되돌리기**: "관심없음" 탭에서 ↩️ 버튼 클릭
- **삭제**: 논문 목록에서 🗑️ 버튼 클릭

### 6. 필터링

상단 탭을 사용하여 논문 필터링:
- **전체**: 모든 논문 (관심없음 제외)
- **미분석**: 등록만 된 논문 (1단계)
- **개요 분석**: 간단 서칭 완료된 논문 (2단계)
- **상세 분석**: 딥 서칭 완료된 논문 (3단계)
- **즐겨찾기**: 북마크된 논문
- **관심없음**: 숨긴 논문

카테고리 드롭다운을 사용하여 추가 필터링:
- **전체**: 모든 논문
- **[카테고리명]**: 해당 카테고리 키워드가 매칭된 논문
- **카테고리 미해당**: 어떤 키워드도 매칭되지 않은 논문

### 7. 키워드 관리

1. 왼쪽 사이드바에서 **"관심 키워드"** 섹션 펼치기
2. 키워드와 카테고리(선택) 입력 후 **"추가"** 클릭
3. 같은 카테고리 내에서는 중복 키워드 불가 (다른 카테고리에는 동일 키워드 가능)
4. 카테고리별로 자동으로 색상이 할당됨
5. 논문의 제목/초록에서 키워드 자동 매칭

### 8. HuggingFace Daily Papers

1. 대시보드에서 **"📰 HuggingFace Daily Papers"** 버튼 클릭
2. 날짜별 인기 논문 목록 확인
3. upvotes 수, AI 요약, GitHub 링크 제공
4. **"등록"** 버튼으로 바로 논문 등록 가능

## 폴더 구조

```
claude_researcher/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI 앱
│   │   ├── config.py            # 설정
│   │   ├── database.py          # DB 연결
│   │   ├── models/              # SQLAlchemy 모델
│   │   ├── schemas/             # Pydantic 스키마
│   │   ├── routers/             # API 라우터
│   │   └── services/            # 비즈니스 로직
│   ├── venv/                    # Python 가상환경
│   └── requirements.txt
│
├── frontend/
│   ├── src/
│   │   ├── api/                 # API 클라이언트
│   │   ├── components/          # UI 컴포넌트
│   │   ├── pages/               # 페이지
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── .env                     # API 서버 주소 설정
│   └── package.json
│
├── data/                        # 서브모듈 (claude-researcher-data)
│   ├── papers.db                # SQLite 데이터베이스
│   └── *.json                   # 논문 분석 JSON 파일
│
├── .gitmodules
├── .gitignore
└── README.md
```

## 데이터 저장 구조

데이터는 `data/` 서브모듈(별도 Git 레포)에 저장되어 팀원 간 공유 가능합니다.

### SQLite Database (data/papers.db)

빠른 조회/필터링을 위한 메타데이터 저장:

**papers 테이블:**
- paper_id, title, arxiv_date
- search_stage (1, 2, 3)
- is_favorite, is_not_interested
- citation_count, registered_by
- figure_url, matched_keywords (JSON)
- created_at, updated_at

**user_keywords 테이블:**
- keyword, category, color
- 같은 카테고리 내에서 키워드 중복 불가 (UniqueConstraint)

### JSON Files (data/*.json)

긴 텍스트 데이터 저장:
- abstract_ko (2단계: 초록 요약)
- detailed_analysis_ko (3단계: 전체 논문 분석)
- figure_url (2단계: ar5iv에서 추출한 Figure 이미지 URL)

### 데이터 동기화 (서브모듈)

```bash
# DB 변경사항 공유 (push)
cd data
git add -A
git commit -m "Update database"
git push
cd ..
git add data
git commit -m "Update data submodule"
git push

# DB 변경사항 가져오기 (pull)
git pull
git submodule update --remote
```

## API 엔드포인트

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | /api/papers | 논문 목록 조회 |
| GET | /api/papers/{paper_id} | 논문 상세 조회 |
| POST | /api/register/new | 새 논문 등록 |
| POST | /api/register/citations | 인용 논문 등록 |
| POST | /api/search/simple/{paper_id} | 간단 서칭 실행 |
| POST | /api/search/deep/{paper_id} | 딥 서칭 실행 |
| PATCH | /api/papers/{paper_id}/favorite | 즐겨찾기 토글 |
| PATCH | /api/papers/{paper_id}/not-interested | 관심없음 토글 |
| DELETE | /api/papers/{paper_id} | 논문 삭제 |
| GET | /api/keywords | 키워드 목록 조회 |
| POST | /api/keywords | 키워드 추가 |
| DELETE | /api/keywords/{id} | 키워드 삭제 |
| PATCH | /api/keywords/{id} | 키워드 수정 |
| POST | /api/keywords/batch-update | 모든 논문 키워드 재매칭 |
| GET | /api/trending/daily | HuggingFace Daily Papers 조회 |

## 문제 해결

### 백엔드가 실행되지 않을 때

```bash
# 가상환경 활성화 확인
source venv/bin/activate

# 의존성 재설치
pip install -r requirements.txt
```

### 프론트엔드 빈 화면이 나올 때

```bash
# Vite 캐시 삭제
rm -rf node_modules/.vite
npm run dev
```

### Claude CLI 오류

- `claude` 명령어가 터미널에서 작동하는지 확인
- Claude Pro 구독이 활성화되어 있는지 확인
- `claude --version`으로 설치 확인

### arXiv 논문을 찾을 수 없을 때

- 논문 번호 형식 확인 (예: `2306.02437`)
- 최신 논문의 경우 arXiv API 반영까지 시간이 걸릴 수 있음

### Semantic Scholar API rate limit

- 인용수가 0으로 표시되면 API rate limit에 걸린 것
- 잠시 후 다시 시도하거나, 인용 논문 등록 기능을 통해 인용수 확인 가능

## 라이선스

MIT License
