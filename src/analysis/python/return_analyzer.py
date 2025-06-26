#!/usr/bin/env python3
"""
Return Statement Analyzer

This module analyzes return statements in code across multiple programming languages.
It detects the programming language and uses appropriate logic to count return-like 
statements per function depending on the language.

Features:
- Accurate function boundary detection
- Language-aware return statement counting
- Proper handling of strings, comments, and edge cases
- Support for implicit returns where applicable

Usage: python return_analyzer.py <file_path>
"""

import sys
import json
import os
import re
import ast
from typing import Dict, List, Tuple, Optional, Set


def detect_language(file_path: str) -> str:
    """
    Detect programming language based on file extension.
    
    Args:
        file_path: Path to the file
        
    Returns:
        Language identifier string
    """
    ext = os.path.splitext(file_path)[1].lower()
    
    language_map = {
        '.js': 'javascript',
        '.jsx': 'javascript',
        '.ts': 'typescript',
        '.tsx': 'typescript',
        '.py': 'python',
        '.c': 'c',
        '.h': 'c',
        '.cpp': 'cpp',
        '.cc': 'cpp',
        '.cxx': 'cpp',
        '.hpp': 'cpp',
        '.cs': 'csharp',
        '.java': 'java',
        '.vue': 'vue',
        '.rb': 'ruby',
        '.m': 'objc',
        '.mm': 'objc',
        '.swift': 'swift',
        '.ttcn': 'ttcn3',
        '.ttcn3': 'ttcn3',
        '.3mp': 'ttcn3',
        '.php': 'php',
        '.phtml': 'php',
        '.php3': 'php',
        '.php4': 'php',
        '.php5': 'php',
        '.phps': 'php',
        '.scala': 'scala',
        '.sc': 'scala',
        '.gd': 'gdscript',
        '.go': 'go',
        '.lua': 'lua',
        '.rs': 'rust',
        '.f': 'fortran',
        '.f77': 'fortran',
        '.f90': 'fortran',
        '.f95': 'fortran',
        '.f03': 'fortran',
        '.f08': 'fortran',
        '.for': 'fortran',
        '.ftn': 'fortran',
        '.kt': 'kotlin',
        '.kts': 'kotlin',
        '.sol': 'solidity',
        '.erl': 'erlang',
        '.hrl': 'erlang',
        '.zig': 'zig',
        '.pl': 'perl',
        '.pm': 'perl',
        '.pod': 'perl',
        '.t': 'perl'
    }
    
    return language_map.get(ext, 'unknown')


