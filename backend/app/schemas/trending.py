from pydantic import BaseModel
from typing import List, Optional


class SubmittedBy(BaseModel):
    name: str
    fullname: str
    avatar_url: str


class TrendingPaper(BaseModel):
    paper_id: str
    title: str
    summary: str
    upvotes: int
    ai_summary: Optional[str] = None
    ai_keywords: List[str] = []
    published_at: str
    github_repo: Optional[str] = None
    github_stars: Optional[int] = None
    num_comments: int = 0
    thumbnail: Optional[str] = None
    submitted_by: Optional[SubmittedBy] = None
    authors: List[str] = []


class TrendingPapersResponse(BaseModel):
    papers: List[TrendingPaper]
    date: str
    total: int
    period: str = "day"
