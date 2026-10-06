import pytest

from tests.conftest import login_as

ADMIN = "u1"
SCRIPT_WRITER = "u2"   # Priya, script writer on t1 and t3
OTHER_SCRIPT_WRITER = "u3"  # Aman, script writer on t2 only
CONTENT_WRITER = "u4"


@pytest.mark.asyncio
async def test_login_returns_token_and_user(client):
    resp = await client.post(f"/auth/switch-user/{ADMIN}")
    assert resp.status_code == 200
    body = resp.json()
    assert body["user"]["role"] == "ADMIN"
    assert body["access_token"]


@pytest.mark.asyncio
async def test_email_password_login_success(client):
    resp = await client.post("/auth/login", json={"email": "admin@neonclasses.com", "password": "admin123"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["user"]["role"] == "ADMIN"
    assert body["access_token"]


@pytest.mark.asyncio
async def test_email_password_login_invalid_password(client):
    resp = await client.post("/auth/login", json={"email": "admin@neonclasses.com", "password": "wrong"})
    assert resp.status_code == 401



@pytest.mark.asyncio
async def test_admin_sees_all_seeded_tasks(client):
    headers = await login_as(client, ADMIN)
    resp = await client.get("/tasks", headers=headers)
    assert resp.status_code == 200
    assert len(resp.json()) == 3


@pytest.mark.asyncio
async def test_worker_only_sees_own_assigned_tasks(client):
    headers = await login_as(client, OTHER_SCRIPT_WRITER)  # Aman is only on t2
    resp = await client.get("/tasks", headers=headers)
    assert resp.status_code == 200
    ids = [t["id"] for t in resp.json()]
    assert ids == ["t2"]


@pytest.mark.asyncio
async def test_worker_cannot_view_unassigned_task_detail(client):
    headers = await login_as(client, OTHER_SCRIPT_WRITER)  # not on t1
    resp = await client.get("/tasks/t1", headers=headers)
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_worker_sees_full_task_data_for_their_own_tasks(client):
    # A worker on the task still needs to see the GLOBAL x/13 progress bar and
    # everyone else's avatars/step counts, exactly like the frontend's TaskCard.
    # RBAC only restricts which checklist is *editable* (see toggle tests below),
    # not which read data comes back for a task they're actually part of.
    headers = await login_as(client, CONTENT_WRITER)
    resp = await client.get("/tasks/t1", headers=headers)
    assert resp.status_code == 200
    assert len(resp.json()["steps"]) == 13


@pytest.mark.asyncio
async def test_admin_sees_all_13_steps(client):
    headers = await login_as(client, ADMIN)
    resp = await client.get("/tasks/t1", headers=headers)
    assert len(resp.json()["steps"]) == 13


@pytest.mark.asyncio
async def test_non_admin_cannot_create_task(client):
    headers = await login_as(client, SCRIPT_WRITER)
    resp = await client.post(
        "/tasks",
        headers=headers,
        json={
            "title": "Should fail",
            "description": "",
            "assignments": {"SCRIPT_WRITER": "u2", "CONTENT_WRITER": "u4", "VIDEO_EDITOR": "u6"},
        },
    )
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_create_task_auto_generates_13_steps(client):
    headers = await login_as(client, ADMIN)
    resp = await client.post(
        "/tasks",
        headers=headers,
        json={
            "title": "New animated episode",
            "description": "Ch.9 Decimals",
            "assignments": {"SCRIPT_WRITER": "u2", "CONTENT_WRITER": "u4", "VIDEO_EDITOR": "u6"},
        },
    )
    assert resp.status_code == 201
    task = resp.json()["task"]
    assert len(task["steps"]) == 13
    assert task["status"] == "TODO"
    assert all(s["status"] == "PENDING" for s in task["steps"])


@pytest.mark.asyncio
async def test_out_of_order_step_completion_is_blocked(client):
    headers = await login_as(client, ADMIN)
    resp = await client.get("/tasks/t2", headers=headers)  # t2: all steps pending
    step_2 = next(s for s in resp.json()["steps"] if s["role"] == "SCRIPT_WRITER" and s["stepNumber"] == 2)

    toggle = await client.patch(f"/tasks/t2/steps/{step_2['id']}", headers=headers)
    assert toggle.status_code == 400
    assert "Step 1" in toggle.json()["detail"]


@pytest.mark.asyncio
async def test_sequential_completion_and_auto_done(client):
    headers = await login_as(client, ADMIN)
    detail = (await client.get("/tasks/t2", headers=headers)).json()
    role_steps = {r: sorted([s for s in detail["steps"] if s["role"] == r], key=lambda s: s["stepNumber"])
                  for r in ("SCRIPT_WRITER", "CONTENT_WRITER", "VIDEO_EDITOR")}

    last_response = None
    for role, steps in role_steps.items():
        for step in steps:
            last_response = await client.patch(f"/tasks/t2/steps/{step['id']}", headers=headers)
            assert last_response.status_code == 200, last_response.text

    final_task = last_response.json()["task"]
    assert final_task["status"] == "DONE"
    assert last_response.json()["task_status_message"] is not None
    assert "auto-marked Done" in last_response.json()["task_status_message"]


@pytest.mark.asyncio
async def test_cannot_uncheck_step_if_next_step_already_done(client):
    headers = await login_as(client, ADMIN)
    detail = (await client.get("/tasks/t1", headers=headers)).json()  # t1 has script writer steps 1-3 done
    sw_steps = sorted([s for s in detail["steps"] if s["role"] == "SCRIPT_WRITER"], key=lambda s: s["stepNumber"])
    step_1 = sw_steps[0]
    assert step_1["status"] == "DONE"

    resp = await client.patch(f"/tasks/t1/steps/{step_1['id']}", headers=headers)
    assert resp.status_code == 400
    assert "already completed after this one" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_worker_cannot_toggle_a_different_roles_step(client):
    # t2 assignments: SCRIPT_WRITER=u3, CONTENT_WRITER=u5, VIDEO_EDITOR=u7
    headers = await login_as(client, "u5")  # Rohit, the CONTENT_WRITER actually assigned on t2
    admin_headers = await login_as(client, ADMIN)
    detail = (await client.get("/tasks/t2", headers=admin_headers)).json()
    sw_step = next(s for s in detail["steps"] if s["role"] == "SCRIPT_WRITER")

    # u5 can see t2 (assigned as content writer) but must not be able to toggle
    # a step belonging to a different role on the same task.
    resp = await client.patch(f"/tasks/t2/steps/{sw_step['id']}", headers=headers)
    assert resp.status_code == 403
