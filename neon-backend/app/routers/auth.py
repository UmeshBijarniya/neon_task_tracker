from fastapi import APIRouter, Depends, HTTPException

from app.database import get_db
from app.dependencies import create_access_token, get_current_user
from app.models import LoginResponse, User

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/switch-user/{user_id}", response_model=LoginResponse)
async def switch_user(user_id: str):
    """
    Demo-mode login. Mirrors the frontend's role switcher: no password,
    just "log in as" any seeded user and get back a JWT for their role.
    Swap this for real password/email login before this touches production.
    """
    db = get_db()
    doc = await db.users.find_one({"id": user_id})
    if not doc:
        raise HTTPException(status_code=404, detail="No such user")
    user = User(**doc)
    token = create_access_token(user)
    return LoginResponse(access_token=token, user=user)


@router.get("/me", response_model=User)
async def me(user: User = Depends(get_current_user)):
    return user
