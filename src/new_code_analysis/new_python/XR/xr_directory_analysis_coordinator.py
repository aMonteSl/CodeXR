#!/usr/bin/env python3
"""
XR Directory Analysis Coordinator (New Engine Version)

This script coordinates directory-level analysis to generate file data for XR visu    try:
        # Use the livePanel file analysis coordinator with resume_only=True to get file metrics
        coordinator_path = script_dir.parent / "livePanels" / "livePanel_file_analysis_coordinator.py"zation.
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

def normalize_path_for_babia(path_str):
    """
    Normalize file paths to use Unix-style forward slashes.
    This is required for BabiaXR neighborhoods organization which doesn't handle
    Windows backslashes properly and for cross-platform compatibility.
    
    Args:
        path_str (str): Path string potentially with backslashes (Windows)
        
    Returns:
        str: Path with forward slashes (Unix-style)
    """
    if not path_str:
        return path_str
    
    # Replace backslashes with forward slashes (Windows paths → Unix-style)
    normalized = path_str.replace('\\', '/')
    
    # Handle double slashes that might occur during conversion
    while '//' in normalized:
        normalized = normalized.replace('//', '/')
    
    return normalized

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
        # Use filtered files if provided, otherwise scan directory for analyzable files
        if filtered_files is not None:
            print(json.dumps({"debug": f"XR_DIRECTORY_ANALYSIS: Using filtered file list with {len(filtered_files)} files"}), file=sys.stderr)
            files_to_analyze = filtered_files
        else:
            # Scan directory for analyzable files
            print(json.dumps({"debug": f"XR_DIRECTORY_ANALYSIS: Scanning directory {directory_path}"}), file=sys.stderr)
            if is_deep:
                files_to_analyze = scan_directory_files_xr_deep(directory_path)
                print(json.dumps({"debug": f"XR_DIRECTORY_ANALYSIS: Deep scan found {len(files_to_analyze)} files to analyze"}), file=sys.stderr)
            else:
                files_to_analyze = scan_directory_files_xr(directory_path)
                print(json.dumps({"debug": f"XR_DIRECTORY_ANALYSIS: Regular scan found {len(files_to_analyze)} files to analyze"}), file=sys.stderr)
        
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
        
        return files_array
        
    except Exception as e:
        print(json.dumps({"debug": f"XR_DIRECTORY_ANALYSIS: Critical error: {str(e)}"}), file=sys.stderr)
        return []

def scan_directory_files_xr(directory_path):
    """
    Scan directory for analyzable files (first level only for XR)
    
    Args:
        directory_path (str): Path to directory to scan
        
    Returns:
        list: List of file paths to analyze
    """
    analyzable_files = []
    analyzable_extensions = get_analyzable_extensions()
    
    try:
        entries = os.listdir(directory_path)
        
        # Limit the number of files to process for performance
        if len(entries) > 1000:
            print(json.dumps({"debug": f"XR_DIRECTORY_ANALYSIS: Large directory detected ({len(entries)} entries), limiting to first 1000 for performance"}), file=sys.stderr)
            entries = entries[:1000]
        
        for entry in entries:
            # Skip hidden files and directories
            if entry.startswith('.'):
                continue
                
            full_path = os.path.join(directory_path, entry)
            
            # Only process files (not subdirectories for XR first-level analysis)
            if os.path.isfile(full_path):
                # Check if file has analyzable extension
                file_ext = os.path.splitext(entry)[1].lower()
                if file_ext in analyzable_extensions:
                    analyzable_files.append(full_path)
    
    except Exception as e:
        print(json.dumps({"debug": f"XR_DIRECTORY_ANALYSIS: Error scanning directory: {str(e)}"}), file=sys.stderr)
    
    print(json.dumps({"debug": f"XR_DIRECTORY_ANALYSIS: Found {len(analyzable_files)} analyzable files in directory"}), file=sys.stderr)
    return sorted(analyzable_files)

def scan_directory_files_xr_deep(directory_path):
    """
    Recursively scan directory and all subdirectories for analyzable files (XR Deep)
    
    Args:
        directory_path (str): Path to directory to scan
        
    Returns:
        list: List of file paths to analyze from all subdirectories
    """
    analyzable_files = []
    analyzable_extensions = get_analyzable_extensions()
    
    # Directories to skip for better performance on large projects
    skip_dirs = {
        'node_modules', '.git', '.svn', '.hg', '.bzr', 
        'build', 'dist', 'out', 'target', 'bin', 'obj',
        '.vscode', '.idea', '.eclipse', '.settings',
        '__pycache__', '.pytest_cache', '.mypy_cache',
        'coverage', '.coverage', '.nyc_output',
        'temp', 'tmp', '.tmp', 'logs', 'log'
    }
    
    try:
        # Use os.walk for recursive directory traversal
        for root, dirs, files in os.walk(directory_path):
            # Filter out directories we should skip in-place to avoid traversing them
            dirs[:] = [d for d in dirs if d not in skip_dirs and not d.startswith('.')]
            
            # Limit the number of files per directory to prevent overwhelming performance
            if len(files) > 1000:
                print(json.dumps({"debug": f"XR_DIRECTORY_ANALYSIS: Large directory detected ({len(files)} files) in {root}, limiting to first 1000 files"}), file=sys.stderr)
                files = files[:1000]
            
            for file in files:
                # Skip hidden files
                if file.startswith('.'):
                    continue
                    
                full_path = os.path.join(root, file)
                
                # Check if file has analyzable extension
                file_ext = os.path.splitext(file)[1].lower()
                if file_ext in analyzable_extensions:
                    analyzable_files.append(full_path)
                    
                # Limit total files to prevent memory issues with extremely large projects
                if len(analyzable_files) > 5000:
                    print(json.dumps({"debug": f"XR_DIRECTORY_ANALYSIS: Reached maximum file limit (5000) for performance, stopping scan"}), file=sys.stderr)
                    break
            
            # Break outer loop if we hit the limit
            if len(analyzable_files) > 5000:
                break
    
    except Exception as e:
        print(json.dumps({"debug": f"XR_DIRECTORY_ANALYSIS: Error scanning directory recursively: {str(e)}"}), file=sys.stderr)
    
    print(json.dumps({"debug": f"XR_DIRECTORY_ANALYSIS: Found {len(analyzable_files)} analyzable files in deep scan"}), file=sys.stderr)
    return sorted(analyzable_files)

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
    # Calculate relative path
    relative_path = os.path.relpath(file_path, base_directory_path)
    
    # Normalize paths for BabiaXR (convert Windows backslashes to forward slashes)
    # This is critical for neighborhoods organization in BabiaXR
    normalized_file_path = normalize_path_for_babia(file_path)
    normalized_relative_path = normalize_path_for_babia(relative_path)
    
    # Basic file information
    xr_data = {
        "fileName": os.path.basename(file_path),
        "filePath": normalized_file_path,
        "relativePath": normalized_relative_path,
        "language": file_analysis.get("language", get_language_from_extension(file_path)),
        "status": "success",
        
        # Line metrics (direct from LivePanel - corrected paths)
        "totalLines": file_analysis.get("totalLines", 0),
        "codeLines": file_analysis.get("codeLines", 0),
        "commentLines": file_analysis.get("commentLines", 0),
        "blankLines": file_analysis.get("blankLines", 0),
        
        # Structure metrics (direct from LivePanel)
        "classCount": file_analysis.get("classCount", 0),
        "functionCount": file_analysis.get("functionCount", 0),
        
        # Complexity metrics (from complexity sub-object)
        "maxComplexity": 0,
        "cyclomaticComplexityNumber": 0.0,
        "cyclomaticComplexityDensity": 0.0,
        
        # Function parameter metrics (calculated from functions array)
        "averageFunctionParameters": 0.0,
        "maxFunctionParameters": 0,
        
        # File size
        "fileSizeBytes": 0
    }
    
    # Calculate file size
    try:
        xr_data["fileSizeBytes"] = os.path.getsize(file_path)
    except:
        xr_data["fileSizeBytes"] = 0
    
    # Extract complexity metrics from the file analysis data
    # (livePanel coordinator in resume mode returns these directly)
    xr_data["maxComplexity"] = file_analysis.get("maxComplexity", 0)
    xr_data["cyclomaticComplexityNumber"] = file_analysis.get("cyclomaticComplexityNumber", 0.0)
    xr_data["cyclomaticComplexityDensity"] = file_analysis.get("cyclomaticComplexityDensity", 0.0)
    xr_data["averageFunctionParameters"] = file_analysis.get("averageFunctionParameters", 0.0)
    xr_data["maxFunctionParameters"] = file_analysis.get("maxFunctionParameters", 0)
    
    return xr_data

def get_analyzable_extensions():
    """
    Get list of file extensions that can be analyzed by Lizard
    (Excluding HTML as per recent requirements)
    
    Returns:
        list: List of file extensions
    """
    return [
        # Programming Languages - CodeXR Supported by Lizard
        '.py', '.pyw', '.pyi',  # Python
        '.rb', '.rbw',  # Ruby
        '.java',  # Java
        '.c', '.h',  # C
        '.cpp', '.cxx', '.cc', '.hpp', '.hxx',  # C++
        '.cs',  # C#
        '.erl', '.hrl',  # Erlang
        '.f90', '.f95', '.f03', '.f08', '.f',  # Fortran
        '.gd',  # GDScript
        '.go',  # Go
        '.js', '.mjs', '.cjs',  # JavaScript
        '.kt', '.kts',  # Kotlin
        '.lua',  # Lua
        '.m', '.mm',  # Objective-C
        '.php', '.phtml', '.php3', '.php4', '.php5',  # PHP
        '.pl', '.pm',  # Perl
        '.scala', '.sc',  # Scala
        '.sol',  # Solidity
        '.swift',  # Swift
        '.ts', '.tsx',  # TypeScript
        '.ttcn', '.ttcn3',  # TTCN-3
        '.vue',  # Vue
        '.zig',  # Zig
        # Additional commonly analyzed languages
        '.rs',  # Rust
        '.dart',  # Dart
        '.r',  # R
        '.sh', '.bash',  # Shell
        '.ps1',  # PowerShell
        '.jsx',  # JavaScript (JSX)
        '.css', '.scss', '.less',  # CSS and preprocessors
        '.clj', '.cljs',  # Clojure
        '.hs',  # Haskell
        '.ml', '.mli',  # OCaml
        '.pas'  # Pascal
        # NOTE: .html files are excluded from directory analysis (like LivePanel)
        # HTML files should only be analyzed individually for DOM visualization
    ]

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
