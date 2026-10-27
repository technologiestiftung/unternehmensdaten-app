#!/usr/bin/env python3
"""PreToolUse hook: before Claude runs `git commit`, run lint, typecheck and the unit tests.

The same three checks CI runs on every pull request (`.github/workflows/checks.yml`), minus
`next build`, which takes long enough to make every commit wait and is still checked in CI. A commit
is the moment the change becomes history, so a red check blocks it here instead of on GitHub.

What passes straight through: any Bash command that is not a `git commit`, and a `git commit` with
nothing staged and no `-a` (git refuses that itself).

Exit codes: 0 lets the command run, 2 blocks it and shows stderr to Claude as feedback.

Adapted from the unternehmensdatenbank repo's hook of the same name; `confirm_before_commit.py`
imports `_commits_all` from here, so it keeps that name.
"""
from __future__ import annotations

import json
import shlex
import subprocess
import sys
from pathlib import Path

HOOKS = Path(__file__).resolve().parent
REPO = HOOKS.parents[1]
sys.path.insert(0, str(HOOKS))

from check_commit_message import _GIT_COMMIT  # noqa: E402  the one definition of "a git commit"

#: npm scripts from package.json, in order of speed, so the cheapest failure is reported first.
CHECKS = ("lint", "typecheck", "test")


def _commits_all(argv: list[str]) -> bool:
    """True when the command line carries `-a`/`--all`, alone or folded into `-am`."""
    for token in argv:
        if token == "--all":
            return True
        if token.startswith("-") and not token.startswith("--") and "a" in token[1:]:
            return True
    return False


def anything_to_commit(argv: list[str]) -> bool:
    if _commits_all(argv):
        return True
    staged = subprocess.run(["git", "diff", "--cached", "--quiet"], cwd=REPO, capture_output=True)
    return staged.returncode == 1


def run_check(script: str) -> str | None:
    """None when `npm run <script>` passes, else the tail of its output."""
    result = subprocess.run(
        ["npm", "run", "--silent", script], cwd=REPO, capture_output=True, text=True
    )
    if result.returncode == 0:
        return None
    output = ((result.stdout or "") + (result.stderr or "")).strip()
    return f"npm run {script} FAILED\n{output[-1500:]}\n\nFix this before committing: npm run {script}\n"


def main() -> int:
    try:
        payload = json.load(sys.stdin)
    except Exception:  # noqa: BLE001  a hook that cannot parse its input must not block the session
        return 0

    command = str((payload.get("tool_input") or {}).get("command") or "")
    if not command or not _GIT_COMMIT.search(command):
        return 0
    try:
        argv = shlex.split(command, posix=True)
    except ValueError:
        return 0  # unbalanced quotes; the shell will say so
    if not anything_to_commit(argv):
        return 0

    for script in CHECKS:
        failure = run_check(script)
        if failure:
            sys.stderr.write(f"BLOCKED before commit: {failure}")
            return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
