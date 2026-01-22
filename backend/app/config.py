from pydantic_settings import BaseSettings
from pathlib import Path


class Settings(BaseSettings):
    DATABASE_URL: str = "sqlite:///./papers.db"
    PAPERS_DIR: Path = Path(__file__).parent.parent / "papers"


settings = Settings()

# Ensure papers directory exists
settings.PAPERS_DIR.mkdir(parents=True, exist_ok=True)
