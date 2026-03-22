#!/usr/bin/env python3
"""
Canonical language contract for the Python analysis engine.

The source of truth must match the languages currently shown in Files by
Language. HTML remains DOM-only and is intentionally excluded from the metric
analysis contract.
"""

from pathlib import Path
from typing import Dict, Iterable, List, Tuple


_LANGUAGE_SPECS: List[Tuple[str, List[str]]] = [
    ("Python", [".py", ".pyw", ".pyi"]),
    ("Ruby", [".rb", ".rbw"]),
    ("Java", [".java"]),
    ("C", [".c", ".h"]),
    ("C++", [".cpp", ".cxx", ".cc", ".hpp", ".hxx"]),
    ("C#", [".cs"]),
    ("Erlang", [".erl", ".hrl"]),
    ("Fortran", [".f90", ".f95", ".f03", ".f08", ".f"]),
    ("GDScript", [".gd"]),
    ("Go", [".go"]),
    ("JavaScript", [".js", ".mjs", ".cjs"]),
    ("Kotlin", [".kt", ".kts"]),
    ("Lua", [".lua"]),
    ("Objective-C", [".m", ".mm"]),
    ("PHP", [".php", ".phtml", ".php3", ".php4", ".php5"]),
    ("Perl", [".pl", ".pm"]),
    ("Scala", [".scala", ".sc"]),
    ("Solidity", [".sol"]),
    ("Swift", [".swift"]),
    ("TypeScript", [".ts", ".tsx"]),
    ("TTCN-3", [".ttcn", ".ttcn3"]),
    ("Vue", [".vue"]),
    ("Zig", [".zig"]),
]

DOM_ONLY_LANGUAGE_EXTENSION_MAP: Dict[str, List[str]] = {
    "HTML": [".html", ".htm", ".xhtml"],
}

LANGUAGE_EXTENSION_MAP: Dict[str, List[str]] = {
    language: list(extensions)
    for language, extensions in _LANGUAGE_SPECS
}

EXTENSION_LANGUAGE_MAP: Dict[str, str] = {}
for language, extensions in _LANGUAGE_SPECS:
    for extension in extensions:
        EXTENSION_LANGUAGE_MAP[extension] = language

SUPPORTED_METRIC_EXTENSIONS: List[str] = sorted(EXTENSION_LANGUAGE_MAP.keys())


def get_metric_language(file_path: str, default: str = "Unknown") -> str:
    return EXTENSION_LANGUAGE_MAP.get(Path(file_path).suffix.lower(), default)


def get_supported_metric_extensions() -> List[str]:
    return list(SUPPORTED_METRIC_EXTENSIONS)


def get_metric_language_contract() -> Dict[str, List[str]]:
    return {
        language: list(extensions)
        for language, extensions in LANGUAGE_EXTENSION_MAP.items()
    }


def get_metric_language_names() -> List[str]:
    return list(LANGUAGE_EXTENSION_MAP.keys())


def get_dom_only_language_contract() -> Dict[str, List[str]]:
    return {
        language: list(extensions)
        for language, extensions in DOM_ONLY_LANGUAGE_EXTENSION_MAP.items()
    }


def is_metric_extension(extension: str) -> bool:
    return extension.lower() in EXTENSION_LANGUAGE_MAP


def iter_metric_extensions() -> Iterable[str]:
    return iter(SUPPORTED_METRIC_EXTENSIONS)
