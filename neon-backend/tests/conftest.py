import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from mongomock_motor import AsyncMongoMockClient

from app import database
from app.main import app
from app.seed import seed_db


@pytest_asyncio.fixture
async def client():
    mock_db = AsyncMongoMockClient()["neon_classes_test"]
    database.set_db(mock_db)
    await seed_db(mock_db)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

    # reset for next test
    database.set_db(None)


async def login_as(client, user_id):
    resp = await client.post(f"/auth/switch-user/{user_id}")
    assert resp.status_code == 200, resp.text
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}
