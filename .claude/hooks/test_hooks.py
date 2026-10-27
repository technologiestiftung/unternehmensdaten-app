"""Self-check for the git command detection: `python -m unittest discover .claude/hooks`.

Runs the hooks the way Claude Code does, JSON on stdin, and asserts on exit code and output.
`check_commit_message.py` stands in for all three commit hooks, which share its `_GIT_COMMIT`.
"""
from __future__ import annotations

import json
import subprocess
import sys
import unittest
from pathlib import Path

HOOKS = Path(__file__).resolve().parent
LONG_BODY = "subject\n\n" + "\n".join(f"- line {n}" for n in range(20))


def _run(hook: str, command: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [sys.executable, str(HOOKS / hook)],
        input=json.dumps({"tool_input": {"command": command}}),
        capture_output=True,
        text=True,
        timeout=10,
    )


class CommitDetection(unittest.TestCase):
    def assert_blocked(self, command: str, blocked: bool) -> None:
        self.assertEqual(_run("check_commit_message.py", command).returncode, 2 if blocked else 0)

    def test_single_line(self) -> None:
        self.assert_blocked(f"git commit -m '{LONG_BODY}'", True)
        self.assert_blocked(f"git add src && git commit -m '{LONG_BODY}'", True)

    def test_later_line(self) -> None:
        self.assert_blocked(f"git add src\ngit commit -m '{LONG_BODY}'", True)

    def test_quoted_mention(self) -> None:
        self.assert_blocked(f"echo \"git commit -m '{LONG_BODY}'\"", False)


class PushDetection(unittest.TestCase):
    def asks(self, command: str) -> bool:
        output = _run("ask_before_push.py", command).stdout
        return bool(output) and json.loads(output)["hookSpecificOutput"]["permissionDecision"] == "ask"

    def test_single_line(self) -> None:
        self.assertTrue(self.asks("git push"))
        self.assertTrue(self.asks("cd app && git push"))

    def test_later_line(self) -> None:
        self.assertTrue(self.asks("cd app\ngit push"))

    def test_other_commands(self) -> None:
        self.assertFalse(self.asks("git status"))
        self.assertFalse(self.asks("echo git push"))


if __name__ == "__main__":
    unittest.main()
