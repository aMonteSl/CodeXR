#!/usr/bin/env python3
"""
Shared helpers for directory-based analysis scanning.

This module centralizes the list of analyzable extensions and the directory/file
ignore rules used by directory XR and LivePanel coordinators.
"""

import os
from typing import Iterable, List, Optional, Sequence

from metric_language_contract import get_supported_metric_extensions

ANALYZABLE_EXTENSIONS: List[str] = get_supported_metric_extensions()

EXCLUDED_DIRECTORIES = {
    '.git', '.svn', '.hg', '.bzr',
    'node_modules', 'bower_components', 'jspm_packages',
    'dist', 'build', 'out', 'target', 'bin', 'obj',
    '.next', '.nuxt', '_site',
    '.vscode', '.idea', '.vs', '.settings', '.eclipse',
    '__pycache__', '.pytest_cache', '.mypy_cache', 'site-packages',
    'coverage', '.coverage', '.nyc_output',
    'venv', '.venv', 'env', '.env',
    'tmp', '.tmp', 'temp', 'logs', 'log', 'cache', '.cache',
}


def get_analyzable_extensions() -> List[str]:
    return list(ANALYZABLE_EXTENSIONS)


def should_skip_directory_name(name: str) -> bool:
    if not name or name in {'.', '..'}:
        return True
    if name in EXCLUDED_DIRECTORIES:
        return True
    return name.startswith('.')


def should_skip_file_name(name: str) -> bool:
    return not name or name.startswith('.')


def is_analyzable_file_path(file_path: str, extensions: Optional[Sequence[str]] = None) -> bool:
    current_extensions = set(extensions or ANALYZABLE_EXTENSIONS)
    if not os.path.isfile(file_path):
        return False
    if should_skip_file_name(os.path.basename(file_path)):
        return False
    return os.path.splitext(file_path)[1].lower() in current_extensions


def filter_explicit_files_for_analysis(
    file_paths: Optional[Iterable[str]],
    max_total_files: Optional[int] = None,
) -> List[str]:
    if not file_paths:
        return []

    filtered: List[str] = []
    for file_path in file_paths:
        if is_analyzable_file_path(file_path):
            filtered.append(file_path)
        if max_total_files is not None and len(filtered) >= max_total_files:
            break

    return sorted(filtered)


def scan_directory_files_for_analysis(
    directory_path: str,
    recursive: bool = False,
    max_entries_per_directory: int = 1000,
    max_total_files: Optional[int] = None,
) -> List[str]:
    analyzable_files: List[str] = []
    extensions = set(ANALYZABLE_EXTENSIONS)

    if recursive:
        for root, dirs, files in os.walk(directory_path, topdown=True):
            dirs[:] = [directory for directory in dirs if not should_skip_directory_name(directory)]
            current_files = files[:max_entries_per_directory] if len(files) > max_entries_per_directory else files

            for file_name in current_files:
                if should_skip_file_name(file_name):
                    continue

                full_path = os.path.join(root, file_name)
                if os.path.splitext(file_name)[1].lower() in extensions:
                    analyzable_files.append(full_path)
                    if max_total_files is not None and len(analyzable_files) >= max_total_files:
                        return sorted(analyzable_files)

        return sorted(analyzable_files)

    try:
        entries = os.listdir(directory_path)
    except OSError:
        return []

    if len(entries) > max_entries_per_directory:
        entries = entries[:max_entries_per_directory]

    for entry in entries:
        if should_skip_file_name(entry):
            continue

        full_path = os.path.join(directory_path, entry)
        if os.path.isfile(full_path) and os.path.splitext(entry)[1].lower() in extensions:
            analyzable_files.append(full_path)
            if max_total_files is not None and len(analyzable_files) >= max_total_files:
                break

    return sorted(analyzable_files)
