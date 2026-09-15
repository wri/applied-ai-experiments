"""Measure how a host serves ranged reads, and say which explanations survive.

The benchmark reads GeoParquet over HTTP range requests, so when a session
stalls the first question is whether the host, the network, or the query is at
fault. Answering that by hand invites the mistake this module exists to
prevent: measure one dimension under uncontrolled load, then report a cause.

The probe varies two dimensions, because one is never enough. Range size alone
cannot separate a byte cap from a response deadline. Concurrency alone cannot
separate a per-connection limit from a global one. Run both and most
explanations fall out on their own.

Usage:
    python harness/probe.py                     # the pinned CAR file
    python harness/probe.py --url URL           # any object
    python harness/probe.py --json              # machine-readable

Attach the output to a bug report. It states measurements and which hypotheses
they rule out, and leaves the mechanism to whoever can see the server.
"""

from __future__ import annotations

import argparse
import json
import statistics
import subprocess
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path

MB = 1024 * 1024

# Sizes that straddle the boundary we have seen in practice. 1 MB has always
# returned whole; larger reads have not.
SIZES_MB = (1, 4, 8, 32)
REPEATS = 3
PARALLEL_STREAMS = 8
CONCURRENCY_STEPS = (1, 2, 4, 8, 16, 32)

# A second object in a different bucket. One misbehaving file explains a lot
# less than a pattern that follows the host.
SECOND_URL = (
    "https://data.source.coop/wri-data-lab/trazofields/trazo3-fields/"
    "trazo3_brazil_goias_2024.parquet"
)

# Any host that is not the one under test. A slow reading here means the
# local link is the constraint and nothing else in the report means much.
CONTROL_URL = "https://speed.cloudflare.com/__down?bytes=20000000"

DEFAULT_URL = (
    "https://data.source.coop/tristangruppwri/cadastral/"
    "Brazil_CAR_AREA_IMOVEL.parquet"
)


def fetch_range(url: str, start: int, length: int, timeout: int = 120,
                open_ended: bool = False) -> dict:
    """One ranged GET, timed in three parts.

    A single elapsed number cannot distinguish a host that answers slowly from
    one that answers late, so connect, first byte, and transfer are separated
    here and never summed before reporting.

    `open_ended` asks for `bytes=start-` instead of a closed range. If the two
    forms stop at different places, the server is reacting to the request
    rather than to the transfer.
    """
    header = (f"bytes={start}-" if open_ended
              else f"bytes={start}-{start + length - 1}")
    request = urllib.request.Request(url)
    request.add_header("Range", header)
    began = time.monotonic()
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            first_byte = time.monotonic()
            headers = response.headers
            body = response.read(length) if open_ended else response.read()
            done = time.monotonic()
        return {
            "bytes": len(body),
            "asked": length,
            "range_header": header,
            "ttfb": round(first_byte - began, 3),
            "total": round(done - began, 3),
            "transfer": round(done - first_byte, 3),
            "complete": len(body) == length,
            "edge": {
                "cf_ray": headers.get("cf-ray"),
                "cf_cache_status": headers.get("cf-cache-status"),
                "server": headers.get("server"),
                "content_length": headers.get("content-length"),
                "transfer_encoding": headers.get("transfer-encoding"),
                "content_encoding": headers.get("content-encoding"),
            },
            "error": None,
        }
    except (urllib.error.URLError, TimeoutError, OSError) as exc:
        return {
            "bytes": 0, "asked": length, "range_header": header,
            "ttfb": None, "total": round(time.monotonic() - began, 3),
            "transfer": None, "complete": False, "edge": {},
            "error": str(exc),
        }


def other_load_present() -> list[str]:
    """Benchmark containers competing for the same link.

    A reading taken while a session downloads in parallel measures the
    contention, not the host. This has already produced one wrong diagnosis,
    so the probe says so rather than leaving it to be remembered.
    """
    try:
        running = subprocess.run(
            ["docker", "ps", "--format", "{{.Image}} {{.Names}}"],
            capture_output=True, text=True, timeout=15,
        ).stdout.split("\n")
    except (OSError, subprocess.SubprocessError):
        return []
    return [line for line in running if line.strip()]


