from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import engine, Base
from app.models import Paper, AccessLog  # 모델 import하여 테이블 자동 생성
from app.routers import (
    papers_router,
    registration_router,
    simple_search_router,
    deep_search_router,
)
from app.routers.trending import router as trending_router
from app.routers.keywords import router as keywords_router
from app.routers.access_logs import router as access_logs_router

# Create database tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Paper Researcher",
    description="논문 검색 사이트 API",
    version="1.0.0",
)

# CORS middleware for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(papers_router, prefix="/api/papers", tags=["Papers"])
app.include_router(registration_router, prefix="/api/register", tags=["Registration"])
app.include_router(simple_search_router, prefix="/api/search", tags=["Simple Search"])
app.include_router(deep_search_router, prefix="/api/search", tags=["Deep Search"])
app.include_router(trending_router, prefix="/api/trending", tags=["Trending"])
app.include_router(keywords_router, prefix="/api/keywords", tags=["Keywords"])
app.include_router(access_logs_router, prefix="/api/access-logs", tags=["Access Logs"])


@app.get("/")
def root():
    return {"message": "Paper Researcher API", "docs": "/docs"}
