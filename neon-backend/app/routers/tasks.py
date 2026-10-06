import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException

from app.database import get_db
from app.dependencies import get_current_user, require_role
from app.models import (
    CreateTaskRequest,
    Role,
    StepStatus,
    Task,
    User,
    WORKER_ROLES,
)
from app.seed import build_steps, calc_status
from app.workflows import TOTAL_STEPS

router = APIRouter(prefix="/tasks", tags=["tasks"])


async def _get_task_or_404(db, task_id: str) -> Task:
    doc = await db.tasks.find_one({"id": task_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Task not found")
    return Task(**doc)


def _visible_to(user: User, task: Task) -> bool:
    if user.role == Role.ADMIN:
        return True
    return task.assignments.get(user.role.value) == user.id


def _for_response(task: Task, user: User) -> dict:
    """
    Full step data is always returned to anyone who can see the task at all —
    the frontend's global x/13 progress bar and per-role avatar/step counts on
    the dashboard card need every role's data, even for a worker viewing their
    own tasks. §3 RBAC instead restricts (a) which *tasks* are visible at all
    (handled by _visible_to / the list query filter) and (b) which checklist
    can be *edited*, enforced separately in toggle_step below.
    """
    return task.model_dump()


@router.post("", response_model=dict, status_code=201)
async def create_task(
    body: CreateTaskRequest,
    admin: User = Depends(require_role(Role.ADMIN)),
):
    missing = [r for r in WORKER_ROLES if r not in body.assignments]
    if missing:
        raise HTTPException(
            status_code=400,
            detail=f"Missing assignment for: {', '.join(r.value for r in missing)}",
        )

    db = get_db()
    # Validate each assigned user actually exists and holds that role.
    for role in WORKER_ROLES:
        user_id = body.assignments[role]
        doc = await db.users.find_one({"id": user_id, "role": role.value})
        if not doc:
            raise HTTPException(status_code=400, detail=f"No {role.value} found with id {user_id}")

    steps = build_steps()
    task = Task(
        id=f"t{uuid.uuid4().hex[:10]}",
        title=body.title,
        description=body.description,
        status=calc_status(steps),  # always TODO on creation, derived not assumed
        createdAt=datetime.now(timezone.utc),
        assignments={r.value: body.assignments[r] for r in WORKER_ROLES},
        steps=steps,
    )
    await db.tasks.insert_one(task.model_dump())
    return {
        "task": task.model_dump(),
        "message": f"{TOTAL_STEPS} workflow steps auto-generated across 3 roles.",
    }


@router.get("", response_model=list[dict])
async def list_tasks(user: User = Depends(get_current_user)):
    db = get_db()
    if user.role == Role.ADMIN:
        query = {}
    else:
        query = {f"assignments.{user.role.value}": user.id}
    docs = await db.tasks.find(query, {"_id": 0}).sort("createdAt", -1).to_list(length=None)
    return [_for_response(Task(**d), user) for d in docs]


@router.get("/{task_id}", response_model=dict)
async def get_task(task_id: str, user: User = Depends(get_current_user)):
    db = get_db()
    task = await _get_task_or_404(db, task_id)
    if not _visible_to(user, task):
        raise HTTPException(status_code=403, detail="You don't have access to this task")
    return _for_response(task, user)


@router.patch("/{task_id}/steps/{step_id}", response_model=dict)
async def toggle_step(task_id: str, step_id: str, user: User = Depends(get_current_user)):
    """
    §7/§8 core business rule. Mirrors the frontend's toggleStep exactly:
    - Completing a PENDING step is blocked if an earlier step (same role) isn't DONE yet.
    - Un-completing a DONE step is blocked if the *next* step (same role) is already DONE.
    - Task status is recomputed from scratch after every mutation (never trusted from client).
    - Server-side ownership check: only the assigned worker for that role (or an Admin)
      may toggle a given role's steps. This isn't enforced by the demo frontend, but the
      API must not rely on the client hiding the button — worse case is a Postman client
      hitting the endpoint directly.
    """
    db = get_db()
    task = await _get_task_or_404(db, task_id)

    if not _visible_to(user, task):
        raise HTTPException(status_code=403, detail="You don't have access to this task")

    step = next((s for s in task.steps if s.id == step_id), None)
    if not step:
        raise HTTPException(status_code=404, detail="Step not found on this task")

    if user.role != Role.ADMIN and user.role != step.role:
        raise HTTPException(
            status_code=403,
            detail=f"Only the assigned {step.role.value.replace('_', ' ').title()} (or an Admin) can update this step",
        )

    role_steps = sorted([s for s in task.steps if s.role == step.role], key=lambda s: s.stepNumber)
    was_done_task = task.status == "DONE"

    if step.status == StepStatus.PENDING:
        blocker = next((s for s in role_steps if s.stepNumber < step.stepNumber and s.status != StepStatus.DONE), None)
        if blocker:
            raise HTTPException(
                status_code=400,
                detail=f'Complete Step {blocker.stepNumber} — "{blocker.title}" — first.',
            )
        step.status = StepStatus.DONE
        step.completedAt = datetime.now(timezone.utc)
        action_message = f'"{step.title}" completed. The rest of the team has been notified.'
    else:
        next_step = next((s for s in role_steps if s.stepNumber == step.stepNumber + 1), None)
        if next_step and next_step.status == StepStatus.DONE:
            raise HTTPException(
                status_code=400,
                detail=f'Can\'t uncheck — Step {next_step.stepNumber} — "{next_step.title}" — is already completed after this one.',
            )
        step.status = StepStatus.PENDING
        step.completedAt = None
        action_message = f'"{step.title}" marked incomplete.'

    # Rebuild task.steps with the mutated step swapped in, then re-derive status.
    new_steps = [step if s.id == step.id else s for s in task.steps]
    new_status = calc_status(new_steps)

    await db.tasks.update_one(
        {"id": task_id},
        {
            "$set": {
                "steps": [s.model_dump() for s in new_steps],
                "status": new_status.value,
            }
        },
    )

    extra_message = None
    if new_status == "DONE" and not was_done_task:
        extra_message = f'All {TOTAL_STEPS} steps done — "{task.title}" auto-marked Done.'
    elif was_done_task and new_status != "DONE":
        extra_message = f'"{task.title}" moved back to In Progress.'

    updated = await _get_task_or_404(db, task_id)
    return {
        "task": _for_response(updated, user),
        "message": action_message,
        "task_status_message": extra_message,
    }
