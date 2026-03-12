#!/usr/bin/env python3
"""
XR Directory Analysis Coordinator (New Engine Version)

This script coordinates directory-level analysis to generate file data for XR visualization.
It generates a simplified data.json structure containing only file metrics for each file
in the directory, designed specifically for XR environments.

Usage: python xr_directory_analysis_coordinator.py <directory_path> [--deep]
"""
import sys
import json
import os
import subprocess
import time
from pathlib import Path

UTILS_DIR = Path(__file__).resolve().parent.parent / "utils"
if str(UTILS_DIR) not in sys.path:
    sys.path.insert(0, str(UTILS_DIR))

from babia_path_utils import normalize_output_paths
from directory_scan_utils import filter_explicit_files_for_analysis, scan_directory_files_for_analysis
from xr_field_schema import safe_ratio, summarize_function_metrics

def analyze_directory_xr(directory_path, is_deep=False, filtered_files=None):
    """
    Coordinate XR directory analysis to generate file-focused data structure
    
    Args:
        directory_path (str): Path to the directory to analyze
        is_deep (bool): Whether to analyze recursively through subdirectories
        filtered_files (list): Optional list of specific files to analyze (bypasses scanning)
        
    Returns:
        list: Array of file data objects for XR visualization
    """
    print(json.dumps({"debug": f"XR_DIRECTORY_ANALYSIS: Starting XR analysis for {directory_path} (deep={is_deep}, filtered={filtered_files is not None})"}), file=sys.stderr)
    
    # Get the directory containing this script
    script_dir = Path(__file__).parent
    
    # Initialize result as simple array of files for XR
    files_array = []
    
    try:
        # Use explicit files if provided, otherwise let the shared scanner walk the directory.
        if filtered_files is not None:
            files_to_analyze = filter_explicit_files_for_analysis(filtered_files, max_total_files=5000)
            print(json.dumps({"debug": f"XR_DIRECTORY_ANALYSIS: Using filtered file list with {len(files_to_analyze)} analyzable files"}), file=sys.stderr)
        else:
            print(json.dumps({"debug": f"XR_DIRECTORY_ANALYSIS: Scanning directory {directory_path}"}), file=sys.stderr)
            files_to_analyze = scan_directory_files_for_analysis(
                directory_path,
                recursive=is_deep,
                max_entries_per_directory=1000,
                max_total_files=5000,
            )
            scan_type = 'deep' if is_deep else 'regular'
            print(json.dumps({"debug": f"XR_DIRECTORY_ANALYSIS: {scan_type.capitalize()} scan found {len(files_to_analyze)} files to analyze"}), file=sys.stderr)

        # Analyze each file and generate XR file data
        analyzed_files = 0
        not_analyzed_files = 0
        total_files = len(files_to_analyze)
        
        print(json.dumps({"progress": {"current": 0, "total": total_files, "fileName": "Starting analysis...", "message": "Starting file analysis..."}}), file=sys.stderr)
        
        for file_path in files_to_analyze:
            try:
                # Calculate progress percentage
                current_file = analyzed_files + not_analyzed_files + 1
                percentage = int((current_file / total_files) * 100) if total_files > 0 else 0
                file_name = os.path.basename(file_path)
                
                print(json.dumps({"progress": {"current": current_file, "total": total_files, "percentage": percentage, "fileName": file_name, "message": f"Analyzing {file_name}... ({current_file}/{total_files})"}}), file=sys.stderr)
                print(json.dumps({"debug": f"XR_DIRECTORY_ANALYSIS: Analyzing file {file_path}"}), file=sys.stderr)
                
                file_data = analyze_single_file_xr(file_path, script_dir, directory_path)
                
                if file_data and file_data.get("status") == "success":
                    files_array.append(file_data)
                    analyzed_files += 1
                    print(json.dumps({"debug": f"XR_DIRECTORY_ANALYSIS: Successfully analyzed {os.path.basename(file_path)}"}), file=sys.stderr)
                else:
                    not_analyzed_files += 1
                    print(json.dumps({"debug": f"XR_DIRECTORY_ANALYSIS: Failed to analyze {os.path.basename(file_path)}"}), file=sys.stderr)
                    
            except Exception as e:
                not_analyzed_files += 1
                print(json.dumps({"debug": f"XR_DIRECTORY_ANALYSIS: Error analyzing {file_path}: {str(e)}"}), file=sys.stderr)
        
        # Final progress update
        print(json.dumps({"progress": {"current": total_files, "total": total_files, "percentage": 100, "fileName": "Completed!", "message": f"Analysis completed! {analyzed_files} files analyzed successfully."}}), file=sys.stderr)
        print(json.dumps({"debug": f"XR_DIRECTORY_ANALYSIS: Completed. {analyzed_files} analyzed, {not_analyzed_files} failed"}), file=sys.stderr)
        
        return normalize_output_paths(files_array)
        
    except Exception as e:
        print(json.dumps({"debug": f"XR_DIRECTORY_ANALYSIS: Critical error: {str(e)}"}), file=sys.stderr)
        return []

