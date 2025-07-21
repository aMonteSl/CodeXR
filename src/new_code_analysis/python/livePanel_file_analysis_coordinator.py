#!/usr/bin/env python3
"""
File Analysis Coordinator

This script coordinates all file-level analyzers to generate a comprehensive
data.json structure for static analysis visualization.

Usage: python file_analysis_coordinator.py <file_path>
"""

import sys
import json
import os
import subprocess
import time
from pathlib import Path

def analyze_file_comprehensive(file_path):
    """
    Coordinate all analyzers to generate comprehensive file analysis data
    
    Args:
        file_path (str): Path to the file to analyze
        
    Returns:
        dict: Complete analysis data structure for visualization
    """
    print(json.dumps({"debug": f"ANALYSIS_FILE_STATS: Starting comprehensive analysis for {file_path}"}), file=sys.stderr)
    
    # Get the directory containing this script
    script_dir = Path(__file__).parent
    
    # Initialize result structure
    result = {
        "fileName": os.path.basename(file_path),
        "filePath": file_path,
        "language": get_language_from_extension(file_path),
        "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
        "status": "success",
        
        # Basic metrics (will be populated)
        "totalLines": 0,
        "codeLines": 0,
        "commentLines": 0,
        "blankLines": 0,
        "classCount": 0,
        "functionCount": 0,
        
        # Complexity metrics (will be populated from lizard)
        "complexity": {
            "averageComplexity": 0,
            "maxComplexity": 0,
            "functionCount": 0,
            "highComplexityFunctions": 0,
            "criticalComplexityFunctions": 0
        },
        
        # Functions data (will be populated from lizard)
        "functions": [],
        
        # Additional metrics
        "commentRatio": 0.0,
        "classes": []
    }
    
    try:
        # Step 1: Run comment analysis
        print(json.dumps({"debug": "ANALYSIS_FILE_STATS: Running comment analysis..."}), file=sys.stderr)
        comment_data = run_analyzer(script_dir / "python_comment_analyzer.py", file_path)
        if comment_data and "commentLines" in comment_data:
            result["commentLines"] = comment_data["commentLines"]
        
        # Step 2: Run class count analysis  
        print(json.dumps({"debug": "ANALYSIS_FILE_STATS: Running class analysis..."}), file=sys.stderr)
        class_data = run_analyzer(script_dir / "class_counter_analyzer.py", file_path)
        if class_data and "classCount" in class_data:
            result["classCount"] = class_data["classCount"]
            result["classes"] = class_data.get("classes", [])
        
        # Step 3: Run lizard complexity analysis
        print(json.dumps({"debug": "ANALYSIS_FILE_STATS: Running complexity analysis..."}), file=sys.stderr)
        lizard_data = run_analyzer(script_dir / "lizard_analyzer.py", file_path)
        if lizard_data and lizard_data.get("status") == "success":
            file_info = lizard_data.get("file", {})
            functions = lizard_data.get("functions", [])
            metrics = lizard_data.get("metrics", {})
            
            # Update file-level metrics from lizard
            result["totalLines"] = file_info.get("nloc", 0)  # Lizard's nloc = non-blank lines
            result["functionCount"] = file_info.get("functionCount", 0)
            result["functions"] = functions
            result["complexity"] = metrics
            
            # Calculate code lines (approximate as total - comments - blank)
            total_lines_with_blank = count_total_lines(file_path)
            result["blankLines"] = max(0, total_lines_with_blank - result["totalLines"])
            result["codeLines"] = max(0, result["totalLines"] - result["commentLines"])
            
            # Recalculate total lines to include blanks
            result["totalLines"] = total_lines_with_blank
        else:
            print(json.dumps({"debug": "ANALYSIS_FILE_STATS: Lizard analysis failed, using minimal data"}), file=sys.stderr)
            # If lizard fails, still provide basic line counts
            total_lines_with_blank = count_total_lines(file_path)
            result["totalLines"] = total_lines_with_blank
            result["codeLines"] = max(0, total_lines_with_blank - result["commentLines"])
            result["blankLines"] = max(0, total_lines_with_blank - result["codeLines"] - result["commentLines"])
        
        # Step 4: Calculate comment ratio
        if result["totalLines"] > 0:
            result["commentRatio"] = round(result["commentLines"] / result["totalLines"], 3)
        
        print(json.dumps({"debug": f"ANALYSIS_FILE_STATS: Analysis completed successfully. Functions: {len(result['functions'])}, Classes: {result['classCount']}, Comments: {result['commentLines']}"}), file=sys.stderr)
        
        return result
        
    except Exception as e:
        print(json.dumps({"debug": f"ANALYSIS_FILE_STATS: Error during analysis: {str(e)}"}), file=sys.stderr)
        result["status"] = "error"
        result["error"] = str(e)
        return result

