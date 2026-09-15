"""Spawn independent benchmark sessions in Docker and collect transcripts.

Each session is one `docker run` of the pinned image: a fresh container,
a fresh workspace, no state shared with any other session or with the
host. The model works through the full question set once per session.

The container workspace receives only prompts/task.md and
fixtures/questions.yaml — never the golden answers.

A session that ends its turn with questions still unanswered is resumed
into the same session id, with a prompt naming what is missing, up to
--max-attempts times. Its transcript holds every attempt.

Per session, this writes results/{model}/{run_id}/, where a run id is
the UTC start time and the harness commit:
    transcript.jsonl   raw stream-json output from the session
    answers/           the CSVs the agent wrote
    meta.json          model, tokens, turns, imputed cost, harness commit

Usage:
    python harness/run.py --model sonnet --passes 10
    python harness/run.py --model haiku --passes 1 --dry-run
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import shutil
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

import ablation
from pricing import PRICES, imputed_cost_usd

IMAGE = "geodata-llm-eval"
REPO_ROOT = Path(__file__).resolve().parent.parent

# The named specs a session can be run against, and the name meaning "all of
# it". A run started without --arm reads no config and records FULL_SPEC, so
# every run already on disk and every plain run from here on group together.
ABLATIONS = REPO_ROOT / "fixtures" / "ablations.yaml"
FULL_SPEC = "full"

# How often the run prints where a session has got to, and how often it
# checks whether the container has exited. A session runs for tens of
# minutes, so a minute between lines is frequent enough to show progress
# without burying the two lines that matter.
HEARTBEAT_SECONDS = 60
POLL_SECONDS = 2

# A headless session ends its turn when the model stops calling tools, which
# is not the same as finishing the work: a session that parks an expensive
# query in the background and yields, expecting to be woken, is never woken.
# Its container dies with the background task still running. Rather than
# score that as a model that answered four questions, the harness resumes the
# same session and says what is missing. Attempts are bounded because a model
# that stops for a reason other than waiting will stop again.
MAX_ATTEMPTS = 3

INITIAL_PROMPT = "Read task.md and complete it."

# --follow truncates each tool call to one line of this width. A session
# writes multi-line heredocs of SQL; the point of following is to see what it
# is doing now, and the transcript keeps the full text either way.
FOLLOW_WIDTH = 150

# Where a tool call's subject lives, by tool. Falls back to the whole input.
TOOL_SUBJECT_KEYS = ("command", "file_path", "pattern", "path", "prompt")

# A 1 MB range read is big enough to measure a route and small enough that
# a dead one fails fast. See source-cooperative/data.source.coop#194.
PROBE_BYTES = 1_048_576
PROBE_TIMEOUT = 30

# The input list, by encoding (see policies/INPUTS.md). experiment 1 (Goiás)
# ships csv; the geometry/split encodings drive the adversarial follow-up.
INPUT_FILES = {
    "csv": ["goias-sample.csv"],
    "geometry": ["goias-sample.parquet"],
    "split": ["goias-sample.csv", "goias-sample-geom.parquet"],
}


def list_files(input_mode: str) -> list[Path]:
    """The input-list file(s) to mount for an encoding mode."""
    base = REPO_ROOT / "fixtures" / "lists"
    return [base / name for name in INPUT_FILES[input_mode]]


def harness_commit() -> str:
    try:
        return subprocess.run(
            ["git", "rev-parse", "HEAD"],
            cwd=REPO_ROOT, capture_output=True, text=True, check=True,
        ).stdout.strip()
    except subprocess.CalledProcessError:
        return "unknown"


CREDENTIALS = Path.home() / ".claude" / ".credentials.json"

# The container HOME is a clean /home/runner (see Dockerfile): no CLAUDE.md,
# no hooks, no MCP config, no memory. A login token is the single host
# artifact that crosses the boundary, and it crosses as a per-session copy
# holding nothing else from ~/.claude.
#
# The credential copy is mounted at every home the CLI might resolve to, not
# just the one the Dockerfile declares. `ENV HOME=/home/runner` only wins when
# the uid the harness passes is absent from the container's /etc/passwd, which
# is what the Dockerfile assumes. A host uid of 1000 is not absent: the node
# base image already owns it as `node`, so the CLI reads the passwd entry,
# resolves HOME to /home/node, finds no credentials there and exits with
# "Not logged in". Mounting both costs one extra bind and removes the
# dependency on what the host uid happens to be.
CONTAINER_CLAUDE_DIRS = ("/home/runner/.claude", "/home/node/.claude")


def auth_args(session_home: Path) -> list[str]:
    """Docker args carrying credentials into the session.

    Prefers a subscription login and falls back to ANTHROPIC_API_KEY, so
    sessions bill against the plan rather than the API. Raises if neither
    is available, rather than launching a session that will fail on its
    first model call.

    The host credentials file is copied into a throwaway per-session home
    and that copy is mounted read-write: the CLI refreshes an expiring
    OAuth token by writing the file back, which a read-only mount of the
    real one would break. The copy dies with the session's temp dir, so a
    session can neither corrupt nor outlive the host login.
    """
    if CREDENTIALS.exists():
        claude_dir = session_home / ".claude"
        claude_dir.mkdir(parents=True, exist_ok=True)
        claude_dir.chmod(0o700)
        dest = claude_dir / ".credentials.json"
        shutil.copy(CREDENTIALS, dest)
        dest.chmod(0o600)
        args: list[str] = []
        for container_dir in CONTAINER_CLAUDE_DIRS:
            args += ["-v", f"{claude_dir}:{container_dir}"]
        return args
    if os.environ.get("ANTHROPIC_API_KEY"):
        return ["-e", "ANTHROPIC_API_KEY"]
    raise SystemExit(
        f"No credentials found. Run `claude login` on the host (writes "
        f"{CREDENTIALS}) or set ANTHROPIC_API_KEY."
    )


def docker_command(workspace: Path, session_home: Path,
                   model_id: str, container: str,
                   prompt: str = INITIAL_PROMPT,
                   resume_session: str | None = None) -> list[str]:
    resume = ["--resume", resume_session] if resume_session else []
    return [
        # `--rm` already drops the container's anonymous volumes on exit.
        # `--name` is what lets an interrupted run find and remove its own
        # container afterwards. (`-v` belongs on `docker rm`, not here: on
        # `docker run` it takes a mount spec and would swallow the next
        # argument.)
        "docker", "run", "--rm", "--name", container,
        # Run as the invoking user. The mounted credential copy is 0600 and
        # host-owned, and the CLI has to both read it and write a refreshed
        # token back; a container uid that isn't the file's owner cannot do
        # either. The image's own `runner` account can't be relied on for
        # this, since its uid is fixed at build time and the host's is not.
        "--user", f"{os.getuid()}:{os.getgid()}",
        "-v", f"{workspace}:/workspace",
        *auth_args(session_home),
        IMAGE,
        "-p", prompt,
        *resume,
        "--model", model_id,
        "--output-format", "stream-json",
        "--verbose",
        "--dangerously-skip-permissions",
    ]


def read_records(transcript_path: Path):
    """Yield the parseable records of a transcript.

    Tolerates a truncated final line, so this works on a transcript the
    session is still writing.
    """
    try:
        handle = open(transcript_path, encoding="utf-8")
    except FileNotFoundError:
        return
    with handle as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                yield json.loads(line)
            except json.JSONDecodeError:
                continue


# Usage field in a `result` record -> the name meta.json reports it under.
USAGE_FIELDS = {
    "input_tokens": "input_tokens",
    "output_tokens": "output_tokens",
    "cache_creation_input_tokens": "cache_creation_tokens",
    "cache_read_input_tokens": "cache_read_tokens",
}


def parse_result_record(transcript_path: Path) -> dict:
    """Pull token counts and turn count from the stream-json transcript.

    A `result` record carries the cumulative usage of one CLI invocation, and
    a resumed session appends a second one. Taking the last record would bill
    the run for its final attempt alone, so the counts are summed: every
    attempt spent real tokens, and the imputed cost has to say so. Turn count
    is the number of assistant records.
    """
    totals = dict.fromkeys(USAGE_FIELDS.values(), 0)
    turns = 0
    for record in read_records(transcript_path):
        if record.get("type") == "assistant":
            turns += 1
        if record.get("type") == "result":
            usage = record.get("usage") or {}
            for field, name in USAGE_FIELDS.items():
                totals[name] += usage.get(field) or 0
    return {"turns": turns, **totals}


def session_id(transcript_path: Path) -> str | None:
    """The id `--resume` needs to continue this session.

    Every stream-json record carries it, and it holds across a resume, so
    the last one that has it is the id of the session on disk.
    """
    found = None
    for record in read_records(transcript_path):
        value = record.get("session_id")
        if isinstance(value, str) and value:
            found = value
    return found


def credential_rejected(transcript_path: Path) -> bool:
    """Whether a 401 appears anywhere in this run's transcript.

    The mounted token copy expires, and a session starting after it does gets
    a 401 on its first call. The CLI retries ten times, logging each as an
    `api_retry` record, then exits 1 having written nothing -- which reads to
    the resume loop exactly like a session that stopped with work left.

    The caller pairs this with "no answers at all", because that combination
    is what distinguishes a dead credential from one refreshed mid-session:
    a run that recovered has answers on disk and is worth resuming. Read on
    its own this is deliberately broad, and it has to be. In the run that
    prompted it, the third attempt logged no api_retry at all -- by then the
    CLI could not find its config file and failed before reaching the API --
    so a rule that inspected only the latest attempt would have missed the
    very failure it was written for.
    """
    return any(record.get("subtype") == "api_retry"
               and record.get("error_status") == 401
               for record in read_records(transcript_path))


# The CLI caps a Bash call here. A call reported at or above the cap was
# killed rather than answered, which is the difference between a query that
# was slow and one that never returned.
TOOL_TIMEOUT_SECONDS = 120


def tool_timings(transcript_path: Path) -> dict:
    """Where a session spent its wall clock.

    The CLI emits heartbeat records carrying a running `elapsed_time_seconds`
    for calls slow enough to need one, so the last heartbeat per tool_use_id
    is a lower bound on that call's duration. Short calls emit none and are
    invisible here, which is the point: this measures the tail.

    Remote reads dominate a run of this benchmark, so a total duration on its
    own cannot distinguish a session that thought for half an hour from one
    that waited on source.coop for half an hour.
    """
    longest: dict[str, tuple[str, float]] = {}
    for record in read_records(transcript_path):
        seconds = record.get("elapsed_time_seconds")
        call_id = record.get("tool_use_id")
        if seconds is None or call_id is None:
            continue
        name = record.get("tool_name") or "unknown"
        if call_id not in longest or seconds > longest[call_id][1]:
            longest[call_id] = (name, float(seconds))

    per_tool: dict[str, float] = {}
    for name, seconds in longest.values():
        per_tool[name] = round(per_tool.get(name, 0.0) + seconds, 1)
    timed_out = sum(
        1 for _, s in longest.values() if s >= TOOL_TIMEOUT_SECONDS
    )
    return {
        "slow_tool_calls": len(longest),
        "slow_tool_seconds": round(sum(s for _, s in longest.values()), 1),
        "slow_tool_seconds_by_tool": per_tool,
        "timed_out_tool_calls": timed_out,
    }


def tool_subject(payload: dict) -> str:
    """The interesting part of a tool call's input, as one line.

    Session scratch paths carry a session uuid and a task id, which is 90
    characters of noise per line and pushes the command off the right edge.
    Only the tail of a path identifies anything a reader wants.
    """
    for key in TOOL_SUBJECT_KEYS:
        value = payload.get(key)
        if not isinstance(value, str) or not value.strip():
            continue
        line = " ".join(value.split())
        if key in ("file_path", "path") and line.count("/") > 2:
            return ".../" + "/".join(line.rsplit("/", 2)[-2:])
        return line
    return json.dumps(payload, sort_keys=True)


def question_ids() -> list[str]:
    """The question ids a complete session answers, in spec order."""
    text = (REPO_ROOT / "fixtures" / "questions.yaml").read_text("utf-8")
    ids = []
    for line in text.splitlines():
        stripped = line.lstrip()
        if stripped.startswith("- id:"):
            ids.append(stripped.split(":", 1)[1].strip().strip("\"'"))
    return ids


def question_count() -> int:
    """How many answers a complete session writes, read from the spec.

    Hard-coding 30 beside a spec that defines the questions invites the two to
    drift, and the progress line would then under- or over-report forever.
    """
    return len(question_ids())


def answer_name(question_id: str) -> str:
    """The answer file a question is written to, as task.md names it."""
    return f"q{question_id}"


def missing_answers(out_dir: Path) -> list[str]:
    """Answer files a complete session would have written and this one has not."""
    written = {path.stem for path in (out_dir / "answers").glob("q*.csv")}
    return [answer_name(qid) for qid in question_ids()
            if answer_name(qid) not in written]


def resume_prompt(missing: list[str]) -> str:
    """What a resumed session is told about why it is running again.

    It ended its turn with work outstanding, most often after handing an
    expensive query to a background task and yielding to wait for it. Nothing
    was waiting: the container exited and took the task with it. So the nudge
    names the questions still unanswered and rules out the move that lost the
    last attempt, rather than repeating the original instruction and letting
    the session make the same bet twice.
    """
    listed = ", ".join(missing[:10])
    if len(missing) > 10:
        listed += f", and {len(missing) - 10} more"
    return (
        f"Your previous turn ended with {len(missing)} of {question_count()} "
        f"answers unwritten: {listed}. Nothing was waiting for you. Any "
        "background task or scheduled wake-up you left running was killed "
        "when your turn ended, and its output is gone. Redo that work in the "
        "foreground, waiting for each query to return before you move on, "
        "and write each answer to answers/<question-id>.csv as soon as you "
        "have it. Re-read task.md if you need the output contracts."
    )


def session_verdict(answered: int) -> str:
    """How a finished session is announced.

    A run that ends without writing anything costs as much as one that works
    and used to print the same word. Two of them read as successes until
    grading contradicted it an hour later, so the headline says which it was.
    """
    if answered == 0:
        return "PRODUCED NOTHING"
    if answered < question_count():
        return "INCOMPLETE"
    return "done"


def result_text(block: dict) -> str:
    """A tool result's text, whatever shape the record put it in."""
    content = block.get("content")
    if isinstance(content, list):
        content = "".join(part.get("text", "") for part in content
                          if isinstance(part, dict))
    return " ".join(str(content or "").split())