def analyze_single_file_xr(file_path, script_dir, base_directory_path):
    """
    Analyze a single file and generate XR-focused file data
    
    Args:
        file_path (str): Path to file to analyze
        script_dir (Path): Path to script directory
        base_directory_path (str): Base directory path for relative path calculation
        
    Returns:
        dict: XR file data structure with metrics
    """
    try:
        # Use the livePanel file analysis coordinator with resume_only=True to get file metrics
        coordinator_path = script_dir.parent / "livePanels" / "livePanel_file_analysis_coordinator.py"
        
        if not coordinator_path.exists():
            print(json.dumps({"debug": f"XR_DIRECTORY_ANALYSIS: File coordinator not found: {coordinator_path}"}), file=sys.stderr)
            return None
        
        # Execute the file analysis coordinator with resume mode for file metrics
        result = subprocess.run(
            [sys.executable, str(coordinator_path), file_path, "--resume"],
            capture_output=True,
            text=True,
            timeout=30  # 30 second timeout per file
        )
        
        if result.returncode == 0 and result.stdout.strip():
            try:
                # Parse the JSON output from the file coordinator
                file_analysis = json.loads(result.stdout.strip())
                
                # The livePanel coordinator with --resume returns file metrics directly
                # Generate XR file data structure
                xr_file_data = create_xr_file_data(file_analysis, file_path, base_directory_path)
                return xr_file_data
                
            except json.JSONDecodeError as e:
                print(json.dumps({"debug": f"XR_DIRECTORY_ANALYSIS: JSON decode error for {file_path}: {str(e)}"}), file=sys.stderr)
                return None
        else:
            print(json.dumps({"debug": f"XR_DIRECTORY_ANALYSIS: File analysis failed for {file_path}. Return code: {result.returncode}"}), file=sys.stderr)
            if result.stderr:
                print(json.dumps({"debug": f"XR_DIRECTORY_ANALYSIS: Error output: {result.stderr[:200]}"}), file=sys.stderr)
            return None
            
    except subprocess.TimeoutExpired:
        print(json.dumps({"debug": f"XR_DIRECTORY_ANALYSIS: Timeout analyzing {file_path}"}), file=sys.stderr)
        return None
    except Exception as e:
        print(json.dumps({"debug": f"XR_DIRECTORY_ANALYSIS: Exception analyzing {file_path}: {str(e)}"}), file=sys.stderr)
        return None

