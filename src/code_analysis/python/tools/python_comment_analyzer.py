#!/usr/bin/env python3
"""
Comment Analyzer

This script analyzes a source code file and counts comment lines,
including lines within multi-line comments or strings.
"""

import sys
import json
import os
import re
import tokenize
from io import BytesIO


def analyze_comments(file_path):
    print(json.dumps({"debug": f"Analyzing file: {file_path}"}), file=sys.stderr)

    try:
        with open(file_path, 'r', encoding='utf-8') as file:
            content = file.read()
            print(json.dumps({"debug": f"File loaded, size: {len(content)} bytes"}), file=sys.stderr)
    except Exception as e:
        print(json.dumps({"debug": f"Error reading file: {str(e)}"}), file=sys.stderr)
        return {
            "file": file_path,
            "commentLines": 0,
            "error": str(e)
        }

    _, ext = os.path.splitext(file_path.lower())
    print(json.dumps({"debug": f"File extension: {ext}"}), file=sys.stderr)
    comment_lines = set()

    if ext == '.py':
        comment_lines = analyze_python_comments(file_path, content)
    elif ext in ['.rb', '.rbw']:
        comment_lines = analyze_ruby_comments(content)
    elif ext in ['.r', '.gd', '.pl', '.pm', '.pod', '.t']:
        comment_lines = analyze_hash_comments(content)
    elif ext in ['.js', '.mjs', '.cjs', '.ts', '.jsx', '.tsx', '.c', '.cpp', '.cc', '.cxx', '.h', '.hpp', '.hh', '.hxx', '.cs', '.java', '.sol', '.m', '.mm', '.zig', '.ttcn', '.ttcn3', '.go', '.kt', '.kts', '.php', '.scala', '.sc', '.swift']:
        comment_lines = analyze_c_style_comments(content)
    elif ext == '.vue':
        comment_lines = analyze_vue_comments(content)
    elif ext in ['.f', '.f90', '.f95', '.f03', '.f08']:
        comment_lines = analyze_fortran_comments(content)
    elif ext == '.lua':
        comment_lines = analyze_lua_comments(content)
    elif ext in ['.erl', '.hrl']:
        comment_lines = analyze_erlang_comments(content)
    elif ext == '.st':
        comment_lines = analyze_structured_text_comments(content)
    else:
        print(json.dumps({"debug": f"Extension '{ext}' not supported"}), file=sys.stderr)

    print(json.dumps({"debug": f"Found {len(comment_lines)} comment lines"}), file=sys.stderr)

    return {
        "file": file_path,
        "commentLines": len(comment_lines)
    }


def analyze_python_comments(file_path, content):
    comment_lines = set()

    try:
        with open(file_path, 'rb') as file:
            content_bytes = file.read()

        all_tokens = list(tokenize.tokenize(BytesIO(content_bytes).readline))

        for tok in all_tokens:
            if tok.type == tokenize.COMMENT:
                comment_lines.add(tok.start[0])
            elif tok.type == tokenize.STRING:
                if tok.string.startswith('"""') or tok.string.startswith("'''"):
                    for line_num in range(tok.start[0], tok.end[0] + 1):
                        comment_lines.add(line_num)
    except Exception as e:
        print(json.dumps({"debug": f"Tokenizer failed: {e}, using fallback"}), file=sys.stderr)
        comment_lines = analyze_hash_comments(content)

    return comment_lines


def analyze_c_style_comments(content):
    comment_lines = set()
    string_pattern = re.compile(r'("(\\.|[^"\\])*"|\'(\\.|[^\'\\])*\')')
    content_wo_strings = []
    for line in content.split('\n'):
        content_wo_strings.append(string_pattern.sub('', line))
    content_wo_strings = '\n'.join(content_wo_strings)

    multiline_pattern = re.compile(r'/\*.*?\*/', re.DOTALL)
    for match in multiline_pattern.finditer(content_wo_strings):
        start = content_wo_strings[:match.start()].count('\n') + 1
        lines = match.group(0).split('\n')
        for offset in range(len(lines)):
            comment_lines.add(start + offset)

    content_no_multiline = multiline_pattern.sub(lambda m: '\n' * m.group(0).count('\n'), content_wo_strings)

    for i, line in enumerate(content_no_multiline.split('\n'), 1):
        if re.search(r'//', line):
            comment_lines.add(i)

    return comment_lines


