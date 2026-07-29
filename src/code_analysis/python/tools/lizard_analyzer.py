#!/usr/bin/env python3
"""
Lizard Code Analyzer Wrapper.
"""

import json
import os
import re
import sys
import tempfile
from pathlib import Path
from typing import Any, Callable, Dict, List, Tuple

import lizard

UTILS_DIR = Path(__file__).resolve().parent.parent / 'utils'
if str(UTILS_DIR) not in sys.path:
    sys.path.insert(0, str(UTILS_DIR))

from babia_path_utils import normalize_output_paths


CleanupFn = Callable[[], None]


def _build_lizard_analyzer():
    file_analyzer_cls = getattr(lizard, 'FileAnalyzer', None)
    get_extensions = getattr(lizard, 'get_extensions', None)

    if callable(file_analyzer_cls) and callable(get_extensions):
        try:
            return file_analyzer_cls(get_extensions(['ND']))
        except Exception:
            return getattr(lizard, 'analyze_file')

    return getattr(lizard, 'analyze_file')


FILE_ANALYZER = _build_lizard_analyzer()


def _noop_cleanup() -> None:
    return None


def _prepare_analysis_source(file_path: str) -> Tuple[str, int, CleanupFn]:
    extension = Path(file_path).suffix.lower()
    if extension != '.vue':
        return file_path, 0, _noop_cleanup

    try:
        content = Path(file_path).read_text(encoding='utf-8', errors='ignore')
    except OSError:
        return file_path, 0, _noop_cleanup

    match = re.search(r'<script(?P<attrs>[^>]*)>(?P<body>.*?)</script>', content, re.IGNORECASE | re.DOTALL)
    if not match:
        return file_path, 0, _noop_cleanup

    attrs = match.group('attrs') or ''
    body = match.group('body') or ''
    lang_suffix = '.ts' if re.search(r'lang\s*=\s*["\']ts["\']', attrs, re.IGNORECASE) else '.js'
    line_offset = content[:match.start('body')].count('\n')

    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=lang_suffix, mode='w', encoding='utf-8')
    tmp.write(body)
    tmp.flush()
    tmp.close()

    def _cleanup() -> None:
        try:
            os.unlink(tmp.name)
        except OSError:
            pass

    return tmp.name, line_offset, _cleanup


def _read_source_lines(file_path: str) -> List[str]:
    try:
        return Path(file_path).read_text(encoding='utf-8', errors='ignore').splitlines()
    except OSError:
        return []


def _count_top_level_arguments(argument_text: str) -> int:
    text = (argument_text or '').strip()
    if not text or text.lower() == 'void':
        return 0

    count = 0
    token: List[str] = []
    round_depth = 0
    square_depth = 0
    curly_depth = 0
    angle_depth = 0

    for character in text:
        if character == ',' and not any((round_depth, square_depth, curly_depth, angle_depth)):
            if ''.join(token).strip():
                count += 1
            token = []
            continue

        token.append(character)
        if character == '(':
            round_depth += 1
        elif character == ')' and round_depth > 0:
            round_depth -= 1
        elif character == '[':
            square_depth += 1
        elif character == ']' and square_depth > 0:
            square_depth -= 1
        elif character == '{':
            curly_depth += 1
        elif character == '}' and curly_depth > 0:
            curly_depth -= 1
        elif character == '<':
            angle_depth += 1
        elif character == '>' and angle_depth > 0:
            angle_depth -= 1

    if ''.join(token).strip():
        count += 1

    return count


def _count_parameters_from_parenthesized_signature(signature_text: str) -> int:
    text = signature_text or ''
    match = re.search(r'\((.*)\)', text)
    if not match:
        return 0
    return _count_top_level_arguments(match.group(1))


def _get_signature_excerpt(source_lines: List[str], line_start: int, line_end: int, max_lines: int = 6) -> str:
    if not source_lines or line_start <= 0:
        return ''

    start_index = max(line_start - 1, 0)
    end_index = min(max(line_end, line_start), len(source_lines), start_index + max_lines)
    return '\n'.join(source_lines[start_index:end_index])


def _count_objective_c_parameters(long_name: str, name: str) -> int:
    long_name_matches = re.findall(r':\s*\(', long_name or '')
    if long_name_matches:
        return len(long_name_matches)

    return (name or '').count(':')


def _count_lua_parameters(source_lines: List[str], line_start: int, line_end: int) -> int:
    excerpt = _get_signature_excerpt(source_lines, line_start, line_end)
    match = re.search(r'function\s+[^\(]+\((.*?)\)', excerpt, re.DOTALL)
    if not match:
        return 0
    return _count_top_level_arguments(match.group(1))


def _count_perl_parameters(source_lines: List[str], line_start: int, line_end: int, long_name: str) -> int:
    excerpt = _get_signature_excerpt(source_lines, line_start, line_end)

    unpack_match = re.search(r'my\s*\(\s*(.*?)\s*\)\s*=\s*@_', excerpt, re.DOTALL)
    if unpack_match:
        return _count_top_level_arguments(unpack_match.group(1))

    if long_name:
        return _count_parameters_from_parenthesized_signature(long_name)

    signature_match = re.search(r'sub\s+[A-Za-z0-9_:]+\s*\((.*?)\)', excerpt, re.DOTALL)
    if signature_match:
        return _count_top_level_arguments(signature_match.group(1))

    return 0