def convert_xr_list_to_file_analysis(xr_function_list, file_path):
    """
    Convert XR file coordinator list output to expected dict format
    
    Args:
        xr_function_list (list): List of function data from XR coordinator
        file_path (str): Path to the file being analyzed
        
    Returns:
        dict: File analysis in expected format
    """
    # Calculate basic file statistics
    total_lines = 0
    code_lines = 0
    comment_lines = 0
    blank_lines = 0
    
    try:
        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
            lines = f.readlines()
            total_lines = len(lines)
            
            for line in lines:
                stripped = line.strip()
                if not stripped:
                    blank_lines += 1
                elif stripped.startswith('#') or stripped.startswith('//') or stripped.startswith('/*'):
                    comment_lines += 1
                else:
                    code_lines += 1
    except Exception:
        # If we can't read the file, use basic stats
        total_lines = len(xr_function_list) * 10  # Rough estimate
        code_lines = total_lines
    
    # Calculate function metrics from the XR list
    function_count = len(xr_function_list)
    max_complexity = 0
    total_complexity = 0
    total_parameters = 0
    max_parameters = 0
    
    for func_data in xr_function_list:
        if isinstance(func_data, dict):
            complexity = func_data.get('cyclomaticComplexity', 0)
            parameters = func_data.get('parameterCount', 0)
            
            max_complexity = max(max_complexity, complexity)
            total_complexity += complexity
            total_parameters += parameters
            max_parameters = max(max_parameters, parameters)
    
    # Create the expected format
    file_analysis = {
        "language": get_language_from_extension(file_path),
        "totalLines": total_lines,
        "codeLines": code_lines,
        "commentLines": comment_lines,
        "blankLines": blank_lines,
        "classCount": 0,  # XR coordinator doesn't track classes separately
        "functionCount": function_count,
        "functions": xr_function_list,
        "complexity": {
            "maxComplexity": max_complexity,
            "averageComplexity": total_complexity / function_count if function_count > 0 else 0.0
        }
    }
    
    return file_analysis

def create_xr_file_data(file_analysis, file_path, base_directory_path):
    """
    Create XR file data structure from detailed file analysis

    Args:
        file_analysis (dict): Detailed file analysis from coordinator
        file_path (str): Full path to the file
        base_directory_path (str): Base directory path for relative path calculation

    Returns:
        dict: XR file data structure
    """
    relative_path = os.path.relpath(file_path, base_directory_path)
    function_summary = summarize_function_metrics(file_analysis.get("functions", []))

    xr_data = {
        "fileName": os.path.basename(file_path),
        "filePath": file_path,
        "relativePath": relative_path,
        "language": file_analysis.get("language", get_language_from_extension(file_path)),
        "status": "success",
        "totalLines": file_analysis.get("totalLines", 0),
        "codeLines": file_analysis.get("codeLines", 0),
        "commentLines": file_analysis.get("commentLines", 0),
        "blankLines": file_analysis.get("blankLines", 0),
        "commentRatio": file_analysis.get("commentRatio", safe_ratio(file_analysis.get("commentLines", 0), file_analysis.get("totalLines", 0))),
        "codeRatio": file_analysis.get("codeRatio", safe_ratio(file_analysis.get("codeLines", 0), file_analysis.get("totalLines", 0))),
        "blankRatio": file_analysis.get("blankRatio", safe_ratio(file_analysis.get("blankLines", 0), file_analysis.get("totalLines", 0))),
        "classCount": file_analysis.get("classCount", 0),
        "functionCount": file_analysis.get("functionCount", 0),
        "maxComplexity": file_analysis.get("maxComplexity", 0),
        "cyclomaticComplexityNumber": file_analysis.get("cyclomaticComplexityNumber", 0.0),
        "cyclomaticComplexityDensity": file_analysis.get("cyclomaticComplexityDensity", 0.0),
        "highComplexityFunctions": file_analysis.get("highComplexityFunctions", function_summary.get("highComplexityFunctions", 0)),
        "criticalComplexityFunctions": file_analysis.get("criticalComplexityFunctions", function_summary.get("criticalComplexityFunctions", 0)),
        "averageFunctionParameters": file_analysis.get("averageFunctionParameters", 0.0),
        "maxFunctionParameters": file_analysis.get("maxFunctionParameters", 0),
        "averageFunctionLines": file_analysis.get("averageFunctionLines", function_summary.get("averageFunctionLines", 0.0)),
        "maxFunctionLines": file_analysis.get("maxFunctionLines", function_summary.get("maxFunctionLines", 0)),
        "averageFunctionNestingDepth": file_analysis.get("averageFunctionNestingDepth", function_summary.get("averageFunctionNestingDepth", 0.0)),
        "maxFunctionNestingDepth": file_analysis.get("maxFunctionNestingDepth", function_summary.get("maxFunctionNestingDepth", 0)),
        "fileSizeBytes": 0,
    }

    try:
        xr_data["fileSizeBytes"] = os.path.getsize(file_path)
    except Exception:
        xr_data["fileSizeBytes"] = 0

    return normalize_output_paths(xr_data)