def control_reading() -> dict:
    """Throughput to an unrelated host, to place the local link."""
    began = time.monotonic()
    try:
        with urllib.request.urlopen(CONTROL_URL, timeout=60) as response:
            size = len(response.read())
        elapsed = time.monotonic() - began
        return {"bytes": size, "seconds": round(elapsed, 3),
                "bytes_per_second": round(size / elapsed), "error": None}
    except (urllib.error.URLError, TimeoutError, OSError) as exc:
        return {"bytes": 0, "seconds": None,
                "bytes_per_second": None, "error": str(exc)}


def sequential_sweep(url: str) -> list[dict]:
    """Each size, several times, one stream at a time."""
    results = []
    for mb in SIZES_MB:
        for _ in range(REPEATS):
            reading = fetch_range(url, 0, mb * MB)
            reading["size_mb"] = mb
            results.append(reading)
    return results


def parallel_reading(url: str, streams: int = PARALLEL_STREAMS) -> dict:
    """Adjacent 1 MB ranges at once.

    The point is aggregate throughput against the single-stream rate. A host
    limiting every client to a fixed total will show the same number either
    way; one limiting each connection will not.
    """
    began = time.monotonic()
    with ThreadPoolExecutor(max_workers=streams) as pool:
        readings = list(pool.map(
            lambda i: fetch_range(url, i * MB, MB),
            range(streams),
        ))
    elapsed = time.monotonic() - began
    delivered = sum(r["bytes"] for r in readings)
    return {
        "streams": streams,
        "bytes": delivered,
        "seconds": round(elapsed, 3),
        "bytes_per_second": round(delivered / elapsed) if elapsed else 0,
        "all_complete": all(r["complete"] for r in readings),
    }


def concurrency_sweep(url: str) -> list[dict]:
    """Aggregate throughput as streams are added.

    Rising throughput points at a per-connection limit. A plateau points at a
    ceiling shared across connections, which is a different thing from no
    ceiling at all, and only a sweep tells them apart.
    """
    return [parallel_reading(url, streams=n) for n in CONCURRENCY_STEPS]


def range_form_reading(url: str, size_mb: int = 8) -> dict:
    """A closed range against an open-ended one of the same length.

    Different stopping points would mean the server decides on the request it
    was handed. The same point means it stops during the transfer, whatever it
    was asked for.
    """
    return {
        "closed": fetch_range(url, 0, size_mb * MB),
        "open_ended": fetch_range(url, 0, size_mb * MB, open_ended=True),
    }


def repeat_reading(url: str, offset: int = 900 * MB) -> dict:
    """The same range twice, then an untouched one.

    Faster on the second read means something caches. Equal timings mean the
    cost is paid on every request, and 'cold cache' stops being an answer.
    """
    first = fetch_range(url, offset, MB)
    second = fetch_range(url, offset, MB)
    elsewhere = fetch_range(url, offset + 800 * MB, MB)
    return {"first": first, "repeat": second, "untouched": elsewhere}


def truncation_pattern(sweep: list[dict]) -> dict:
    """Where incomplete responses stop, by bytes and by seconds.

    A byte cap holds the size steady while the duration moves with throughput.
    A response deadline does the opposite. Reporting the spread of both is what
    separates them, so both are always reported.
    """
    cut = [r for r in sweep if not r["complete"] and r["error"] is None]
    if not cut:
        return {"truncated": 0}
    sizes = [r["bytes"] for r in cut]
    times = [r["total"] for r in cut]
    return {
        "truncated": len(cut),
        "bytes_median": int(statistics.median(sizes)),
        "bytes_spread": max(sizes) - min(sizes),
        "seconds_median": round(statistics.median(times), 2),
        "seconds_spread": round(max(times) - min(times), 2),
    }


