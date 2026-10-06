from datetime import datetime, timezone
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class Role(str, Enum):
    ADMIN = "ADMIN"
    SCRIPT_WRITER = "SCRIPT_WRITER"
    CONTENT_WRITER = "CONTENT_WRITER"
    VIDEO_EDITOR = "VIDEO_EDITOR"


# The three roles that ever get assigned to / do work on a task.
# (ADMIN is a role a *user* can have, but never appears in task.assignments.)
WORKER_ROLES = [Role.SCRIPT_WRITER, Role.CONTENT_WRITER, Role.VIDEO_EDITOR]


class StepStatus(str, Enum):
    PENDING = "PENDING"
    DONE = "DONE"


class TaskStatus(str, Enum):
    TODO = "TODO"
    IN_PROGRESS = "IN_PROGRESS"
    DONE = "DONE"


class User(BaseModel):
    id: str
    name: str
    role: Role
    email: Optional[str] = None


class TaskStep(BaseModel):
    id: str
    role: Role
    stepNumber: int
    title: str
    status: StepStatus = StepStatus.PENDING
    completedAt: Optional[datetime] = None


class Task(BaseModel):
    id: str
    title: str
    description: str = ""
    status: TaskStatus = TaskStatus.TODO
    createdAt: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    # role -> userId, e.g. {"SCRIPT_WRITER": "u2", "CONTENT_WRITER": "u4", "VIDEO_EDITOR": "u6"}
    assignments: dict[str, str]
    steps: list[TaskStep]


# ---- request/response payloads ----

class CreateTaskRequest(BaseModel):
    title: str
    description: str = ""
    assignments: dict[Role, str]  # must contain all 3 WORKER_ROLES


class LoginRequest(BaseModel):
    email: str
    password: str


class RegisterEmployeeRequest(BaseModel):
    name: str
    email: str
    password: str
    role: Role


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: User


class ErrorResponse(BaseModel):
    detail: str

