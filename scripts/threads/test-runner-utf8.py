#!/usr/bin/env python3
import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path

root = Path.cwd()
tmp = Path(tempfile.mkdtemp(prefix="threads-runner-utf8-"))
scripts = tmp / "scripts" / "threads"
scripts.mkdir(parents=True)
mock = scripts / "mock_utf8_child.py"
mock.write_text(
    "import json\n"
    "print(json.dumps({'ok': True, 'blockedReason': '店舗SNSあるある', 'published': False, 'compensationPostExecuted': False}, ensure_ascii=False))\n",
    encoding="utf-8",
)

env = os.environ.copy()
env["THREADS_NODE_EXE"] = sys.executable
result = subprocess.run(
    [
        sys.executable,
        str(root / "scripts" / "threads" / "run_scheduled_thread.py"),
        "--slot",
        "19",
        "--date",
        "2026-06-23",
        "--now-iso",
        "2026-06-23T19:00:00+09:00",
        "--project-root",
        str(tmp),
        "--node-script",
        "scripts/threads/mock_utf8_child.py",
    ],
    cwd=root,
    env=env,
    text=True,
    encoding="utf-8",
    errors="strict",
    capture_output=True,
)

summary = json.loads(result.stdout)
assert result.returncode == 0, result.stderr or result.stdout
assert summary["decodeFailed"] is False
assert summary["nodeStarted"] is True
assert summary["blockedReason"] == "店舗SNSあるある"

print(json.dumps({
    "runnerUtf8TestCount": 4,
    "passed": True,
    "pythonSubprocessEncoding": "utf-8",
    "decodeFailed": False,
    "realThreadsApiCallCount": 0,
    "realPostCount": 0,
}, ensure_ascii=True))
