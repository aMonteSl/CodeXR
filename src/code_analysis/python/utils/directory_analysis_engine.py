#!/usr/bin/env python3
"""
Shared directory-analysis engine used by XR and LivePanel.
"""

import os
from typing import Callable, Dict, Iterable, List, Optional

from directory_scan_utils import filter_explicit_files_for_analysis, get_analyzable_extensions, scan_directory_files_for_analysis
from file_analysis_engine import build_file_snapshot
from file_metric_summary import build_file_metric_summary

ProgressCallback = Callable[[int, int, str], None]


def collect_directory_targets(
    directory_path: str,
    recursive: bool = False,
    filtered_files: Optional[Iterable[str]] = None,
    max_entries_per_directory: int = 1000,
    max_total_files: int = 5000,
) -> List[str]:
    if filtered_files is not None:
        return filter_explicit_files_for_analysis(filtered_files, max_total_files=max_total_files)

    return scan_directory_files_for_analysis(
        directory_path,
        recursive=recursive,
        max_entries_per_directory=max_entries_per_directory,
        max_total_files=max_total_files,
    )


def analyze_directory_entries(
    directory_path: str,
    recursive: bool = False,
    filtered_files: Optional[Iterable[str]] = None,
    progress_callback: Optional[ProgressCallback] = None,
) -> List[Dict[str, object]]:
    files_to_analyze = collect_directory_targets(
        directory_path,
        recursive=recursive,
        filtered_files=filtered_files,
    )

    entries: List[Dict[str, object]] = []
    total_files = len(files_to_analyze)

    for index, file_path in enumerate(files_to_analyze, start=1):
        if progress_callback:
            progress_callback(index, total_files, file_path)

        relative_path = os.path.relpath(file_path, directory_path)
        snapshot = build_file_snapshot(file_path)
        entries.append(build_file_metric_summary(snapshot, file_path, relative_path))

    return entries


def get_directory_metadata(scan_depth: str) -> Dict[str, object]:
    return {
        'analysisType': 'DirectoryCodeAnalysis',
        'scanDepth': scan_depth,
        'includedExtensions': get_analyzable_extensions(),
    }