def remove_comments_and_strings(content: str, language: str) -> str:
    """
    Remove comments and string literals from code to avoid false positives.
    
    Args:
        content: Source code content
        language: Programming language
        
    Returns:
        Code with comments and strings removed (replaced with spaces to preserve line numbers)
    """
    if language in ['javascript', 'typescript', 'java', 'csharp', 'c', 'cpp', 'go', 'rust', 'swift', 'kotlin', 'scala', 'php']:
        # Remove single-line comments (//)
        content = re.sub(r'//.*?$', lambda m: ' ' * len(m.group(0)), content, flags=re.MULTILINE)
        # Remove multi-line comments (/* */)
        content = re.sub(r'/\*.*?\*/', lambda m: ' ' * len(m.group(0)), content, flags=re.DOTALL)
        # Remove string literals (double quotes)
        content = re.sub(r'"(?:[^"\\]|\\.)*"', lambda m: ' ' * len(m.group(0)), content)
        # Remove string literals (single quotes)
        content = re.sub(r"'(?:[^'\\]|\\.)*'", lambda m: ' ' * len(m.group(0)), content)
        # Remove template literals (backticks) for JS/TS
        if language in ['javascript', 'typescript']:
            content = re.sub(r'`(?:[^`\\]|\\.)*`', lambda m: ' ' * len(m.group(0)), content)
    
    elif language == 'python':
        # Remove single-line comments (#)
        content = re.sub(r'#.*?$', lambda m: ' ' * len(m.group(0)), content, flags=re.MULTILINE)
        # Remove string literals (triple quotes)
        content = re.sub(r'""".*?"""', lambda m: ' ' * len(m.group(0)), content, flags=re.DOTALL)
        content = re.sub(r"'''.*?'''", lambda m: ' ' * len(m.group(0)), content, flags=re.DOTALL)
        # Remove string literals (single/double quotes)
        content = re.sub(r'"(?:[^"\\]|\\.)*"', lambda m: ' ' * len(m.group(0)), content)
        content = re.sub(r"'(?:[^'\\]|\\.)*'", lambda m: ' ' * len(m.group(0)), content)
    
    elif language == 'ruby':
        # Remove single-line comments (#)
        content = re.sub(r'#.*?$', lambda m: ' ' * len(m.group(0)), content, flags=re.MULTILINE)
        # Remove string literals
        content = re.sub(r'"(?:[^"\\]|\\.)*"', lambda m: ' ' * len(m.group(0)), content)
        content = re.sub(r"'(?:[^'\\]|\\.)*'", lambda m: ' ' * len(m.group(0)), content)
    
    elif language == 'lua':
        # Remove single-line comments (--)
        content = re.sub(r'--.*?$', lambda m: ' ' * len(m.group(0)), content, flags=re.MULTILINE)
        # Remove multi-line comments (--[[ ]])
        content = re.sub(r'--\[\[.*?\]\]', lambda m: ' ' * len(m.group(0)), content, flags=re.DOTALL)
        # Remove string literals
        content = re.sub(r'"(?:[^"\\]|\\.)*"', lambda m: ' ' * len(m.group(0)), content)
        content = re.sub(r"'(?:[^'\\]|\\.)*'", lambda m: ' ' * len(m.group(0)), content)
    
    elif language == 'erlang':
        # Remove single-line comments (%)
        content = re.sub(r'%.*?$', lambda m: ' ' * len(m.group(0)), content, flags=re.MULTILINE)
        # Remove string literals
        content = re.sub(r'"(?:[^"\\]|\\.)*"', lambda m: ' ' * len(m.group(0)), content)
    
    elif language == 'perl':
        # Remove single-line comments (#)
        content = re.sub(r'#.*?$', lambda m: ' ' * len(m.group(0)), content, flags=re.MULTILINE)
        # Remove string literals
        content = re.sub(r'"(?:[^"\\]|\\.)*"', lambda m: ' ' * len(m.group(0)), content)
        content = re.sub(r"'(?:[^'\\]|\\.)*'", lambda m: ' ' * len(m.group(0)), content)
    
    return content


def extract_functions_improved(content: str, language: str) -> List[Dict]:
    """
    Extract function definitions with improved accuracy.
    
    Args:
        content: File content (comments/strings already removed)
        language: Programming language
        
    Returns:
        List of function information dictionaries
    """
    functions = []
    lines = content.split('\n')
    
    if language == 'python':
        return extract_python_functions(content)
    elif language in ['javascript', 'typescript']:
        return extract_js_ts_functions(content)
    elif language in ['java', 'csharp']:
        return extract_java_csharp_functions(content)
    elif language in ['c', 'cpp']:
        return extract_c_cpp_functions(content)
    elif language == 'go':
        return extract_go_functions(content)
    elif language == 'rust':
        return extract_rust_functions(content)
    elif language == 'ruby':
        return extract_ruby_functions(content)
    elif language == 'swift':
        return extract_swift_functions(content)
    elif language in ['kotlin', 'scala']:
        return extract_kotlin_scala_functions(content)
    elif language == 'php':
        return extract_php_functions(content)
    elif language == 'lua':
        return extract_lua_functions(content)
    elif language == 'erlang':
        return extract_erlang_functions(content)
    elif language == 'perl':
        return extract_perl_functions(content)
    else:
        return extract_generic_functions(content)


def extract_python_functions(content: str) -> List[Dict]:
    """Extract Python function definitions using AST when possible, fallback to regex."""
    functions = []
    
    try:
        # Try using AST for accurate parsing
        tree = ast.parse(content)
        for node in ast.walk(tree):
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                functions.append({
                    'name': node.name,
                    'start_line': node.lineno,
                    'end_line': node.end_lineno or node.lineno,
                })
    except:
        # Fallback to regex if AST fails
        lines = content.split('\n')
        current_function = None
        
        for line_num, line in enumerate(lines, 1):
            stripped = line.strip()
            
            # Function definition
            match = re.match(r'^\s*(async\s+)?def\s+(\w+)\s*\(', line)
            if match:
                if current_function:
                    current_function['end_line'] = line_num - 1
                    functions.append(current_function)
                
                current_function = {
                    'name': match.group(2),
                    'start_line': line_num,
                    'end_line': line_num,
                }
            
            # End function when indentation returns to original level
            elif current_function and line.strip() and not line.startswith(' ') and not line.startswith('\t'):
                if not re.match(r'^\s*(async\s+)?def\s+', line):
                    current_function['end_line'] = line_num - 1
                    functions.append(current_function)
                    current_function = None
        
        # Handle function at end of file
        if current_function:
            current_function['end_line'] = len(lines)
            functions.append(current_function)
    
    return functions


