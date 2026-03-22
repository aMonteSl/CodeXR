#!/usr/bin/env python3
"""
XR File Analysis Coordinator.
"""

import json
import os
import sys
from pathlib import Path

UTILS_DIR = Path(__file__).resolve().parent.parent / 'utils'
if str(UTILS_DIR) not in sys.path:
    sys.path.insert(0, str(UTILS_DIR))

from file_analysis_engine import build_file_payload, build_file_snapshot


def analyze_file_for_xr(file_path):
    print(json.dumps({'debug': f'XR_ANALYSIS: Starting XR analysis for {file_path}'}), file=sys.stderr)
    snapshot = build_file_snapshot(file_path)
    payload = build_file_payload(file_path, snapshot)
    print(json.dumps({'debug': f'XR_ANALYSIS: Generated {len(payload)} XR function records'}), file=sys.stderr)
    return payload


def main():
    if len(sys.argv) != 2:
        print('Usage: python xr_file_analysis_coordinator.py <file_path>', file=sys.stderr)
        sys.exit(1)

    file_path = sys.argv[1]
    if not os.path.isfile(file_path):
        print(json.dumps({'error': f'File not found: {file_path}'}), file=sys.stderr)
        sys.exit(1)

    try:
        xr_data = analyze_file_for_xr(file_path)
        print(json.dumps(xr_data, indent=2))
    except Exception as error:
        print(json.dumps({'error': f'XR analysis failed: {str(error)}'}), file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()