def verdicts(control: dict, sweep: list[dict], parallel: dict,
             repeat: dict) -> list[str]:
    """Which explanations the numbers rule out.

    Each line names a hypothesis and the reading that bears on it. Nothing here
    claims a mechanism: the probe sees one client's view of a server it cannot
    inspect, and a confident cause from that position is how a measurement
    becomes a wrong bug report.
    """
    out = []

    if control["error"] or not control["bytes_per_second"]:
        out.append("INCONCLUSIVE local link: control host unreachable")
        return out
    control_rate = control["bytes_per_second"]

    singles = [r for r in sweep if r["complete"] and r["transfer"]]
    single_rate = (
        statistics.median(r["bytes"] / r["transfer"] for r in singles)
        if singles else 0
    )

    if control_rate < 5 * MB:
        out.append(
            f"LOCAL LINK is slow ({control_rate / MB:.1f} MB/s to control "
            f"host). Nothing below is trustworthy until this is faster."
        )
    else:
        out.append(
            f"RULED OUT local link: control host gives "
            f"{control_rate / MB:.0f} MB/s"
        )

    pattern = truncation_pattern(sweep)
    if not pattern["truncated"]:
        out.append("RULED OUT truncation: every range returned in full")
    else:
        if pattern["seconds_spread"] < pattern["bytes_spread"] / MB:
            out.append(
                f"CONSISTENT WITH a response deadline: cuts cluster at "
                f"{pattern['seconds_median']}s "
                f"(spread {pattern['seconds_spread']}s) while bytes vary by "
                f"{pattern['bytes_spread'] / MB:.1f} MB"
            )
        else:
            out.append(
                f"CONSISTENT WITH a byte cap: cuts cluster at "
                f"{pattern['bytes_median'] / MB:.1f} MB "
                f"(spread {pattern['bytes_spread'] / MB:.1f} MB)"
            )

    if parallel["bytes_per_second"] > 2 * single_rate and single_rate:
        out.append(
            f"RULED OUT a global rate limit: {parallel['streams']} streams "
            f"reach {parallel['bytes_per_second'] / MB:.1f} MB/s against "
            f"{single_rate / MB:.2f} MB/s on one. The limit is per connection."
        )
    elif single_rate:
        out.append(
            f"CONSISTENT WITH a global rate limit: {parallel['streams']} "
            f"streams reach {parallel['bytes_per_second'] / MB:.2f} MB/s, "
            f"about the single-stream {single_rate / MB:.2f} MB/s"
        )

    first, again = repeat["first"]["ttfb"], repeat["repeat"]["ttfb"]
    if first and again:
        if again < first / 2:
            out.append(
                f"CONSISTENT WITH caching: a repeated range answers in "
                f"{again}s against {first}s cold"
            )
        else:
            out.append(
                f"RULED OUT cache warming: a repeated range answers in "
                f"{again}s against {first}s cold, no better"
            )
    return out


def concurrency_verdict(steps: list[dict]) -> str:
    """Whether adding streams keeps paying."""
    usable = [s for s in steps if s["bytes_per_second"]]
    if len(usable) < 2:
        return "INCONCLUSIVE concurrency: too few readings"
    best = max(usable, key=lambda s: s["bytes_per_second"])
    one = usable[0]["bytes_per_second"]
    if best["bytes_per_second"] < 2 * one:
        return (
            f"CONSISTENT WITH a shared ceiling: {best['streams']} streams "
            f"reach {best['bytes_per_second'] / MB:.2f} MB/s against "
            f"{one / MB:.2f} MB/s on one"
        )
    return (
        f"RULED OUT a shared ceiling below "
        f"{best['bytes_per_second'] / MB:.1f} MB/s: throughput scales to "
        f"{best['streams']} streams"
    )


def range_form_verdict(forms: dict) -> str:
    closed, opened = forms["closed"], forms["open_ended"]
    if closed["complete"] and opened["complete"]:
        return "RULED OUT range syntax: both forms returned in full"
    drift = abs(closed["bytes"] - opened["bytes"])
    if drift < MB // 2:
        return (
            f"RULED OUT range syntax: closed and open-ended stop within "
            f"{drift / MB:.2f} MB of each other, so the cut happens during "
            f"transfer"
        )
    return (
        f"CONSISTENT WITH request-shape handling: closed stops at "
        f"{closed['bytes'] / MB:.2f} MB, open-ended at "
        f"{opened['bytes'] / MB:.2f} MB"
    )


def second_object_verdict(here: dict, there: dict) -> str:
    if here["truncated"] and there["truncated"]:
        return (
            "RULED OUT a single bad object: both objects truncate, in "
            "different buckets"
        )
    if here["truncated"] and not there["truncated"]:
        return (
            "CONSISTENT WITH an object-specific fault: only the first "
            "object truncates"
        )
    return "RULED OUT truncation on both objects"


