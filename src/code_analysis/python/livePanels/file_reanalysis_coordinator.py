#!/usr/bin/env python3
"""
File Re-analysis Coordinator.

Generates canonical per-file summary entries for directory incremental updates.
"""

import json
import os
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional

UTILS_DIR = Path(__file__).resolve().parent.parent / 'utils'
if str(UTILS_DIR) not in sys.path:
    sys.path.insert(0, str(UTILS_DIR))

from babia_path_utils import normalize_output_paths
from file_analysis_engine import build_file_snapshot
from file_metric_summary import build_file_metric_summary


def analyze_file_summary(file_path: str, relative_path: Optional[str] = None) -> Dict[str, Any]:
    snapshot = build_file_snapshot(file_path)
    return normalize_output_paths(build_file_metric_summary(snapshot, file_path, relative_path))


def analyze_multiple_files(file_paths: List[str], relative_paths: Optional[List[str]] = None) -> List[Dict[str, Any]]:
    if relative_paths and len(relative_paths) != len(file_paths):
        raise ValueError('relative_paths length must match file_paths length')

    results: List[Dict[str, Any]] = []
    for index, file_path in enumerate(file_paths):
        relative_path = relative_paths[index] if relative_paths else None
        results.append(analyze_file_summary(file_path, relative_path))

    return results


def main():
    if len(sys.argv) < 2:
        print('Usage: python file_reanalysis_coordinator.py <file_path> [relative_path]', file=sys.stderr)
        print('   or: python file_reanalysis_coordinator.py <file1> <file2> ... [--relative-paths path1 path2 ...]', file=sys.stderr)
        sys.exit(1)

    args = sys.argv[1:]
    relative_paths = None

    if '--relative-paths' in args:
        rel_index = args.index('--relative-paths')
        file_paths = args[:rel_index]
        relative_paths = args[rel_index + 1:]
        if len(relative_paths) != len(file_paths):
            print(json.dumps({'error': 'Number of relative paths must match number of file paths'}), file=sys.stderr)
            sys.exit(1)
    else:
        file_paths = args

    for file_path in file_paths:
        if not os.path.isfile(file_path):
            print(json.dumps({'error': f'File not found: {file_path}'}), file=sys.stderr)
            sys.exit(1)

    try:
        if len(file_paths) == 1 and relative_paths is None:
            result = analyze_file_summary(file_paths[0])
        elif len(file_paths) == 2 and relative_paths is None and not os.path.isfile(file_paths[1]):
            result = analyze_file_summary(file_paths[0], file_paths[1])
        else:
            result = analyze_multiple_files(file_paths, relative_paths)

        print('=== JSON_START ===')
        print(json.dumps(result, indent=2))
        print('=== JSON_END ===')
    except Exception as error:
        print(json.dumps({'error': f'File re-analysis failed: {str(error)}'}), file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()