class Follower:
    """Renders a running session's transcript as it is written.

    A tool call is two events: the call, and the result that says how long it
    took and whether it worked. Printing only the first made a failed query
    and a successful one look identical, and left a four-minute wait looking
    like a session that had stopped. Pairing them by tool_use_id, and passing
    the heartbeats through, is what makes the terminal readable.
    """

    def __init__(self, clock=time.monotonic) -> None:
        self.offset = 0
        self.clock = clock
        self.pending: dict[str, tuple[str, float]] = {}
        self.beat_shown: dict[str, float] = {}

    def stamp(self) -> str:
        return datetime.now().strftime("%H:%M:%S")

    def running_for(self) -> float:
        """Seconds the oldest unfinished call has been going, 0 when idle."""
        if not self.pending:
            return 0.0
        return self.clock() - min(start for _, start in self.pending.values())

    def consume(self, transcript_path: Path) -> None:
        """Print everything written since the last call.

        Reads bytes rather than lines so a partially-written final record
        waits for the next poll instead of parsing as truncated JSON.
        """
        try:
            with open(transcript_path, "rb") as handle:
                handle.seek(self.offset)
                data = handle.read()
        except FileNotFoundError:
            return
        complete = data.rfind(b"\n") + 1
        self.offset += complete
        for raw in data[:complete].splitlines():
            try:
                self.emit(json.loads(raw))
            except (json.JSONDecodeError, UnicodeDecodeError):
                continue

    def emit(self, record: dict) -> None:
        if record.get("type") == "tool_progress":
            self.emit_heartbeat(record)
            return
        for block in record.get("message", {}).get("content", []) or []:
            if not isinstance(block, dict):
                continue
            if block.get("type") == "tool_use":
                self.emit_call(block)
            elif block.get("type") == "tool_result":
                self.emit_result(block)

    def emit_call(self, block: dict) -> None:
        name = block.get("name", "?")
        self.pending[block.get("id")] = (name, self.clock())
        line = (f"  {self.stamp()} {name[:9]:<9} "
                f"{tool_subject(block.get('input', {}))}")
        print(line[:FOLLOW_WIDTH], flush=True)

    def emit_result(self, block: dict) -> None:
        call_id = block.get("tool_use_id")
        _name, start = self.pending.pop(call_id, ("?", None))
        self.beat_shown.pop(call_id, None)
        took = f"{self.clock() - start:.1f}s" if start is not None else "?"
        if block.get("is_error"):
            line = (f"  {self.stamp()} {'':<9}   ↳ FAILED after {took}: "
                    f"{result_text(block)}")
        else:
            line = f"  {self.stamp()} {'':<9}   ↳ {took}"
        print(line[:FOLLOW_WIDTH], flush=True)

    def emit_heartbeat(self, record: dict) -> None:
        """One line a minute while a call runs, so a long wait shows a pulse
        instead of silence."""
        call_id = record.get("parent_tool_use_id") or record.get("tool_use_id")
        seconds = float(record.get("elapsed_time_seconds") or 0)
        if seconds - self.beat_shown.get(call_id, 0.0) < HEARTBEAT_SECONDS:
            return
        self.beat_shown[call_id] = seconds
        print(f"  {self.stamp()} {'':<9}   ↳ still running, {seconds:.0f}s",
              flush=True)


