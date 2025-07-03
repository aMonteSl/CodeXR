#!/usr/bin/env python3
"""
Comment Analyzer

This script analyzes a source code file and counts comment lines,
including lines within multi-line comments or strings.

Usage: python comment_analyzer.py <file_path>
"""

import sys
import json
import os
import re
import tokenize
from io import BytesIO

def analyze_comments(file_path):
    """
    Analyzes comments in a source code file
    
    Args:
        file_path (str): Path to the file to analyze
        
    Returns:
        dict: Analysis result with comment count
    """
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
    
    # Handle different comment styles based on language
    if ext == '.py':
        comment_lines = analyze_python_comments(file_path, content)
    elif ext in ['.rb']:
        comment_lines = analyze_ruby_comments(content)
    elif ext in ['.js', '.ts', '.jsx', '.tsx', '.c', '.cpp', '.cc', '.cxx', '.h', '.hpp', '.cs', '.java', '.sol', '.m', '.zig', '.ttcn', '.ttcn3']:
        comment_lines = analyze_c_style_comments(content)
    elif ext == '.vue':
        comment_lines = analyze_vue_comments(content)
    elif ext in ['.f90', '.f95', '.f03', '.f08']:  # Fortran
        comment_lines = analyze_fortran_comments(content)
    elif ext in ['.gd']:  # GDScript
        comment_lines = analyze_hash_comments(content)
    else:
        print(json.dumps({"debug": f"Extension '{ext}' not supported"}), file=sys.stderr)

    print(json.dumps({"debug": f"Found {len(comment_lines)} comment lines"}), file=sys.stderr)
    
    return {
        "file": file_path,
        "commentLines": len(comment_lines)
    }

def analyze_python_comments(file_path, content):
    """
    Analyzes Python comments using tokenizer (most accurate)
    
    Args:
        file_path (str): Path to the Python file
        content (str): File content
        
    Returns:
        set: Set of line numbers containing comments
    """
    comment_lines = set()
    
    try:
        with open(file_path, 'rb') as file:
            content_bytes = file.read()
            
        # Use Python's tokenizer for accurate comment detection
        all_tokens = list(tokenize.tokenize(BytesIO(content_bytes).readline))
        
        for tok in all_tokens:
            if tok.type == tokenize.COMMENT:
                comment_lines.add(tok.start[0])
            elif tok.type == tokenize.STRING:
                # Only count triple-quoted strings (docstrings)
                if (tok.string.startswith('"""') or tok.string.startswith("'''")):
                    for line_num in range(tok.start[0], tok.end[0] + 1):
                        comment_lines.add(line_num)
                        
    except Exception as e:
        print(json.dumps({"debug": f"Tokenizer failed: {e}, using fallback"}), file=sys.stderr)
        # Fallback to simple line scanning
        comment_lines = analyze_hash_comments(content)
    
    return comment_lines

def analyze_c_style_comments(content):
    """
    Analyzes C-style comments (//, /* ... */) using regex.
    Supports: Java, JavaScript, C/C++, C#, Solidity, Objective-C, Zig, TTCN-3, etc.
    """
    comment_lines = set()
    # Remove string literals to avoid false positives
    string_pattern = re.compile(r'(\"(\\.|[^"\\])*\"|\'(\\.|[^\'\\])*\')')
    content_wo_strings = []
    for line in content.split('\n'):
        content_wo_strings.append(string_pattern.sub('', line))
    content_wo_strings = '\n'.join(content_wo_strings)

    # Find all multiline comments
    multiline_pattern = re.compile(r'/\*.*?\*/', re.DOTALL)
    for match in multiline_pattern.finditer(content_wo_strings):
        start = content_wo_strings[:match.start()].count('\n') + 1
        lines = match.group(0).split('\n')
        for offset in range(len(lines)):
            comment_lines.add(start + offset)

    # Remove multiline comments to avoid double-counting single-line markers inside them
    content_no_multiline = multiline_pattern.sub(lambda m: '\n' * m.group(0).count('\n'), content_wo_strings)

    # Find all single-line comments
    for i, line in enumerate(content_no_multiline.split('\n'), 1):
        if re.search(r'//', line):
            comment_lines.add(i)

    return comment_lines

def analyze_hash_comments(content):
    """
    Analyzes hash-style comments (single line with #)
    Used for GDScript and fallback for Python
    """
    comment_lines = set()
    string_pattern = re.compile(r'(\"(\\.|[^"\\])*\"|\'(\\.|[^\'\\])*\')')
    for i, line in enumerate(content.split('\n'), 1):
        line_wo_strings = string_pattern.sub('', line)
        if re.search(r'#', line_wo_strings):
            comment_lines.add(i)
    return comment_lines

def analyze_fortran_comments(content):
    """
    Analyzes Fortran comments (single line with !)
    """
    comment_lines = set()
    string_pattern = re.compile(r'(\"(\\.|[^"\\])*\"|\'(\\.|[^\'\\])*\')')
    for i, line in enumerate(content.split('\n'), 1):
        line_wo_strings = string_pattern.sub('', line)
        if re.search(r'!', line_wo_strings):
            comment_lines.add(i)
    return comment_lines

def analyze_ruby_comments(content):
    """
    Analyzes Ruby comments:
    - Single-line comments: '#'
    - Multiline comments: =begin to =end
    Ignores comment markers inside strings.
    """
    comment_lines = set()
    in_multiline = False
    string_pattern = re.compile(r'(\"(\\.|[^"\\])*\"|\'(\\.|[^\'\\])*\')')

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
    """
    Analyzes Vue.js comments (HTML-style <!-- ... -->)
    """
    comment_lines = set()
    # Remove string literals to avoid false positives
    string_pattern = re.compile(r'(\"(\\.|[^"\\])*\"|\'(\\.|[^\'\\])*\')')
    content_wo_strings = []
    for line in content.split('\n'):
        content_wo_strings.append(string_pattern.sub('', line))
    content_wo_strings = '\n'.join(content_wo_strings)

    # Find all HTML comments
    html_comment_pattern = re.compile(r'<!--.*?-->', re.DOTALL)
    for match in html_comment_pattern.finditer(content_wo_strings):
        start = content_wo_strings[:match.start()].count('\n') + 1
        lines = match.group(0).split('\n')
        for offset in range(len(lines)):
            comment_lines.add(start + offset)
    return comment_lines

def main():
    """Main entry point"""
    if len(sys.argv) < 2:
        error_msg = {"error": "No file path provided"}
        print(json.dumps(error_msg))
        sys.exit(1)

    file_path = sys.argv[1]
    result = analyze_comments(file_path)

    # Output as JSON
    print(json.dumps(result))

if __name__ == "__main__":
    main()