from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import engine, Base
from app.routers import (
    papers_router,
    registration_router,
    simple_search_router,
    deep_search_router,
)
from app.routers.trending import router as trending_router
from app.routers.keywords import router as keywords_router

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


@app.get("/")
def root():
    return {"message": "Paper Researcher API", "docs": "/docs"}
