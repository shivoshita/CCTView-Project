"""
Configuration Management
Loads settings from environment variables
"""

from pydantic_settings import BaseSettings
from pydantic import ConfigDict
from typing import List, Optional
from pathlib import Path


class Settings(BaseSettings):
    """Application settings"""
    
    # Application
    PROJECT_NAME: str = "CCTView"
    VERSION: str = "1.0.0"
    API_V1_PREFIX: str = "/api/v1"
    
    # Server
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    
    # CORS
    CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://localhost:5173",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
    ]
    
    # Security
    SECRET_KEY: str = "your-secret-key-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    
    # AI Service (GPU Server)
    AI_SERVICE_URL: str = "http://192.168.0.9:8888"
    AI_SERVICE_TIMEOUT: int = 30
    
    # Redis Configuration
    REDIS_HOST: str = "localhost"
    REDIS_PORT: int = 6379
    REDIS_PASSWORD: Optional[str] = None
    REDIS_DB: int = 0
    REDIS_MAX_CONNECTIONS: int = 50
    
    #LLM Configuration
    LLM_PROVIDER: str ="ollama"
    
    # Ollama Settings
    OLLAMA_BASE_URL: str = "http://192.168.0.9:11434"
    OLLAMA_MODEL: str = "llama3.1:8b"
    OLLAMA_TIMEOUT: int = 300

    # OpenAI Settings (optional)
    OPENAI_API_KEY: Optional[str] = None
    OPENAI_MODEL: str = "gpt-4o-mini"
    
    # Redis TTL Settings (Context Window)
    REDIS_TTL_2HOUR: int = 7200  # MAX 2 hours
    REDIS_MIGRATION_THRESHOLD: int = 300  # 5 minutes - when to start migration to Neo4j
    
    # Neo4j Configuration
    NEO4J_URI: str = "bolt://localhost:7687"
    NEO4J_USER: str = "neo4j"
    NEO4J_PASSWORD: str = "your-neo4j-password"
    NEO4J_DATABASE: str = "neo4j"
    NEO4J_MAX_CONNECTION_LIFETIME: int = 3600
    NEO4J_MAX_CONNECTION_POOL_SIZE: int = 50
    
    # Retention Policies
    RETENTION_30_DAYS: int = 30
    RETENTION_60_DAYS: int = 60
    RETENTION_90_DAYS: int = 90
    RETENTION_UNLIMITED: Optional[int] = None
    DEFAULT_RETENTION_DAYS: int = 90
    
    # RabbitMQ Configuration
    RABBITMQ_HOST: str = "localhost"
    RABBITMQ_PORT: int = 5672
    RABBITMQ_USER: str = "guest"
    RABBITMQ_PASSWORD: str = "guest"
    RABBITMQ_VHOST: str = "/"
    
    # Celery Configuration
    CELERY_BROKER_URL: str = "amqp://guest:guest@localhost:5672//"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/1"
    
    # Camera Processing
    FRAME_EXTRACTION_INTERVAL: float = 2.0  # seconds
    CAPTION_INTERVAL_OPTIONS: List[int] = [15, 20, 40, 60]  # 15s, 20s, 40s, 1min
    DEFAULT_CAPTION_INTERVAL: int = 15  # Default to 15 seconds
    MOTION_DETECTION_THRESHOLD: float = 15.0  # percentage
    BLUR_DETECTION_THRESHOLD: float = 100.0
    MAX_CONCURRENT_CAMERAS: int = 50
    
    # AI Processing
    BATCH_SIZE: int = 4
    SIMILARITY_THRESHOLD: float = 0.95  # for deduplication
    ANOMALY_CONFIDENCE_THRESHOLD: float = 0.75
    REID_SIMILARITY_THRESHOLD: float = 0.75
    
    # Storage Paths
    MODELS_DIR: Path = Path("./models")
    LOGS_DIR: Path = Path("./logs")
    TEMP_DIR: Path = Path("./temp")
    
    # Notification Settings
    ENABLE_PUSH_NOTIFICATIONS: bool = True
    ENABLE_EMAIL_NOTIFICATIONS: bool = True
    ENABLE_SMS_NOTIFICATIONS: bool = False
    
    # Email Configuration
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: Optional[str] = None
    SMTP_PASSWORD: Optional[str] = None
    SMTP_FROM_EMAIL: str = "cctview@example.com"
    SMTP_FROM_NAME: str = "CCTView Alert System"
    
    # FCM Configuration (Firebase Cloud Messaging)
    FCM_SERVER_KEY: Optional[str] = None
    
    # Caption Deduplication Settings (NEW)
    CAPTION_SIMILARITY_THRESHOLD: float = 0.95  # Captions above this are considered duplicates
    MIN_CAPTION_DURATION: int = 60  # Minimum seconds for a caption event (1 minute)
    MAX_CAPTION_DURATION: int = 300  # Maximum seconds for grouping (5 minutes)
    
    # Twilio Configuration (SMS)
    TWILIO_ACCOUNT_SID: Optional[str] = None
    TWILIO_AUTH_TOKEN: Optional[str] = None
    TWILIO_FROM_NUMBER: Optional[str] = None
    
    # Logging
    LOG_LEVEL: str = "INFO"
    LOG_FORMAT: str = "json"  # "json" or "text"
    
    model_config = ConfigDict(
        env_file=".env",
        case_sensitive=True,
        extra="ignore"  # This will ignore extra fields in .env
    )


# Create settings instance
settings = Settings()

# Create directories if they don't exist
settings.MODELS_DIR.mkdir(exist_ok=True)
settings.LOGS_DIR.mkdir(exist_ok=True)
settings.TEMP_DIR.mkdir(exist_ok=True)