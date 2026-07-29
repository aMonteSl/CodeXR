#!/usr/bin/env python3
"""
Shared helpers to turn file-analysis snapshots into directory/file summary metrics.
"""

import os
from typing import Any, Dict

from metric_language_contract import get_metric_language


def build_file_metric_summary(file_analysis: Dict[str, Any], file_path: str, relative_path: str = None) -> Dict[str, Any]:
    return {
        'fileName': os.path.basename(file_path),
        'filePath': file_path,
        'relativePath': relative_path if relative_path is not None else os.path.basename(file_path),
        'language': file_analysis.get('language', get_metric_language(file_path)),
        'timestamp': file_analysis.get('timestamp'),
        'modifiedAtMs': file_analysis.get('modifiedAtMs'),
        'modifiedAtIso': file_analysis.get('modifiedAtIso'),
        'status': file_analysis.get('status', 'success'),
        'totalLines': file_analysis.get('totalLines', 0),
        'codeLines': file_analysis.get('codeLines', 0),
        'commentLines': file_analysis.get('commentLines', 0),
        'blankLines': file_analysis.get('blankLines', 0),
        'commentRatio': file_analysis.get('commentRatio', 0.0),
        'codeRatio': file_analysis.get('codeRatio', 0.0),
        'blankRatio': file_analysis.get('blankRatio', 0.0),
        'classCount': file_analysis.get('classCount', 0),
        'functionCount': file_analysis.get('functionCount', 0),
        'maxComplexity': file_analysis.get('maxComplexity', 0),
        'cyclomaticComplexityNumber': file_analysis.get('cyclomaticComplexityNumber', 0.0),
        'cyclomaticComplexityDensity': file_analysis.get('cyclomaticComplexityDensity', 0.0),
        'highComplexityFunctions': file_analysis.get('highComplexityFunctions', 0),
        'criticalComplexityFunctions': file_analysis.get('criticalComplexityFunctions', 0),
        'averageFunctionParameters': file_analysis.get('averageFunctionParameters', 0.0),
        'maxFunctionParameters': file_analysis.get('maxFunctionParameters', 0),
        'averageFunctionLines': file_analysis.get('averageFunctionLines', 0.0),
        'maxFunctionLines': file_analysis.get('maxFunctionLines', 0),
        'averageFunctionNestingDepth': file_analysis.get('averageFunctionNestingDepth', 0.0),
        'maxFunctionNestingDepth': file_analysis.get('maxFunctionNestingDepth', 0),
        'fileSizeBytes': file_analysis.get('fileSizeBytes', get_file_size(file_path)),
    }


def get_file_size(file_path: str) -> int:
    try:
        return os.path.getsize(file_path)
    except Exception:
        return 0
