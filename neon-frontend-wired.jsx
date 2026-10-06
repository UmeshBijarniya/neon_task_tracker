import { useState, useEffect, useCallback } from "react";
import {
  Zap, LayoutDashboard, Users, Plus, X, CheckCircle2, Circle, Lock, Clock,
  PenLine, FileText, Film, Shield, ChevronRight, AlertCircle, Sparkles, ClipboardList,
  Loader2,
} from "lucide-react";

/*
  NEON CLASSES — TASK TRACKER  (wired to the FastAPI backend)

  Everything that used to live in local useState + in-memory mock data
  (buildSteps, seed, calcStatus, the hardcoded USERS array) now lives on
  the server. This file only keeps UI-only constants (ROLE_META, STATUS_META,
  WORKFLOWS-for-display) and talks to the API for everything else.

  Set API_BASE to wherever `uvicorn app.main:app` is running.
*/

const API_BASE = "http://localhost:8000";

/* ---------------------------------------------------------------- */
/* UI-only constants (unchanged from the prototype)                 */
/* ---------------------------------------------------------------- */

const WORKER_ROLES = ["SCRIPT_WRITER", "CONTENT_WRITER", "VIDEO_EDITOR"];

const ROLE_META = {
  ADMIN:          { label: "Admin",          icon: Shield,   text: "text-cyan-300",   bg: "bg-cyan-950",   border: "border-cyan-800",   },
  SCRIPT_WRITER:  { label: "Script Writer",  icon: PenLine,  text: "text-violet-300", bg: "bg-violet-950", border: "border-violet-800", },
  CONTENT_WRITER: { label: "Content Writer", icon: FileText, text: "text-amber-300",  bg: "bg-amber-950",  border: "border-amber-800",  },
  VIDEO_EDITOR:   { label: "Video Editor",   icon: Film,     text: "text-rose-300",   bg: "bg-rose-950",   border: "border-rose-800",   },
};

/* Kept only for the sidebar's "N steps" labels — the real steps come from the API. */
const WORKFLOWS_DISPLAY = {
  SCRIPT_WRITER: 4,
  CONTENT_WRITER: 4,
  VIDEO_EDITOR: 5,
};

const STATUS_META = {
  TODO:        { label: "To-Do",       cls: "bg-zinc-900 text-zinc-300 border-zinc-700",       dot: "bg-zinc-400" },
  IN_PROGRESS: { label: "In Progress", cls: "bg-amber-950 text-amber-300 border-amber-800",    dot: "bg-amber-400" },
  DONE:        { label: "Done",        cls: "bg-emerald-950 text-emerald-300 border-emerald-800", dot: "bg-emerald-400" },
};

/* ---------------------------------------------------------------- */
/* API helper                                                        */
/* ---------------------------------------------------------------- */

async function apiFetch(path, token, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.detail || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return data;
}

/* ---------------------------------------------------------------- */
/* Helpers                                                            */
/* ---------------------------------------------------------------- */

const initials = (name) => name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const fmtDT = (d) => {
  if (!d) return "";
  const dt = new Date(d);
  let h = dt.getHours();
  const am = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  const m = String(dt.getMinutes()).padStart(2, "0");
  return `${dt.getDate()} ${MONTHS[dt.getMonth()]}, ${h}:${m} ${am}`;
};

