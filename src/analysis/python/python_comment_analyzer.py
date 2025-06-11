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
    elif ext in ['.js', '.ts', '.jsx', '.tsx', '.c', '.cpp', '.cc', '.cxx', '.h', '.hpp', '.cs', '.java']:
        comment_lines = analyze_c_style_comments(content, ext)
    elif ext == '.vue':
        comment_lines = analyze_vue_comments(content)
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
        comment_lines = analyze_python_comments_fallback(content)
    
    return comment_lines

def analyze_python_comments_fallback(content):
    """
    Fallback Python comment analysis using line scanning
    
    Args:
        content (str): File content
        
    Returns:
        set: Set of line numbers containing comments
    """
    comment_lines = set()
    in_docstring = False
    
    for i, line in enumerate(content.split('\n'), 1):
        stripped_line = line.strip()
        if not stripped_line:
            continue
        
        if '#' in line and not in_docstring:
            comment_lines.add(i)
            continue
        
        if '"""' in line or "'''" in line:
            comment_lines.add(i)
            # Toggle docstring mode
            tripledouble = line.count('"""')
            triplesingle = line.count("'''")
            if tripledouble % 2 == 1 or triplesingle % 2 == 1:
                in_docstring = not in_docstring
            continue
        
        if in_docstring:
            comment_lines.add(i)
    
    return comment_lines

def analyze_ruby_comments(content):
    """
    Analyzes Ruby comments
    
    Args:
        content (str): File content
        
    Returns:
        set: Set of line numbers containing comments
    """
    comment_lines = set()
    in_multiline = False
    
    for i, line in enumerate(content.split('\n'), 1):
        stripped_line = line.strip()
        
        if stripped_line.startswith('=begin'):
            in_multiline = True
            comment_lines.add(i)
        elif stripped_line.startswith('=end'):
            in_multiline = False
            comment_lines.add(i)
        elif in_multiline or stripped_line.startswith('#'):
            comment_lines.add(i)
    
    return comment_lines

def analyze_c_style_comments(content, ext):
    """
    Analyzes C-style comments (includes Java, JavaScript, C/C++, C#)
    
    Args:
        content (str): File content
        ext (str): File extension
        
    Returns:
        set: Set of line numbers containing comments
    """
    print(json.dumps({"debug": f"Processing C-style comments for {ext}"}), file=sys.stderr)
    
    comment_lines = set()
    in_multiline = False
    
    lines = content.split('\n')
    
    for i, line in enumerate(lines, 1):
        stripped_line = line.strip()
        
        # Count empty lines inside multiline comments
        if not stripped_line:
            if in_multiline:
                comment_lines.add(i)
            continue
            
        # If we're in a multiline comment, check for end
        if in_multiline:
            comment_lines.add(i)
            if '*/' in stripped_line:
                in_multiline = False
            continue
        
        # Check for single-line comment (//)
        if find_comment_outside_strings(stripped_line, '//'):
            comment_lines.add(i)
        
        # Check for multi-line comment start (/* or /**)
        multiline_pos = find_comment_outside_strings(stripped_line, '/*')
        if multiline_pos >= 0:
            comment_lines.add(i)
            in_multiline = True
            
            # Check if multi-line comment ends on same line
            end_pos = stripped_line.find('*/', multiline_pos + 2)
            if end_pos >= 0:
                in_multiline = False
    
    return comment_lines

def find_comment_outside_strings(line, comment_marker):
    """
    Finds comment markers that are not inside string literals
    
    Args:
        line (str): Line to search
        comment_marker (str): Comment marker to find ('//', '/*')
        
    Returns:
        int: Position of comment marker, or -1 if not found outside strings
    """
    in_string = False
    in_char = False
    escaped = False
    
    for i, char in enumerate(line):
        if escaped:
            escaped = False
            continue
            
        if char == '\\':
            escaped = True
            continue
            
        if char == '"' and not in_char:
            in_string = not in_string
        elif char == "'" and not in_string:
            in_char = not in_char
        elif not in_string and not in_char:
            if line[i:i+len(comment_marker)] == comment_marker:
                return i
    
    return -1

def analyze_vue_comments(content):
    """
    Analyzes Vue.js comments (HTML-style comments)
    
    Args:
        content (str): File content
        
    Returns:
        set: Set of line numbers containing comments
    """
    comment_lines = set()
    in_html_comment = False
    
    for i, line in enumerate(content.split('\n'), 1):
        stripped_line = line.strip()
        
        # Check for HTML comment start
        if '<!--' in stripped_line and not in_html_comment:
            comment_lines.add(i)
            in_html_comment = True
            # Check if comment ends on same line
            if '-->' in stripped_line[stripped_line.find('<!--')+4:]:
                in_html_comment = False
            continue
            
        # If in HTML comment, add line and check for end
        if in_html_comment:
            comment_lines.add(i)
            if '-->' in stripped_line:
                in_html_comment = False
            continue
    
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