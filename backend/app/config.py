from pydantic_settings import BaseSettings, SettingsConfigDict
from pathlib import Path


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=Path(__file__).parent.parent / ".env",
        env_file_encoding="utf-8",
    )

    DATABASE_URL: str = "sqlite:///./papers.db"
    PAPERS_DIR: Path = Path(__file__).parent.parent / "papers"
    ADMIN_PASSWORD: str = "admin123"  # .env 파일에서 설정


settings = Settings()

# Ensure papers directory exists
settings.PAPERS_DIR.mkdir(parents=True, exist_ok=True)