def extract_js_ts_functions(content: str) -> List[Dict]:
    """Extract JavaScript/TypeScript function definitions."""
    functions = []
    lines = content.split('\n')
    current_function = None
    brace_level = 0
    
    for line_num, line in enumerate(lines, 1):
        stripped = line.strip()
        
        # Function patterns
        patterns = [
            r'^\s*function\s+(\w+)\s*\(',
            r'^\s*async\s+function\s+(\w+)\s*\(',
            r'^\s*(\w+)\s*:\s*function\s*\(',
            r'^\s*(\w+)\s*:\s*async\s*function\s*\(',
            r'^\s*(const|let|var)\s+(\w+)\s*=\s*function',
            r'^\s*(const|let|var)\s+(\w+)\s*=\s*async\s*function',
            r'^\s*(const|let|var)\s+(\w+)\s*=\s*\([^)]*\)\s*=>', 
        ]
        
        # Check if this line starts a new function
        for pattern in patterns:
            match = re.search(pattern, line)
            if match:
                # Extract function name (could be in different groups depending on pattern)
                name = None
                for group in match.groups():
                    if group and group not in ['const', 'let', 'var', 'async']:
                        name = group
                        break
                
                if name:
                    # Finish previous function if exists
                    if current_function:
                        current_function['end_line'] = line_num - 1
                        functions.append(current_function)
                    
                    current_function = {
                        'name': name,
                        'start_line': line_num,
                        'end_line': line_num,
                    }
                    brace_level = 0
                break
        
        # Track brace level for current function
        if current_function:
            # Count opening and closing braces
            open_braces = line.count('{')
            close_braces = line.count('}')
            brace_level += open_braces - close_braces
            
            # If we hit brace level 0 after having opened braces, function is complete
            if brace_level == 0 and open_braces > 0:
                current_function['end_line'] = line_num
                functions.append(current_function)
                current_function = None
    
    # Handle function at end of file
    if current_function:
        current_function['end_line'] = len(lines)
        functions.append(current_function)
    
    return functions


def extract_java_csharp_functions(content: str) -> List[Dict]:
    """Extract Java/C# method definitions."""
    functions = []
    lines = content.split('\n')
    current_function = None
    brace_level = 0
    
    for line_num, line in enumerate(lines, 1):
        stripped = line.strip()
        
        # Method patterns - more flexible to handle different modifiers
        patterns = [
            r'^\s*(?:public|private|protected|internal|static|virtual|override|abstract|final)\s+(?:public|private|protected|internal|static|virtual|override|abstract|final\s+)?\w+\s+(\w+)\s*\(',
            r'^\s*(?:public|private|protected|internal|static|virtual|override|abstract|final)\s+(\w+)\s*\(',
            r'^\s*\w+\s+(\w+)\s*\(',  # Simple method without modifiers
        ]
        
        # Check if this line starts a new method
        for pattern in patterns:
            match = re.search(pattern, line)
            if match and not stripped.endswith(';'):  # Not an abstract method or interface
                if current_function:
                    current_function['end_line'] = line_num - 1
                    functions.append(current_function)
                
                current_function = {
                    'name': match.group(1),
                    'start_line': line_num,
                    'end_line': line_num,
                }
                brace_level = 0
                break
        
        # Track brace level
        if current_function:
            open_braces = line.count('{')
            close_braces = line.count('}')
            brace_level += open_braces - close_braces
            
            # Method ends when brace level returns to 0 after opening
            if brace_level == 0 and open_braces > 0:
                current_function['end_line'] = line_num
                functions.append(current_function)
                current_function = None
    
    # Handle method at end of file
    if current_function:
        current_function['end_line'] = len(lines)
        functions.append(current_function)
    
    return functions