def get_language_from_extension(file_path):
    """
    Determine programming language from file extension
    
    Args:
        file_path (str): Path to the file
        
    Returns:
        str: Programming language name
    """
    ext = os.path.splitext(file_path)[1].lower()
    
    language_map = {
        # Programming Languages - CodeXR Supported
        '.py': 'Python', '.pyw': 'Python', '.pyi': 'Python',
        '.rb': 'Ruby', '.rbw': 'Ruby',
        '.java': 'Java',
        '.c': 'C', '.h': 'C',
        '.cpp': 'C++', '.cxx': 'C++', '.cc': 'C++', '.hpp': 'C++', '.hxx': 'C++',
        '.cs': 'C#',
        '.erl': 'Erlang', '.hrl': 'Erlang',
        '.f90': 'Fortran', '.f95': 'Fortran', '.f03': 'Fortran', '.f08': 'Fortran', '.f': 'Fortran',
        '.gd': 'GDScript',
        '.go': 'Go',
        '.js': 'JavaScript', '.mjs': 'JavaScript', '.cjs': 'JavaScript',
        '.kt': 'Kotlin', '.kts': 'Kotlin',
        '.lua': 'Lua',
        '.m': 'Objective-C', '.mm': 'Objective-C',
        '.php': 'PHP', '.phtml': 'PHP', '.php3': 'PHP', '.php4': 'PHP', '.php5': 'PHP',
        '.pl': 'Perl', '.pm': 'Perl',
        '.scala': 'Scala', '.sc': 'Scala',
        '.sol': 'Solidity',
        '.swift': 'Swift',
        '.ts': 'TypeScript', '.tsx': 'TypeScript',
        '.ttcn': 'TTCN-3', '.ttcn3': 'TTCN-3',
        '.vue': 'Vue',
        '.zig': 'Zig',
        '.rs': 'Rust',
        '.dart': 'Dart',
        '.r': 'R',
        '.sh': 'Shell', '.bash': 'Shell',
        '.ps1': 'PowerShell',
        '.jsx': 'JavaScript',
        '.css': 'CSS', '.scss': 'CSS', '.less': 'CSS',
        '.clj': 'Clojure', '.cljs': 'Clojure',
        '.hs': 'Haskell',
        '.ml': 'OCaml', '.mli': 'OCaml',
        '.pas': 'Pascal'
    }
    
    return language_map.get(ext, 'Unknown')

def main(filtered_files=None):
    """Main entry point for XR directory analysis"""
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Usage: python xr_directory_analysis_coordinator.py <directory_path> [--deep]"}), file=sys.stderr)
        sys.exit(1)
    
    directory_path = sys.argv[1]
    is_deep = False
    
    # Parse remaining arguments
    for i in range(2, len(sys.argv)):
        arg = sys.argv[i]
        if arg == '--deep':
            is_deep = True
    
    print(json.dumps({"debug": f"XR_DIRECTORY_ANALYSIS: Starting with directory={directory_path}, deep={is_deep}, filtered_files={filtered_files is not None}"}), file=sys.stderr)
    
    # Validate directory exists (skip if using filtered files)
    if filtered_files is None and (not os.path.exists(directory_path) or not os.path.isdir(directory_path)):
        print(json.dumps({"error": f"Directory not found or not a directory: {directory_path}"}), file=sys.stderr)
        sys.exit(1)
    
    # Perform XR directory analysis
    files_array = analyze_directory_xr(directory_path, is_deep, filtered_files)
    
    # Output result as JSON array to stdout
    print(json.dumps(files_array, indent=2))

if __name__ == "__main__":
    main()