def progress_snapshot(transcript_path: Path) -> tuple[int, str]:
    """Turns so far and the most recent tool call, from a partial transcript."""
    turns = 0
    last_tool = "-"
    for record in read_records(transcript_path):
        if record.get("type") != "assistant":
            continue
        turns += 1
        for block in (record.get("message") or {}).get("content") or []:
            if isinstance(block, dict) and block.get("type") == "tool_use":
                last_tool = block.get("name", "-")
    return turns, last_tool


def stop_session(proc: subprocess.Popen, container: str) -> None:
    """Make sure neither the client process nor the container outlives us."""
    if proc.poll() is None:
        proc.terminate()
        try:
            proc.wait(timeout=10)
        except subprocess.TimeoutExpired:
            proc.kill()
    # `docker run --rm` deletes the container on a normal exit, so this is a
    # no-op for a session that finished. It is the interrupted case that
    # leaves one behind.
    subprocess.run(["docker", "rm", "-f", "-v", container],
                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                   check=False)


def clear_pass_dir(out_dir: Path) -> None:
    """Empty a pass directory so a re-run leaves nothing of the run before it.

    A pass is one session's record. Re-running into a directory that still
    holds the previous attempt's grades, diffs, or answers produces a mixture
    that reads as a single coherent run and is not one.
    """
    if not out_dir.exists():
        return
    for path in sorted(out_dir.iterdir()):
        if path.is_dir():
            shutil.rmtree(path)
        else:
            path.unlink()