def extract_c_cpp_functions(content: str) -> List[Dict]:
    """Extract C/C++ function definitions."""
    functions = []
    lines = content.split('\n')
    current_function = None
    brace_level = 0
    
    for line_num, line in enumerate(lines, 1):
        stripped = line.strip()
        
        # Function patterns - more flexible to handle brace on next line
        patterns = [
            r'^\s*(?:static\s+|extern\s+|inline\s+|virtual\s+)?(?:const\s+)?\w+(?:\s*\*+)?\s+(\w+)\s*\([^)]*\)',
            r'^\s*(?:static\s+|extern\s+|inline\s+|virtual\s+)?(?:const\s+)?void\s+(\w+)\s*\([^)]*\)',
        ]
        
        # Check if this line starts a new function
        for pattern in patterns:
            match = re.search(pattern, line)
            if match and not stripped.endswith(';'):  # Not a declaration
                if current_function:
                    current_function['end_line'] = line_num - 1
                    functions.append(current_function)
                
                current_function = {
                    'name': match.group(1),
                    'start_line': line_num,
                    'end_line': line_num,
                }
                brace_level = 0
                break
        
        # Track brace level
        if current_function:
            open_braces = line.count('{')
            close_braces = line.count('}')
            brace_level += open_braces - close_braces
            
            # Function ends when brace level returns to 0 after opening
            if brace_level == 0 and open_braces > 0:
                current_function['end_line'] = line_num
                functions.append(current_function)
                current_function = None
    
    # Handle function at end of file
    if current_function:
        current_function['end_line'] = len(lines)
        functions.append(current_function)
    
    return functions


def extract_go_functions(content: str) -> List[Dict]:
    """Extract Go function definitions."""
    functions = []
    lines = content.split('\n')
    brace_stack = []
    current_function = None
    
    for line_num, line in enumerate(lines, 1):
        # Function patterns
        patterns = [
            r'^\s*func\s+(\w+)\s*\(',
            r'^\s*func\s+\([^)]+\)\s+(\w+)\s*\(',  # Method with receiver
        ]
        
        for pattern in patterns:
            match = re.search(pattern, line)
            if match and '{' in line:
                current_function = {
                    'name': match.group(1),
                    'start_line': line_num,
                    'end_line': line_num,
                }
                break
        
        # Track braces
        if current_function:
            brace_stack.extend(['{'] * line.count('{'))
            brace_stack = brace_stack[:-line.count('}')]
            
            if not brace_stack:
                current_function['end_line'] = line_num
                functions.append(current_function)
                current_function = None
    
    return functions


def extract_rust_functions(content: str) -> List[Dict]:
    """Extract Rust function definitions."""
    functions = []
    lines = content.split('\n')
    current_function = None
    brace_level = 0
    
    for line_num, line in enumerate(lines, 1):
        stripped = line.strip()
        
        # Function patterns
        func_pattern = r'^\s*(?:pub\s+)?(?:async\s+)?fn\s+(\w+)\s*\('
        match = re.search(func_pattern, line)
        
        if match:
            if current_function:
                current_function['end_line'] = line_num - 1
                functions.append(current_function)
            
            current_function = {
                'name': match.group(1),
                'start_line': line_num,
                'end_line': line_num,
            }
            brace_level = 0
        
        # Track brace level
        if current_function:
            open_braces = line.count('{')
            close_braces = line.count('}')
            brace_level += open_braces - close_braces
            
            # Function ends when brace level returns to 0 after opening
            if brace_level == 0 and open_braces > 0:
                current_function['end_line'] = line_num
                functions.append(current_function)
                current_function = None
    
    # Handle function at end of file
    if current_function:
        current_function['end_line'] = len(lines)
        functions.append(current_function)
    
    return functions