def run(url: str, quick: bool = False) -> dict:
    contention = other_load_present()
    control = control_reading()
    sweep = sequential_sweep(url)
    parallel = parallel_reading(url)
    repeat = repeat_reading(url)
    forms = range_form_reading(url)

    lines = verdicts(control, sweep, parallel, repeat)
    lines.append(range_form_verdict(forms))

    steps: list[dict] = []
    second: list[dict] = []
    if not quick:
        steps = concurrency_sweep(url)
        lines.append(concurrency_verdict(steps))
        second = sequential_sweep(SECOND_URL)
        lines.append(second_object_verdict(
            truncation_pattern(sweep), truncation_pattern(second)))

    if contention:
        lines.insert(0, (
            f"WARNING {len(contention)} container(s) running; readings may "
            f"measure contention for the link rather than the host"
        ))
    return {
        "url": url,
        "measured_utc": datetime.now(timezone.utc).isoformat(),
        "other_load": contention,
        "control": control,
        "sequential": sweep,
        "parallel": parallel,
        "concurrency": steps,
        "range_forms": forms,
        "second_object": {"url": SECOND_URL,
                          "truncation": truncation_pattern(second)},
        "repeat": repeat,
        "truncation": truncation_pattern(sweep),
        "verdicts": lines,
    }


def render(report: dict) -> str:
    lines = [f"target: {report['url']}",
             f"measured: {report['measured_utc']}", ""]
    control = report["control"]
    if control["bytes_per_second"]:
        lines.append(
            f"control host: {control['bytes_per_second'] / MB:.0f} MB/s"
        )
    edges = [r["edge"] for r in report["sequential"] if r.get("edge")]
    if edges and edges[0].get("cf_ray"):
        lines.append(
            f"edge: {edges[0]['cf_ray']} "
            f"cache={edges[0].get('cf_cache_status')} "
            f"server={edges[0].get('server')}"
        )
    lines += ["", "single stream, by range size:",
              "  asked   returned      ttfb  transfer  complete"]
    for r in report["sequential"]:
        lines.append(
            f"  {r['size_mb']:3d} MB  {r['bytes'] / MB:7.2f} MB"
            f"  {r['ttfb'] or 0:6.2f}s  {r['transfer'] or 0:7.2f}s"
            f"  {'yes' if r['complete'] else 'NO'}"
        )
    par = report["parallel"]
    lines += ["", f"{par['streams']} parallel streams of 1 MB:",
              f"  {par['bytes'] / MB:.1f} MB in {par['seconds']}s"
              f" = {par['bytes_per_second'] / MB:.2f} MB/s aggregate,"
              f" all complete: {'yes' if par['all_complete'] else 'NO'}"]
    if report["concurrency"]:
        lines += ["", "aggregate throughput by stream count:"]
        for step in report["concurrency"]:
            lines.append(
                f"  {step['streams']:2d} streams:"
                f" {step['bytes_per_second'] / MB:6.2f} MB/s"
                f"  all complete: {'yes' if step['all_complete'] else 'NO'}"
            )
    forms = report["range_forms"]
    lines += ["", "closed range against open-ended:"]
    for label in ("closed", "open_ended"):
        r = forms[label]
        lines.append(
            f"  {label:>10}: {r['bytes'] / MB:6.2f} MB in {r['total']}s"
            f"  ({r['range_header']})"
        )
    rep = report["repeat"]
    lines += ["", "same range twice, then an untouched one:"]
    for label in ("first", "repeat", "untouched"):
        r = rep[label]
        lines.append(f"  {label:>9}: ttfb {r['ttfb']}s  total {r['total']}s")
    lines += ["", "what the readings rule out:"]
    lines += [f"  - {v}" for v in report["verdicts"]]
    lines += ["", "not answerable from one client on one network:",
              "  - is this IP or ASN limited? rerun from another network",
              "  - is the path to the origin the cost? rerun from us-west-2",
              "  - do signed requests behave differently? rerun after "
              "`source-coop-cli` login",
              "  - does HTTP/2 matter? compare curl --http1.1 with --http2"]
    return "\n".join(lines)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--url", default=DEFAULT_URL)
    ap.add_argument("--json", action="store_true")
    ap.add_argument("--quick", action="store_true",
                    help="skip the concurrency sweep and second object")
    ap.add_argument("--out", type=Path, help="also write the report here")
    args = ap.parse_args()

    report = run(args.url, quick=args.quick)
    text = json.dumps(report, indent=2) if args.json else render(report)
    print(text)
    if args.out:
        args.out.write_text(text + "\n", encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