def run_session(model: str, dry_run: bool, input_mode: str = "csv",
                follow: bool = False, label: str = "",
                max_attempts: int = MAX_ATTEMPTS, arm: str = "",
                ablations: Path | None = None) -> None:
    # Resolve the arm before any work: a heading that no longer matches the
    # document should cost a second, not a container.
    arm_spec = {"arm": arm or FULL_SPEC, "why": "", "ops": []}
    if arm:
        config = ablation.load_arms(ablations or ABLATIONS)
        if arm not in config["arms"]:
            raise ablation.AblationError(
                f"unknown arm {arm!r}, expected one of {sorted(config['arms'])}")
        chosen = config["arms"][arm]
        # The resolved operations are copied in, not referenced. A config
        # edited next week must not change what this run says it did.
        arm_spec = {"arm": arm, "why": str(chosen["why"]).strip(),
                    "ops": chosen["ops"]}

    model_id = PRICES[model].model_id
    started = datetime.now(timezone.utc)
    name = run_id(started, harness_commit())
    out_dir = REPO_ROOT / "results" / model / name
    container = f"geodata-eval-{model}-{name}-{os.getpid()}"

    with tempfile.TemporaryDirectory(prefix="geodata-eval-") as tmp:
        # Two siblings: only `workspace` is mounted at /workspace, so the
        # session's credential copy in `home` sits outside the directory
        # the agent is pointed at.
        workspace = Path(tmp) / "workspace"
        session_home = Path(tmp) / "home"
        workspace.mkdir()
        session_home.mkdir()
        shutil.copy(REPO_ROOT / "prompts" / "task.md", workspace / "task.md")
        shutil.copy(
            REPO_ROOT / "fixtures" / "questions.yaml",
            workspace / "questions.yaml",
        )
        # The policy documents are the binding spec the agent implements; the
        # golden fixtures never enter the workspace.
        shutil.copytree(REPO_ROOT / "policies", workspace / "policies")
        lists_dir = workspace / "lists"
        lists_dir.mkdir()
        for src in list_files(input_mode):
            shutil.copy(src, lists_dir / src.name)
        (workspace / "answers").mkdir()

        # Shaping happens after assembly, never instead of it, so there stays
        # one place a workspace is built and the ablation is a mutation of it.
        arm_spec["receipt"] = ablation.apply_arm(workspace, arm_spec["ops"])
        spec_digest, spec_manifest = ablation.spec_fingerprint(workspace)

        cmd = docker_command(workspace, session_home, model_id, container)
        if dry_run:
            print(" ".join(cmd))
            print(f"arm {arm_spec['arm']} -> spec {spec_digest}")
            for path in sorted(spec_manifest):
                print(f"  {path}")
            for path, removed in sorted(arm_spec["receipt"].items()):
                print(f"  removed {removed} lines from {path}")
            return

        clear_pass_dir(out_dir)
        out_dir.mkdir(parents=True, exist_ok=True)
        transcript_path = out_dir / "transcript.jsonl"
        errors_path = Path(tmp) / "stderr.log"
        started_at = time.monotonic()
        catalog_before = source_coop_sample()
        rate = catalog_before.get("bytes_per_second")
        speed = f"{rate / 1e6:.1f} MB/s" if rate else "unreachable"
        print(f"[{model}/{name}] starting"
              f" (source.coop {speed} via {catalog_before.get('colo') or '?'})")

        follower = Follower() if follow else None

        def stream(cmd: list[str], container_name: str, mode: str) -> int:
            """Run one invocation to completion, printing progress.

            Popen rather than run(): a session works remote catalogs for tens
            of minutes, and a single line at the end cannot tell a run that is
            progressing from one that is wedged. stderr goes to a file because
            a pipe nobody drains fills its buffer and deadlocks the container.
            Both files are opened in the caller's mode so a resumed attempt
            adds to the record of the first rather than erasing it.
            """
            with open(transcript_path, mode, encoding="utf-8") as transcript, \
                    open(errors_path, mode, encoding="utf-8") as errors:
                proc = subprocess.Popen(cmd, stdout=transcript, stderr=errors,
                                        text=True)
                next_beat = time.monotonic() + HEARTBEAT_SECONDS
                try:
                    while proc.poll() is None:
                        time.sleep(POLL_SECONDS)
                        if follower:
                            follower.consume(transcript_path)
                        if time.monotonic() < next_beat:
                            continue
                        next_beat = time.monotonic() + HEARTBEAT_SECONDS
                        turns, last_tool = progress_snapshot(transcript_path)
                        elapsed = (time.monotonic() - started_at) / 60
                        # Counted in the workspace, which is where the session
                        # writes. The results directory only receives them
                        # once the session is over.
                        answered = question_count() - len(
                            missing_answers(workspace))
                        waiting = follower.running_for() if follower else 0.0
                        detail = (f"in {last_tool} {waiting:.0f}s" if waiting
                                  else f"last: {last_tool}")
                        print(
                            f"[{model}/{name}] {elapsed:.0f}m ·"
                            f" {turns} turns · {answered}/{question_count()}"
                            f" answers · {detail}",
                            flush=True,
                        )
                finally:
                    # Ctrl-C kills this process, not the container it started,
                    # and `docker run --rm` only cleans up after a container it
                    # is still attached to exits. Without this the session
                    # keeps running headless, holding the mounted credential
                    # copy open and writing into a transcript nobody reads.
                    stop_session(proc, container_name)
                if follower:
                    follower.consume(transcript_path)
            if proc.returncode != 0:
                print(f"[{model}/{name}] session exited {proc.returncode}",
                      file=sys.stderr)
                print(errors_path.read_text(encoding="utf-8")[-2000:],
                      file=sys.stderr)
            return proc.returncode

        attempts = 0
        returncode = stream(cmd, container, "w")
        while True:
            attempts += 1
            missing = missing_answers(workspace)
            if not missing or attempts >= max_attempts:
                break
            # The session id survives in the mounted home, so the same session
            # can be handed back its own history. Without one there is nothing
            # to resume into, and starting a fresh session would answer the
            # remaining questions without the context that produced the first
            # answers.
            # Resuming is for a session that stopped early with work left. A
            # session that answered nothing at all after a 401 is not that:
            # the CLI already retried the credential ten times, and every
            # further attempt fails the same way. One sweep spent all three
            # proving it, and the arm came back n=1.
            if len(missing) == question_count() and credential_rejected(transcript_path):
                print(f"[{model}/{name}] the credential was rejected and"
                      f" nothing was answered; not resuming. Run `claude"
                      f" login` on the host and start this arm again.",
                      file=sys.stderr)
                break
            resume = session_id(transcript_path)
            if not resume:
                print(f"[{model}/{name}] no session id in the transcript;"
                      f" cannot resume")
                break
            print(f"[{model}/{name}] resuming: {len(missing)} of"
                  f" {question_count()} answers missing"
                  f" (attempt {attempts + 1} of {max_attempts})", flush=True)
            returncode = stream(
                docker_command(workspace, session_home, model_id,
                               f"{container}-{attempts + 1}",
                               resume_prompt(missing), resume),
                f"{container}-{attempts + 1}",
                "a",
            )

        duration = round(time.monotonic() - started_at, 1)

        answers_out = out_dir / "answers"
        if answers_out.exists():
            shutil.rmtree(answers_out)
        shutil.copytree(workspace / "answers", answers_out)

        stats = parse_result_record(transcript_path)
        meta = {
            "model": model,
            "model_id": model_id,
            "run_id": name,
            "label": label,
            "started_utc": started.isoformat(),
            "finished_utc": datetime.now(timezone.utc).isoformat(),
            "duration_seconds": duration,
            "exit_code": returncode,
            "attempts": attempts,
            "harness_commit": harness_commit(),
            "input_mode": input_mode,
            "golden_fingerprint": golden_fingerprint(),
            "spec_fingerprint": spec_digest,
            "spec_manifest": spec_manifest,
            "ablation": arm_spec,
            "catalog_at_start": catalog_before,
            "catalog_at_end": source_coop_sample(),
            **stats,
            **tool_timings(transcript_path),
            "imputed_cost_usd": round(
                imputed_cost_usd(
                    model,
                    stats["input_tokens"],
                    stats["output_tokens"],
                    stats["cache_creation_tokens"],
                    stats["cache_read_tokens"],
                ),
                6,
            ),
        }
        waited = meta["slow_tool_seconds"]
        answered = len(list((out_dir / "answers").glob("q*.csv")))
        verdict = session_verdict(answered)
        meta["answers_written"] = answered
        meta["status"] = verdict.lower().replace(" ", "_")
        (out_dir / "meta.json").write_text(json.dumps(meta, indent=2) + "\n")
        print(
            f"[{model}/{name}] {verdict}:"
            f" {answered}/{question_count()} answers,"
            f" {stats['turns']} turns,"
            f" {duration / 60:.0f}m wall"
            f" ({waited / 60:.0f}m in slow tool calls,"
            f" {meta['timed_out_tool_calls']} timed out),"
            f" ${meta['imputed_cost_usd']:.4f} imputed"
            + (f", {attempts} attempts" if attempts > 1 else "")
        )
        if answered < question_count():
            print(
                f"[{model}/{name}] the session stopped short of the question"
                f" set {attempts} time(s) and was resumed each time; whatever"
                f" it deferred on its last turn is lost"
            )