def _resolve_parameter_count(func: Any, extension: str, source_lines: List[str]) -> int:
    parameter_count = getattr(func, 'parameter_count', None)
    if parameter_count is None:
        parameter_count = len(getattr(func, 'parameters', []) or [])

    try:
        numeric_parameter_count = int(parameter_count or 0)
    except (TypeError, ValueError):
        numeric_parameter_count = 0

    if numeric_parameter_count > 0:
        return numeric_parameter_count

    line_start = int(getattr(func, 'start_line', 0) or 0)
    line_end = int(getattr(func, 'end_line', line_start) or line_start)
    long_name = str(getattr(func, 'long_name', '') or '')
    function_name = str(getattr(func, 'name', '') or '')

    if extension in {'.m', '.mm'}:
        return _count_objective_c_parameters(long_name, function_name)

    if extension == '.lua':
        return _count_lua_parameters(source_lines, line_start, line_end)

    if extension in {'.pl', '.pm'}:
        return _count_perl_parameters(source_lines, line_start, line_end, long_name)

    return _count_parameters_from_parenthesized_signature(long_name)


def analyze_file(file_path: str) -> Dict[str, Any]:
    if not os.path.exists(file_path):
        return {
            'error': f'File not found: {file_path}',
            'status': 'error',
        }

    analysis_path, line_offset, cleanup = _prepare_analysis_source(file_path)
    source_lines = _read_source_lines(file_path)
    extension = Path(file_path).suffix.lower()

    try:
        analysis = FILE_ANALYZER(analysis_path)
        if analysis is None:
            return {
                'error': f'Lizard could not analyze file: {file_path}',
                'file': {
                    'filePath': file_path,
                    'fileName': os.path.basename(file_path),
                    'nloc': 0,
                    'functionCount': 0,
                },
                'functions': [],
                'metrics': calculate_complexity_metrics([]),
                'status': 'unsupported',
            }

        file_info = {
            'filePath': file_path,
            'fileName': os.path.basename(file_path),
            'nloc': getattr(analysis, 'nloc', 0),
            'functionCount': len(getattr(analysis, 'function_list', []) or []),
        }

        functions = []
        for func in getattr(analysis, 'function_list', []) or []:
            line_start = (getattr(func, 'start_line', 0) or 0) + line_offset
            line_end = (getattr(func, 'end_line', line_start) or line_start) + line_offset
            line_count = getattr(func, 'nloc', 0) or max((line_end - line_start) + 1, 0)
            complexity = getattr(func, 'cyclomatic_complexity', 0) or 0
            parameters = _resolve_parameter_count(func, extension, source_lines)
            max_nesting_depth = int(getattr(func, 'max_nesting_depth', 0) or 0)

            functions.append(
                {
                    'name': getattr(func, 'name', 'unknown') or 'unknown',
                    'longName': getattr(func, 'long_name', '') or getattr(func, 'name', 'unknown') or 'unknown',
                    'lineStart': line_start,
                    'lineEnd': line_end,
                    'lineCount': line_count,
                    'complexity': complexity,
                    'parameters': parameters,
                    'maxNestingDepth': max_nesting_depth,
                    'cyclomaticDensity': round(complexity / max(line_count, 1), 3),
                }
            )

        return {
            'file': file_info,
            'functions': functions,
            'metrics': calculate_complexity_metrics(functions),
            'status': 'success',
        }
    except Exception as error:
        error_msg = str(error).lower()
        if 'unsupported' in error_msg or 'unknown' in error_msg or 'not supported' in error_msg:
            return {
                'error': f'Language not supported by Lizard: {file_path}',
                'file': {
                    'filePath': file_path,
                    'fileName': os.path.basename(file_path),
                    'nloc': 0,
                    'functionCount': 0,
                },
                'functions': [],
                'metrics': calculate_complexity_metrics([]),
                'status': 'unsupported',
            }

        return {
            'error': str(error),
            'status': 'error',
        }
    finally:
        cleanup()


def calculate_complexity_metrics(functions):
    if not functions:
        return {
            'averageComplexity': 0,
            'maxComplexity': 0,
            'functionCount': 0,
            'highComplexityFunctions': 0,
            'criticalComplexityFunctions': 0,
        }

    complexities = [func['complexity'] for func in functions]
    avg_complexity = sum(complexities) / len(complexities)
    return {
        'averageComplexity': round(avg_complexity, 2),
        'maxComplexity': max(complexities),
        'functionCount': len(functions),
        'highComplexityFunctions': sum(1 for complexity in complexities if complexity > 10),
        'criticalComplexityFunctions': sum(1 for complexity in complexities if complexity > 25),
    }


def main():
    if len(sys.argv) < 2:
        print(json.dumps({'error': 'No file path provided', 'status': 'error'}))
        sys.exit(1)

    file_path = sys.argv[1]
    result = normalize_output_paths(analyze_file(file_path))
    print(json.dumps(result))


if __name__ == '__main__':
    main()
