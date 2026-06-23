#!/usr/bin/env python3
import argparse
import json
import os
import shutil
import subprocess
import sys
from datetime import datetime, timezone, timedelta
from pathlib import Path

JST = timezone(timedelta(hours=9))
WINDOWS = {
    "11": ((10, 55), (11, 30)),
    "19": ((18, 55), (19, 30)),
}
SAFE_CHILD_KEYS = {
    "ok",
    "slot",
    "postDate",
    "insideSlotWindow",
    "publishEnabled",
    "dryRun",
    "apiConfigured",
    "planEnsured",
    "planGenerated",
    "postPrepared",
    "postValidated",
    "mediaType",
    "mediaItemCount",
    "mediaValidated",
    "mediaValidationErrorCount",
    "wouldPublish",
    "published",
    "compensationPostExecuted",
    "blockedReason",
    "postIdPresent",
}


def main():
    parser = argparse.ArgumentParser(description="Run one safe Threads scheduled slot.")
    parser.add_argument("--slot", required=True, choices=["11", "19"])
    parser.add_argument("--date", default="")
    parser.add_argument("--now-iso", default=os.environ.get("THREADS_NOW_ISO", ""))
    parser.add_argument("--project-root", default=str(Path(__file__).resolve().parents[2]))
    parser.add_argument("--node-timeout-seconds", type=int, default=75)
    parser.add_argument("--node-script", default="scripts/threads/publish-scheduled-thread.mjs")
    args = parser.parse_args()

    root = Path(args.project_root).resolve()
    now = parse_now(args.now_iso)
    target_date = args.date or now.astimezone(JST).date().isoformat()
    summary = base_summary(args.slot, target_date, now)

    if not root.exists():
        return finish(root, summary, 70, "working_directory_missing")

    window = slot_window(args.slot, target_date, now)
    summary.update(window)
    if not window["withinWindow"]:
        summary["ok"] = True
        return finish(root, summary, 0, "outside_slot_window")

    if already_published(root, target_date, args.slot):
        summary["ok"] = True
        return finish(root, summary, 0, "already_published")

    lock_path = root / "data" / "threads" / "runtime-locks" / f"{target_date}-{args.slot}.lock"
    lock_acquired = acquire_lock(lock_path, summary)
    if not lock_acquired:
        summary["ok"] = True
        return finish(root, summary, 0, "slot_lock_exists")

    try:
        node = resolve_node()
        if not node:
            return finish(root, summary, 71, "node_executable_missing")
        summary["nodeStarted"] = True
        command = [
            node,
            args.node_script,
            "--slot",
            args.slot,
            "--date",
            target_date,
        ]
        env = os.environ.copy()
        env["THREADS_NOW_ISO"] = now.astimezone(JST).isoformat()
        env["PYTHONUTF8"] = "1"
        env["PYTHONIOENCODING"] = "utf-8"
        completed = run_child(command, root, env, args.node_timeout_seconds)
        summary["nodeExitCode"] = completed["exitCode"]
        summary["timedOut"] = completed["timedOut"]
        summary["processAborted"] = completed["processAborted"]
        summary["decodeFailed"] = completed.get("decodeFailed", False)
        child = parse_last_json(completed["stdout"])
        for key, value in child.items():
            if key in SAFE_CHILD_KEYS:
                summary[key] = value
        if completed["timedOut"]:
            return finish(root, summary, 124, "node_runner_timeout")
        if completed.get("decodeFailed"):
            return finish(root, summary, 125, "node_output_decode_failed")
        if completed["exitCode"] != 0 and not summary.get("blockedReason"):
            return finish(root, summary, completed["exitCode"], "node_runner_failed")
        summary["ok"] = completed["exitCode"] == 0 and summary.get("ok") is not False
        return finish(root, summary, completed["exitCode"], summary.get("blockedReason", ""))
    finally:
        try:
            lock_path.unlink()
        except FileNotFoundError:
            pass


def base_summary(slot, target_date, now):
    return {
        "ok": False,
        "schedulerAuthority": "windows_task_scheduler",
        "runnerStarted": True,
        "slot": slot,
        "postDate": target_date,
        "checkedAtJst": now.astimezone(JST).isoformat(),
        "withinWindow": False,
        "nodeStarted": False,
        "published": False,
        "verified": False,
        "timedOut": False,
        "processAborted": False,
        "compensationPostExecuted": False,
        "realThreadsApiCallCount": 0,
        "autoReplyExecuted": False,
        "autoLikeExecuted": False,
        "autoFollowExecuted": False,
        "sensitiveDataLogged": False,
        "blockedReason": "",
    }


