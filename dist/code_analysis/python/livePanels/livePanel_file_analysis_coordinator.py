#!/usr/bin/env python3
"""
File Analysis Coordinator.

Produces the canonical shared file payload used by both XR and LivePanel.
"""

import json
import os
import sys
from pathlib import Path

UTILS_DIR = Path(__file__).resolve().parent.parent / 'utils'
if str(UTILS_DIR) not in sys.path:
    sys.path.insert(0, str(UTILS_DIR))

from file_analysis_engine import build_file_payload, build_file_snapshot
from file_metric_summary import build_file_metric_summary


def analyze_file_comprehensive(file_path, resume_only=False):
    print(json.dumps({'debug': f'ANALYSIS_FILE_STATS: Starting analysis for {file_path} (resume_only={resume_only})'}), file=sys.stderr)
    snapshot = build_file_snapshot(file_path)

    if resume_only:
        print(json.dumps({'debug': 'ANALYSIS_FILE_STATS: Returning directory-summary shape for watcher update'}), file=sys.stderr)
        return build_file_metric_summary(snapshot, file_path)

    payload = build_file_payload(file_path, snapshot)
    print(json.dumps({'debug': f'ANALYSIS_FILE_STATS: Generated {len(payload)} function records'}), file=sys.stderr)
    return payload


def main():
    import argparse

    if len(sys.argv) == 2 and not sys.argv[1].startswith('-'):
        file_path = sys.argv[1]
        resume_only = False
    else:
        parser = argparse.ArgumentParser(description='File Analysis Coordinator')
        parser.add_argument('file_path', help='Path to the file to analyze')
        parser.add_argument('-r', '--resume', action='store_true', help='Generate directory-summary format for watcher updates')
        args = parser.parse_args()
        file_path = args.file_path
        resume_only = args.resume

    if file_path.startswith('/file:'):
        file_path = file_path.replace('/file:', '')
        while file_path.startswith('//'):
            file_path = file_path[1:]

    if not os.path.exists(file_path):
        print(json.dumps({'error': f'File not found: {file_path}', 'status': 'error'}))
        sys.exit(1)

    result = analyze_file_comprehensive(file_path, resume_only)
    print(json.dumps(result, indent=2))


if __name__ == '__main__':
    main()
