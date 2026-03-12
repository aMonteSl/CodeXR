#!/usr/bin/env python3
"""
Shared path normalization utilities for BabiaXR-facing payloads.
"""

from typing import Any, Iterable, Optional, Set

DEFAULT_BABIA_PATH_KEYS = frozenset({
    "filePath",
    "relativePath",
    "directoryPath",
    "originalFile",
    "file_path",
})


def sanitize_tree_segment(value: Optional[str], fallback: str) -> str:
    """
    Prepare a tree segment so it cannot create accidental hierarchy levels.
    """
    if value is None:
        return fallback

    normalized = str(value).strip()
    if normalized == "":
        return fallback

    return normalized.replace("\\", "_").replace("/", "_")


def build_tree_path(file_name: Optional[str], function_name: Optional[str]) -> str:
    """
    Build a stable BabiaXR tree path for file analyses.
    """
    safe_file_name = sanitize_tree_segment(file_name, "unknown")
    safe_function_name = sanitize_tree_segment(function_name, "unknown")
    return f"{safe_file_name}/{safe_function_name}"


def normalize_path_for_babia(path_str: Optional[str]) -> Optional[str]:
    """
    Normalize file paths to use Unix-style forward slashes and remove drive letters.
    """
    if path_str is None or path_str == "":
        return path_str

    if not isinstance(path_str, str):
        return path_str

    normalized = path_str.replace("\\", "/")

    if len(normalized) >= 2 and normalized[1] == ":" and normalized[0].isalpha():
        normalized = normalized[2:]

    while "//" in normalized:
        normalized = normalized.replace("//", "/")

    return normalized


def normalize_output_paths(payload: Any, path_keys: Optional[Iterable[str]] = None) -> Any:
    """
    Recursively normalize whitelisted path fields in BabiaXR-facing payloads.
    """
    normalized_keys: Set[str] = set(path_keys) if path_keys is not None else set(DEFAULT_BABIA_PATH_KEYS)

    if isinstance(payload, dict):
        normalized_payload = {}
        for key, value in payload.items():
            if key in normalized_keys:
                normalized_payload[key] = normalize_path_for_babia(value)
            else:
                normalized_payload[key] = normalize_output_paths(value, normalized_keys)
        return normalized_payload

    if isinstance(payload, list):
        return [normalize_output_paths(item, normalized_keys) for item in payload]

    return payload