def extract_go_functions(content: str) -> List[Dict]:
    """Extract Go function definitions."""
    functions = []
    lines = content.split('\n')
    current_function = None
    brace_level = 0
    
    for line_num, line in enumerate(lines, 1):
        # Function patterns
        patterns = [
            r'^\s*func\s+(\w+)\s*\(',
            r'^\s*func\s+\([^)]+\)\s+(\w+)\s*\(',  # Method with receiver
        ]
        
        for pattern in patterns:
            match = re.search(pattern, line)
            if match:
                if current_function:
                    current_function['end_line'] = line_num - 1
                    functions.append(current_function)
                
                current_function = {
                    'name': match.group(1),
                    'start_line': line_num,
                    'end_line': line_num,
                }
                brace_level = 0
                break
        
        # Track brace level
        if current_function:
            open_braces = line.count('{')
            close_braces = line.count('}')
            brace_level += open_braces - close_braces
            
            # Function ends when brace level returns to 0 after opening
            if brace_level == 0 and open_braces > 0:
                current_function['end_line'] = line_num
                functions.append(current_function)
                current_function = None
    
    # Handle function at end of file
    if current_function:
        current_function['end_line'] = len(lines)
        functions.append(current_function)
    
    return functions


def extract_ruby_functions(content: str) -> List[Dict]:
    """Extract Ruby method definitions."""
    functions = []
    lines = content.split('\n')
    current_function = None
    
    for line_num, line in enumerate(lines, 1):
        stripped = line.strip()
        
        # Method definition
        match = re.match(r'^\s*def\s+(?:self\.)?(\w+)', line)
        if match:
            if current_function:
                current_function['end_line'] = line_num - 1
                functions.append(current_function)
            
            current_function = {
                'name': match.group(1),
                'start_line': line_num,
                'end_line': line_num,
            }
        
        # End method
        elif current_function and stripped == 'end':
            current_function['end_line'] = line_num
            functions.append(current_function)
            current_function = None
    
    return functions


def extract_swift_functions(content: str) -> List[Dict]:
    """Extract Swift function definitions."""
    functions = []
    lines = content.split('\n')
    brace_stack = []
    current_function = None
    
    for line_num, line in enumerate(lines, 1):
        # Function patterns
        func_pattern = r'^\s*(?:public\s+|private\s+|internal\s+)?func\s+(\w+)\s*\('
        match = re.search(func_pattern, line)
        
        if match and '{' in line:
            current_function = {
                'name': match.group(1),
                'start_line': line_num,
                'end_line': line_num,
            }
        
        # Track braces
        if current_function:
            brace_stack.extend(['{'] * line.count('{'))
            brace_stack = brace_stack[:-line.count('}')]
            
            if not brace_stack:
                current_function['end_line'] = line_num
                functions.append(current_function)
                current_function = None
    
    return functions


def extract_kotlin_scala_functions(content: str) -> List[Dict]:
    """Extract Kotlin/Scala function definitions."""
    functions = []
    lines = content.split('\n')
    brace_stack = []
    current_function = None
    
    for line_num, line in enumerate(lines, 1):
        # Function patterns
        patterns = [
            r'^\s*(?:public\s+|private\s+|internal\s+|protected\s+)?(?:suspend\s+)?fun\s+(\w+)\s*\(',  # Kotlin
            r'^\s*(?:public\s+|private\s+|protected\s+)?def\s+(\w+)\s*\(',  # Scala
        ]
        
        for pattern in patterns:
            match = re.search(pattern, line)
            if match and ('{' in line or '=' in line):
                current_function = {
                    'name': match.group(1),
                    'start_line': line_num,
                    'end_line': line_num,
                }
                break
        
        # Track braces (or single expression)
        if current_function:
            if '{' in line:
                brace_stack.extend(['{'] * line.count('{'))
                brace_stack = brace_stack[:-line.count('}')]
                
                if not brace_stack:
                    current_function['end_line'] = line_num
                    functions.append(current_function)
                    current_function = None
            elif '=' in line and not '{' in line:  # Single expression function
                current_function['end_line'] = line_num
                functions.append(current_function)
                current_function = None
    
    return functions


def extract_php_functions(content: str) -> List[Dict]:
    """Extract PHP function definitions."""
    functions = []
    lines = content.split('\n')
    current_function = None
    brace_level = 0
    
    for line_num, line in enumerate(lines, 1):
        stripped = line.strip()
        
        # Function patterns
        func_pattern = r'^\s*(?:public\s+|private\s+|protected\s+|static\s+)*function\s+(\w+)\s*\('
        match = re.search(func_pattern, line)
        
        if match:
            if current_function:
                current_function['end_line'] = line_num - 1
                functions.append(current_function)
            
            current_function = {
                'name': match.group(1),
                'start_line': line_num,
                'end_line': line_num,
            }
            brace_level = 0
        
        # Track brace level
        if current_function:
            open_braces = line.count('{')
            close_braces = line.count('}')
            brace_level += open_braces - close_braces
            
            # Function ends when brace level returns to 0 after opening
            if brace_level == 0 and open_braces > 0:
                current_function['end_line'] = line_num
                functions.append(current_function)
                current_function = None
    
    # Handle function at end of file
    if current_function:
        current_function['end_line'] = len(lines)
        functions.append(current_function)
    
    return functions


