#!/usr/bin/env python3
"""
Shared helpers for file line metrics.
"""

from typing import Dict, List

from xr_field_schema import safe_ratio


def read_text_lines(file_path: str) -> List[str]:
    try:
        with open(file_path, 'r', encoding='utf-8', errors='ignore') as file:
            return file.readlines()
    except Exception:
        return []


def count_total_lines(file_path: str) -> int:
    return len(read_text_lines(file_path))


def count_blank_lines(file_path: str) -> int:
    return sum(1 for line in read_text_lines(file_path) if not line.strip())


def build_line_metrics(file_path: str, comment_lines: int = 0) -> Dict[str, int | float]:
    total_lines = count_total_lines(file_path)
    blank_lines = count_blank_lines(file_path)
    safe_comment_lines = max(int(comment_lines or 0), 0)
    code_lines = max(total_lines - safe_comment_lines - blank_lines, 0)

    return {
        'totalLines': total_lines,
        'codeLines': code_lines,
        'commentLines': safe_comment_lines,
        'blankLines': blank_lines,
        'commentRatio': safe_ratio(safe_comment_lines, total_lines),
        'codeRatio': safe_ratio(code_lines, total_lines),
        'blankRatio': safe_ratio(blank_lines, total_lines),
    }
