#!/usr/bin/env python3
"""
HTML Content Extractor

This script extracts HTML content for babia-html visualization.
It's designed to be called from the TypeScript code in the CodeXR extension.

Usage: python html_dom_parser.py <file_path>
"""

import sys
import json
import os
from typing import Dict, Any
from pathlib import Path

UTILS_DIR = Path(__file__).resolve().parent.parent / "utils"
if str(UTILS_DIR) not in sys.path:
    sys.path.insert(0, str(UTILS_DIR))

from babia_path_utils import normalize_output_paths


def extract_html_content(file_path: str) -> Dict[str, Any]:
    """Extract the original HTML document for babia-html visualization."""
    try:
        if not os.path.exists(file_path):
            return {"error": f"File not found: {file_path}"}

        html_content = read_html_file(file_path)
        prepared_html = prepare_html_for_visualization(html_content)

        return {
            "htmlContent": prepared_html,
            "originalFile": file_path,
            "preparedForVisualization": True
        }

    except Exception as e:
        return {"error": f"Error processing HTML file: {str(e)}"}


def read_html_file(file_path: str) -> str:
    """Read an HTML file with a robust UTF-8-first strategy."""
    for encoding in ('utf-8', 'utf-8-sig', 'latin-1'):
        try:
            with open(file_path, 'r', encoding=encoding, errors='strict') as file:
                return file.read()
        except UnicodeDecodeError:
            continue

    with open(file_path, 'r', encoding='utf-8', errors='ignore') as file:
        return file.read()


def prepare_html_for_visualization(html_content: str) -> str:
    """Preserve the full original document for babia-html."""
    normalized = html_content.replace('\r\n', '\n').replace('\r', '\n')
    return normalized.strip()


def emit_json_result(result: Dict[str, Any]) -> None:
    print('=== JSON_START ===')
    print(json.dumps(result, ensure_ascii=False, indent=2))
    print('=== JSON_END ===')


def main():
    """Main entry point"""
    if len(sys.argv) < 2:
        emit_json_result({"error": "No file path provided"})
        sys.exit(1)

    file_path = sys.argv[1]
    result = normalize_output_paths(extract_html_content(file_path))
    emit_json_result(result)

    if result.get('error'):
        sys.exit(1)


if __name__ == "__main__":
    main()