def extract_lua_functions(content: str) -> List[Dict]:
    """Extract Lua function definitions."""
    functions = []
    lines = content.split('\n')
    current_function = None
    
    for line_num, line in enumerate(lines, 1):
        # Function patterns
        patterns = [
            r'^\s*function\s+(\w+)\s*\(',
            r'^\s*local\s+function\s+(\w+)\s*\(',
            r'^\s*(\w+)\s*=\s*function\s*\(',
        ]
        
        for pattern in patterns:
            match = re.search(pattern, line)
            if match:
                if current_function:
                    current_function['end_line'] = line_num - 1
                    functions.append(current_function)
                
                current_function = {
                    'name': match.group(1),
                    'start_line': line_num,
                    'end_line': line_num,
                }
                break
        
        # End function
        if current_function and line.strip() == 'end':
            current_function['end_line'] = line_num
            functions.append(current_function)
            current_function = None
    
    return functions


def extract_erlang_functions(content: str) -> List[Dict]:
    """Extract Erlang function definitions."""
    functions = []
    lines = content.split('\n')
    
    for line_num, line in enumerate(lines, 1):
        # Function pattern (name(args) ->)
        match = re.match(r'^(\w+)\s*\([^)]*\)\s*->', line)
        if match:
            # Find end of function (next function or end of file)
            end_line = line_num
            for next_line_num in range(line_num + 1, len(lines) + 1):
                if next_line_num >= len(lines) or re.match(r'^(\w+)\s*\([^)]*\)\s*->', lines[next_line_num - 1]):
                    end_line = next_line_num - 1
                    break
                elif next_line_num == len(lines):
                    end_line = next_line_num
            
            functions.append({
                'name': match.group(1),
                'start_line': line_num,
                'end_line': end_line,
            })
    
    return functions


def extract_perl_functions(content: str) -> List[Dict]:
    """Extract Perl subroutine definitions."""
    functions = []
    lines = content.split('\n')
    brace_stack = []
    current_function = None
    
    for line_num, line in enumerate(lines, 1):
        # Subroutine pattern
        match = re.match(r'^\s*sub\s+(\w+)\s*{', line)
        if match:
            current_function = {
                'name': match.group(1),
                'start_line': line_num,
                'end_line': line_num,
            }
        
        # Track braces
        if current_function:
            brace_stack.extend(['{'] * line.count('{'))
            brace_stack = brace_stack[:-line.count('}')]
            
            if not brace_stack:
                current_function['end_line'] = line_num
                functions.append(current_function)
                current_function = None
    
    return functions


def extract_generic_functions(content: str) -> List[Dict]:
    """Generic function extraction fallback."""
    functions = []
    lines = content.split('\n')
    
    for line_num, line in enumerate(lines, 1):
        # Very basic pattern matching
        if re.search(r'\b(?:function|def|func|sub)\s+(\w+)', line):
            match = re.search(r'\b(?:function|def|func|sub)\s+(\w+)', line)
            if match:
                functions.append({
                    'name': match.group(1),
                    'start_line': line_num,
                    'end_line': line_num + 10,  # Approximate
                })
    
    return functions