def run_id(started: datetime, commit: str) -> str:
    """A run's directory name: when it started, and the code it ran.

    This used to be `pass-{n}`, a position in a sequence rather than an
    identity, so two runs could want the same name and the second destroyed
    the first. Every guard around that -- --force, --start-pass, scanning for
    the lowest free number -- existed to manage a collision that a name
    carrying a timestamp cannot have. It sorts chronologically as a string,
    and says when a run happened and what it ran without opening a file.
    """
    return f"{started.strftime('%Y%m%dT%H%M%SZ')}-{commit[:7]}"


def source_coop_sample() -> dict:
    """How fast the catalogs are answering, right now.

    A session's wall clock is mostly waiting on source.coop, whose throughput
    varies by more than an order of magnitude with the network route (see
    source-cooperative/data.source.coop#194). Without a sample beside the run
    there is no way to tell a slow model from a slow route afterwards, and the
    route is gone by the time anyone asks.
    """
    url = json.loads((REPO_ROOT / "fixtures" / "pins.json")
                     .read_text(encoding="utf-8"))["catalogs"]["cadastral"]["car_parquet"]
    request = urllib.request.Request(
        url, headers={"Range": f"bytes=0-{PROBE_BYTES - 1}"})
    started = time.monotonic()
    try:
        with urllib.request.urlopen(request, timeout=PROBE_TIMEOUT) as response:
            payload = response.read()
            colo = (response.headers.get("cf-ray") or "").rsplit("-", 1)[-1]
    except Exception as exc:                       # noqa: BLE001 - never fatal
        return {"ok": False, "error": f"{type(exc).__name__}: {exc}"[:200]}
    elapsed = time.monotonic() - started
    return {
        "ok": len(payload) == PROBE_BYTES,
        "bytes": len(payload),
        "seconds": round(elapsed, 2),
        "bytes_per_second": round(len(payload) / elapsed) if elapsed else None,
        "colo": colo,
    }


