import re
from fastapi import APIRouter, Depends, HTTPException, status

from app.database import get_db
from app.dependencies import create_access_token, get_current_user
from app.models import LoginRequest, LoginResponse, User

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=LoginResponse)
async def login(body: LoginRequest):
    email = body.email.strip().lower()
    password = body.password.strip()

    if not email or not password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email and password are required.",
        )

    # Convenience shortcuts/aliases for quick access:
    alias_map = {
        "admin@neon.com": "admin@neonclasses.com",
        "script@neon.com": "priya@neonclasses.com",
        "script@neonclasses.com": "priya@neonclasses.com",
        "content@neon.com": "neha@neonclasses.com",
        "content@neonclasses.com": "neha@neonclasses.com",
        "editor@neon.com": "karan@neonclasses.com",
        "editor@neonclasses.com": "karan@neonclasses.com",
    }
    lookup_email = alias_map.get(email, email)

    db = get_db()
    # Case-insensitive email query
    doc = await db.users.find_one({"email": {"$regex": f"^{re.escape(lookup_email)}$", "$options": "i"}})

    # Fallback to id check if someone entered e.g. "u1"
    if not doc and (lookup_email in ["u1", "u2", "u3", "u4", "u5", "u6", "u7"]):
        doc = await db.users.find_one({"id": lookup_email})

    if not doc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )

    stored_password = doc.get("password")
    if stored_password and stored_password != password:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )

    user = User(
        id=doc["id"],
        name=doc["name"],
        role=doc["role"],
        email=doc.get("email"),
    )
    token = create_access_token(user)
    return LoginResponse(access_token=token, user=user)


@router.post("/switch-user/{user_id}", response_model=LoginResponse)
async def switch_user(user_id: str):
    """
    Demo/switch-user endpoint (kept for testing and backward compatibility).
    """
    db = get_db()
    doc = await db.users.find_one({"id": user_id})
    if not doc:
        raise HTTPException(status_code=404, detail="No such user")
    user = User(
        id=doc["id"],
        name=doc["name"],
        role=doc["role"],
        email=doc.get("email"),
    )
    token = create_access_token(user)
    return LoginResponse(access_token=token, user=user)


@router.get("/me", response_model=User)
async def me(user: User = Depends(get_current_user)):
    return user