def count_returns_in_function(content: str, func_info: Dict, language: str) -> int:
    """
    Count return statements within a specific function with language-aware logic.
    
    Args:
        content: File content (already cleaned of comments/strings)
        func_info: Function information with start/end lines
        language: Programming language
        
    Returns:
        Number of return statements found
    """
    lines = content.split('\n')
    start = func_info['start_line'] - 1  # Convert to 0-based indexing
    end = func_info['end_line']
    function_lines = lines[start:end]
    function_content = '\n'.join(function_lines)
    
    return_count = 0
    
    if language == 'python':
        # Python: explicit return statements only
        for line in function_lines:
            if re.match(r'^\s*return\b', line):
                return_count += 1
                
    elif language in ['javascript', 'typescript']:
        # JavaScript/TypeScript: return keyword
        for line in function_lines:
            return_count += len(re.findall(r'\breturn\b', line))
            
    elif language in ['c', 'cpp', 'java', 'csharp']:
        # C-family: return keyword
        for line in function_lines:
            return_count += len(re.findall(r'\breturn\b', line))
            
    elif language == 'go':
        # Go: return keyword (can have multiple values)
        for line in function_lines:
            return_count += len(re.findall(r'\breturn\b', line))
            
    elif language == 'rust':
        # Rust: explicit return statements and implicit returns
        for line in function_lines:
            # Explicit returns
            return_count += len(re.findall(r'\breturn\b', line))
        
        # For implicit returns, check if last non-empty line doesn't end with semicolon
        last_line = None
        for line in reversed(function_lines):
            stripped = line.strip()
            if stripped and not stripped.startswith('//') and stripped != '}':
                last_line = stripped
                break
        
        if last_line and not last_line.endswith(';') and not last_line.endswith('}'):
            return_count += 1
            
    elif language == 'ruby':
        # Ruby: explicit return statements 
        for line in function_lines:
            return_count += len(re.findall(r'\breturn\b', line))
        
        # Ruby always has an implicit return of the last expression
        if function_lines:
            return_count += 1
            
    elif language == 'swift':
        # Swift: return keyword
        for line in function_lines:
            return_count += len(re.findall(r'\breturn\b', line))
            
    elif language in ['kotlin', 'scala']:
        # Kotlin/Scala: return keyword
        for line in function_lines:
            return_count += len(re.findall(r'\breturn\b', line))
        
        # Check for single expression functions (function = expression)
        first_line = function_lines[0] if function_lines else ""
        if '=' in first_line and '{' not in first_line:
            return_count += 1
            
    elif language == 'php':
        # PHP: return keyword
        for line in function_lines:
            return_count += len(re.findall(r'\breturn\b', line))
            
    elif language == 'lua':
        # Lua: return keyword
        for line in function_lines:
            return_count += len(re.findall(r'\breturn\b', line))
            
    elif language == 'erlang':
        # Erlang: function clauses separated by semicolons, each ends with expression
        # Count semicolons + 1 (last clause)
        clause_count = function_content.count(';') + 1
        return_count = clause_count
        
    elif language == 'perl':
        # Perl: explicit return statements
        for line in function_lines:
            return_count += len(re.findall(r'\breturn\b', line))
        
        # Perl has implicit return of last expression if no explicit return
        has_explicit_return = any('return' in line for line in function_lines)
        if not has_explicit_return and function_lines:
            return_count += 1
    
    else:
        # Generic fallback: just count 'return' keyword
        for line in function_lines:
            return_count += len(re.findall(r'\breturn\b', line))
    
    return return_count


def analyze_returns_in_file(file_path: str) -> Dict:
    """
    Analyze return statements in a file across all functions.
    
    Args:
        file_path: Path to the file to analyze
        
    Returns:
        Dictionary with return analysis results
    """
    if not os.path.exists(file_path):
        return {
            "error": f"File not found: {file_path}",
            "status": "error"
        }
    
    try:
        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
            content = f.read()
        
        language = detect_language(file_path)
        if language == 'unknown':
            return {
                "error": f"Unsupported file type: {os.path.splitext(file_path)[1]}",
                "status": "error"
            }
        
        # Remove comments and strings to avoid false positives
        cleaned_content = remove_comments_and_strings(content, language)
        
        # Extract functions using improved methods
        functions = extract_functions_improved(cleaned_content, language)
        
        # Count returns in each function using original content for line mapping
        function_returns = []
        for func in functions:
            returns_count = count_returns_in_function(cleaned_content, func, language)
            function_returns.append({
                "name": func['name'],
                "startLine": func['start_line'],
                "endLine": func['end_line'],
                "returns": returns_count
            })
        
        return {
            "file": {
                "path": file_path,
                "name": os.path.basename(file_path),
                "language": language
            },
            "functions": function_returns,
            "status": "success"
        }
        
    except Exception as e:
        return {
            "error": str(e),
            "status": "error"
        }


def main():
    """Main entry point"""
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No file path provided", "status": "error"}))
        sys.exit(1)
    
    file_path = sys.argv[1]
    result = analyze_returns_in_file(file_path)
    
    # Output as JSON
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