def golden_fingerprint() -> str | None:
    """A digest of the golden manifest, so a pass records which answers it was
    graded against. The fixtures are regenerated when the oracle changes, and
    a score compared against a different set of goldens is not comparable."""
    manifest = REPO_ROOT / "fixtures" / "golden" / "SHA256SUMS"
    if not manifest.exists():
        return None
    return hashlib.sha256(manifest.read_bytes()).hexdigest()[:12]


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--model", choices=sorted(PRICES), required=True)
    ap.add_argument("--passes", type=int, default=10)
    ap.add_argument("--label", default="",
                    help="tag these runs so a comparison can select them "
                         "later, e.g. --label experiment-1")
    ap.add_argument("--dry-run", action="store_true",
                    help="print the docker command instead of running")
    ap.add_argument("--follow", action="store_true",
                    help="print each tool call as the session makes it")
    ap.add_argument("--input-mode", choices=sorted(INPUT_FILES), default="csv",
                    help="encoding of the input list; see policies/INPUTS.md")
    ap.add_argument("--max-attempts", type=int, default=MAX_ATTEMPTS,
                    help="how many times a session that stops with questions "
                         "unanswered is resumed (1 disables resuming)")
    ap.add_argument("--arm", default="",
                    help="withhold part of the spec, by arm name from the "
                         "ablations config; default is the whole spec")
    ap.add_argument("--ablations", type=Path, default=ABLATIONS,
                    help="the ablation config to read --arm from")
    args = ap.parse_args()

    for _ in range(args.passes):
        try:
            run_session(args.model, args.dry_run, args.input_mode, args.follow,
                        args.label, max_attempts=args.max_attempts,
                        arm=args.arm, ablations=args.ablations)
        except ablation.AblationError as exc:
            # A mistyped arm is a config problem, not a crash. Say so in one
            # line rather than a traceback, and stop before spending anything.
            print(f"ablation: {exc}", file=sys.stderr)
            return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
