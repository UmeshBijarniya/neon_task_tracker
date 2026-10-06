# Neon Classes Task Tracker — Backend

FastAPI + MongoDB backend replicating the exact business logic of the React prototype
(sequential step locking, RBAC, auto-generation of the 13-step workflow, auto-DONE).

## Run locally

1. Have MongoDB running locally (or use Atlas and set `MONGO_URL`).
   ```bash
   # easiest: run mongo in Docker
   docker run -d -p 27017:27017 --name neon-mongo mongo:7
   ```

2. Install deps:
   ```bash
   pip install -r requirements.txt --break-system-packages   # or use a venv
   ```

3. Start the API:
   ```bash
   uvicorn app.main:app --reload --port 8000
   ```
   On startup it seeds `users` and `tasks` collections automatically (only if empty) —
   same 7 users and 3 demo tasks as the frontend's mock data.

4. Docs at http://localhost:8000/docs

## Run tests (no real Mongo needed — uses mongomock)

```bash
python -m pytest tests/ -v
```

## Demo login

There's no password — call `/auth/switch-user/{id}` with any seeded user id
(`u1`..`u7`) to get a JWT, exactly like the frontend's role switcher:

| id | name | role |
|----|------|------|
| u1 | Raja Sir | ADMIN |
| u2 | Priya Sharma | SCRIPT_WRITER |
| u3 | Aman Verma | SCRIPT_WRITER |
| u4 | Neha Gupta | CONTENT_WRITER |
| u5 | Rohit Jain | CONTENT_WRITER |
| u6 | Karan Singh | VIDEO_EDITOR |
| u7 | Divya Meena | VIDEO_EDITOR |

## Endpoints

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/auth/switch-user/{user_id}` | none | returns JWT |
| GET | `/auth/me` | any | current user |
| GET | `/users?role=` | any | for assignment dropdowns |
| POST | `/tasks` | ADMIN | body: `{title, description, assignments}` |
| GET | `/tasks` | any | RBAC-filtered list |
| GET | `/tasks/{id}` | any (must be visible) | worker gets only their role's steps |
| PATCH | `/tasks/{id}/steps/{step_id}` | any (must own the step or be ADMIN) | toggles complete/incomplete |