const clamp2 = { display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" };

const CSS = `
@keyframes toastIn { from { opacity: 0; transform: translateY(10px) scale(.97); } to { opacity: 1; transform: translateY(0) scale(1); } }
* { scrollbar-width: thin; scrollbar-color: #3f3f46 transparent; }
*::-webkit-scrollbar { width: 8px; height: 8px; }
*::-webkit-scrollbar-thumb { background: #3f3f46; border-radius: 8px; }
*::-webkit-scrollbar-track { background: transparent; }
select option { background: #0a0a0a; color: #e5e5e5; }
`;

/* ---------------------------------------------------------------- */
/* Small shared pieces (unchanged, just take `user` directly now)    */
/* ---------------------------------------------------------------- */

function Avatar({ user, className = "h-8 w-8 text-xs" }) {
  if (!user) return <div className={`${className} rounded-full bg-neutral-800 shrink-0`} />;
  const m = ROLE_META[user.role];
  return (
    <div className={`${className} rounded-full flex items-center justify-center font-bold border shrink-0 ${m.bg} ${m.text} ${m.border}`}>
      {initials(user.name)}
    </div>
  );
}

function Badge({ status }) {
  const m = STATUS_META[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${m.cls}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${m.dot}`} />
      {m.label}
    </span>
  );
}

function Progress({ pct }) {
  return (
    <div className="h-2 rounded-full bg-neutral-800 overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-500 ${pct === 100 ? "bg-emerald-400" : "bg-gradient-to-r from-cyan-500 to-cyan-300"}`}
        style={{ width: pct + "%" }}
      />
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Toasts (Sonner-style) — unchanged                                  */
/* ---------------------------------------------------------------- */

const TOAST_META = {
  success: { icon: CheckCircle2, box: "bg-emerald-950 border-emerald-800", ic: "text-emerald-400", title: "text-emerald-100", msg: "text-emerald-300" },
  error:   { icon: AlertCircle,  box: "bg-red-950 border-red-800",        ic: "text-red-400",     title: "text-red-100",     msg: "text-red-300" },
  done:    { icon: Sparkles,     box: "bg-cyan-950 border-cyan-800",      ic: "text-cyan-300",    title: "text-cyan-100",    msg: "text-cyan-300" },
  info:    { icon: AlertCircle,  box: "bg-neutral-900 border-neutral-700", ic: "text-neutral-300", title: "text-neutral-100", msg: "text-neutral-400" },
};

function ToastStack({ toasts }) {
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 w-80 max-w-full pointer-events-none">
      {toasts.map((t) => {
        const m = TOAST_META[t.type] || TOAST_META.info;
        const Icon = m.icon;
        return (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-start gap-3 rounded-xl border shadow-2xl p-3.5 ${m.box}`}
            style={{ animation: "toastIn .25s ease-out" }}
          >
            <Icon size={17} className={`${m.ic} shrink-0 mt-0.5`} />
            <div className="min-w-0">
              <div className={`text-sm font-semibold leading-tight ${m.title}`}>{t.title}</div>
              {t.msg && <div className={`text-xs mt-0.5 leading-snug ${m.msg}`}>{t.msg}</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Sequential step tracker (per-role checklist)                     */
/* ---------------------------------------------------------------- */

function RoleChecklist({ task, role, getUserById, onToggle, busyStepId }) {
  const m = ROLE_META[role];
  const Icon = m.icon;
  const assignee = getUserById(task.assignments[role]);
  const steps = task.steps.filter((s) => s.role === role).sort((a, b) => a.stepNumber - b.stepNumber);
  const done = steps.filter((s) => s.status === "DONE").length;

  return (
    <section className="rounded-xl border border-neutral-800 bg-neutral-950 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800">
        <div className="flex items-center gap-2.5">
          <span className={`p-1.5 rounded-lg border ${m.bg} ${m.border}`}>
            <Icon size={14} className={m.text} />
          </span>
          <div>
            <div className="text-sm font-semibold">{m.label}</div>
            <div className="text-xs text-neutral-500">{assignee ? assignee.name : "Unassigned"}</div>
          </div>
        </div>
        <span className={`text-xs font-semibold ${done === steps.length ? "text-emerald-300" : "text-neutral-400"}`}>
          {done}/{steps.length}
        </span>
      </div>

      <div className="p-2">
        {steps.map((s) => {
          const blocked = s.status === "PENDING" && steps.some((x) => x.stepNumber < s.stepNumber && x.status !== "DONE");
          const isBusy = busyStepId === s.id;
          return (
            <button
              key={s.id}
              disabled={isBusy}
              onClick={() => onToggle(task.id, s.id)}
              className={`group w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${
                blocked ? "opacity-40 cursor-not-allowed" : "hover:bg-neutral-900"
              } ${isBusy ? "opacity-60" : ""}`}
            >
              {isBusy ? (
                <Loader2 size={18} className="text-cyan-400 shrink-0 animate-spin" />
              ) : s.status === "DONE" ? (
                <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
              ) : blocked ? (
                <Lock size={16} className="text-neutral-500 shrink-0" />
              ) : (
                <Circle size={18} className="text-cyan-500 shrink-0" />
              )}

              <span className="flex-1 min-w-0">
                <span className={`text-sm ${s.status === "DONE" ? "line-through text-neutral-500" : "text-neutral-200"}`}>
                  {s.stepNumber}. {s.title}
                </span>
              </span>

              {s.status === "DONE" ? (
                <span className="text-xs text-neutral-500 flex items-center gap-1 shrink-0">
                  <Clock size={11} /> {fmtDT(s.completedAt)}
                </span>
              ) : (
                !blocked && (
                  <span className="text-xs text-cyan-400 font-medium shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    Mark done
                  </span>
                )
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}

function TaskDetailsModal({ task, me, isAdmin, getUserById, onClose, onToggle, busyStepId }) {
  const rolesToShow = isAdmin ? WORKER_ROLES : [me.role];
  const doneSteps = task.steps.filter((s) => s.status === "DONE").length;
  const pct = Math.round((doneSteps / task.steps.length) * 100);

  return (
    <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center sm:p-6" onClick={onClose}>
      <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }} />
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full sm:max-w-2xl bg-neutral-900 border border-neutral-800 rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        style={{ maxHeight: "88vh" }}
      >
        <div className="flex items-start justify-between gap-4 p-5 border-b border-neutral-800 shrink-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1.5">
              <Badge status={task.status} />
              <span className="text-xs text-neutral-500 flex items-center gap-1">
                <Clock size={12} /> Created {fmtDT(task.createdAt)}
              </span>
            </div>
            <h2 className="text-lg font-bold tracking-tight leading-snug">{task.title}</h2>
            <p className="text-sm text-neutral-400 mt-1 leading-relaxed">{task.description}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-neutral-800 text-neutral-400 hover:text-neutral-100 shrink-0">
            <X size={18} />
          </button>
        </div>

        <div className="px-5 pt-4 shrink-0">
          <div className="flex justify-between text-xs mb-1.5">
            <span className="text-neutral-500">Overall progress — all roles</span>
            <span className={`font-semibold ${pct === 100 ? "text-emerald-300" : "text-cyan-300"}`}>
              {doneSteps}/{task.steps.length} · {pct}%
            </span>
          </div>
          <Progress pct={pct} />
        </div>

        <div className="p-5 space-y-4 overflow-y-auto">
          {rolesToShow.map((role) => (
            <RoleChecklist
              key={role}
              task={task}
              role={role}
              getUserById={getUserById}
              onToggle={onToggle}
              busyStepId={busyStepId}
            />
          ))}
          <p className="text-xs text-neutral-600 flex items-center gap-1.5">
            <Lock size={12} /> Steps unlock strictly in order. Ticking the final step auto-marks the task Done.
          </p>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Create Task modal (Admin only) — now loads users from the API     */
/* ---------------------------------------------------------------- */

function CreateTaskModal({ users, onClose, onCreate, pushToast, creating }) {
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [asg, setAsg] = useState({ SCRIPT_WRITER: "", CONTENT_WRITER: "", VIDEO_EDITOR: "" });

  const inputCls =
    "w-full rounded-lg bg-neutral-950 border border-neutral-700 px-3 py-2 text-sm text-neutral-100 placeholder-neutral-600 outline-none focus:border-cyan-500 transition-colors";

  const submit = () => {
    if (!title.trim()) {
      pushToast("error", "Title required", "Give the task a title before creating it.");
      return;
    }
    const missing = WORKER_ROLES.find((r) => !asg[r]);
    if (missing) {
      pushToast("error", "Assignment missing", `Select a ${ROLE_META[missing].label} for this task.`);
      return;
    }
    onCreate(title.trim(), desc.trim(), { ...asg });
  };

  return (
    <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center sm:p-6" onClick={onClose}>
      <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }} />
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full sm:max-w-lg bg-neutral-900 border border-neutral-800 rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-y-auto"
        style={{ maxHeight: "88vh" }}
      >
        <div className="flex items-center justify-between p-5 border-b border-neutral-800">
          <h2 className="text-base font-bold tracking-tight">Create new task</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-neutral-800 text-neutral-400 hover:text-neutral-100">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-widest text-neutral-400 mb-1.5">Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Ch.7 Decimals — Animated Episode"
              className={inputCls}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-widest text-neutral-400 mb-1.5">Description</label>
            <textarea
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              rows={3}
              placeholder="What is this project about?"
              className={inputCls}
            />
          </div>

          <div className="space-y-3 pt-1">
            <div className="text-xs font-semibold uppercase tracking-widest text-neutral-400">Assign the team</div>
            {WORKER_ROLES.map((role) => {
              const m = ROLE_META[role];
              const Icon = m.icon;
              const opts = users.filter((u) => u.role === role);
              return (
                <div key={role}>
                  <label className={`flex items-center gap-1.5 text-xs mb-1.5 ${m.text}`}>
                    <Icon size={12} /> {m.label}
                  </label>
                  <select value={asg[role]} onChange={(e) => setAsg((p) => ({ ...p, [role]: e.target.value }))} className={inputCls}>
                    <option value="">Select {m.label}…</option>
                    {opts.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))}
                  </select>
                </div>
              );
            })}
          </div>

          <p className="text-xs text-neutral-500 flex items-center gap-1.5 pt-1">
            <Sparkles size={12} className="text-cyan-400" /> 13 sub-steps (4 + 4 + 5) are auto-generated the moment you create this task.
          </p>
        </div>

        <div className="flex justify-end gap-2 p-5 border-t border-neutral-800">
          <button
            onClick={onClose}
            className="rounded-lg border border-neutral-700 px-4 py-2 text-sm font-medium text-neutral-300 hover:bg-neutral-800 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={creating}
            className="rounded-lg bg-cyan-500 hover:bg-cyan-400 disabled:opacity-60 px-4 py-2 text-sm font-semibold text-neutral-950 transition-colors flex items-center gap-2"
            style={{ boxShadow: "0 0 24px rgba(34,211,238,0.25)" }}
          >
            {creating && <Loader2 size={14} className="animate-spin" />}
            Create task
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Task card                                                          */
/* ---------------------------------------------------------------- */

function TaskCard({ task, getUserById, onOpen }) {
  const doneSteps = task.steps.filter((s) => s.status === "DONE").length;
  const pct = Math.round((doneSteps / task.steps.length) * 100);

  return (
    <button
      onClick={onOpen}
      className="group text-left rounded-2xl border border-neutral-800 bg-neutral-900 p-5 hover:border-neutral-600 transition-colors flex flex-col gap-4"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-semibold leading-snug tracking-tight group-hover:text-cyan-300 transition-colors">{task.title}</h3>
        <Badge status={task.status} />
      </div>

      <p className="text-sm text-neutral-400 leading-relaxed" style={clamp2}>
        {task.description}
      </p>

      <div>
        <div className="flex justify-between text-xs mb-1.5">
          <span className="text-neutral-500">
            {doneSteps}/{task.steps.length} steps
          </span>
          <span className={`font-semibold ${pct === 100 ? "text-emerald-300" : "text-cyan-300"}`}>{pct}%</span>
        </div>
        <Progress pct={pct} />
      </div>

      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-3 flex-wrap">
          {WORKER_ROLES.map((r) => {
            const m = ROLE_META[r];
            const Icon = m.icon;
            const rs = task.steps.filter((s) => s.role === r);
            const d = rs.filter((s) => s.status === "DONE").length;
            return (
              <span key={r} className={`flex items-center gap-1 text-xs ${d === rs.length ? "text-emerald-300" : "text-neutral-500"}`}>
                <Icon size={12} className={m.text} /> {d}/{rs.length}
              </span>
            );
          })}
        </div>
        <div className="flex -space-x-2">
          {WORKER_ROLES.map((r) => {
            const u = getUserById(task.assignments[r]);
            return u ? <Avatar key={r} user={u} className="h-6 w-6 text-xs" /> : null;
          })}
        </div>
      </div>

      <div className="flex items-center justify-between text-xs text-neutral-600 border-t border-neutral-800 pt-3">
        <span className="flex items-center gap-1">
          <Clock size={12} /> {fmtDT(task.createdAt)}
        </span>
        <span className="flex items-center gap-1 text-neutral-500 group-hover:text-cyan-300 transition-colors">
          Open <ChevronRight size={14} />
        </span>
      </div>
    </button>
  );
}

/* ---------------------------------------------------------------- */
/* App                                                                */
/* ---------------------------------------------------------------- */

export default function App() {
  const [token, setToken] = useState(null);
  const [me, setMe] = useState(null);
  const [users, setUsers] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [view, setView] = useState("dashboard");
  const [toasts, setToasts] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [detailId, setDetailId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [busyStepId, setBusyStepId] = useState(null);
  const [fatalError, setFatalError] = useState(null);

  const isAdmin = me?.role === "ADMIN";
  const getUserById = useCallback((id) => users.find((u) => u.id === id), [users]);

  const pushToast = (type, title, msg) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((p) => [...p, { id, type, title, msg }]);
    setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), 4200);
  };

  const fetchTasks = useCallback(async (authToken) => {
    const data = await apiFetch("/tasks", authToken);
    setTasks(data);
  }, []);

  /* Log in as a given user id (mirrors the old demo role switcher) */
  const loginAs = useCallback(async (userId) => {
    const { access_token, user } = await apiFetch(`/auth/switch-user/${userId}`, null, { method: "POST" });
    setToken(access_token);
    setMe(user);
    setDetailId(null);
    setShowCreate(false);
    await fetchTasks(access_token);
    return access_token;
  }, [fetchTasks]);

  /* Bootstrap: log in as the default admin, then load the team list */
  useEffect(() => {
    (async () => {
      try {
        const initialToken = await loginAs("u1");
        const userList = await apiFetch("/users", initialToken);
        setUsers(userList);
      } catch (e) {
        setFatalError(e.message || "Couldn't reach the backend.");
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const switchUser = async (id) => {
    try {
      await loginAs(id);
    } catch (e) {
      pushToast("error", "Couldn't switch user", e.message);
    }
  };

  const createTask = async (title, description, assignments) => {
    setCreating(true);
    try {
      const result = await apiFetch("/tasks", token, {
        method: "POST",
        body: JSON.stringify({ title, description, assignments }),
      });
      setTasks((p) => [result.task, ...p]);
      pushToast("success", "Task created", result.message);
      setShowCreate(false);
    } catch (e) {
      pushToast("error", "Couldn't create task", e.message);
    } finally {
      setCreating(false);
    }
  };

  /* §7 + §8 — sequential blocking, timestamps, notifications, auto-DONE.
     The rules themselves now live server-side; this just calls the API
     and reflects whatever it decides back into local state. */
  const toggleStep = async (taskId, stepId) => {
    setBusyStepId(stepId);
    try {
      const result = await apiFetch(`/tasks/${taskId}/steps/${stepId}`, token, { method: "PATCH" });
      setTasks((p) => p.map((t) => (t.id === taskId ? result.task : t)));
      pushToast("success", "Step updated", result.message);
      if (result.task_status_message) {
        const type = result.task_status_message.includes("auto-marked Done") ? "done" : "info";
        pushToast(type, type === "done" ? "Task complete" : "Task reopened", result.task_status_message);
      }
    } catch (e) {
      pushToast("error", e.status === 403 ? "Not allowed" : "Step locked", e.message);
    } finally {
      setBusyStepId(null);
    }
  };

  const detailTask = tasks.find((t) => t.id === detailId) || null;

  const stepsAll = tasks.reduce((a, t) => a + t.steps.length, 0);
  const stepsDone = tasks.reduce((a, t) => a + t.steps.filter((s) => s.status === "DONE").length, 0);
  const stats = [
    { label: "Total tasks", value: tasks.length, cls: "text-neutral-100" },
    { label: "In progress", value: tasks.filter((t) => t.status === "IN_PROGRESS").length, cls: "text-amber-300" },
    { label: "Completed", value: tasks.filter((t) => t.status === "DONE").length, cls: "text-emerald-300" },
    { label: "Steps done", value: `${stepsDone}/${stepsAll}`, cls: "text-cyan-300" },
  ];

  const NAV = [
    { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { key: "team", label: "Team", icon: Users },
  ];

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-neutral-950 text-neutral-400 gap-2">
        <Loader2 className="animate-spin" size={18} /> Connecting to API…
      </div>
    );
  }

  if (fatalError) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-neutral-950 text-neutral-300 gap-3 px-6 text-center">
        <AlertCircle className="text-red-400" size={28} />
        <div className="font-semibold">Couldn't reach the backend</div>
        <div className="text-sm text-neutral-500 max-w-sm">{fatalError}</div>
        <div className="text-xs text-neutral-600">
          Make sure the API is running at <code className="text-neutral-400">{API_BASE}</code> (see the backend README).
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen overflow-hidden flex bg-neutral-950 text-neutral-100" style={{ fontFamily: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif' }}>
      <style>{CSS}</style>

      {/* Fixed left sidebar */}
      <aside className="hidden md:flex md:flex-col w-60 shrink-0 border-r border-neutral-800">
        <div className="flex items-center gap-2.5 px-5 h-16 border-b border-neutral-800 shrink-0">
          <div className="h-8 w-8 rounded-lg bg-cyan-500 text-neutral-950 flex items-center justify-center" style={{ boxShadow: "0 0 20px rgba(34,211,238,0.4)" }}>
            <Zap size={17} strokeWidth={2.5} />
          </div>
          <div className="leading-tight">
            <div className="font-extrabold tracking-tight text-sm">NEON CLASSES</div>
            <div className="text-neutral-500 tracking-widest uppercase" style={{ fontSize: 10 }}>Task Tracker</div>
          </div>
        </div>

        <nav className="p-3 space-y-1">
          {NAV.map(({ key, label, icon: Icon }) => {
            const active = view === key;
            return (
              <button
                key={key}
                onClick={() => setView(key)}
                className={`w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  active ? "bg-neutral-900 text-cyan-300" : "text-neutral-400 hover:text-neutral-100 hover:bg-neutral-900"
                }`}
              >
                <Icon size={16} /> {label}
              </button>
            );
          })}
        </nav>

        <div className="px-5 pt-4 pb-2 text-xs font-semibold uppercase tracking-widest text-neutral-600">Workflows</div>
        <div className="px-3 space-y-1">
          {WORKER_ROLES.map((r) => {
            const m = ROLE_META[r];
            const Icon = m.icon;
            return (
              <div key={r} className="flex items-center justify-between rounded-lg px-3 py-2 text-xs text-neutral-400">
                <span className="flex items-center gap-2">
                  <Icon size={13} className={m.text} /> {m.label}
                </span>
                <span className="text-neutral-600">{WORKFLOWS_DISPLAY[r]} steps</span>
              </div>
            );
          })}
        </div>

        <div className="mt-auto p-5 text-xs text-neutral-600">Neon Universe Pvt. Ltd. · Jaipur</div>
      </aside>

      {/* Main column */}
      <div className="flex-1 flex flex-col min-w-0">
        <header
          className="shrink-0 border-b border-neutral-800 px-4 md:px-8 h-16 flex items-center justify-between gap-3"
          style={{ background: "rgba(10,10,11,0.85)", backdropFilter: "blur(8px)" }}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="md:hidden h-8 w-8 rounded-lg bg-cyan-500 text-neutral-950 flex items-center justify-center shrink-0">
              <Zap size={16} strokeWidth={2.5} />
            </div>
            <div className="min-w-0">
              <h1 className="text-base md:text-lg font-bold tracking-tight truncate">
                {view === "dashboard" ? (isAdmin ? "All Tasks" : "My Tasks") : "Team"}
              </h1>
              <p className="text-xs text-neutral-500 hidden sm:block">
                {view === "dashboard"
                  ? `${tasks.length} task${tasks.length === 1 ? "" : "s"} · viewing as ${ROLE_META[me.role].label}`
                  : `${users.length} members across 4 roles`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 md:gap-3">
            <div className="md:hidden flex gap-1">
              {NAV.map(({ key, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => setView(key)}
                  className={`p-2 rounded-lg transition-colors ${view === key ? "bg-neutral-900 text-cyan-300" : "text-neutral-500 hover:text-neutral-200"}`}
                >
                  <Icon size={16} />
                </button>
              ))}
            </div>

            {isAdmin && (
              <button
                onClick={() => setShowCreate(true)}
                className="flex items-center gap-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-neutral-950 text-sm font-semibold px-3 py-2 transition-colors"
                style={{ boxShadow: "0 0 24px rgba(34,211,238,0.25)" }}
              >
                <Plus size={16} /> <span className="hidden sm:inline">New Task</span>
              </button>
            )}

            <div className="flex items-center gap-2 rounded-full border border-neutral-800 bg-neutral-900 pl-1 pr-3 py-1">
              <Avatar user={me} className="h-7 w-7 text-xs" />
              <div className="leading-tight hidden sm:block">
                <div className="text-xs font-semibold">{me.name}</div>
                <div className={`text-xs ${ROLE_META[me.role].text}`}>{ROLE_META[me.role].label}</div>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="max-w-5xl mx-auto px-4 md:px-8 py-6 space-y-6">
            {view === "dashboard" ? (
              <>
                {/* Demo role switcher — now calls /auth/switch-user */}
                <section className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="h-2 w-2 rounded-full bg-cyan-400 animate-pulse" />
                    <h2 className="text-xs font-semibold uppercase tracking-widest text-neutral-400">Demo · switch profile</h2>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {users.map((u) => {
                      const active = u.id === me.id;
                      const m = ROLE_META[u.role];
                      const Icon = m.icon;
                      return (
                        <button
                          key={u.id}
                          onClick={() => switchUser(u.id)}
                          className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors ${
                            active
                              ? `${m.bg} ${m.border} ${m.text}`
                              : "border-neutral-800 bg-neutral-950 text-neutral-400 hover:border-neutral-600 hover:text-neutral-200"
                          }`}
                        >
                          <Icon size={14} />
                          <span className="font-medium">{u.name}</span>
                          <span className="hidden sm:inline text-xs opacity-70">· {m.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </section>

                <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  {stats.map((s) => (
                    <div key={s.label} className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
                      <div className="text-xs uppercase tracking-widest text-neutral-500 mb-1">{s.label}</div>
                      <div className={`text-2xl font-bold tracking-tight ${s.cls}`}>{s.value}</div>
                    </div>
                  ))}
                </section>

                {tasks.length === 0 ? (
                  <section className="rounded-2xl border border-dashed border-neutral-800 p-12 flex flex-col items-center text-center gap-3">
                    <ClipboardList size={28} className="text-neutral-600" />
                    <div className="text-sm text-neutral-400">
                      {isAdmin ? "No tasks yet. Create the first one to auto-generate its 13-step workflow." : "No tasks assigned to you yet. The Admin assigns work from their dashboard."}
                    </div>
                    {isAdmin && (
                      <button
                        onClick={() => setShowCreate(true)}
                        className="mt-1 flex items-center gap-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-neutral-950 text-sm font-semibold px-3 py-2 transition-colors"
                      >
                        <Plus size={16} /> New Task
                      </button>
                    )}
                  </section>
                ) : (
                  <section className="grid gap-4 md:grid-cols-2">
                    {tasks.map((t) => (
                      <TaskCard key={t.id} task={t} getUserById={getUserById} onOpen={() => setDetailId(t.id)} />
                    ))}
                  </section>
                )}
              </>
            ) : (
              <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {users.map((u) => {
                  const m = ROLE_META[u.role];
                  const assigned = u.role === "ADMIN" ? [] : tasks.filter((t) => t.assignments[u.role] === u.id);
                  const roleSteps = assigned.flatMap((t) => t.steps.filter((s) => s.role === u.role));
                  const sd = roleSteps.filter((s) => s.status === "DONE").length;
                  return (
                    <div key={u.id} className="rounded-2xl border border-neutral-800 bg-neutral-900 p-5 flex items-center gap-4">
                      <Avatar user={u} className="h-12 w-12 text-sm" />
                      <div className="min-w-0">
                        <div className="font-semibold tracking-tight">{u.name}</div>
                        <div className={`text-xs ${m.text}`}>{m.label}</div>
                        <div className="text-xs text-neutral-500 mt-1">
                          {u.role === "ADMIN"
                            ? `Oversees all ${tasks.length} tasks`
                            : `${assigned.length} task${assigned.length === 1 ? "" : "s"} · ${sd}/${roleSteps.length} steps done`}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </section>
            )}
          </div>
        </main>
      </div>

      {showCreate && (
        <CreateTaskModal users={users} onClose={() => setShowCreate(false)} onCreate={createTask} pushToast={pushToast} creating={creating} />
      )}
      {detailTask && (
        <TaskDetailsModal
          task={detailTask}
          me={me}
          isAdmin={isAdmin}
          getUserById={getUserById}
          onClose={() => setDetailId(null)}
          onToggle={toggleStep}
          busyStepId={busyStepId}
        />
      )}
      <ToastStack toasts={toasts} />
    </div>
  );
}
