#!/usr/bin/env python3
"""
XR Directory Analysis Coordinator.
"""

import json
import os
import sys
from pathlib import Path

UTILS_DIR = Path(__file__).resolve().parent.parent / 'utils'
if str(UTILS_DIR) not in sys.path:
    sys.path.insert(0, str(UTILS_DIR))

from babia_path_utils import normalize_output_paths
from directory_analysis_engine import analyze_directory_entries


def _emit_progress(current: int, total: int, file_path: str) -> None:
    percentage = int((current / total) * 100) if total > 0 else 0
    file_name = os.path.basename(file_path)
    print(json.dumps({'progress': {'current': current, 'total': total, 'percentage': percentage, 'fileName': file_name, 'message': f'Analyzing {file_name}... ({current}/{total})'}}), file=sys.stderr)


def analyze_directory_xr(directory_path, is_deep=False, filtered_files=None):
    print(json.dumps({'debug': f'XR_DIRECTORY_ANALYSIS: Starting XR analysis for {directory_path} (deep={is_deep})'}), file=sys.stderr)
    entries = analyze_directory_entries(
        directory_path,
        recursive=is_deep,
        filtered_files=filtered_files,
        progress_callback=_emit_progress,
    )
    print(json.dumps({'debug': f'XR_DIRECTORY_ANALYSIS: Generated {len(entries)} file records'}), file=sys.stderr)
    return normalize_output_paths(entries)


def main(filtered_files=None):
    if len(sys.argv) < 2:
        print(json.dumps({'error': 'Usage: python xr_directory_analysis_coordinator.py <directory_path> [--deep]'}), file=sys.stderr)
        sys.exit(1)

    directory_path = sys.argv[1]
    is_deep = '--deep' in sys.argv[2:]

    if filtered_files is None and not os.path.isdir(directory_path):
        print(json.dumps({'error': f'Directory not found or not a directory: {directory_path}'}), file=sys.stderr)
        sys.exit(1)

    result = analyze_directory_xr(directory_path, is_deep=is_deep, filtered_files=filtered_files)
    print(json.dumps(result, indent=2))


if __name__ == '__main__':
    main()
