from app.routers.papers import router as papers_router
from app.routers.registration import router as registration_router
from app.routers.simple_search import router as simple_search_router
from app.routers.deep_search import router as deep_search_router

__all__ = [
    "papers_router",
    "registration_router",
    "simple_search_router",
    "deep_search_router",
]
