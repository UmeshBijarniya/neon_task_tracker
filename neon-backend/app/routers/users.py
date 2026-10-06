from typing import Optional

from fastapi import APIRouter, Depends, Query

from app.database import get_db
from app.dependencies import get_current_user
from app.models import Role, User

router = APIRouter(prefix="/users", tags=["users"])


@router.get("", response_model=list[User])
async def list_users(
    role: Optional[Role] = Query(default=None),
    _: User = Depends(get_current_user),  # any logged-in user can see the team list
):
    db = get_db()
    query = {"role": role.value} if role else {}
    docs = await db.users.find(query).to_list(length=None)
    return [User(**d) for d in docs]
