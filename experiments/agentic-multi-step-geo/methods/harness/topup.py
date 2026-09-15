#!/usr/bin/env python3
"""Drive a model to a target number of usable runs, unattended.

`run.py --passes N` launches N sessions and stops, whatever came back. On a
subscription plan that is not enough. When the plan's session limit is reached
every remaining session returns "You've hit your session limit", writes no
answers, burns no tokens and exits. Twenty-three of thirty runs in the first
full sweep ended that way.

Those runs are not results. Left on disk they are indistinguishable from a
model that could not produce anything, which is the opposite of what happened:
one is a finding about the model, the other is a fact about the account. So
this driver discards a run that failed on rate_limit, waits, and carries on
until the model has `--target` runs that are actually about the model.

Everything else is kept, including runs that produced nothing for their own
reasons. A model that cannot finish the question set is a result.

Models run one at a time. Concurrency does not change how many tokens a sweep
spends, only how fast, and spending them slowly is what keeps a sweep inside
the plan's rolling window.

    python harness/topup.py --models haiku,sonnet,opus --target 10
    python harness/topup.py --purge-only
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from layout import read_meta, run_dirs  # noqa: E402
from run import credential_rejected  # noqa: E402

REPO_ROOT = Path(__file__).resolve().parent.parent
RESULTS = REPO_ROOT / "results"

# The CLI marks the refusal on the transcript record itself; the human-readable
# reset time rides along in the result text.
RATE_LIMIT_ERROR = "rate_limit"
RESET_RE = re.compile(r"resets\s+\d{1,2}:\d{2}\s*(?:am|pm)", re.IGNORECASE)

# A dead token surfaces three different ways, and all three have now been seen:
# a run of 401s that run.py's credential_rejected() recognises as api_retry
# records, and two flavours of this error, "Not logged in" when the mounted
# file is unreadable and "OAuth session expired and could not be refreshed"
# when it is present but stale. The last one carries no 401 anywhere, so it
# passed the 401 check and was scored as a model that produced nothing.
AUTH_ERROR = "authentication_failed"

# Waited when the limit is hit. The transcript names a reset time but not a
# date or zone offset that can be parsed safely, so this polls instead: a wait
# that is too short costs one wasted session, not a wrong number.
BACKOFF_S = 20 * 60


def scan_transcript(run_dir: Path) -> tuple[bool, str | None, bool]:
    """(rate limited, reset time if named, authentication failed)."""
    transcript = run_dir / "transcript.jsonl"
    if not transcript.exists():
        return False, None, False
    limited = False
    auth_failed = False
    reset = None
    with transcript.open(encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if not line:
                continue
            try:
                record = json.loads(line)
            except json.JSONDecodeError:
                continue
            error = record.get("error")
            if error == RATE_LIMIT_ERROR:
                limited = True
            elif error == AUTH_ERROR:
                auth_failed = True
            match = RESET_RE.search(str(record.get("result") or ""))
            if match:
                reset = match.group(0)
    return limited, reset, auth_failed


def quota_failure(run_dir: Path) -> str | None:
    """The reset time named in the transcript, or None if not rate-limited."""
    limited, reset, _ = scan_transcript(run_dir)
    return (reset or "unknown") if limited else None


def infrastructure_failure(run_dir: Path) -> str | None:
    """Why this run says nothing about the model, or None if it does.

    Three ways a session can come back empty without the model having been
    asked anything. The plan's session limit refuses it outright. An expired
    mounted token gets a 401 on the first call, and run.py stops resuming once
    it sees that paired with no answers at all. A token that is present but
    stale fails differently again, with authentication_failed and no 401
    anywhere, which is why the 401 check alone let one through to be scored as
    a model that produced nothing.

    All three bill nothing and write nothing, and on disk all three look
    exactly like a model that could not produce an answer. Scoring them
    reports a fact about the account as a finding about the model.
    """
    limited, reset, auth_failed = scan_transcript(run_dir)
    if limited:
        return f"session limit ({reset or 'unknown'})"
    transcript = run_dir / "transcript.jsonl"
    if not transcript.exists():
        return None
    try:
        wrote_nothing = read_meta(run_dir).get("answers_written", 0) == 0
    except (OSError, json.JSONDecodeError):
        wrote_nothing = not any((run_dir / "answers").glob("q*.csv"))
    if not wrote_nothing:
        return None
    if auth_failed:
        return "credential rejected (authentication_failed)"
    if credential_rejected(transcript):
        return "credential rejected (401)"
    return None


def usable(model: str) -> list[Path]:
    return [d for d in run_dirs(RESULTS, model)
            if infrastructure_failure(d) is None]


def purge(model: str) -> int:
    removed = 0
    for run_dir in run_dirs(RESULTS, model):
        if infrastructure_failure(run_dir) is None:
            continue
        for path in sorted(run_dir.rglob("*"), reverse=True):
            if path.is_file():
                path.unlink()
            else:
                path.rmdir()
        run_dir.rmdir()
        removed += 1
    return removed


def one_pass(model: str) -> None:
    subprocess.run(
        [sys.executable, "-u", str(REPO_ROOT / "harness" / "run.py"),
         "--model", model, "--passes", "1"],
        cwd=str(REPO_ROOT), check=False,
    )


def status_of(run_dir: Path) -> str:
    try:
        return read_meta(run_dir).get("status", "?")
    except (OSError, json.JSONDecodeError):
        return "?"


def drive(model: str, target: int, max_attempts: int) -> int:
    have = len(usable(model))
    print(f"[{model}] {have}/{target} usable on disk", flush=True)
    attempts = 0
    while have < target and attempts < max_attempts:
        attempts += 1
        one_pass(model)
        dirs = run_dirs(RESULTS, model)
        newest = dirs[-1] if dirs else None
        if newest is None:
            print(f"[{model}] run.py wrote nothing; stopping", flush=True)
            break
        failure = infrastructure_failure(newest)
        if failure is not None:
            purge(model)
            if failure.startswith("credential"):
                # Waiting does not refresh a dead token, and every further
                # session fails identically and instantly. Burning 40 attempts
                # proving that is what leaves an arm at n=0.
                print(f"[{model}] {failure}; refresh the host login and"
                      f" restart. Stopping.", flush=True)
                return len(usable(model))
            print(f"[{model}] {failure}; discarding and waiting"
                  f" {BACKOFF_S // 60}m", flush=True)
            time.sleep(BACKOFF_S)
            continue
        have = len(usable(model))
        print(f"[{model}] {have}/{target} usable"
              f" (last: {status_of(newest)})", flush=True)
    if have < target:
        print(f"[{model}] STOPPED at {have}/{target}"
              f" after {attempts} attempts", flush=True)
    return have


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--models", default="haiku,sonnet,opus")
    ap.add_argument("--target", type=int, default=10)
    ap.add_argument("--max-attempts", type=int, default=40,
                    help="per model, counting quota failures")
    ap.add_argument("--purge-only", action="store_true",
                    help="discard quota failures already on disk and exit")
    args = ap.parse_args()

    models = [m.strip() for m in args.models.split(",") if m.strip()]
    for model in models:
        removed = purge(model)
        if removed:
            print(f"[{model}] discarded {removed} quota-failed run(s)",
                  flush=True)
    if args.purge_only:
        return 0

    final = {model: drive(model, args.target, args.max_attempts)
             for model in models}
    print(f"\nfinal: {final}", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
