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
    # Debug info
    print(json.dumps({"debug": f"Analyzing file: {file_path}"}), file=sys.stderr)
    
    try:
        with open(file_path, 'r', encoding='utf-8') as file:
            content = file.read()
            print(json.dumps({"debug": f"File loaded, size: {len(content)} bytes"}), file=sys.stderr)
            # Print first few lines for debugging
            preview = '\n'.join(content.split('\n')[:5])
            print(json.dumps({"debug": f"Preview: {preview}"}), file=sys.stderr)
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
        # Python comments handling
        try:
            with open(file_path, 'rb') as file:
                content_bytes = file.read()
                
            # Collect all tokens first
            all_tokens = list(tokenize.tokenize(BytesIO(content_bytes).readline))
            
            # Process tokens to find comments and docstrings
            for tok in all_tokens:
                if tok.type == tokenize.COMMENT:
                    comment_lines.add(tok.start[0])
                elif tok.type == tokenize.STRING:
                    # Only count triple-quoted strings
                    if (tok.string.startswith('"""') or tok.string.startswith("'''")):
                        # Add each line of the docstring
                        for line_num in range(tok.start[0], tok.end[0] + 1):
                            comment_lines.add(line_num)
        except Exception as e:
            print(f"Tokenizer failed: {e}, falling back to line scanning")
            # Fall back to line scanning
            in_docstring = False
            for i, line in enumerate(content.split('\n'), 1):
                line = line.strip()
                if not line:
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

    elif ext in ['.rb']:
        # Ruby comments handling
        in_multiline = False
        for i, line in enumerate(content.split('\n'), 1):
            line = line.strip()
            if line.startswith('=begin'):
                in_multiline = True
                comment_lines.add(i)
            elif line.startswith('=end'):
                in_multiline = False
                comment_lines.add(i)
            elif in_multiline or line.startswith('#'):
                comment_lines.add(i)

    elif ext in ['.js', '.ts', '.jsx', '.tsx', '.c', '.cpp', '.cc', '.cxx', '.h', '.hpp', '.cs']:
        # C-style languages comment handling
        in_multiline = False
        for i, line in enumerate(content.split('\n'), 1):
            stripped_line = line.strip()
            
            # Skip empty lines
            if not stripped_line:
                continue
                
            # If we're in a multiline comment already, check for end
            if in_multiline:
                comment_lines.add(i)  # Add current line as part of multi-line comment
                if '*/' in stripped_line:
                    in_multiline = False
                continue
            
            # Check for single-line comment (//)
            comment_pos = stripped_line.find('//')
            if comment_pos >= 0:
                # Basic check to see if // is inside a string
                single_quotes = stripped_line[:comment_pos].count("'") % 2
                double_quotes = stripped_line[:comment_pos].count('"') % 2
                
                if not (single_quotes or double_quotes):
                    comment_lines.add(i)
            
            # Check for multi-line comment start
            comment_pos = stripped_line.find('/*')
            if comment_pos >= 0:
                # Basic check to see if /* is inside a string
                single_quotes = stripped_line[:comment_pos].count("'") % 2
                double_quotes = stripped_line[:comment_pos].count('"') % 2
                
                if not (single_quotes or double_quotes):
                    comment_lines.add(i)
                    in_multiline = True
                    
                    # Check if multi-line comment ends on same line
                    if '*/' in stripped_line[comment_pos+2:]:
                        in_multiline = False

    # Special handling for Vue.js files
    if ext == '.vue':
        # Add HTML comments
        for i, line in enumerate(content.split('\n'), 1):
            stripped_line = line.strip()
            
            # HTML comments
            if '<!--' in stripped_line and '-->' not in stripped_line[:stripped_line.find('<!--')]:
                comment_lines.add(i)
                continue
                
            if '-->' in stripped_line:
                comment_lines.add(i)
                continue
                
            # Look for script and style tags to identify sections
            if '<script' in stripped_line or '<style' in stripped_line:
                comment_lines.add(i)

    # Print debug info before returning
    print(json.dumps({"debug": f"Found {len(comment_lines)} comment lines for {ext} file"}), file=sys.stderr)
    if len(comment_lines) > 0:
        print(json.dumps({"debug": f"Comment lines: {sorted(list(comment_lines))[:10]}..."}), file=sys.stderr)
    
    # Return the total count as the number of unique comment lines
    return {
        "file": file_path,
        "commentLines": len(comment_lines)
    }

def main():
    """Main entry point"""
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No file path provided"}))
        sys.exit(1)

    file_path = sys.argv[1]
    result = analyze_comments(file_path)

    # Output as JSON
    print(json.dumps(result))

if __name__ == "__main__":
    main()