def parse_now(value):
    if value:
        clean = value.replace("Z", "+00:00")
        return datetime.fromisoformat(clean).astimezone(JST)
    return datetime.now(JST)


def slot_window(slot, target_date, now):
    start_pair, end_pair = WINDOWS[slot]
    start = datetime.fromisoformat(f"{target_date}T{start_pair[0]:02d}:{start_pair[1]:02d}:00+09:00")
    end = datetime.fromisoformat(f"{target_date}T{end_pair[0]:02d}:{end_pair[1]:02d}:00+09:00")
    current = now.astimezone(JST)
    return {
        "slotWindowStart": start.isoformat(),
        "slotWindowEnd": end.isoformat(),
        "withinWindow": start <= current <= end,
    }


def already_published(root, target_date, slot):
    path = root / "data" / "threads" / "published" / f"{target_date}-{slot}.json"
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return False
    return data.get("published") is True


def acquire_lock(lock_path, summary):
    lock_path.parent.mkdir(parents=True, exist_ok=True)
    if lock_path.exists():
        try:
            age_seconds = datetime.now(JST).timestamp() - lock_path.stat().st_mtime
        except OSError:
            age_seconds = 0
        if age_seconds < 15 * 60:
            summary["lockPresent"] = True
            return False
        try:
            lock_path.unlink()
        except OSError:
            summary["lockPresent"] = True
            return False
    lock_body = {
        "slot": summary["slot"],
        "postDate": summary["postDate"],
        "pid": os.getpid(),
        "createdAtJst": datetime.now(JST).isoformat(),
        "reason": "running",
    }
    lock_path.write_text(json.dumps(lock_body, ensure_ascii=True, indent=2) + "\n", encoding="utf-8")
    summary["lockPresent"] = False
    summary["lockAcquired"] = True
    return True


def resolve_node():
    override = os.environ.get("THREADS_NODE_EXE", "").strip()
    if override and Path(override).exists():
        return override
    return shutil.which("node")


def run_child(command, root, env, timeout_seconds):
    process = subprocess.Popen(
        command,
        cwd=str(root),
        env=env,
        stdin=subprocess.DEVNULL,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        encoding="utf-8",
        errors="strict",
        shell=False,
    )
    try:
        stdout, stderr = process.communicate(timeout=timeout_seconds)
        return {
            "exitCode": int(process.returncode or 0),
            "stdout": stdout,
            "stderr": stderr,
            "timedOut": False,
            "processAborted": False,
        }
    except UnicodeError:
        terminate_tree(process.pid)
        return {
            "exitCode": 125,
            "stdout": "",
            "stderr": "",
            "timedOut": False,
            "processAborted": True,
            "decodeFailed": True,
        }
    except subprocess.TimeoutExpired:
        terminate_tree(process.pid)
        try:
            stdout, stderr = process.communicate(timeout=5)
        except UnicodeError:
            stdout, stderr = "", ""
        return {
            "exitCode": 124,
            "stdout": stdout,
            "stderr": stderr,
            "timedOut": True,
            "processAborted": True,
        }


def terminate_tree(pid):
    if os.name == "nt":
        subprocess.run(["taskkill", "/PID", str(pid), "/T", "/F"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    else:
        try:
            os.kill(pid, 15)
        except OSError:
            pass


def parse_last_json(value):
    for line in reversed(str(value or "").splitlines()):
        text = line.strip()
        if text.startswith("{") and text.endswith("}"):
            try:
                return json.loads(text)
            except json.JSONDecodeError:
                return {}
    return {}


def finish(root, summary, exit_code, reason):
    if reason:
        summary["blockedReason"] = reason
    if summary.get("blockedReason") in {"outside_slot_window", "already_published", "slot_lock_exists"}:
        summary["ok"] = True
    write_log(root, summary)
    print(json.dumps(summary, ensure_ascii=True, sort_keys=True))
    return int(exit_code)


def write_log(root, summary):
    try:
        out_dir = root / "data" / "threads" / "runner-logs"
        out_dir.mkdir(parents=True, exist_ok=True)
        stamp = datetime.now(JST).strftime("%Y%m%d-%H%M%S")
        out_path = out_dir / f"{summary['postDate']}-{summary['slot']}-{stamp}.json"
        out_path.write_text(json.dumps(summary, ensure_ascii=True, indent=2) + "\n", encoding="utf-8")
    except Exception:
        pass


if __name__ == "__main__":
    sys.exit(main())
