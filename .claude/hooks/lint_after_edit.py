#!/usr/bin/env python3
"""PostToolUse hook: after Claude edits a .ts/.tsx/.js/.mjs file in this repo, run ESLint on it.

Catches a breakage in the turn it happens instead of at commit time. One file only, so it stays at
a couple of seconds. Typecheck and tests wait for the commit hook: both need the whole project.

Exit codes: 0 when clean or not a lintable file, 2 shows ESLint's output to Claude as feedback.
"""
from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
LINTED = {".ts", ".tsx", ".js", ".mjs"}
SKIPPED_DIRS = {"node_modules", ".next"}


def lintable(raw: str) -> Path | None:
    """The repo-relative path when `raw` is a lintable source file inside the repo, else None."""
    if not raw:
        return None
    path = Path(raw).resolve()
    try:
        relative = path.relative_to(REPO)
    except ValueError:
        return None
    if path.suffix not in LINTED or SKIPPED_DIRS & set(relative.parts) or not path.exists():
        return None
    return relative


def main() -> int:
    try:
        payload = json.load(sys.stdin)
    except Exception:  # noqa: BLE001  a hook that cannot parse its input must not block the session
        return 0

    relative = lintable(str((payload.get("tool_input") or {}).get("file_path") or ""))
    if relative is None:
        return 0
    result = subprocess.run(
        ["npx", "--no-install", "eslint", str(relative)], cwd=REPO, capture_output=True, text=True
    )
    if result.returncode == 0:
        return 0
    output = ((result.stdout or "") + (result.stderr or "")).strip()
    sys.stderr.write(f"ESLint FAILED on {relative}\n{output[-1500:]}\n\nFix this before doing anything else.\n")
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
