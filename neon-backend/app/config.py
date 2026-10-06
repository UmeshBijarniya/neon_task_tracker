import os

MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.getenv("DB_NAME", "neon_classes")

# Demo-only secret. Swap for a real secret (env var) before deploying anywhere real.
JWT_SECRET = os.getenv("JWT_SECRET", "neon-classes-dev-secret-change-me")
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_MINUTES = 60 * 24  # 24h, generous since this is a demo login

# CORS configuration
CORS_ORIGINS_RAW = os.getenv("CORS_ORIGINS", "*")
CORS_ORIGINS = [o.strip() for o in CORS_ORIGINS_RAW.split(",") if o.strip()]

