from pydantic_settings import BaseSettings
from functools import lru_cache
from typing import Optional


class Settings(BaseSettings):
    # Database
    database_url: str = "mysql+aiomysql://user:password@localhost:3306/broker_agent"
    
    # Google Drive
    google_drive_credentials_path: str = "./credentials/google_service_account.json"
    google_drive_folder_id: str = ""
    
    # OpenAI
    openai_api_key: str = ""
    
    # Gemini
    gemini_api_key: str = ""
    
    # JWT
    secret_key: str = "your-secret-key-change-in-production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    
    # App
    debug: bool = True
    upload_dir: str = "./uploads"
    
    class Config:
        env_file = ".env"
        case_sensitive = False


@lru_cache()
def get_settings() -> Settings:
    return Settings()