def analyze_hash_comments(content):
    comment_lines = set()
    string_pattern = re.compile(r'("(\\.|[^"\\])*"|\'(\\.|[^\'\\])*\')')
    for i, line in enumerate(content.split('\n'), 1):
        line_wo_strings = string_pattern.sub('', line)
        if re.search(r'#', line_wo_strings):
            comment_lines.add(i)
    return comment_lines


def analyze_fortran_comments(content):
    comment_lines = set()
    string_pattern = re.compile(r'("(\\.|[^"\\])*"|\'(\\.|[^\'\\])*\')')
    for i, line in enumerate(content.split('\n'), 1):
        line_wo_strings = string_pattern.sub('', line)
        if re.search(r'!', line_wo_strings):
            comment_lines.add(i)
    return comment_lines


def analyze_ruby_comments(content):
    comment_lines = set()
    in_multiline = False
    string_pattern = re.compile(r'("(\\.|[^"\\])*"|\'(\\.|[^\'\\])*\')')

    lines = content.split('\n')
    for i, line in enumerate(lines, 1):
        stripped = string_pattern.sub('', line.strip())

        if not stripped:
            continue

        if in_multiline:
            comment_lines.add(i)
            if re.match(r'^\s*=end\b', stripped):
                in_multiline = False
            continue

        if re.match(r'^\s*=begin\b', stripped):
            in_multiline = True
            comment_lines.add(i)
            continue

        if '#' in stripped:
            comment_lines.add(i)

    return comment_lines


def analyze_vue_comments(content):
    comment_lines = set()
    string_pattern = re.compile(r'("(\\.|[^"\\])*"|\'(\\.|[^\'\\])*\')')
    content_wo_strings = []
    for line in content.split('\n'):
        content_wo_strings.append(string_pattern.sub('', line))
    content_wo_strings = '\n'.join(content_wo_strings)

    html_comment_pattern = re.compile(r'<!--.*?-->', re.DOTALL)
    for match in html_comment_pattern.finditer(content_wo_strings):
        start = content_wo_strings[:match.start()].count('\n') + 1
        lines = match.group(0).split('\n')
        for offset in range(len(lines)):
            comment_lines.add(start + offset)

    script_match = re.search(r'<script[^>]*>(.*?)</script>', content, re.DOTALL | re.IGNORECASE)
    if script_match:
        script_start_line = content[:script_match.start(1)].count('\n') + 1
        for local_line in analyze_c_style_comments(script_match.group(1)):
            comment_lines.add(script_start_line + local_line - 1)

    return comment_lines


def analyze_lua_comments(content):
    comment_lines = set()
    lines = content.split('\n')
    in_block_comment = False

    for line_num, line in enumerate(lines, 1):
        stripped = line.strip()

        if '--[[' in line:
            in_block_comment = True
            comment_lines.add(line_num)
            if ']]' in line:
                in_block_comment = False
            continue

        if in_block_comment:
            comment_lines.add(line_num)
            if ']]' in line:
                in_block_comment = False
            continue

        if stripped.startswith('--'):
            comment_lines.add(line_num)

    return comment_lines


def analyze_erlang_comments(content):
    comment_lines = set()
    lines = content.split('\n')

    for line_num, line in enumerate(lines, 1):
        in_string = False
        escape_next = False

        for char in line:
            if escape_next:
                escape_next = False
                continue

            if char == '\\':
                escape_next = True
                continue

            if char == '"' and not in_string:
                in_string = True
            elif char == '"' and in_string:
                in_string = False
            elif char == '%' and not in_string:
                comment_lines.add(line_num)
                break

    return comment_lines


def analyze_structured_text_comments(content):
    comment_lines = set()
    block_patterns = [
        re.compile(r'\(\*.*?\*\)', re.DOTALL),
        re.compile(r'\{.*?\}', re.DOTALL),
    ]

    content_without_blocks = content
    for block_pattern in block_patterns:
        for match in block_pattern.finditer(content_without_blocks):
            start = content_without_blocks[:match.start()].count('\n') + 1
            lines = match.group(0).split('\n')
            for offset in range(len(lines)):
                comment_lines.add(start + offset)
        content_without_blocks = block_pattern.sub(lambda m: '\n' * m.group(0).count('\n'), content_without_blocks)

    for line_num, line in enumerate(content_without_blocks.split('\n'), 1):
        if '//' in line:
            comment_lines.add(line_num)

    return comment_lines


def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No file path provided"}))
        sys.exit(1)

    file_path = sys.argv[1]
    result = analyze_comments(file_path)
    print(json.dumps(result))


if __name__ == "__main__":
    main()
