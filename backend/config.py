import logging
import os

from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"))

FRONTEND_ORIGIN = os.getenv("FRONTEND_ORIGIN", "http://localhost:5173")
DATABASE_URL = os.getenv(
    "DATABASE_URL", "postgresql://rhymathic:rhymathic@localhost:5432/rhymathic"
)

JWT_SECRET = os.getenv("JWT_SECRET", "dev-secret-change-me")
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days

ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "admin@rhymathic.local")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "change_me")

MISTRAL_API_KEY = os.getenv("MISTRAL_API_KEY", "")
MISTRAL_CHAT_URL = "https://api.mistral.ai/v1/chat/completions"
MISTRAL_MODEL = "mistral-small-latest"
