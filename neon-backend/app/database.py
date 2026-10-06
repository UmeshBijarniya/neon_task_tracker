import certifi
from motor.motor_asyncio import AsyncIOMotorClient

from app.config import DB_NAME, MONGO_URL

_client: AsyncIOMotorClient | None = None
_db = None


def get_db():
    """
    Returns the active DB handle. In production this is a real Mongo db
    (lazily connected on first use). In tests, main.py's dependency override
    swaps this out for a mongomock-motor in-memory database instead.
    """
    global _client, _db
    if _db is None:
        client_kwargs = {
            "maxPoolSize": 50,
            "minPoolSize": 5,
            "maxIdleTimeMS": 45000,
            "serverSelectionTimeoutMS": 10000,
            "connectTimeoutMS": 10000,
            "socketTimeoutMS": 20000,
        }
        if "mongodb+srv://" in MONGO_URL or "ssl=true" in MONGO_URL.lower() or "tls=true" in MONGO_URL.lower():
            client_kwargs["tlsCAFile"] = certifi.where()

        _client = AsyncIOMotorClient(MONGO_URL, **client_kwargs)
        _db = _client[DB_NAME]
    return _db




def set_db(db):
    """Used by tests to inject a mongomock database instead of real Mongo."""
    global _db
    _db = db
