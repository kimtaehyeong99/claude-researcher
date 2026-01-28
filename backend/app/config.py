from pydantic_settings import BaseSettings, SettingsConfigDict
from pathlib import Path


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=Path(__file__).parent.parent / ".env",
        env_file_encoding="utf-8",
    )

    # DB 경로: 프로젝트 루트의 data/ 서브모듈
    _db_path: Path = Path(__file__).parent.parent.parent / "data" / "papers.db"
    DATABASE_URL: str = f"sqlite:///{_db_path}"
    PAPERS_DIR: Path = Path(__file__).parent.parent / "papers"
    ADMIN_PASSWORD: str = "admin123"  # .env 파일에서 설정


settings = Settings()

# Ensure papers directory exists
settings.PAPERS_DIR.mkdir(parents=True, exist_ok=True)
