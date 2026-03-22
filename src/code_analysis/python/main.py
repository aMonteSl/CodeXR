#!/usr/bin/env python3
"""
Main entry point for Python analysis.
"""

import argparse
import json
import os
import sys
from pathlib import Path

UTILS_DIR = Path(__file__).resolve().parent / 'utils'
if str(UTILS_DIR) not in sys.path:
    sys.path.insert(0, str(UTILS_DIR))

from progress_logger import log_debug, log_error, log_info
from xr_field_schema import get_xr_schema

LIVEPANELS_DIR = Path(__file__).resolve().parent / 'livePanels'
XR_DIR = Path(__file__).resolve().parent / 'XR'
HTML_DIR = Path(__file__).resolve().parent / 'html'

for module_dir in (LIVEPANELS_DIR, XR_DIR, HTML_DIR):
    if str(module_dir) not in sys.path:
        sys.path.insert(0, str(module_dir))

from livePanel_directory_analysis_coordinator import analyze_directory_comprehensive
from livePanel_directory_deep_analysis_coordinator import analyze_directory_deep_comprehensive
from livePanel_file_analysis_coordinator import analyze_file_comprehensive
from xr_directory_analysis_coordinator import analyze_directory_xr
from xr_file_analysis_coordinator import analyze_file_for_xr


def main():
    parser = argparse.ArgumentParser(description='Python Analysis Entry Point')
    parser.add_argument('--mode', required=True, choices=['livePanel', 'xr', 'schema'], help='Analysis mode')
    parser.add_argument('--type', required=True, choices=['file', 'directory', 'project'], help='Analysis type')
    parser.add_argument('--target', help='Target path to analyze')
    parser.add_argument('--output', help='Output file path (optional)')
    parser.add_argument('--files', nargs='*', help='Specific files to analyze (directory mode only)')
    parser.add_argument('--deep', action='store_true', help='Enable deep recursive analysis for directories')

    args = parser.parse_args()

    if args.mode != 'schema' and not args.target:
        parser.error('--target is required unless --mode schema is used')

    normalized_type = 'directory' if args.type == 'project' else args.type

    log_info(f'Starting analysis - Mode: {args.mode}, Type: {normalized_type}')
    if args.target:
        log_info(f'Target: {args.target}')

    try:
        if args.mode == 'schema':
            result = execute_schema_request(normalized_type)
        elif args.mode == 'livePanel' and normalized_type == 'file':
            result = analyze_file_comprehensive(args.target)
        elif args.mode == 'livePanel' and normalized_type == 'directory':
            result = analyze_directory_deep_comprehensive(args.target, args.files) if args.deep else analyze_directory_comprehensive(args.target, args.files)
        elif args.mode == 'xr' and normalized_type == 'file':
            result = analyze_file_for_xr(args.target)
        elif args.mode == 'xr' and normalized_type == 'directory':
            result = analyze_directory_xr(args.target, is_deep=args.deep, filtered_files=args.files)
        else:
            raise ValueError(f'Unsupported combination: {args.mode} + {normalized_type}')

        log_info('Analysis completed successfully')
        print('=== JSON_START ===')
        print(json.dumps(result, indent=2))
        print('=== JSON_END ===')
    except Exception as error:
        log_error(f'Error during analysis: {str(error)}')
        print('=== JSON_START ===')
        print(json.dumps({
            'error': True,
            'message': str(error),
            'mode': args.mode,
            'type': normalized_type,
            'target': args.target,
        }, indent=2))
        print('=== JSON_END ===')
        sys.exit(1)


def execute_schema_request(target_type):
    if target_type not in {'file', 'directory'}:
        raise ValueError(f'Unsupported schema type: {target_type}')

    log_debug(f'Returning XR schema metadata for {target_type}...')
    return get_xr_schema(target_type)


if __name__ == '__main__':
    main()
