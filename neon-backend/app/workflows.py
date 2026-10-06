"""
Predefined fragmented workflows (blueprint §4).
Kept as a single source of truth so the auto-generation engine
produces byte-identical step titles/order to the frontend's seed data.
"""

from app.models import Role

WORKFLOWS: dict[Role, list[str]] = {
    Role.SCRIPT_WRITER: ["Research", "First Draft", "Revisions", "Final Approval"],
    Role.CONTENT_WRITER: ["SEO Research", "Drafting", "Proofing", "Ready"],
    Role.VIDEO_EDITOR: ["Rough Cut", "B-Roll", "Effects", "Audio", "Render"],
}

TOTAL_STEPS = sum(len(v) for v in WORKFLOWS.values())  # 13
