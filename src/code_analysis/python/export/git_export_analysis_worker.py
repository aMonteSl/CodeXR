#!/usr/bin/env python3
"""
Persistent, line-delimited worker used only by offline Git export.

Node owns scheduling and sends one compact JSON command at a time. Results are
written atomically to private temporary files, so stdout remains a small,
framed control channel even for source files with many functions.
"""

import json
import os
import sys
from pathlib import Path

PYTHON_ROOT = Path(__file__).resolve().parent.parent
UTILS_DIR = PYTHON_ROOT / "utils"
if str(UTILS_DIR) not in sys.path:
    sys.path.insert(0, str(UTILS_DIR))

from file_analysis_engine import build_file_payload, build_file_snapshot
from file_metric_summary import build_file_metric_summary

PROTOCOL_VERSION = 1


def emit(payload):
    print(json.dumps(payload, separators=(",", ":")), flush=True)


def analyze(command):
    job_id = str(command.get("id") or "")
    input_path = str(command.get("inputPath") or "")
    output_path = str(command.get("outputPath") or "")
    target_type = str(command.get("targetType") or "")

    if not job_id or not input_path or not output_path:
        raise ValueError("invalid-worker-command")
    if target_type not in {"file", "directory"}:
        raise ValueError("invalid-worker-target-type")
    if not os.path.isfile(input_path):
        raise ValueError("worker-input-missing")

    snapshot = build_file_snapshot(input_path)
    if target_type == "file":
        result = build_file_payload(input_path, snapshot)
    else:
        result = build_file_metric_summary(
            snapshot,
            input_path,
            os.path.basename(input_path),
        )

    destination = Path(output_path)
    destination.parent.mkdir(parents=True, exist_ok=True)
    temporary = destination.with_name(
        f".{destination.name}.tmp-{os.getpid()}-{job_id}"
    )
    try:
        temporary.write_text(
            json.dumps(result, separators=(",", ":")),
            encoding="utf-8",
        )
        os.replace(temporary, destination)
    finally:
        try:
            temporary.unlink(missing_ok=True)
        except OSError:
            pass


def main():
    emit({"type": "ready", "protocol": PROTOCOL_VERSION, "pid": os.getpid()})
    for raw_line in sys.stdin:
        line = raw_line.strip()
        if not line:
            continue
        command = None
        try:
            command = json.loads(line)
            command_type = command.get("type")
            if command_type == "shutdown":
                emit({"type": "stopped"})
                return
            if command_type != "analyze":
                raise ValueError("unknown-worker-command")
            analyze(command)
            emit({"type": "complete", "id": str(command.get("id") or "")})
        except Exception as error:
            emit(
                {
                    "type": "error",
                    "id": str((command or {}).get("id") or ""),
                    "error": str(error),
                }
            )


if __name__ == "__main__":
    main()
