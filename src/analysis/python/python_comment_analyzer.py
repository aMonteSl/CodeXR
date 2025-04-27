#!/usr/bin/env python3
"""
Python Comment Analyzer

This script analyzes a Python file and counts comment lines,
including lines within multi-line strings.

Usage: python python_comment_analyzer.py <file_path>
"""

import sys
import json
import tokenize
from io import BytesIO

def analyze_python_comments(file_path):
    """
    Analyze a Python file to count comment lines, including multi-line strings.
    """
    try:
        with open(file_path, 'rb') as file:
            content = file.read()
    except Exception as e:
        return {
            "file": file_path,
            "commentLines": 0,
            "error": str(e)
        }

    comment_lines = set()

    try:
        # Collect all tokens first
        all_tokens = list(tokenize.tokenize(BytesIO(content).readline))
        
        # Process tokens to find comments and docstrings
        for tok in all_tokens:
            token_type = tok.type
            start_line = tok.start[0]
            end_line = tok.end[0]
            token_string = tok.string

            # Process single-line comments (#)
            if token_type == tokenize.COMMENT:
                comment_lines.add(start_line)  # Comments only occupy one line
            
            # Process potential docstrings (triple-quoted strings)
            elif token_type == tokenize.STRING:
                # Only count triple-quoted strings
                if (token_string.startswith('"""') or token_string.startswith("'''")):
                    # Add each line of the docstring
                    for line_num in range(start_line, end_line + 1):
                        comment_lines.add(line_num)

    except tokenize.TokenError as e:
        # Fall back to a simple line scanning approach if tokenization fails
        try:
            with open(file_path, 'r', encoding='utf-8', errors='replace') as file:
                lines = file.readlines()
                
            in_docstring = False
            for i, line in enumerate(lines, 1):  # 1-based line numbering
                line = line.strip()
                
                # Skip empty lines
                if not line:
                    continue
                
                # Check for # comments
                if '#' in line and not in_docstring:
                    comment_lines.add(i)
                    continue
                
                # Check for docstring start/end
                if '"""' in line or "'''" in line:
                    comment_lines.add(i)
                    # Toggle docstring mode if this is a docstring boundary
                    tripledouble = line.count('"""')
                    triplesingle = line.count("'''")
                    if tripledouble % 2 == 1 or triplesingle % 2 == 1:
                        in_docstring = not in_docstring
                    continue
                
                # If we're in a docstring, count this line
                if in_docstring:
                    comment_lines.add(i)
                    
        except Exception as nested_e:
            return {
                "file": file_path,
                "commentLines": 0,
                "error": f"Fallback parsing error: {nested_e}"
            }
        
    except Exception as e:
        return {
            "file": file_path,
            "commentLines": 0,
            "error": f"General analysis error: {e}"
        }

    # The total count is the number of unique lines identified
    comment_count = len(comment_lines)

    return {
        "file": file_path,
        "commentLines": comment_count
    }

def main():
    """Main entry point"""
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No file path provided"}))
        sys.exit(1)

    file_path = sys.argv[1]
    result = analyze_python_comments(file_path)

    # Output as JSON
    print(json.dumps(result))

if __name__ == "__main__":
    main()