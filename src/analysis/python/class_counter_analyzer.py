#!/usr/bin/env python3
"""
Class Counter Analyzer

This script analyzes a file and counts the number of class declarations.
It supports Python, JavaScript, TypeScript, and C/C++.

Usage: python class_counter_analyzer.py <file_path>
"""

import sys
import json
import os
import re


def analyze_classes(file_path):
    """
    Analyze a file to count class declarations.
    
    Args:
        file_path: Path to the file
        
    Returns:
        Dictionary with file path and class count
    """
    try:
        with open(file_path, 'r', encoding='utf-8') as file:
            content = file.read()
    except Exception as e:
        return {
            "file": file_path,
            "classCount": 0,
            "error": str(e)
        }
    
    # Determine file type based on extension
    _, ext = os.path.splitext(file_path.lower())
    
    class_count = 0
    
    if ext in ['.py']:
        # Python class pattern
        # Look for 'class Name:' or 'class Name(object):'
        class_pattern = r'^\s*class\s+[A-Za-z0-9_]+\s*(\([^)]*\))?\s*:'
        class_count = len(re.findall(class_pattern, content, re.MULTILINE))
        
    elif ext in ['.js', '.ts', '.jsx', '.tsx']:
        # JavaScript/TypeScript class pattern
        # Look for 'class Name {' or 'class Name extends Parent {'
        class_pattern = r'^\s*class\s+[A-Za-z0-9_$]+\s*(\s+extends\s+[A-Za-z0-9_$.]+\s*)?{'
        class_count = len(re.findall(class_pattern, content, re.MULTILINE))
        
        # Also check for classes defined with Object.defineClass or similar patterns
        alt_class_patterns = [
            r'^\s*const\s+[A-Za-z0-9_$]+\s*=\s*class\s*(\s+[A-Za-z0-9_$]+)?',
            r'^\s*let\s+[A-Za-z0-9_$]+\s*=\s*class\s*(\s+[A-Za-z0-9_$]+)?',
            r'^\s*var\s+[A-Za-z0-9_$]+\s*=\s*class\s*(\s+[A-Za-z0-9_$]+)?'
        ]
        
        for pattern in alt_class_patterns:
            class_count += len(re.findall(pattern, content, re.MULTILINE))
            
    elif ext in ['.c', '.cpp', '.cc', '.cxx', '.h', '.hpp']:
        # C/C++ class pattern
        # Look for 'class Name {' or 'class Name : public Parent {'
        class_pattern = r'^\s*class\s+[A-Za-z0-9_]+\s*(:\s*(public|private|protected)\s+[A-Za-z0-9_:]+\s*)?{'
        class_count = len(re.findall(class_pattern, content, re.MULTILINE))
        
        # Also check for struct declarations which are essentially classes in C++
        struct_pattern = r'^\s*struct\s+[A-Za-z0-9_]+\s*(:\s*(public|private|protected)\s+[A-Za-z0-9_:]+\s*)?{'
        class_count += len(re.findall(struct_pattern, content, re.MULTILINE))
    
    # If no extension match, return 0
    return {
        "file": file_path,
        "classCount": class_count
    }


def main():
    """Main entry point"""
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No file path provided"}))
        sys.exit(1)
    
    file_path = sys.argv[1]
    result = analyze_classes(file_path)
    
    # Output as JSON
    print(json.dumps(result))


if __name__ == "__main__":
    main()