import uuid
from datetime import datetime, timedelta, timezone

from app.models import Role, StepStatus, Task, TaskStatus, TaskStep, User, WORKER_ROLES
from app.workflows import WORKFLOWS

USERS: list[User] = [
    User(id="u1", name="Raja Sir", role=Role.ADMIN),
    User(id="u2", name="Priya Sharma", role=Role.SCRIPT_WRITER),
    User(id="u3", name="Aman Verma", role=Role.SCRIPT_WRITER),
    User(id="u4", name="Neha Gupta", role=Role.CONTENT_WRITER),
    User(id="u5", name="Rohit Jain", role=Role.CONTENT_WRITER),
    User(id="u6", name="Karan Singh", role=Role.VIDEO_EDITOR),
    User(id="u7", name="Divya Meena", role=Role.VIDEO_EDITOR),
]


def _ago(hours: float) -> datetime:
    return datetime.now(timezone.utc) - timedelta(hours=hours)


def build_steps(done_hours: dict[Role, list[float]] | None = None) -> list[TaskStep]:
    """
    §4 Auto-generation engine. Loops the predefined workflow templates and
    produces the 13 required sub-steps for a task.

    done_hours (optional, used only for seeding demo data): {ROLE: [hoursAgo, ...]}
    marks the first N steps of that role as completed that many hours ago,
    exactly like the frontend's seed() helper.
    """
    done_hours = done_hours or {}
    steps: list[TaskStep] = []
    for role in WORKER_ROLES:
        role_done_hours = done_hours.get(role, [])
        for i, title in enumerate(WORKFLOWS[role]):
            hrs = role_done_hours[i] if i < len(role_done_hours) else None
            done = hrs is not None
            steps.append(
                TaskStep(
                    id=f"s{uuid.uuid4().hex[:8]}",
                    role=role,
                    stepNumber=i + 1,
                    title=title,
                    status=StepStatus.DONE if done else StepStatus.PENDING,
                    completedAt=_ago(hrs) if done else None,
                )
            )
    return steps


def calc_status(steps: list[TaskStep]) -> TaskStatus:
    """Task status is always DERIVED from steps, never stored independently."""
    done = sum(1 for s in steps if s.status == StepStatus.DONE)
    if done == len(steps):
        return TaskStatus.DONE
    if done > 0:
        return TaskStatus.IN_PROGRESS
    return TaskStatus.TODO


def seed_tasks() -> list[Task]:
    """Three demo tasks in three different states, matching the frontend seed()."""
    t1_steps = build_steps({
        Role.SCRIPT_WRITER: [40, 30, 22],
        Role.CONTENT_WRITER: [36, 20],
        Role.VIDEO_EDITOR: [12],
    })
    t3_steps = build_steps({
        Role.SCRIPT_WRITER: [96, 88, 80, 72],
        Role.CONTENT_WRITER: [92, 76, 60, 52],
        Role.VIDEO_EDITOR: [68, 58, 46, 38, 30],
    })
    return [
        Task(
            id="t1",
            title="Ch.5 Fractions — Comic to Animation (Class 4)",
            description="Convert the 45-page fractions comic into a broadcast-ready animated episode for Neon School Prime.",
            status=calc_status(t1_steps),
            createdAt=_ago(48),
            assignments={"SCRIPT_WRITER": "u2", "CONTENT_WRITER": "u4", "VIDEO_EDITOR": "u6"},
            steps=t1_steps,
        ),
        Task(
            id="t2",
            title="Percentage Brahmastra — YouTube Short",
            description="60-sec Hinglish short: 6-second hook, Roma proof shot, loop ending. Target VVSA 70%+.",
            status=TaskStatus.TODO,
            createdAt=_ago(6),
            assignments={"SCRIPT_WRITER": "u3", "CONTENT_WRITER": "u5", "VIDEO_EDITOR": "u7"},
            steps=build_steps(),
        ),
        Task(
            id="t3",
            title="NMO 2026 — Announcement Video",
            description="Olympiad registration launch video for both channels with end-screen CTA.",
            status=calc_status(t3_steps),
            createdAt=_ago(120),
            assignments={"SCRIPT_WRITER": "u2", "CONTENT_WRITER": "u4", "VIDEO_EDITOR": "u7"},
            steps=t3_steps,
        ),
    ]


async def seed_db(db):
    """Idempotent: only seeds if collections are empty."""
    if await db.users.count_documents({}) == 0:
        await db.users.insert_many([u.model_dump() for u in USERS])
    if await db.tasks.count_documents({}) == 0:
        await db.tasks.insert_many([t.model_dump() for t in seed_tasks()])