def run_analyzer(analyzer_path, file_path):
    """
    Run a specific analyzer and return its JSON output
    
    Args:
        analyzer_path (Path): Path to the analyzer script
        file_path (str): Path to the file to analyze
        
    Returns:
        dict: Parsed JSON output from the analyzer, or None if error
    """
    try:
        # Run the analyzer
        cmd = [sys.executable, str(analyzer_path), file_path]
        process = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=30  # 30 second timeout
        )
        
        if process.returncode == 0 and process.stdout.strip():
            return json.loads(process.stdout.strip())
        else:
            print(json.dumps({"debug": f"ANALYSIS_FILE_STATS: Analyzer {analyzer_path.name} failed: {process.stderr}"}), file=sys.stderr)
            return None
            
    except subprocess.TimeoutExpired:
        print(json.dumps({"debug": f"ANALYSIS_FILE_STATS: Analyzer {analyzer_path.name} timed out"}), file=sys.stderr)
        return None
    except json.JSONDecodeError as e:
        print(json.dumps({"debug": f"ANALYSIS_FILE_STATS: Failed to parse JSON from {analyzer_path.name}: {e}"}), file=sys.stderr)
        return None
    except Exception as e:
        print(json.dumps({"debug": f"ANALYSIS_FILE_STATS: Error running {analyzer_path.name}: {e}"}), file=sys.stderr)
        return None

def count_total_lines(file_path):
    """
    Count total lines in file including blanks
    
    Args:
        file_path (str): Path to the file
        
    Returns:
        int: Total line count
    """
    try:
        with open(file_path, 'r', encoding='utf-8') as file:
            return len(file.readlines())
    except Exception:
        return 0

def get_language_from_extension(file_path):
    """
    Get language name from file extension
    
    Args:
        file_path (str): Path to the file
        
    Returns:
        str: Language name
    """
    _, ext = os.path.splitext(file_path.lower())
    
    language_map = {
        '.py': 'Python',
        '.js': 'JavaScript',
        '.ts': 'TypeScript',
        '.tsx': 'TypeScript',
        '.jsx': 'JavaScript',
        '.java': 'Java',
        '.c': 'C',
        '.cpp': 'C++',
        '.cc': 'C++',
        '.cxx': 'C++',
        '.h': 'C/C++',
        '.hpp': 'C++',
        '.cs': 'C#',
        '.go': 'Go',
        '.rs': 'Rust',
        '.php': 'PHP',
        '.rb': 'Ruby',
        '.swift': 'Swift',
        '.kt': 'Kotlin',
        '.kts': 'Kotlin',
        '.scala': 'Scala',
        '.sc': 'Scala',
        '.dart': 'Dart',
        '.vue': 'Vue',
        '.html': 'HTML',
        '.css': 'CSS',
        '.scss': 'SCSS',
        '.less': 'Less',
        # Additional languages for analysis
        '.sol': 'Solidity',
        '.m': 'Objective-C',
        '.mm': 'Objective-C++',
        '.zig': 'Zig',
        '.ttcn': 'TTCN-3',
        '.ttcn3': 'TTCN-3',
        '.erl': 'Erlang',
        '.hrl': 'Erlang',
        '.lua': 'Lua',
        '.pl': 'Perl',
        '.pm': 'Perl',
        '.pod': 'Perl',
        '.t': 'Perl',
        '.f90': 'Fortran',
        '.f95': 'Fortran',
        '.f03': 'Fortran',
        '.f08': 'Fortran',
        '.gd': 'GDScript'
    }
    
    return language_map.get(ext, 'Unknown')

def main():
    """Main entry point"""
    if len(sys.argv) < 2:
        error_msg = {"error": "No file path provided", "status": "error"}
        print(json.dumps(error_msg))
        sys.exit(1)

    file_path = sys.argv[1]
    print(json.dumps({"debug": f"ANALYSIS_FILE_STATS: Lizard dependency available"}), file=sys.stderr)
    print(json.dumps({"debug": f"ANALYSIS_FILE_STATS: Received file path: {file_path}"}), file=sys.stderr)
    
    # Fix malformed URI paths from VS Code
    if file_path.startswith('/file:'):
        # Remove /file: prefix and normalize path
        file_path = file_path.replace('/file:', '')
        # Remove any leading extra slashes
        while file_path.startswith('//'):
            file_path = file_path[1:]
        print(json.dumps({"debug": f"ANALYSIS_FILE_STATS: Corrected file path: {file_path}"}), file=sys.stderr)
    
    # Check if file exists
    if not os.path.exists(file_path):
        error_msg = {"error": f"File not found: {file_path}", "status": "error"}
        print(json.dumps(error_msg))
        sys.exit(1)
    
    # Perform comprehensive analysis
    result = analyze_file_comprehensive(file_path)
    
    # Output the complete data.json structure
    print(json.dumps(result, indent=2))

if __name__ == "__main__":
    main()
